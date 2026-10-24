// Máy chủ của một phòng chơi: mỗi phòng là một Durable Object, tức một "trọng tài" riêng chạy trên Cloudflare,
// luôn chỉ có đúng một bản ở một nơi, nên hai người chơi cùng nói chuyện với cùng một trọng tài.
// Trọng tài giữ dữ liệu phòng (lưu bền, tắt máy chủ vẫn còn), nối WebSocket với từng người (đường dây hai chiều,
// có nước đi là báo ngay không cần hỏi lại), và đặt hẹn giờ để tự xử hết giờ đúng lúc.
// Luật của phòng nằm ở src/online/room.ts; file này chỉ lo phần mạng và lưu trữ.
//
// Trọng tài làm từng việc một, nên ai gửi thật nhiều thư là người khác phải chờ (nước đi tới trễ, đồng hồ bị trừ oan).
// Vì vậy có mấy giới hạn: người xem tối đa MAX_VISITORS, mỗi người chơi tối đa MAX_TABS tab, mỗi đường dây chỉ chào
// một lần và gửi thư có mức, thư quá dài bị bỏ, và chỉ báo cho cả phòng khi có gì thay đổi thật.
import { DurableObject } from 'cloudflare:workers'
import { MAX_VISITORS, type ChatLine, type CreateRequest, type ErrorCode, type ServerMessage } from '../src/online/protocol'
import { chat, chatOf, checkFlag, createRoom, flagDue, handle, parseClientMessage, seatOf, upgradeRoom, viewsOf, type RoomData, type Seat } from '../src/online/room'
import type { FeedbackBox } from './feedback-box'

export type Env = { ROOMS: DurableObjectNamespace<ChessRoom>; FEEDBACK: DurableObjectNamespace<FeedbackBox> }

// Phòng không ai đụng tới 30 ngày thì xoá cho gọn.
const CLEANUP_AFTER = 30 * 24 * 60 * 60 * 1000

// Mỗi người chơi mở phòng cùng lúc ở tối đa bấy nhiêu tab hay máy; mở thêm thì tab cũ nhất bị ngắt.
const MAX_TABS = 4
// Tổng số đường dây một phòng giữ, tính cả đường dây vừa nối chưa kịp chào.
const MAX_SOCKETS = 2 * MAX_TABS + MAX_VISITORS + 8
// Thư dài nhất máy chủ chịu đọc (thư thật dài chưa tới 200 ký tự).
const MAX_MESSAGE = 1000
// Mỗi đường dây gửi liền một lúc tối đa MESSAGE_BURST thư, sau đó MESSAGES_PER_SECOND thư mỗi giây
// (người chơi thật chưa bao giờ cần tới). Gửi dày hơn thì thư bị bỏ; bị bỏ quá MAX_DROPPED thư thì bị ngắt.
const MESSAGE_BURST = 20
const MESSAGES_PER_SECOND = 5
const MAX_DROPPED = 100

// Ghi chú gắn vào mỗi đường WebSocket: mã máy của người ở đầu bên kia (chưa chào thì là null), và lúc nối.
type Attachment = { token: string | null; since: number }

// Mức gửi thư của một đường dây (giữ trong bộ nhớ; phòng ngủ đông thì quên, không sao).
type Bucket = { tokens: number; at: number; dropped: number }

function attachment(ws: WebSocket): Attachment {
  return ws.deserializeAttachment() as Attachment
}

