// Hộp thư góp ý: một Durable Object duy nhất cho cả web (cùng kiểu "trọng tài" với phòng chơi), giữ mọi góp ý trong một
// cơ sở dữ liệu SQLite nhỏ của riêng nó, lưu bền trên Cloudflare (gói miễn phí). Worker (worker/index.ts) đã kiểm tra
// nội dung góp ý và chìa khoá của chủ web trước khi gọi tới đây; file này chỉ lo lưu, đếm lượt gửi và đọc ra.
//
// Không lưu địa chỉ mạng của người gửi: worker chỉ đưa một dãy mã hoá một chiều (`who`) để đếm lượt gửi mỗi giờ,
// và dấu lượt gửi tự xoá sau một ngày.
//
// Hộp thư cũng giữ cài đặt báo góp ý mới về mail (src/feedback/mail.ts): bật hay tắt, mail nhận, chìa Resend, và số
// thư đã gửi hôm nay. Chìa Resend chỉ đưa cho worker lúc gửi thư, trang Hộp thư chỉ thấy 4 ký tự cuối.
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
import { MAIL_PER_DAY, mailDay, type MailProblem, type MailSave, type MailSettings } from '../src/feedback/mail'
import type { Env } from './room-server'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

type Row = { id: number; at: number; kind: string; text: string; contact: string; context: string | null; status: string }

// Cài đặt báo mail lưu trong máy chủ. `day`, `sent`: ngày (giờ Việt Nam) và số thư đã gửi ngày đó.
type MailState = { on: boolean; email: string; key: string | null; day: string; sent: number; lastSentAt: number | null; problem: MailProblem | null }
const NO_MAIL: MailState = { on: false, email: '', key: null, day: '', sent: 0, lastSentAt: null, problem: null }

// Chìa và mail để worker gửi một thư. `last`: thư cuối cùng được gửi hôm nay.
export type MailTicket = { key: string; email: string; last: boolean }

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
    // Cài đặt của hộp thư (hiện chỉ có báo mail), mỗi dòng một mục dạng JSON.
    this.sql.exec('CREATE TABLE IF NOT EXISTS settings (name TEXT PRIMARY KEY, value TEXT NOT NULL)')
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

  // ---------- Báo góp ý mới về mail ----------
  private mail(): MailState {
    const row = this.sql.exec<{ value: string }>("SELECT value FROM settings WHERE name = 'mail'").toArray()[0]
    try {
      return row ? { ...NO_MAIL, ...(JSON.parse(row.value) as Partial<MailState>) } : { ...NO_MAIL }
    } catch {
      return { ...NO_MAIL }
    }
  }

  private storeMail(state: MailState): void {
    this.sql.exec("INSERT INTO settings (name, value) VALUES ('mail', ?) ON CONFLICT (name) DO UPDATE SET value = excluded.value", JSON.stringify(state))
  }

  private mailView(state: MailState, now: number): MailSettings {
    return {
      on: state.on,
      email: state.email,
      keyHint: state.key ? state.key.slice(-4) : null,
      sentToday: state.day === mailDay(now) ? state.sent : 0,
      lastSentAt: state.lastSentAt,
      problem: state.problem,
    }
  }

  async mailSettings(now: number): Promise<MailSettings> {
    return this.mailView(this.mail(), now)
  }

  // Lưu cài đặt báo mail. Bật mà chưa có chìa Resend hay chưa có mail nhận thì không lưu.
  async saveMail(save: MailSave, now: number): Promise<MailSettings | 'nokey' | 'noemail'> {
    const state = this.mail()
    const key = save.key ?? state.key
    if (save.on && !key) return 'nokey'
    if (save.on && !save.email) return 'noemail'
    // Đổi chìa hay đổi mail thì lỗi cũ không còn đúng nữa.
    const problem = key === state.key && save.email === state.email ? state.problem : null
    const next: MailState = { ...state, on: save.on, email: save.email, key, problem }
    this.storeMail(next)
    return this.mailView(next, now)
  }

  // Lấy lượt gửi một thư báo góp ý mới (tính vào hạn mức mỗi ngày). null: đang tắt, thiếu cài đặt hay hôm nay đã đủ thư.
  async takeMail(now: number): Promise<MailTicket | null> {
    const state = this.mail()
    if (!state.on || !state.key || !state.email) return null
    const day = mailDay(now)
    const sent = state.day === day ? state.sent : 0
    if (sent >= MAIL_PER_DAY) return null
    this.storeMail({ ...state, day, sent: sent + 1 })
    return { key: state.key, email: state.email, last: sent + 1 === MAIL_PER_DAY }
  }

  // Chìa và mail để gửi thư thử: chạy cả khi đang tắt, không tính vào hạn mức mỗi ngày.
  async mailTarget(): Promise<{ key: string; email: string } | null> {
    const { key, email } = this.mail()
    return key && email ? { key, email } : null
  }

  // Ghi kết quả lần gửi thư gần nhất, để trang Hộp thư báo nếu có lỗi.
  async mailDone(problem: MailProblem | null, now: number): Promise<void> {
    const state = this.mail()
    this.storeMail({ ...state, problem, lastSentAt: problem ? state.lastSentAt : now })
  }
}
