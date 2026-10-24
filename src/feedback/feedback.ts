// Góp ý người chơi gửi cho người làm web: loại góp ý, nội dung, tên hay cách liên lạc (không bắt buộc), và thông tin
// ván, máy do web tự gửi kèm. File này dùng chung cho máy chủ (worker/feedback-box.ts), máy người chơi và hộp thư giả
// của bản chơi thử, nên mọi giới hạn và cách kiểm tra chỉ viết một lần ở đây.

// Tên người làm web, hiện trong form ("Gửi thẳng tới Tài").
export const OWNER_NAME = 'Tài'

export const FEEDBACK_KINDS = ['bug', 'idea', 'praise', 'other'] as const
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]

// Tên, hình và chữ gợi ý trong ô nội dung của từng loại góp ý.
export const KIND_INFO: Record<FeedbackKind, { name: string; icon: string; hint: string }> = {
  bug: { name: 'Báo lỗi', icon: '🐞', hint: 'Bạn đang làm gì thì gặp lỗi? Ví dụ: bấm Đấu ván nữa mà bên kia không thấy gì.' },
  idea: { name: 'Ý tưởng', icon: '💡', hint: 'Bạn muốn web có thêm gì? Ví dụ: chơi với máy, thêm bộ quân mới…' },
  praise: { name: 'Khen', icon: '❤️', hint: 'Bạn thích gì nhất ở web này?' },
  other: { name: 'Khác', icon: '💬', hint: `Bạn muốn nói gì với ${OWNER_NAME}?` },
}

// Thông tin web tự gửi kèm (người gửi tắt được). Toàn chữ ngắn để hộp thư hiện thẳng ra.
export type FeedbackContext = {
  page: string // trang đang mở: "Chơi một máy", "Phòng online x7k2m9ab"…
  game?: string // các nước đã đi, viết kiểu "e4 e5 Nf3" (cách nhau dấu cách)
  side?: 'white' | 'black' // bàn cờ quay về phía nào, để mở lại ván trên lichess đúng chiều
  state?: string // tình hình ván: "Tới lượt Đen", "Trắng thắng: chiếu bí", "Bạn cầm Đen, ván 2"…
  device: string // "Điện thoại Android · Samsung Internet 27 · màn 384×832"
  settings: string // chủ đề, bộ tiếng, cỡ bàn cờ
  version: string // bản web đang chạy
}

export type FeedbackInput = { kind: FeedbackKind; text: string; contact: string; context: FeedbackContext | null }

// new: chưa mở hộp thư lần nào từ lúc nhận; seen: đã thấy; done: đã xử lý xong.
export type FeedbackStatus = 'new' | 'seen' | 'done'
export type FeedbackItem = FeedbackInput & { id: number; at: number; status: FeedbackStatus }

// Hộp thư hỏi: lọc theo loại, chỉ góp ý chưa xử lý, và trang tiếp theo (góp ý có số nhỏ hơn `before`).
export type FeedbackQuery = { kind?: FeedbackKind; open?: boolean; before?: number }
// Số góp ý cả hộp: tất cả, mới, chưa xử lý, và theo từng loại.
export type FeedbackCounts = { all: number; new: number; open: number } & Record<FeedbackKind, number>
export type FeedbackPage = { items: FeedbackItem[]; more: boolean; counts: FeedbackCounts }

// Máy chủ trả lời khi nhận góp ý: ok, hay vì sao không nhận.
//   slow: máy này vừa gửi nhiều quá; busy: cả web hôm nay nhận đủ rồi; full: hộp đầy, chờ chủ web xoá bớt.
export type SubmitResult = 'ok' | 'slow' | 'busy' | 'full'

export const TEXT_MAX = 1000
export const CONTACT_MAX = 80
// Thư gửi lên dài nhất máy chủ chịu đọc (góp ý dài nhất kèm ván 300 nước chưa tới mức này).
export const BODY_MAX = 8000
const CONTEXT_MAX: Record<Exclude<keyof FeedbackContext, 'side'>, number> = {
  page: 80,
  game: 3000,
  state: 200,
  device: 300,
  settings: 300,
  version: 60,
}

