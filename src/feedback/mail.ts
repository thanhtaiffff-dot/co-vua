// Báo góp ý mới về mail của chủ web, qua Resend (dịch vụ gửi mail cho web, gói miễn phí 100 thư mỗi ngày). Web chưa có
// tên miền riêng nên thư gửi từ địa chỉ thử onboarding@resend.dev, và Resend chỉ cho gửi tới đúng mail của chủ tài
// khoản Resend: vừa đủ để báo tin cho chủ web. Chìa Resend và mail nhận thư do chủ web dán ở trang Hộp thư, máy chủ
// giữ (không nằm trong code công khai, không bao giờ gửi cả chìa ra ngoài). File này dùng chung cho máy chủ, trang Hộp
// thư và bản chơi thử.
import { cleanText, contextLines, KIND_INFO, type FeedbackInput } from './feedback'

// Mỗi ngày (theo giờ Việt Nam) gửi tối đa bấy nhiêu thư: web bạn bè không chạm tới, lỡ bị phá thì Gmail không bị ngập.
export const MAIL_PER_DAY = 20
export const EMAIL_MAX = 120

// Vì sao không gửi được thư: chìa Resend sai hay bị khoá (key), mail nhận không phải mail của tài khoản Resend
// (address), Resend báo hết lượt (limit), Resend trục trặc (service), máy chủ không gọi được Resend (network).
export type MailProblem = 'key' | 'address' | 'limit' | 'service' | 'network'

// Trang Hộp thư thấy gì: bật hay tắt, mail nhận, 4 ký tự cuối của chìa, hôm nay đã gửi mấy thư, lần gửi được gần nhất
// và lỗi của lần gửi gần nhất.
export type MailSettings = {
  on: boolean
  email: string
  keyHint: string | null
  sentToday: number
  lastSentAt: number | null
  problem: MailProblem | null
}

// Chủ web lưu cài đặt; không kèm `key` là giữ chìa cũ.
export type MailSave = { on: boolean; email: string; key?: string }

export function isEmail(text: string): boolean {
  return text.length <= EMAIL_MAX && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)
}

// Chìa Resend có dạng re_xxxxxxxx.
export function isResendKey(text: string): boolean {
  return /^re_[A-Za-z0-9_-]{8,120}$/.test(text)
}

export function parseMailSave(body: unknown): MailSave | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null
  const data = body as Record<string, unknown>
  if (typeof data.on !== 'boolean' || typeof data.email !== 'string') return null
  const email = cleanText(data.email, false)
  if (email && !isEmail(email)) return null
  const save: MailSave = { on: data.on, email }
  if (data.key !== undefined && data.key !== '') {
    if (typeof data.key !== 'string' || !isResendKey(data.key.trim())) return null
    save.key = data.key.trim()
  }
  return save
}

// Ngày theo giờ Việt Nam (UTC+7), để đếm thư mỗi ngày.
export function mailDay(now: number): string {
  return new Date(now + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

// Link, tên miền người gửi viết vào thì làm hỏng cố ý (http → hxxp, dấu chấm → [.]) để Gmail không biến thành link bấm
// được, chủ web khỏi bấm nhầm link lừa đảo (giống trong hộp thư, link không bấm được). Địa chỉ mail để nguyên.
const LINKISH = /(?<![@\w.-])(?:https?:\/\/[^\s<>"]+|www\.[^\s<>"]+|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/[^\s<>"]*)?)(?![\w@-])/gi

export function defang(text: string): string {
  return text.replace(LINKISH, (link) => link.replace(/^(h)tt(ps?:)/i, '$1xx$2').replace(/\./g, '[.]'))
}

export type MailMessage = { subject: string; text: string }

// Thư báo một góp ý mới. `origin`: địa chỉ web (để kèm link mở hộp thư); `last`: thư cuối cùng được gửi hôm nay.
// Thư chỉ có chữ thường (không HTML), không chứa chìa hộp thư.
export function feedbackMail(feedback: FeedbackInput, origin: string, last: boolean): MailMessage {
  const info = KIND_INFO[feedback.kind]
  // Cắt theo từng ký tự (không theo đơn vị UTF-16) để không xẻ đôi emoji.
  const firstLine = [...defang(feedback.text.split('\n')[0])]
  const snippet = firstLine.length > 60 ? `${firstLine.slice(0, 59).join('')}…` : firstLine.join('')
  const lines = [`${info.icon} ${info.name} mới trên web cờ vua`, '', defang(feedback.text), '', `— ${feedback.contact ? defang(feedback.contact) : 'Không để tên'}`]
  if (feedback.context) {
    lines.push('')
    for (const [name, value] of contextLines(feedback.context)) lines.push(`${name}: ${defang(value)}`)
  }
  const raw = [feedback.text, feedback.contact, ...(feedback.context ? contextLines(feedback.context).map(([, value]) => value) : [])]
  if (raw.some((part) => defang(part) !== part)) lines.push('', 'Link trong góp ý đã bị làm hỏng cố ý (hxxp, [.]) để bạn khỏi bấm nhầm.')
  lines.push('', `Mở hộp thư: ${origin}/hop-thu`)
  if (last) lines.push('', `Hôm nay đã gửi đủ ${MAIL_PER_DAY} thư. Góp ý mới từ giờ tới hết ngày chỉ có trong hộp thư.`)
  return { subject: `${info.icon} ${info.name}: ${snippet}`, text: lines.join('\n') }
}

export function testMail(origin: string): MailMessage {
  return {
    subject: 'Thư thử: báo góp ý về mail đã chạy',
    text: [
      `Từ giờ có góp ý mới trên web cờ vua là bạn nhận một thư như thế này (tối đa ${MAIL_PER_DAY} thư mỗi ngày).`,
      '',
      `Mở hộp thư: ${origin}/hop-thu`,
      'Muốn tắt: vào hộp thư, bấm Báo về mail.',
    ].join('\n'),
  }
}

export const MAIL_FROM = 'Cờ vua <onboarding@resend.dev>'

// Đọc lỗi Resend trả về (mã lỗi HTTP, tên và câu báo lỗi) ra lý do dễ hiểu.
export function resendProblem(status: number, body: { name?: unknown; message?: unknown }): MailProblem {
  const name = typeof body.name === 'string' ? body.name : ''
  const message = typeof body.message === 'string' ? body.message : ''
  if (status === 429) return 'limit'
  if (status === 401 || name.endsWith('_api_key')) return 'key'
  if (/own email|testing emails/i.test(message)) return 'address'
  if (/quota|limit/i.test(message)) return 'limit'
  if (/api key/i.test(message)) return 'key'
  if (status === 400 || status === 422) return 'address'
  return 'service'
}

// Gửi một thư qua Resend. Trả về null nếu gửi được, hay lý do không gửi được. Resend chặn mọi lệnh gọi không có
// User-Agent (lỗi 403 mã 1010), mà fetch của Cloudflare không tự thêm, nên phải ghi rõ.
export async function sendWithResend(key: string, to: string, message: MailMessage, fetcher: typeof fetch = fetch): Promise<MailProblem | null> {
  let response: Response
  try {
    response = await fetcher('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'User-Agent': 'co-vua/1.0' },
      body: JSON.stringify({ from: MAIL_FROM, to: [to], subject: message.subject, text: message.text }),
    })
  } catch {
    return 'network'
  }
  if (response.ok) return null
  const body = await response.json().then(
    (data: unknown) => (data && typeof data === 'object' ? (data as { name?: unknown; message?: unknown }) : {}),
    () => ({}),
  )
  return resendProblem(response.status, body)
}
