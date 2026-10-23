// Máy chủ của một phòng chơi: mỗi phòng là một Durable Object, tức một "trọng tài" riêng chạy trên Cloudflare,
// luôn chỉ có đúng một bản ở một nơi, nên hai người chơi cùng nói chuyện với cùng một trọng tài.
// Trọng tài giữ dữ liệu phòng (lưu bền, tắt máy chủ vẫn còn), nối WebSocket với từng người (đường dây hai chiều,
// có nước đi là báo ngay không cần hỏi lại), và đặt hẹn giờ để tự xử hết giờ đúng lúc.
// Luật của phòng nằm ở src/online/room.ts; file này chỉ lo phần mạng và lưu trữ.
import { DurableObject } from 'cloudflare:workers'
import type { ClientMessage, CreateRequest, ServerMessage } from '../src/online/protocol'
import { checkFlag, createRoom, flagDue, handle, seatOf, view, type RoomData } from '../src/online/room'

export type Env = { ROOMS: DurableObjectNamespace<ChessRoom> }

// Phòng không ai đụng tới 30 ngày thì xoá cho gọn.
const CLEANUP_AFTER = 30 * 24 * 60 * 60 * 1000

// Ghi chú gắn vào mỗi đường WebSocket: mã máy của người ở đầu bên kia (chưa chào thì là null).
type Attachment = { token: string | null }

export class ChessRoom extends DurableObject<Env> {
  private room: RoomData | null = null

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    void ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get<RoomData>('room')) ?? null
    })
    // Máy người chơi gửi "ping" vài giây một lần để đo độ trễ mạng. Cloudflare tự trả "pong", không cần đánh thức phòng.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'))
  }

  // Worker gọi khi có người bấm "Tạo phòng". Trả về false nếu mã phòng này đã có người dùng.
  async create(id: string, request: CreateRequest): Promise<boolean> {
    if (this.room) return false
    this.room = createRoom(id, request, Date.now())
    await this.save()
    return true
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Cần nối bằng WebSocket', { status: 426 })
    const [client, server] = Object.values(new WebSocketPair())
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ token: null } satisfies Attachment)
    if (!this.room) {
      server.send(JSON.stringify({ t: 'error', code: 'not-found' } satisfies ServerMessage))
      server.close(4404, 'Không có phòng này')
    }
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    if (typeof data !== 'string' || !this.room) return
    let message: ClientMessage
    try {
      message = JSON.parse(data) as ClientMessage
    } catch {
      return
    }
    const now = Date.now()
    if (message.t === 'hello') {
      if (typeof message.token !== 'string') return
      ws.serializeAttachment({ token: message.token } satisfies Attachment)
      if (checkFlag(this.room, now)) await this.save()
      // Có người vừa vào (hoặc nối lại mạng): báo cho mọi người, để chấm xanh "đang online" sáng lên.
      this.broadcast()
      return
    }
    const { token } = ws.deserializeAttachment() as Attachment
    if (handle(this.room, token, message, now, Math.random)) {
      await this.save()
      this.broadcast()
    } else {
      // Thư không làm gì được (nước đi sai, gửi trễ...): gửi lại tình hình thật cho người đó, máy họ tự sửa theo.
      this.send(ws, now)
    }
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    try {
      ws.close(code === 1005 || code === 1006 ? 1000 : code, 'Tạm biệt')
    } catch {
      // Đường dây đã đóng hẳn rồi.
    }
    this.broadcast(ws)
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.broadcast(ws)
  }

  // Hẹn giờ reo: hoặc bên đang tới lượt hết giờ, hoặc phòng đã bỏ không quá lâu.
  async alarm(): Promise<void> {
    if (!this.room) return
    const now = Date.now()
    if (checkFlag(this.room, now)) {
      await this.save()
      this.broadcast()
      return
    }
    if (flagDue(this.room) === null && now - this.room.updated >= CLEANUP_AFTER && this.ctx.getWebSockets().length === 0) {
      this.room = null
      await this.ctx.storage.deleteAll()
      return
    }
    await this.schedule()
  }

  private async save(): Promise<void> {
    if (!this.room) return
    await this.ctx.storage.put('room', this.room)
    await this.schedule()
  }

  private async schedule(): Promise<void> {
    if (!this.room) return
    await this.ctx.storage.setAlarm(flagDue(this.room) ?? this.room.updated + CLEANUP_AFTER)
  }

  // Ai đang mở trang, theo ghế (bỏ qua đường dây `closing` đang đóng).
  private online(closing?: WebSocket): [boolean, boolean] {
    const online: [boolean, boolean] = [false, false]
    if (!this.room) return online
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === closing) continue
      const seat = seatOf(this.room, (ws.deserializeAttachment() as Attachment).token)
      if (seat !== null) online[seat] = true
    }
    return online
  }

  private send(ws: WebSocket, now: number, online = this.online()): void {
    const { token } = ws.deserializeAttachment() as Attachment
    if (!this.room || token === null) return
    try {
      ws.send(JSON.stringify({ t: 'state', room: view(this.room, token, now, online) } satisfies ServerMessage))
    } catch {
      // Đường dây vừa đứt; người đó nối lại sẽ nhận tình hình mới.
    }
  }

  private broadcast(closing?: WebSocket): void {
    const now = Date.now()
    const online = this.online(closing)
    for (const ws of this.ctx.getWebSockets()) if (ws !== closing) this.send(ws, now, online)
  }
}
