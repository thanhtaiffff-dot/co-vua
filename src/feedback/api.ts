// Gửi góp ý lên máy chủ (ai cũng gửi được, có giới hạn lượt); máy chủ đưa nó thành Issue trên GitHub của chủ web.
// Bản chơi thử (không có máy chủ) giả vờ gửi xong luôn.
import type { FeedbackInput, SubmitResult } from './feedback'

// Vì sao không gửi được: máy chủ từ chối (slow, busy, full), mất mạng (network), hay lỗi khác (bad).
export type FeedbackProblem = Exclude<SubmitResult, 'ok'> | 'network' | 'bad'

export class FeedbackError extends Error {
  problem: FeedbackProblem
  constructor(problem: FeedbackProblem) {
    super(problem)
    this.problem = problem
  }
}

// `website`: ô bẫy máy dò tự động (người thật để trống).
export type FeedbackSend = FeedbackInput & { website: string }

async function sendToServer(feedback: FeedbackSend): Promise<void> {
  let response: Response
  try {
    response = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(feedback) })
  } catch {
    throw new FeedbackError('network')
  }
  if (response.ok) return
  const error = await response
    .json()
    .then((body: { error?: unknown }) => body.error)
    .catch(() => null)
  throw new FeedbackError(error === 'slow' || error === 'busy' || error === 'full' ? error : 'bad')
}

// Bản gộp một file (`npm run build:single`, `build:demo`) không có máy chủ.
export const sendFeedback: (feedback: FeedbackSend) => Promise<void> =
  import.meta.env.MODE === 'single' || import.meta.env.MODE === 'demo' ? () => new Promise((resolve) => setTimeout(resolve, 400)) : sendToServer
