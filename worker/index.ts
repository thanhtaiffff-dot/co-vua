// Cửa vào của web trên Cloudflare. Các trang và file của web (HTML, JS, hình, tiếng) Cloudflare tự trả;
// chỉ những địa chỉ bắt đầu bằng /api/ mới chạy tới đây (xem run_worker_first trong wrangler.jsonc).
//   POST /api/rooms          tạo phòng mới, trả về mã phòng
//   GET  /api/rooms/<mã>/ws  nối WebSocket vào phòng (chuyển thẳng cho máy chủ của phòng đó)
import { newRoomId, ROOM_ID, type CreateResponse } from '../src/online/protocol'
import { parseCreateRequest } from '../src/online/room'
import type { Env } from './room-server'

export { ChessRoom } from './room-server'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })
}

async function createRoom(request: Request, env: Env): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Dữ liệu gửi lên không đọc được' }, 400)
  }
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

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (pathname === '/api/rooms' && request.method === 'POST') return createRoom(request, env)
    const socket = /^\/api\/rooms\/([^/]+)\/ws$/.exec(pathname)
    if (socket && ROOM_ID.test(socket[1])) return env.ROOMS.get(env.ROOMS.idFromName(socket[1])).fetch(request)
    return json({ error: 'Không có địa chỉ này' }, 404)
  },
} satisfies ExportedHandler<Env>
