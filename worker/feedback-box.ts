// Hộp thư góp ý: một Durable Object duy nhất cho cả web (cùng kiểu "trọng tài" với phòng chơi), giữ mọi góp ý trong một
// cơ sở dữ liệu SQLite nhỏ của riêng nó, lưu bền trên Cloudflare (gói miễn phí). Worker (worker/index.ts) đã kiểm tra
// nội dung góp ý và chìa khoá của chủ web trước khi gọi tới đây; file này chỉ lo lưu, đếm lượt gửi và đọc ra.
//
// Không lưu địa chỉ mạng của người gửi: worker chỉ đưa một dãy mã hoá một chiều (`who`) để đếm lượt gửi mỗi giờ,
// và dấu lượt gửi tự xoá sau một ngày.
import { DurableObject } from 'cloudflare:workers'
import {
  countFeedback,
  FEEDBACK_KINDS,
  KEEP,
  PAGE_SIZE,
  PER_DAY,
  PER_HOUR,
  type FeedbackContext,
  type FeedbackInput,
  type FeedbackItem,
  type FeedbackPage,
  type FeedbackQuery,
  type FeedbackStatus,
  type SubmitResult,
} from '../src/feedback/feedback'
import type { Env } from './room-server'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

type Row = { id: number; at: number; kind: string; text: string; contact: string; context: string | null; status: string }

function toItem(row: Row): FeedbackItem {
  let context: FeedbackContext | null = null
  try {
    context = row.context ? (JSON.parse(row.context) as FeedbackContext) : null
  } catch {
    // Dòng hỏng thì thôi, vẫn hiện nội dung góp ý.
  }
  return {
    id: row.id,
    at: row.at,
    kind: FEEDBACK_KINDS.find((kind) => kind === row.kind) ?? 'other',
    text: row.text,
    contact: row.contact,
    context,
    status: row.status === 'seen' || row.status === 'done' ? row.status : 'new',
  }
}

export class FeedbackBox extends DurableObject<Env> {
  private sql: SqlStorage

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.sql = ctx.storage.sql
    // Bảng góp ý, và bảng dấu lượt gửi (ai, lúc nào) để chống gửi dồn.
    this.sql.exec(`CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at INTEGER NOT NULL,
      kind TEXT NOT NULL,
      text TEXT NOT NULL,
      contact TEXT NOT NULL,
      context TEXT,
      status TEXT NOT NULL DEFAULT 'new'
    )`)
    this.sql.exec('CREATE TABLE IF NOT EXISTS hits (who TEXT NOT NULL, at INTEGER NOT NULL)')
    this.sql.exec('CREATE INDEX IF NOT EXISTS hits_by_who ON hits (who, at)')
  }

  private count(query: string, ...bindings: (string | number)[]): number {
    return this.sql.exec<{ n: number }>(query, ...bindings).one().n
  }

  // Nhận một góp ý đã kiểm tra. `who`: mã hoá một chiều địa chỉ mạng người gửi, chỉ để đếm lượt.
  async submit(input: FeedbackInput, who: string, now: number): Promise<SubmitResult> {
    this.sql.exec('DELETE FROM hits WHERE at <= ?', now - DAY)
    if (this.count('SELECT COUNT(*) AS n FROM hits WHERE who = ? AND at > ?', who, now - HOUR) >= PER_HOUR) return 'slow'
    if (this.count('SELECT COUNT(*) AS n FROM hits') >= PER_DAY) return 'busy'
    if (this.count('SELECT COUNT(*) AS n FROM feedback') >= KEEP) return 'full'
    this.sql.exec('INSERT INTO hits (who, at) VALUES (?, ?)', who, now)
    this.sql.exec(
      'INSERT INTO feedback (at, kind, text, contact, context) VALUES (?, ?, ?, ?, ?)',
      now,
      input.kind,
      input.text,
      input.contact,
      input.context ? JSON.stringify(input.context) : null,
    )
    return 'ok'
  }

  // Một trang góp ý, mới nhất trước, kèm số góp ý cả hộp.
  async list(query: FeedbackQuery): Promise<FeedbackPage> {
    const where: string[] = []
    const bindings: (string | number)[] = []
    if (query.kind) {
      where.push('kind = ?')
      bindings.push(query.kind)
    }
    if (query.open) where.push("status != 'done'")
    if (query.before) {
      where.push('id < ?')
      bindings.push(query.before)
    }
    const filter = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const rows = this.sql.exec<Row>(`SELECT * FROM feedback ${filter} ORDER BY id DESC LIMIT ?`, ...bindings, PAGE_SIZE + 1).toArray()
    const groups = this.sql.exec<{ kind: string; status: string; n: number }>('SELECT kind, status, COUNT(*) AS n FROM feedback GROUP BY kind, status').toArray()
    return { items: rows.slice(0, PAGE_SIZE).map(toItem), more: rows.length > PAGE_SIZE, counts: countFeedback(groups) }
  }

  // Số góp ý mới (chấm đỏ trên nút Góp ý của chủ web).
  async unread(): Promise<number> {
    return this.count("SELECT COUNT(*) AS n FROM feedback WHERE status = 'new'")
  }

  // Chủ web đã mở hộp thư và thấy các góp ý này (tối đa một trang).
  async markSeen(ids: number[]): Promise<void> {
    for (const id of ids.slice(0, PAGE_SIZE)) this.sql.exec("UPDATE feedback SET status = 'seen' WHERE status = 'new' AND id = ?", id)
  }

  async setStatus(id: number, status: Exclude<FeedbackStatus, 'new'>): Promise<boolean> {
    return this.sql.exec('UPDATE feedback SET status = ? WHERE id = ?', status, id).rowsWritten > 0
  }

  async remove(id: number): Promise<boolean> {
    return this.sql.exec('DELETE FROM feedback WHERE id = ?', id).rowsWritten > 0
  }
}
