// Cửa vào của web trên Cloudflare. Các trang và file của web (HTML, JS, hình, tiếng) Cloudflare tự trả;
// chỉ những địa chỉ bắt đầu bằng /api/ mới chạy tới đây (xem run_worker_first trong wrangler.jsonc).
//   POST /api/rooms          tạo phòng mới, trả về mã phòng
//   GET  /api/rooms/<mã>/ws  nối WebSocket vào phòng (chuyển thẳng cho máy chủ của phòng đó)
//   POST /api/feedback       gửi một góp ý (ai cũng gửi được, có giới hạn lượt)
// Hộp thư góp ý, chỉ chủ web (có chìa khoá) dùng được:
//   GET    /api/feedback?kind=&open=&before=   đọc một trang góp ý
//   GET    /api/feedback/unread                 số góp ý mới
//   POST   /api/feedback/seen                   đã thấy các góp ý này (`ids`)
//   PATCH  /api/feedback/<số>                   đổi trạng thái (đã xử lý hay chưa)
//   DELETE /api/feedback/<số>                   xoá
import { BODY_MAX, PAGE_SIZE, parseFeedback, parseQuery } from '../src/feedback/feedback'
import { newRoomId, ROOM_ID, type CreateResponse } from '../src/online/protocol'
import { parseCreateRequest } from '../src/online/room'
import type { Env } from './room-server'

export { ChessRoom } from './room-server'
export { FeedbackBox } from './feedback-box'

// Dấu vân tay (SHA-256) của chìa khoá hộp thư góp ý. Chìa là 24 byte ngẫu nhiên chỉ chủ web giữ; từ dấu vân tay không
// suy ngược ra chìa được, nên để dòng này trong kho code công khai vẫn an toàn. Muốn đổi chìa: tạo chìa mới, thay dòng này.
const OWNER_KEY_SHA256 = 'e8b0fcebe0b50642420b6de7f05b5d219974946ebb4852cb05802a5e24de421b'

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

const OWNER_DIGEST = Uint8Array.from(OWNER_KEY_SHA256.match(/../g) ?? [], (pair) => parseInt(pair, 16))

// Người gọi có đúng chìa khoá hộp thư không (gửi kèm dạng "Authorization: Bearer <chìa>").
async function isOwner(request: Request): Promise<boolean> {
  const key = /^Bearer ([A-Za-z0-9_-]{16,128})$/.exec(request.headers.get('Authorization') ?? '')?.[1]
  if (!key) return false
  return crypto.subtle.timingSafeEqual(await sha256(key), OWNER_DIGEST)
}

// Cả web dùng chung một hộp thư.
function feedbackBox(env: Env) {
  return env.FEEDBACK.get(env.FEEDBACK.idFromName('hop-thu'))
}

const SUBMIT_REFUSED = { slow: 429, busy: 429, full: 507 } as const

async function sendFeedback(request: Request, env: Env): Promise<Response> {
  // Chỉ nhận thư dạng JSON: trình duyệt không cho trang web khác lén gửi kiểu thư này tới đây.
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({ error: 'Cần gửi dạng JSON' }, 415)
  const body = await readJson(request, BODY_MAX)
  if (body instanceof Response) return body
  const input = parseFeedback(body)
  // Máy dò tự động điền ô bẫy: giả vờ nhận cho nó thôi gửi lại, nhưng không lưu.
  if (input === 'trap') return json({ ok: true }, 201)
  if (!input) return json({ error: 'Thiếu hoặc sai nội dung góp ý' }, 400)
  // Đếm lượt gửi theo địa chỉ mạng, nhưng chỉ đưa cho hộp thư bản mã hoá một chiều (đổi mỗi ngày), không lưu địa chỉ thật.
  const ip = request.headers.get('CF-Connecting-IP') ?? ''
  const who = hex(await sha256(`${ip}|${new Date().toISOString().slice(0, 10)}`)).slice(0, 32)
  const result = await feedbackBox(env).submit(input, who, Date.now())
  if (result === 'ok') return json({ ok: true }, 201)
  return json({ error: result }, SUBMIT_REFUSED[result])
}

// Các việc của hộp thư (chủ web). `rest`: phần địa chỉ sau /api/feedback.
async function inbox(request: Request, env: Env, rest: string): Promise<Response> {
  if (!(await isOwner(request))) return json({ error: 'key' }, 401)
  const box = feedbackBox(env)
  if (rest === '' && request.method === 'GET') return json(await box.list(parseQuery(new URL(request.url).searchParams)))
  if (rest === '/unread' && request.method === 'GET') return json({ unread: await box.unread() })
  if (rest === '/seen' && request.method === 'POST') {
    const body = await readJson(request, MAX_BODY)
    if (body instanceof Response) return body
    const ids = (body as { ids?: unknown } | null)?.ids
    if (!Array.isArray(ids) || ids.length > PAGE_SIZE || !ids.every((id) => Number.isSafeInteger(id))) return json({ error: 'Sai danh sách góp ý' }, 400)
    await box.markSeen(ids as number[])
    return json({ ok: true })
  }
  const one = /^\/(\d{1,9})$/.exec(rest)
  if (one && request.method === 'DELETE') return json({ ok: await box.remove(Number(one[1])) })
  if (one && request.method === 'PATCH') {
    const body = await readJson(request, MAX_BODY)
    if (body instanceof Response) return body
    const status = (body as { status?: unknown } | null)?.status
    if (status !== 'seen' && status !== 'done') return json({ error: 'Trạng thái không đúng' }, 400)
    return json({ ok: await box.setStatus(Number(one[1]), status) })
  }
  return json({ error: 'Không có địa chỉ này' }, 404)
}

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (pathname === '/api/rooms' && request.method === 'POST') return createRoom(request, env)
    const socket = /^\/api\/rooms\/([^/]+)\/ws$/.exec(pathname)
    if (socket && ROOM_ID.test(socket[1])) return env.ROOMS.get(env.ROOMS.idFromName(socket[1])).fetch(request)
    if (pathname === '/api/feedback' && request.method === 'POST') return sendFeedback(request, env)
    if (pathname === '/api/feedback' || pathname.startsWith('/api/feedback/')) return inbox(request, env, pathname.slice('/api/feedback'.length))
    return json({ error: 'Không có địa chỉ này' }, 404)
  },
} satisfies ExportedHandler<Env>
