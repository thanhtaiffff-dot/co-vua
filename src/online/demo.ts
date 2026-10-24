// Bản chơi thử chơi online khi chưa có máy chủ thật (ví dụ trang xem thử trên Claude): một máy chủ giả chạy ngay
// trong trình duyệt, dùng đúng luật phòng của máy chủ thật (room.ts), thư đi thư về chậm như mạng thật,
// và một "bạn bè ảo" tự đi quân để thử đi trước, xin đi lại, xin hòa, đấu ván nữa, chat khi chỉ có một mình.
import { Chess, type Move } from 'chess.js'
import { chat, chatOf, flagDue, checkFlag, createRoom, handle, seatOf, view, type RoomData, type Seat } from './room'
import { fromUci, newRoomId, type ChatLine, type ClientMessage, type ServerMessage } from './protocol'
import type { Backend } from './backend'
import type { ConnectionEvents } from './connection'
import { materialDiff, replay } from '../game/rules'

const LATENCY = 90 // thời gian một thư đi một chiều (ms)
const BOT_TOKEN = 'ban-be-ao-demo-token'
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

type Client = { token: string | null; events: ConnectionEvents; open: boolean }
type DemoRoom = {
  data: RoomData
  clients: Set<Client>
  flagTimer?: ReturnType<typeof setTimeout>
  botTimer?: ReturnType<typeof setTimeout>
  botTakebacks: { number: number; count: number } // bạn bè ảo đã xin đi lại mấy lần trong ván thứ `number`
  botReplies: number // bạn bè ảo đã trả lời chat mấy lần
  botSaidEnd: number // ván gần nhất bạn bè ảo đã nói câu hết ván
  replyTimer?: ReturnType<typeof setTimeout>
}

// Bạn bè ảo trả lời chat lần lượt theo danh sách này.
const BOT_REPLIES = ['Haha', 'Để coi ai thắng nha', 'Ghê vậy 😳', 'Từ từ, đang nghĩ', 'Nói ít thôi, đánh đi 😏', '😂😂']

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

// Gửi chat cho một người (người xem thì không nhận).
function deliverChat(room: DemoRoom, client: Client, lines: ChatLine[], all: boolean): void {
  if (!client.open || chatOf(room.data, client.token) === null) return
  const copy = JSON.parse(JSON.stringify({ t: 'chat', lines, all } satisfies ServerMessage)) as ServerMessage
  later(() => client.open && client.events.message(copy))
}

function sendChat(room: DemoRoom, line: ChatLine): void {
  for (const client of room.clients) deliverChat(room, client, [line], false)
}

// Bạn bè ảo nói một câu sau `delay` ms.
function botSay(room: DemoRoom, text: string, delay: number): void {
  setTimeout(() => {
    const line = chat(room.data, BOT_TOKEN, text, Date.now())
    if (line) sendChat(room, line)
  }, delay)
}

// Có người chat thì bạn bè ảo trả lời (nhắn dồn mấy câu thì trả lời một lần).
function botReply(room: DemoRoom, text: string): void {
  clearTimeout(room.replyTimer)
  room.replyTimer = setTimeout(() => {
    const reply = text.includes('?') ? 'Chắc vậy 🤔' : BOT_REPLIES[room.botReplies++ % BOT_REPLIES.length]
    const line = chat(room.data, BOT_TOKEN, reply, Date.now())
    if (line) sendChat(room, line)
  }, 1800)
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
  // Hết ván thì bạn bè ảo nói một câu, mỗi ván một lần.
  const game = room.data.game
  const seat = seatOf(room.data, BOT_TOKEN)
  if (game?.end && seat !== null && room.botSaidEnd !== game.number && game.end.kind !== 'aborted') {
    room.botSaidEnd = game.number
    const won = 'winner' in game.end && (game.end.winner === 'w') === (game.white === seat)
    const lost = 'winner' in game.end && !won
    botSay(room, won ? 'Hên thôi 😁' : lost ? 'Ván hay, phục 🙇' : 'Hòa cũng được', 1500)
  }
  clearTimeout(room.botTimer)
  const action = botAction(room)
  if (action) {
    room.botTimer = setTimeout(() => {
      if (handle(room.data, BOT_TOKEN, action.message(), Date.now(), Math.random)) broadcast(room)
    }, action.delay)
  }
}

// Bạn bè ảo nghĩ gì: tới lượt thì đi; được xin hòa, xin đi lại thì cân nhắc; hết ván thì rủ đấu tiếp. Thỉnh thoảng
// nó cũng xin đi lại nước vừa đi, để thử nút "Cho đi lại", "Không cho". Các lựa chọn tính theo số nước đã đi chứ không
// bốc thăm, để máy chủ giả gửi tình hình lại (có người vào xem…) thì nó không đổi ý.
function botAction(room: DemoRoom): { delay: number; message: () => ClientMessage } | null {
  const data = room.data
  const game = data.game
  const seat = seatOf(data, BOT_TOKEN)
  if (!game || seat === null) return null
  const you: Seat = seat === 0 ? 1 : 0
  const color = seat === game.white ? 'w' : 'b'
  if (game.end) {
    if (game.rematch[seat]) return null
    if (game.rematch[you]) return { delay: 1200, message: () => ({ t: 'rematch', yes: true }) }
    // Bạn chưa mời thì một lúc sau nó tự rủ; bạn đã từ chối thì thôi.
    if (game.rematchDeclined === seat) return null
    return { delay: 4500, message: () => ({ t: 'rematch', yes: true }) }
  }
  const chess = replay(game.moves.map((m) => fromUci(m)!))
  if (game.drawOffer === you) {
    const behind = materialDiff(chess)[color === 'w' ? 'b' : 'w'].score >= 2
    return { delay: 1500, message: () => ({ t: 'draw', yes: behind }) }
  }
  if (game.takeback === you) {
    // Thường thì cho đi lại, cứ bốn lần thì có một lần không cho.
    const yes = (game.number + game.moves.length) % 4 !== 0
    return { delay: 1500, message: () => ({ t: 'takeback', yes }) }
  }
  if (chess.turn() !== color) {
    // Vừa đi xong: thỉnh thoảng xin đi lại nước đó, mỗi ván tối đa hai lần.
    const asked = room.botTakebacks.number === game.number ? room.botTakebacks.count : 0
    const wants = game.moves.length >= 6 && (game.moves.length * 7 + game.number * 3 + asked * 5) % 10 < 2
    if (!wants || asked >= 2 || game.takeback !== null || game.takebackAsked[seat]) return null
    return {
      delay: 1800,
      message: () => {
        room.botTakebacks = { number: game.number, count: asked + 1 }
        return { t: 'takeback', yes: true }
      },
    }
  }
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
    rooms.set(id, {
      data: createRoom(id, request, Date.now()),
      clients: new Set(),
      botTakebacks: { number: 0, count: 0 },
      botReplies: 0,
      botSaidEnd: 0,
    })
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
      const history = chatOf(room.data, token)
      if (history) deliverChat(room, client, history, true)
    })
    events.status('connecting')
    return {
      send(message) {
        later(() => {
          const room = rooms.get(id)
          if (!room || !client.open) return
          if (message.t === 'hello') return
          if (message.t === 'chat') {
            const line = chat(room.data, client.token, message.text, Date.now())
            if (line) {
              sendChat(room, line)
              botReply(room, line.text)
            }
            return
          }
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
      if (room && handle(room.data, BOT_TOKEN, { t: 'join', name: 'Bạn bè ảo' }, Date.now(), Math.random)) {
        broadcast(room)
        botSay(room, 'Chào nha 👋', 1500)
      }
    },
  },
}
