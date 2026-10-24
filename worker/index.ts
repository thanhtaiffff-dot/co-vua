// Cửa vào của web trên Cloudflare. Các trang và file của web (HTML, JS, hình, tiếng) Cloudflare tự trả;
// chỉ những địa chỉ bắt đầu bằng /api/ mới chạy tới đây (xem run_worker_first trong wrangler.jsonc).
//   POST /api/rooms          tạo phòng mới, trả về mã phòng
//   GET  /api/rooms/<mã>/ws  nối WebSocket vào phòng (chuyển thẳng cho máy chủ của phòng đó)
//   POST /api/feedback       gửi một góp ý (ai cũng gửi được, có giới hạn lượt); máy chủ đưa nó thành Issue trên GitHub
import { BODY_MAX, parseFeedback } from '../src/feedback/feedback'
import { newRoomId, ROOM_ID, type CreateResponse } from '../src/online/protocol'
import { parseCreateRequest } from '../src/online/room'
import type { Env } from './room-server'

export { ChessRoom } from './room-server'
export { FeedbackBox } from './feedback-box'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

// Yêu cầu tạo phòng thật chỉ khoảng 150 ký tự; dài hơn mức này thì khỏi đọc.
const MAX_BODY = 2000

// Đọc thư JSON gửi lên, dài tối đa `max` ký tự. Không đọc được thì trả về câu trả lời lỗi để gửi lại luôn.
async function readJson(request: Request, max: number): Promise<unknown> {
  if (Number(request.headers.get('Content-Length') ?? 0) > max) return json({ error: 'Dữ liệu gửi lên quá dài' }, 413)
  try {
    const text = await request.text()
    if (text.length > max) return json({ error: 'Dữ liệu gửi lên quá dài' }, 413)
    return JSON.parse(text)
  } catch {
    return json({ error: 'Dữ liệu gửi lên không đọc được' }, 400)
  }
}

async function createRoom(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request, MAX_BODY)
  if (body instanceof Response) return body
  const create = parseCreateRequest(body)
  if (!create) return json({ error: 'Thiếu hoặc sai thông tin tạo phòng' }, 400)
  // Mã phòng bốc ngẫu nhiên; lỡ trùng phòng đã có thì bốc lại.
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = newRoomId((n) => crypto.getRandomValues(new Uint8Array(n)))
    const room = env.ROOMS.get(env.ROOMS.idFromName(id))
    if (await room.create(id, create)) return json({ id } satisfies CreateResponse, 201)
  }
  return json({ error: 'Chưa tạo được phòng, thử lại nhé' }, 503)
}

async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Cả web dùng chung một hàng chờ góp ý. Tên 'hop-thu' có từ thời hộp thư cũ, giữ nguyên để góp ý cũ còn chờ vẫn được gửi.
function feedbackBox(env: Env) {
  return env.FEEDBACK.get(env.FEEDBACK.idFromName('hop-thu'))
}

const SUBMIT_REFUSED = { slow: 429, busy: 429, full: 507 } as const

async function sendFeedback(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  // Chỉ nhận thư dạng JSON: trình duyệt không cho trang web khác lén gửi kiểu thư này tới đây.
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({ error: 'Cần gửi dạng JSON' }, 415)
  const body = await readJson(request, BODY_MAX)
  if (body instanceof Response) return body
  const input = parseFeedback(body)
  // Máy dò tự động điền ô bẫy: giả vờ nhận cho nó thôi gửi lại, nhưng không lưu.
  if (input === 'trap') return json({ ok: true }, 201)
  if (!input) return json({ error: 'Thiếu hoặc sai nội dung góp ý' }, 400)
  // Đếm lượt gửi theo địa chỉ mạng, nhưng chỉ đưa cho hàng chờ bản mã hoá một chiều (đổi mỗi ngày), không lưu địa chỉ thật.
  const ip = request.headers.get('CF-Connecting-IP') ?? ''
  const who = hex(await sha256(`${ip}|${new Date().toISOString().slice(0, 10)}`)).slice(0, 32)
  const box = feedbackBox(env)
  const result = await box.submit(input, who, Date.now())
  if (result !== 'ok') return json({ error: result }, SUBMIT_REFUSED[result])
  // Đưa lên GitHub sau khi đã trả lời người gửi, nên họ không phải chờ.
  ctx.waitUntil(box.flush())
  return json({ ok: true }, 201)
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (pathname === '/api/rooms' && request.method === 'POST') return createRoom(request, env)
    const socket = /^\/api\/rooms\/([^/]+)\/ws$/.exec(pathname)
    if (socket && ROOM_ID.test(socket[1])) return env.ROOMS.get(env.ROOMS.idFromName(socket[1])).fetch(request)
    if (pathname === '/api/feedback' && request.method === 'POST') return sendFeedback(request, env, ctx)
    return json({ error: 'Không có địa chỉ này' }, 404)
  },
} satisfies ExportedHandler<Env>
