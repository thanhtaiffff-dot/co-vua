// Những việc trang chơi online cần máy chủ làm. Bản thật nói chuyện với máy chủ trên Cloudflare;
// bản chơi thử (demo.ts) thay bằng một máy chủ giả chạy ngay trong trình duyệt.
import { connectSocket, type Connection, type ConnectionEvents } from './connection'
import type { CreateRequest, CreateResponse } from './protocol'

export type Backend = {
  createRoom: (request: CreateRequest) => Promise<string> // trả về mã phòng
  connect: (id: string, token: string, events: ConnectionEvents) => Connection
  link: (id: string) => string // link mời bạn bè
  demo?: { addFriend: (id: string) => void } // chỉ bản chơi thử có: cho "bạn bè ảo" vào phòng
}

export const serverBackend: Backend = {
  async createRoom(request) {
    const response = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    if (!response.ok) throw new Error(`Máy chủ trả lỗi ${response.status}`)
    return ((await response.json()) as CreateResponse).id
  },
  connect(id, token, events) {
    const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:'
    return connectSocket(`${scheme}//${location.host}/api/rooms/${id}/ws`, token, events)
  },
  link: (id) => `${location.origin}/phong/${id}`,
}
