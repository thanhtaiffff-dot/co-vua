// Góp ý người chơi gửi cho người làm web: loại góp ý, nội dung, tên hay cách liên lạc (không bắt buộc), và thông tin
// ván, máy do web tự gửi kèm. File này dùng chung cho máy chủ (worker/feedback-box.ts) và máy người chơi, nên mọi giới
// hạn và cách kiểm tra chỉ viết một lần ở đây. Máy chủ đưa mỗi góp ý thành một Issue trên GitHub (xem issue.ts).

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

// Thông tin web tự gửi kèm (người gửi tắt được). Toàn chữ ngắn để Issue hiện thẳng ra.
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

// Máy chủ trả lời khi nhận góp ý: ok, hay vì sao không nhận.
//   slow: máy này vừa gửi nhiều quá; busy: cả web hôm nay nhận đủ rồi; full: GitHub trục trặc lâu, hàng chờ đã đầy.
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
// hàng chờ (góp ý chưa đưa lên GitHub được) giữ tối đa QUEUE_MAX góp ý. Người thật không bao giờ chạm tới.
export const PER_HOUR = 5
export const PER_DAY = 200
export const QUEUE_MAX = 1000

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

// Thông tin gửi kèm viết thành từng dòng (tên, nội dung), bỏ dòng trống: cho form và Issue.
export function contextLines(context: FeedbackContext): [string, string][] {
  const moves = context.game ? context.game.split(' ').length : 0
  const lines: [string, string | undefined][] = [
    ['Trang', context.page],
    ['Ván', [moves ? `${moves} nước đã đi` : '', context.state ?? ''].filter(Boolean).join(' · ')],
    ['Máy', context.device],
    ['Cài đặt', context.settings],
    ['Bản web', context.version],
  ]
  return lines.filter((line): line is [string, string] => !!line[1])
}
