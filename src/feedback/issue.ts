// Mỗi góp ý thành một Issue trong repo riêng tư trên GitHub (chỉ chủ web đọc được): tiêu đề có loại góp ý và dòng đầu,
// nhãn theo loại, thân Issue có nội dung, tên người gửi và thông tin kèm. Máy chủ (worker/feedback-box.ts) gửi Issue
// bằng token GitHub của chủ web, lưu làm Secret trên Cloudflare (không nằm trong code).
//
// Chữ người chơi gõ (nội dung, tên, thông tin kèm) chỉ nằm trong khối chữ thô của Markdown: GitHub hiện đúng từng chữ,
// không biến thành link, ảnh, @tên người hay mã HTML.
import { analysisUrl } from '../game/rules'
import { contextLines, KIND_INFO, type FeedbackInput } from './feedback'

export type IssueDraft = { title: string; body: string; labels: string[] }

// Bọc chữ trong khối chữ thô. Rào bằng dấu ` dài hơn mọi chuỗi ` có trong chữ, để chữ không phá được khối.
function raw(text: string): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length))
  const fence = '`'.repeat(Math.max(3, longest + 1))
  return `${fence}text\n${text}\n${fence}`
}

// Giờ Việt Nam, kiểu "24/10/2026 20:15".
function vnTime(at: number): string {
  const [date, time] = new Date(at + 7 * 60 * 60 * 1000).toISOString().split('T')
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y} ${time.slice(0, 5)}`
}

// Nước đi chỉ gồm chữ, số và + # = - O (kiểu "e4", "Nf3", "O-O", "e8=Q+"): mới đưa vào link lichess.
const SAN = /^[A-Za-z0-9+#=-]{2,8}$/

export function feedbackIssue(feedback: FeedbackInput, at: number): IssueDraft {
  const info = KIND_INFO[feedback.kind]
  // Cắt theo từng ký tự (không theo đơn vị UTF-16) để không xẻ đôi emoji.
  const firstLine = [...feedback.text.split('\n')[0]]
  const snippet = firstLine.length > 60 ? `${firstLine.slice(0, 59).join('')}…` : firstLine.join('')
  const parts = ['### Nội dung', raw(feedback.text), '### Người gửi', raw(feedback.contact || 'Không để tên')]
  const context = feedback.context
  if (context) {
    const lines = contextLines(context).map(([name, value]) => `${name}: ${value}`)
    if (context.game) lines.push(`Nước đi: ${context.game}`)
    parts.push('### Thông tin kèm', raw(lines.join('\n')))
    const moves = context.game?.split(' ') ?? []
    if (moves.length && moves.every((move) => SAN.test(move))) parts.push(`[Mở ván trên lichess](${analysisUrl(moves, context.side ?? 'white')})`)
  }
  parts.push(`Gửi lúc ${vnTime(at)} (giờ Việt Nam)`)
  return { title: `${info.icon} ${info.name}: ${snippet}`, body: parts.join('\n\n'), labels: [info.name] }
}

// Kết quả gửi Issue: ok; token sai, hết hạn hay không có quyền trên repo (token); GitHub trục trặc hay mất mạng (retry).
export type IssueResult = 'ok' | 'token' | 'retry'

export const GITHUB_API = 'https://api.github.com'

// Tạo một Issue trong repo `repo` (dạng "chủ/tên"). GitHub bắt buộc có User-Agent.
export async function createIssue(token: string, repo: string, draft: IssueDraft, api = GITHUB_API, fetcher: typeof fetch = fetch): Promise<IssueResult> {
  let response: Response
  try {
    response = await fetcher(`${api}/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'co-vua',
      },
      body: JSON.stringify(draft),
    })
  } catch {
    return 'retry'
  }
  if (response.status === 201) return 'ok'
  // 422: GitHub không nhận nội dung, thường do nhãn. Gửi lại một lần không kèm nhãn (tiêu đề đã có loại góp ý).
  if (response.status === 422 && draft.labels.length) return createIssue(token, repo, { ...draft, labels: [] }, api, fetcher)
  // 401: token sai hay hết hạn. 403 không phải do gọi dồn, hay 404: token không có quyền trên repo (GitHub giấu repo riêng
  // tư bằng 404).
  if (response.status === 401 || response.status === 404) return 'token'
  if (response.status === 403 && response.headers.get('x-ratelimit-remaining') !== '0' && !response.headers.has('retry-after')) return 'token'
  return 'retry'
}
