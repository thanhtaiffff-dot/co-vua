// Bản chơi thử chơi online khi chưa có máy chủ thật (ví dụ trang xem thử trên Claude): một máy chủ giả chạy ngay
// trong trình duyệt, dùng đúng luật phòng của máy chủ thật (room.ts), thư đi thư về chậm như mạng thật,
// và một "bạn bè ảo" tự đi quân để thử đi trước, xin hòa, tái đấu khi chỉ có một mình.
import { Chess, type Move } from 'chess.js'
import { flagDue, checkFlag, createRoom, handle, seatOf, view, type RoomData } from './room'
import { fromUci, newRoomId, type ClientMessage, type ServerMessage } from './protocol'
import type { Backend } from './backend'
import type { ConnectionEvents } from './connection'
import { materialDiff, replay } from '../game/rules'

const LATENCY = 90 // thời gian một thư đi một chiều (ms)
const BOT_TOKEN = 'ban-be-ao-demo-token'
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

type Client = { token: string | null; events: ConnectionEvents; open: boolean }
type DemoRoom = { data: RoomData; clients: Set<Client>; flagTimer?: ReturnType<typeof setTimeout>; botTimer?: ReturnType<typeof setTimeout> }

const rooms = new Map<string, DemoRoom>()

function later(action: () => void): void {
  setTimeout(action, LATENCY)
}

function online(room: DemoRoom): [boolean, boolean] {
  const result: [boolean, boolean] = [false, false]
  const tokens = [...room.clients].filter((c) => c.open).map((c) => c.token)
  if (seatOf(room.data, BOT_TOKEN) !== null) tokens.push(BOT_TOKEN)
  for (const token of tokens) {
    const seat = seatOf(room.data, token)
    if (seat !== null) result[seat] = true
  }
  return result
}

function deliver(room: DemoRoom, client: Client): void {
  if (!client.open || client.token === null) return
  const message: ServerMessage = { t: 'state', room: view(room.data, client.token, Date.now(), online(room)) }
  const copy = JSON.parse(JSON.stringify(message)) as ServerMessage
  later(() => client.open && client.events.message(copy))
}

function broadcast(room: DemoRoom): void {
  for (const client of room.clients) deliver(room, client)
  schedule(room)
}

// Hẹn giờ xử hết giờ, và cho bạn bè ảo trả lời.
function schedule(room: DemoRoom): void {
  clearTimeout(room.flagTimer)
  const due = flagDue(room.data)
  if (due !== null) {
    room.flagTimer = setTimeout(() => {
      if (checkFlag(room.data, Date.now())) broadcast(room)
    }, Math.max(0, due - Date.now()) + 5)
  }
  clearTimeout(room.botTimer)
  const action = botAction(room.data)
  if (action) {
    room.botTimer = setTimeout(() => {
      if (handle(room.data, BOT_TOKEN, action.message(), Date.now(), Math.random)) broadcast(room)
    }, action.delay)
  }
}

// Bạn bè ảo nghĩ gì: tới lượt thì đi, được mời hòa thì cân nhắc, được mời đấu tiếp thì đồng ý.
function botAction(data: RoomData): { delay: number; message: () => ClientMessage } | null {
  const game = data.game
  const seat = seatOf(data, BOT_TOKEN)
  if (!game || seat === null) return null
  const color = seat === game.white ? 'w' : 'b'
  if (game.end) return game.rematch[seat === 0 ? 1 : 0] && !game.rematch[seat] ? { delay: 1200, message: () => ({ t: 'rematch', yes: true }) } : null
  const chess = replay(game.moves.map((m) => fromUci(m)!))
  if (game.drawOffer !== null && game.drawOffer !== seat) {
    const behind = materialDiff(chess)[color === 'w' ? 'b' : 'w'].score >= 2
    return { delay: 1500, message: () => ({ t: 'draw', yes: behind }) }
  }
  if (chess.turn() !== color) return null
  const bullet = (game.clock.control?.minutes ?? 10) <= 2
  const delay = (bullet ? 300 : 700) + Math.random() * (bullet ? 900 : 2200)
  const ply = game.moves.length
  return { delay, message: () => ({ t: 'move', uci: pickMove(chess), ply, lag: LATENCY * 2 }) }
}

// Chọn nước kiểu người mới chơi: thích chiếu bí, ăn quân to, phong cấp, chiếu; còn lại đi bừa.
function pickMove(chess: Chess): string {
  let best: Move | null = null
  let bestScore = -Infinity
  for (const move of chess.moves({ verbose: true })) {
    let score = Math.random() * 2.5
    if (move.captured) score += VALUE[move.captured] * 2
    if (move.promotion) score += 8
    if (move.san.includes('#')) score += 1000
    else if (move.san.includes('+')) score += 1
    if (score > bestScore) {
      best = move
      bestScore = score
    }
  }
  return best!.lan
}

export const demoBackend: Backend = {
  async createRoom(request) {
    await new Promise((resolve) => setTimeout(resolve, LATENCY * 2))
    const id = newRoomId((n) => crypto.getRandomValues(new Uint8Array(n)))
    rooms.set(id, { data: createRoom(id, request, Date.now()), clients: new Set() })
    return id
  },

  connect(id, token, events) {
    const client: Client = { token: null, events, open: false }
    later(() => {
      const room = rooms.get(id)
      if (!room) {
        events.message({ t: 'error', code: 'not-found' })
        return
      }
      client.open = true
      room.clients.add(client)
      events.status('open')
      client.token = token
      broadcast(room)
    })
    events.status('connecting')
    return {
      send(message) {
        later(() => {
          const room = rooms.get(id)
          if (!room || !client.open) return
          if (message.t === 'hello') return
          if (handle(room.data, client.token, message, Date.now(), Math.random)) broadcast(room)
          else deliver(room, client)
        })
      },
      lag: () => LATENCY * 2,
      close() {
        client.open = false
        const room = rooms.get(id)
        if (room?.clients.delete(client)) broadcast(room)
      },
    }
  },

  link: (id) => `https://chess.thanhtaiffff.workers.dev/phong/${id}`,

  demo: {
    addFriend(id) {
      const room = rooms.get(id)
      if (room && handle(room.data, BOT_TOKEN, { t: 'join', name: 'Bạn bè ảo' }, Date.now(), Math.random)) broadcast(room)
    },
  },
}