export class ChessRoom extends DurableObject<Env> {
  private room: RoomData | null = null
  private buckets = new WeakMap<WebSocket, Bucket>()

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    void ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get<RoomData>('room')
      this.room = saved ? upgradeRoom(saved) : null
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
    const sockets = this.sockets()
    if (sockets.length >= MAX_SOCKETS) {
      // Đầy chỗ: ngắt đường dây nối lâu nhất mà vẫn chưa chào để nhường chỗ. Người chơi thật chào ngay khi vừa nối,
      // nên chỉ đường dây của kẻ phá bị ngắt. Không có đường dây nào như vậy thì từ chối; máy người chơi tự thử lại sau.
      const silent = sockets.filter((ws) => attachment(ws).token === null).sort((a, b) => attachment(a).since - attachment(b).since)
      if (silent.length === 0) return new Response('Phòng quá đông', { status: 503 })
      silent[0].close(4429, 'Phòng quá đông')
    }
    const [client, server] = Object.values(new WebSocketPair())
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ token: null, since: Date.now() } satisfies Attachment)
    if (!this.room) this.refuse(server, 'not-found')
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    if (!this.allow(ws) || typeof data !== 'string' || data.length > MAX_MESSAGE || !this.room) return
    const message = parseClientMessage(data)
    if (!message) return
    const now = Date.now()
    const { token } = attachment(ws)
    if (message.t === 'hello') {
      // Mỗi đường dây chỉ chào một lần, lúc vừa nối; chào lại thì bỏ qua.
      if (token === null) await this.hello(ws, message.token, now)
      return
    }
    if (token === null) return
    if (message.t === 'chat') {
      // Câu chat chỉ báo cho hai người chơi, không gửi lại cả tình hình phòng. Câu không nhận (gửi quá dày...) thì bỏ.
      const line = chat(this.room, token, message.text, now)
      if (line) {
        await this.save()
        this.sendChat(line)
      }
      return
    }
    if (handle(this.room, token, message, now, Math.random)) {
      await this.save()
      this.broadcast()
    } else if (message.t === 'join' || seatOf(this.room, token) !== null) {
      // Thư không làm gì được (nước đi sai, gửi trễ...): gửi lại tình hình thật cho người đó, máy họ tự sửa theo.
      // Người xem gửi linh tinh thì khỏi trả lời.
      this.send(ws, now)
    }
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    try {
      ws.close(code === 1005 || code === 1006 ? 1000 : code, 'Tạm biệt')
    } catch {
      // Đường dây đã đóng hẳn rồi.
    }
    this.left(ws)
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.left(ws)
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

  // Đường dây `ws` chào, xưng mã máy `token`. Người chơi lúc nào cũng vào được; người xem thì còn chỗ mới vào.
  private async hello(ws: WebSocket, token: string, now: number): Promise<void> {
    if (!this.room) return
    const seat = seatOf(this.room, token)
    const others = this.sockets().filter((other) => other !== ws)
    if (seat === null) {
      const visitors = others.filter((other) => this.isVisitor(other)).length
      if (visitors >= MAX_VISITORS) {
        this.refuse(ws, 'full')
        return
      }
    } else {
      // Người chơi mở quá nhiều tab (hay để lại đường dây cũ khi đổi mạng): ngắt bớt những tab cũ nhất.
      const tabs = others.filter((other) => seatOf(this.room!, attachment(other).token) === seat)
      tabs.sort((a, b) => attachment(a).since - attachment(b).since)
      for (const old of tabs.slice(0, Math.max(0, tabs.length - (MAX_TABS - 1)))) this.refuse(old, 'replaced')
    }
    const wasOnline = this.online()
    ws.serializeAttachment({ ...attachment(ws), token } satisfies Attachment)
    if (checkFlag(this.room, now)) {
      await this.save()
      this.broadcast()
    } else if (seat !== null && !wasOnline[seat]) {
      // Người chơi vừa vào (hoặc nối lại mạng): báo cho mọi người, để chấm xanh "đang online" sáng lên.
      this.broadcast()
    } else {
      this.send(ws, now)
    }
    // Người chơi vừa nối (hay nối lại) thì nhận cả chat của phòng.
    const history = chatOf(this.room, token)
    if (history) trySend(ws, JSON.stringify({ t: 'chat', lines: history, all: true } satisfies ServerMessage))
  }

  // Đường dây `ws` đóng: chỉ báo cho cả phòng khi đó là đường dây cuối của một người chơi (chấm xanh tắt).
  private left(ws: WebSocket): void {
    if (!this.room) return
    const seat = seatOf(this.room, attachment(ws).token)
    if (seat !== null && !this.online(ws)[seat]) this.broadcast(ws)
  }

  // Còn được gửi thư không (mỗi lần gửi tốn một lượt; lượt hồi lại dần theo thời gian).
  private allow(ws: WebSocket): boolean {
    const now = Date.now()
    const bucket = this.buckets.get(ws) ?? { tokens: MESSAGE_BURST, at: now, dropped: 0 }
    bucket.tokens = Math.min(MESSAGE_BURST, bucket.tokens + ((now - bucket.at) * MESSAGES_PER_SECOND) / 1000)
    bucket.at = now
    this.buckets.set(ws, bucket)
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1
      return true
    }
    if (++bucket.dropped > MAX_DROPPED) ws.close(1008, 'Gửi quá nhiều thư')
    return false
  }

  private refuse(ws: WebSocket, code: ErrorCode): void {
    try {
      ws.send(JSON.stringify({ t: 'error', code } satisfies ServerMessage))
      ws.close(code === 'not-found' ? 4404 : 4429, code)
    } catch {
      // Đường dây đã đứt.
    }
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

  // Các đường dây đang mở (bỏ qua đường dây đang đóng, và `closing` nếu có).
  private sockets(closing?: WebSocket): WebSocket[] {
    return this.ctx.getWebSockets().filter((ws) => ws !== closing && ws.readyState === WebSocket.OPEN)
  }

  private isVisitor(ws: WebSocket): boolean {
    const { token } = attachment(ws)
    return token !== null && this.room !== null && seatOf(this.room, token) === null
  }

  // Ai đang mở trang, theo ghế.
  private online(closing?: WebSocket): [boolean, boolean] {
    const online: [boolean, boolean] = [false, false]
    if (!this.room) return online
    for (const ws of this.sockets(closing)) {
      const seat = seatOf(this.room, attachment(ws).token)
      if (seat !== null) online[seat] = true
    }
    return online
  }

  private send(ws: WebSocket, now: number): void {
    const { token } = attachment(ws)
    if (!this.room || token === null) return
    const room = viewsOf(this.room, now, this.online())(seatOf(this.room, token))
    trySend(ws, JSON.stringify({ t: 'state', room } satisfies ServerMessage))
  }

  // Báo tình hình cho cả phòng: mỗi vai (chủ phòng, khách, người xem) chỉ soạn thư một lần rồi gửi cho mọi đường dây.
  private broadcast(closing?: WebSocket): void {
    if (!this.room) return
    const room = this.room
    const sockets = this.sockets(closing)
    const views = viewsOf(room, Date.now(), this.online(closing))
    const letters = new Map<Seat | null, string>()
    for (const ws of sockets) {
      const { token } = attachment(ws)
      if (token === null) continue
      const seat = seatOf(room, token)
      let letter = letters.get(seat)
      if (letter === undefined) {
        letter = JSON.stringify({ t: 'state', room: views(seat) } satisfies ServerMessage)
        letters.set(seat, letter)
      }
      trySend(ws, letter)
    }
  }

  // Báo câu chat cho mọi đường dây của hai người chơi (người xem không nhận).
  private sendChat(line: ChatLine): void {
    if (!this.room) return
    const letter = JSON.stringify({ t: 'chat', lines: [line], all: false } satisfies ServerMessage)
    for (const ws of this.sockets()) if (seatOf(this.room, attachment(ws).token) !== null) trySend(ws, letter)
  }
}

function trySend(ws: WebSocket, letter: string): void {
  try {
    ws.send(letter)
  } catch {
    // Đường dây vừa đứt; người đó nối lại sẽ nhận tình hình mới.
  }
}
