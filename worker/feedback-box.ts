// Hàng chờ góp ý: một Durable Object duy nhất cho cả web (cùng kiểu "trọng tài" với phòng chơi). Nhận góp ý đã kiểm tra
// từ worker (worker/index.ts), đếm lượt gửi để chống gửi dồn, rồi đưa từng góp ý thành một Issue trên GitHub
// (src/feedback/issue.ts). Đưa lên được thì xoá khỏi hàng chờ. GitHub trục trặc, chưa dán token hay token hết hạn thì
// góp ý nằm chờ trong cơ sở dữ liệu SQLite nhỏ của Durable Object, cứ mỗi giờ thử lại, nên không mất góp ý nào.
//
// Không lưu địa chỉ mạng của người gửi: worker chỉ đưa một dãy mã hoá một chiều (`who`) để đếm lượt gửi mỗi giờ,
// và dấu lượt gửi tự xoá sau một ngày.
import { DurableObject } from 'cloudflare:workers'
import { FEEDBACK_KINDS, PER_DAY, PER_HOUR, QUEUE_MAX, type FeedbackContext, type FeedbackInput, type SubmitResult } from '../src/feedback/feedback'
import { createIssue, feedbackIssue, GITHUB_API } from '../src/feedback/issue'
import type { Env } from './room-server'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
// Mỗi lần đưa lên GitHub tối đa bấy nhiêu góp ý (GitHub không thích bị tạo Issue dồn dập).
const BATCH = 10

type Row = { id: number; at: number; kind: string; text: string; contact: string; context: string | null }

function toInput(row: Row): FeedbackInput {
  let context: FeedbackContext | null = null
  try {
    context = row.context ? (JSON.parse(row.context) as FeedbackContext) : null
  } catch {
    // Dòng hỏng thì thôi, vẫn gửi nội dung góp ý.
  }
  return { kind: FEEDBACK_KINDS.find((kind) => kind === row.kind) ?? 'other', text: row.text, contact: row.contact, context }
}

export class FeedbackBox extends DurableObject<Env> {
  private sql: SqlStorage
  private flushing: Promise<void> | null = null

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.sql = ctx.storage.sql
    // Bảng góp ý chờ đưa lên GitHub (cột status là của hộp thư cũ, không dùng nữa), và bảng dấu lượt gửi (ai, lúc nào).
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
    // Bảng cài đặt báo mail cũ (có chìa Resend): bỏ hẳn.
    this.sql.exec('DROP TABLE IF EXISTS settings')
  }

  private count(query: string, ...bindings: (string | number)[]): number {
    return this.sql.exec<{ n: number }>(query, ...bindings).one().n
  }

  // Nhận một góp ý đã kiểm tra. `who`: mã hoá một chiều địa chỉ mạng người gửi, chỉ để đếm lượt.
  async submit(input: FeedbackInput, who: string, now: number): Promise<SubmitResult> {
    this.sql.exec('DELETE FROM hits WHERE at <= ?', now - DAY)
    if (this.count('SELECT COUNT(*) AS n FROM hits WHERE who = ? AND at > ?', who, now - HOUR) >= PER_HOUR) return 'slow'
    if (this.count('SELECT COUNT(*) AS n FROM hits') >= PER_DAY) return 'busy'
    if (this.count('SELECT COUNT(*) AS n FROM feedback') >= QUEUE_MAX) return 'full'
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

  // Đưa các góp ý đang chờ lên GitHub, cũ trước. Đang đưa thì không đưa chồng (khỏi tạo Issue hai lần).
  async flush(): Promise<void> {
    this.flushing ??= this.send().finally(() => {
      this.flushing = null
    })
    return this.flushing
  }

  private async send(): Promise<void> {
    const { GITHUB_TOKEN: token, GITHUB_REPO: repo, GITHUB_API: api = GITHUB_API } = this.env
    // Lấy từng góp ý một (cũ trước), nên góp ý mới tới giữa chừng cũng được đưa lên luôn trong lượt này.
    for (let sent = 0; sent < BATCH; sent++) {
      const row = this.sql.exec<Row>('SELECT id, at, kind, text, contact, context FROM feedback ORDER BY id LIMIT 1').toArray()[0]
      if (!row) return
      const result = token && repo ? await createIssue(token, repo, feedbackIssue(toInput(row), row.at), api) : 'token'
      if (result !== 'ok') {
        // Chưa có token, token hỏng hay GitHub trục trặc: giữ lại, một giờ nữa thử tiếp.
        await this.ctx.storage.setAlarm(Date.now() + HOUR)
        return
      }
      this.sql.exec('DELETE FROM feedback WHERE id = ?', row.id)
    }
    // Còn góp ý chờ (quá một lượt) thì lát nữa đưa tiếp.
    if (this.count('SELECT COUNT(*) AS n FROM feedback') > 0) await this.ctx.storage.setAlarm(Date.now() + 60 * 1000)
  }

  async alarm(): Promise<void> {
    await this.flush()
  }
}