// Chống gửi dồn: mỗi máy (theo địa chỉ mạng) tối đa PER_HOUR góp ý mỗi giờ, cả web tối đa PER_DAY góp ý mỗi ngày,
// hộp giữ tối đa KEEP góp ý (đầy thì chờ chủ web xoá bớt). Người thật không bao giờ chạm tới.
export const PER_HOUR = 5
export const PER_DAY = 200
export const KEEP = 1000
// Mỗi lần hộp thư tải bấy nhiêu góp ý; muốn xem cũ hơn thì bấm "Xem thêm".
export const PAGE_SIZE = 20

// Ký tự điều khiển (trừ xuống dòng), ký tự đảo chiều chữ (dùng để giả mạo link, tên file) và ký tự vô hình.
// oxlint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F​-‏‪-‮⁠-⁯﻿]/g

// Làm sạch một ô chữ: bỏ ký tự lạ, gộp khoảng trắng; `multiline` thì giữ xuống dòng (tối đa một dòng trống liền nhau).
export function cleanText(raw: string, multiline: boolean): string {
  let text = raw.normalize('NFC').replace(/\r\n?/g, '\n').replace(/\t/g, ' ').replace(CONTROL, '')
  if (multiline) {
    text = text
      .split('\n')
      .map((line) => line.replace(/ {2,}/g, ' ').trimEnd())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
  } else {
    text = text.replace(/\s+/g, ' ')
  }
  return text.trim()
}

function isKind(value: unknown): value is FeedbackKind {
  return FEEDBACK_KINDS.some((kind) => kind === value)
}

// Thông tin gửi kèm do web tự viết, nên ô nào sai thì bỏ ô đó, dài quá thì cắt bớt, thay vì từ chối cả góp ý.
function parseContext(raw: unknown): FeedbackContext | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const data = raw as Record<string, unknown>
  const field = (key: keyof typeof CONTEXT_MAX): string => {
    const value = data[key]
    return typeof value === 'string' ? cleanText(value, false).slice(0, CONTEXT_MAX[key]) : ''
  }
  const context: FeedbackContext = { page: field('page'), device: field('device'), settings: field('settings'), version: field('version') }
  const game = field('game')
  const state = field('state')
  if (game) context.game = game
  if (state) context.state = state
  if (data.side === 'white' || data.side === 'black') context.side = data.side
  return context
}

// Đọc một góp ý máy người chơi gửi lên. Trả về null nếu thiếu hay sai; 'trap' nếu ô bẫy (ô ẩn người thật không thấy,
// chỉ máy dò tự động mới điền) có chữ: máy chủ giả vờ nhận rồi bỏ.
export function parseFeedback(body: unknown): FeedbackInput | 'trap' | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null
  const data = body as Record<string, unknown>
  if (typeof data.website === 'string' && data.website.trim() !== '') return 'trap'
  if (!isKind(data.kind) || typeof data.text !== 'string') return null
  const text = cleanText(data.text, true)
  if (text.replace(/\s/g, '').length < 2 || text.length > TEXT_MAX) return null
  const contact = typeof data.contact === 'string' ? cleanText(data.contact, false) : ''
  if (contact.length > CONTACT_MAX) return null
  return { kind: data.kind, text, contact, context: parseContext(data.context) }
}

// Đọc yêu cầu lọc của hộp thư (từ địa chỉ /api/feedback?kind=bug&open=1&before=120).
export function parseQuery(params: URLSearchParams): FeedbackQuery {
  const query: FeedbackQuery = {}
  const kind = params.get('kind')
  if (isKind(kind)) query.kind = kind
  if (params.get('open') === '1') query.open = true
  const before = Number(params.get('before'))
  if (Number.isSafeInteger(before) && before > 0) query.before = before
  return query
}

export function emptyCounts(): FeedbackCounts {
  return { all: 0, new: 0, open: 0, bug: 0, idea: 0, praise: 0, other: 0 }
}

// Cộng số góp ý theo từng loại và trạng thái (mỗi dòng: loại, trạng thái, bao nhiêu góp ý).
export function countFeedback(rows: { kind: string; status: string; n: number }[]): FeedbackCounts {
  const counts = emptyCounts()
  for (const { kind, status, n } of rows) {
    counts.all += n
    if (status === 'new') counts.new += n
    if (status !== 'done') counts.open += n
    if (isKind(kind)) counts[kind] += n
  }
  return counts
}
