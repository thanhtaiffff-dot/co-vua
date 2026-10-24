// Những việc phần góp ý cần máy chủ làm: gửi góp ý (ai cũng được), và hộp thư (chỉ chủ web, có chìa khoá).
// Bản thật nói chuyện với máy chủ trên Cloudflare; bản chơi thử (demo.ts) giữ góp ý ngay trong trình duyệt.
import { useSyncExternalStore } from 'react'
import { loadSaved, save } from '../storage'
import { demoFeedback } from './demo'
import type { FeedbackInput, FeedbackPage, FeedbackQuery, SubmitResult } from './feedback'

// Vì sao không gửi hay không đọc được: máy chủ từ chối (slow, busy, full), chìa khoá sai (key), mất mạng (network),
// hay lỗi khác (bad).
export type FeedbackProblem = Exclude<SubmitResult, 'ok'> | 'key' | 'network' | 'bad'

export class FeedbackError extends Error {
  problem: FeedbackProblem
  constructor(problem: FeedbackProblem) {
    super(problem)
    this.problem = problem
  }
}

// `website`: ô bẫy máy dò tự động (người thật để trống).
export type FeedbackSend = FeedbackInput & { website: string }

export type FeedbackBackend = {
  send: (feedback: FeedbackSend) => Promise<void>
  list: (key: string, query: FeedbackQuery) => Promise<FeedbackPage>
  unread: (key: string) => Promise<number>
  markSeen: (key: string, ids: number[]) => Promise<void> // chủ web đã thấy các góp ý này
  setDone: (key: string, id: number, done: boolean) => Promise<void>
  remove: (key: string, id: number) => Promise<void>
  demo?: true // bản chơi thử: ai cũng xem được hộp thư (toàn góp ý của chính mình và vài góp ý mẫu)
}

async function call<T>(path: string, init: RequestInit = {}, key?: string): Promise<T> {
  const headers: Record<string, string> = {}
  if (init.body) headers['Content-Type'] = 'application/json'
  if (key) headers.Authorization = `Bearer ${key}`
  let response: Response
  try {
    response = await fetch(path, { ...init, headers })
  } catch {
    throw new FeedbackError('network')
  }
  if (response.ok) return (await response.json()) as T
  if (response.status === 401) throw new FeedbackError('key')
  const error = await response
    .json()
    .then((body: { error?: unknown }) => body.error)
    .catch(() => null)
  throw new FeedbackError(error === 'slow' || error === 'busy' || error === 'full' ? error : 'bad')
}

const serverFeedback: FeedbackBackend = {
  async send(feedback) {
    await call('/api/feedback', { method: 'POST', body: JSON.stringify(feedback) })
  },
  list(key, query) {
    const params = new URLSearchParams()
    if (query.kind) params.set('kind', query.kind)
    if (query.open) params.set('open', '1')
    if (query.before) params.set('before', String(query.before))
    const search = params.toString()
    return call<FeedbackPage>(`/api/feedback${search ? `?${search}` : ''}`, {}, key)
  },
  async unread(key) {
    return (await call<{ unread: number }>('/api/feedback/unread', {}, key)).unread
  },
  async markSeen(key, ids) {
    await call('/api/feedback/seen', { method: 'POST', body: JSON.stringify({ ids }) }, key)
  },
  async setDone(key, id, done) {
    await call(`/api/feedback/${id}`, { method: 'PATCH', body: JSON.stringify({ status: done ? 'done' : 'seen' }) }, key)
  },
  async remove(key, id) {
    await call(`/api/feedback/${id}`, { method: 'DELETE' }, key)
  },
}

// Bản gộp một file (`npm run build:single`, `build:demo`) không có máy chủ, nên giữ góp ý ngay trong trình duyệt.
export const feedbackBackend: FeedbackBackend = import.meta.env.MODE === 'single' || import.meta.env.MODE === 'demo' ? demoFeedback : serverFeedback

// ---------- Chìa khoá hộp thư của chủ web ----------
// Chủ web mở link riêng dạng /hop-thu#khoa=<chìa> một lần là máy nhớ chìa (chỉ máy đó). Chìa nằm sau dấu #, nên
// trình duyệt không gửi nó lên máy chủ cùng địa chỉ trang (không lọt vào nhật ký máy chủ); web đọc xong thì xoá khỏi
// thanh địa chỉ cho khỏi lộ khi chụp màn hình.
const KEY = /^[A-Za-z0-9_-]{16,128}$/

export function ownerKey(): string | null {
  if (feedbackBackend.demo) return 'ban-choi-thu'
  const saved = loadSaved<unknown>('ownerKey', null)
  return typeof saved === 'string' && KEY.test(saved) ? saved : null
}

// Lấy chìa từ link (hay từ chữ dán vào: cả link hoặc riêng chìa). Trả về chìa đọc được, hoặc null.
export function readKey(text: string): string | null {
  const key = /(?:^|#khoa=)([A-Za-z0-9_-]{16,128})$/.exec(text.trim())?.[1]
  return key ?? null
}

export function saveOwnerKey(key: string | null): void {
  save('ownerKey', key)
  unreadCount = null
  notify()
  if (key) void refreshUnread()
}

// Mở trang bằng link có chìa thì nhớ chìa rồi xoá nó khỏi thanh địa chỉ.
export function takeKeyFromLink(): void {
  if (typeof location === 'undefined' || !location.hash.startsWith('#khoa=')) return
  const key = readKey(location.hash)
  history.replaceState(null, '', location.pathname + location.search)
  if (key) saveOwnerKey(key)
}

// ---------- Số góp ý mới (chấm đỏ trên nút Góp ý, chỉ máy chủ web thấy) ----------
let unreadCount: number | null = null
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

export function setUnread(count: number | null): void {
  unreadCount = count
  notify()
}

export async function refreshUnread(): Promise<void> {
  const key = ownerKey()
  if (!key) return setUnread(null)
  try {
    setUnread(await feedbackBackend.unread(key))
  } catch (error) {
    // Chìa sai (đã đổi chìa) thì quên chìa cũ; mất mạng thì để lần sau.
    if (error instanceof FeedbackError && error.problem === 'key') saveOwnerKey(null)
  }
}

let watching = false

// Hỏi số góp ý mới lúc mở web và mỗi lần quay lại tab web (không hỏi liên tục cho đỡ tốn lượt của gói miễn phí).
function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (!watching && typeof document !== 'undefined') {
    watching = true
    void refreshUnread()
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void refreshUnread()
    })
  }
  return () => listeners.delete(listener)
}

// Số góp ý mới; null là máy này không phải của chủ web (hay chưa biết).
export function useUnread(): number | null {
  return useSyncExternalStore(subscribe, () => unreadCount)
}
