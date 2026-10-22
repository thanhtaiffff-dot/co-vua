// Luật của một phòng chơi online: ai ngồi ghế nào, ai cầm màu gì, nước đi có hợp lệ không, đồng hồ trừ bao nhiêu,
// khi nào hết ván, tỉ số, tái đấu. Máy chủ (worker/room.ts) giữ dữ liệu phòng và gọi các hàm ở đây.
// Các hàm không tự đọc giờ thật hay bốc thăm, mà nhận `now`, `random` từ ngoài vào, nên test được từng tình huống
// và dùng lại được cho bản chơi thử chạy ngay trong trình duyệt.
import type { Color } from 'chess.js'
import { TIME_CONTROLS, flagTime, lastTimes, newClock, recordMove, sameControl, type ClockState, type TimeControl } from '../game/clock'
import { gameStatus, replay, timeoutStatus } from '../game/rules'
import { fromUci, type ClientMessage, type ClockView, type ColorChoice, type CreateRequest, type GameView, type OnlineStatus, type RoomView } from './protocol'

// Ghế 0 là chủ phòng, ghế 1 là bạn bè vào sau.
export type Seat = 0 | 1

export type SeatData = {
  token: string
  name: string
  lag: number // thời gian đường truyền gần nhất của người này (ms), để không xử thua oan khi mạng chậm
}

export type GameData = {
  number: number
  white: Seat // ghế đang cầm Trắng
  moves: string[]
  clock: ClockState
  end: OnlineStatus | null // null: đang chơi
  endedAt: number // lúc hết ván, để đồng hồ dừng đúng chỗ
  drawOffer: Seat | null
  rematch: [boolean, boolean]
}

export type RoomData = {
  id: string
  control: TimeControl | null
  hostColor: ColorChoice
  seats: SeatData[]
  game: GameData | null
  score: [number, number] // tỉ số theo ghế, cộng dồn qua các ván tái đấu
  updated: number
}

// Thời gian đường truyền được trả lại tối đa cho mỗi nước (giống lichess): mạng chậm hơn nữa thì người đi chịu.
export const MAX_LAG_CREDIT = 1000
const NAME_LIMIT = 20

export function cleanName(name: unknown): string {
  if (typeof name !== 'string') return ''
  // Bỏ ký tự điều khiển, dồn khoảng trắng, cắt theo ký tự thật (emoji, chữ có dấu không bị cắt đôi).
  const clean = name.replace(/[\p{Cc}\p{Cf}]/gu, '').replace(/\s+/g, ' ').trim()
  return [...clean].slice(0, NAME_LIMIT).join('')
}

function validToken(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(token)
}

// Đọc yêu cầu tạo phòng gửi từ ngoài vào; sai kiểu thì trả về null. Mức giờ phải là một trong các mức có sẵn.
export function parseCreateRequest(body: unknown): CreateRequest | null {
  if (typeof body !== 'object' || body === null) return null
  const { token, name, control, color } = body as Record<string, unknown>
  if (!validToken(token)) return null
  if (color !== 'w' && color !== 'b' && color !== 'random') return null
  let tc: TimeControl | null = null
  if (control !== null) {
    const known = TIME_CONTROLS.flatMap((group) => group.controls).find((c) => sameControl(c, control as TimeControl))
    if (!known) return null
    tc = { ...known }
  }
  return { token, name: cleanName(name), control: tc, color }
}

export function createRoom(id: string, request: CreateRequest, now: number): RoomData {
  return {
    id,
    control: request.control,
    hostColor: request.color,
    seats: [{ token: request.token, name: request.name, lag: 0 }],
    game: null,
    score: [0, 0],
    updated: now,
  }
}

export function seatOf(room: RoomData, token: string | null): Seat | null {
  const index = room.seats.findIndex((seat) => seat.token === token)
  return index === 0 || index === 1 ? index : null
}

function colorOf(game: GameData, seat: Seat): Color {
  return seat === game.white ? 'w' : 'b'
}

function seatWith(game: GameData, color: Color): Seat {
  return color === 'w' ? game.white : game.white === 0 ? 1 : 0
}

function newGame(number: number, white: Seat, control: TimeControl | null): GameData {
  return { number, white, moves: [], clock: newClock(control), end: null, endedAt: 0, drawOffer: null, rematch: [false, false] }
}

// Bạn bè bấm "Vào chơi": ngồi ghế còn trống, máy chủ bốc màu nếu chủ phòng chọn ngẫu nhiên, rồi bắt đầu ván.
export function join(room: RoomData, token: string, name: string, random: () => number): boolean {
  if (room.seats.length >= 2 || seatOf(room, token) !== null) return false
  room.seats.push({ token, name: cleanName(name), lag: 0 })
  const hostColor = room.hostColor === 'random' ? (random() < 0.5 ? 'w' : 'b') : room.hostColor
  room.game = newGame(1, hostColor === 'w' ? 0 : 1, room.control)
  return true
}

function finish(room: RoomData, game: GameData, end: OnlineStatus, now: number): void {
  game.end = end
  game.endedAt = now
  game.drawOffer = null
  if (end.kind === 'aborted') return
  if ('winner' in end) room.score[seatWith(game, end.winner)] += 1
  else {
    room.score[0] += 0.5
    room.score[1] += 0.5
  }
}

// Dựng lại bàn cờ từ các nước đã đi.
function board(game: GameData) {
  return replay(game.moves.map((uci) => fromUci(uci)!))
}

function turnOf(game: GameData): Color {
  return game.moves.length % 2 === 0 ? 'w' : 'b'
}

// Lúc máy chủ xử bên đang tới lượt hết giờ: lúc đồng hồ về 0, cộng thêm thời gian đường truyền của người đó
// (nước đi có thể đang trên đường tới). null khi đồng hồ không chạy.
export function flagDue(room: RoomData): number | null {
  const game = room.game
  if (!game || game.end) return null
  const turn = turnOf(game)
  const flag = flagTime(game.clock, turn)
  return flag === null ? null : flag + room.seats[seatWith(game, turn)].lag
}

// Bên đang tới lượt hết giờ chưa; hết rồi thì kết thúc ván (thua, hoặc hòa nếu đối thủ không đủ quân chiếu bí).
export function checkFlag(room: RoomData, now: number): boolean {
  const due = flagDue(room)
  const game = room.game
  if (due === null || !game || now < due) return false
  const turn = turnOf(game)
  finish(room, game, timeoutStatus(board(game), turn), due)
  return true
}

function move(room: RoomData, seat: Seat, uci: string, ply: number, lag: number, now: number): boolean {
  const game = room.game
  if (!game || game.end || ply !== game.moves.length) return false
  const color = colorOf(game, seat)
  const played = fromUci(uci)
  if (!played || turnOf(game) !== color) return false
  const chess = board(game)
  const credit = Math.min(MAX_LAG_CREDIT, Math.max(0, Number.isFinite(lag) ? lag : 0))
  room.seats[seat].lag = credit
  // Nước đi tới nơi khi đồng hồ đã về 0 (kể cả sau khi trả lại thời gian đường truyền) thì không nhận: hết giờ.
  const flag = flagTime(game.clock, color)
  if (flag !== null && now - credit >= flag) {
    finish(room, game, timeoutStatus(chess, color), flag)
    return true
  }
  let lan: string
  try {
    lan = chess.move(played).lan
  } catch {
    return false
  }
  game.moves.push(lan)
  game.clock = recordMove(game.clock, color, now, credit)
  // Đối thủ đang xin hòa mà mình đi tiếp thay vì đồng ý, coi như từ chối.
  if (game.drawOffer !== null && game.drawOffer !== seat) game.drawOffer = null
  const status = gameStatus(chess)
  if (status.kind !== 'playing') finish(room, game, status, now)
  return true
}

function resign(room: RoomData, seat: Seat, now: number): boolean {
  const game = room.game
  if (!game || game.end) return false
  // Chưa ai đi quá một nước thì chỉ là huỷ ván, không ai thua.
  const end: OnlineStatus = game.moves.length < 2 ? { kind: 'aborted' } : { kind: 'resign', winner: colorOf(game, seat) === 'w' ? 'b' : 'w' }
  finish(room, game, end, now)
  return true
}

function draw(room: RoomData, seat: Seat, yes: boolean, now: number): boolean {
  const game = room.game
  if (!game || game.end || game.moves.length < 2) return false
  if (!yes) {
    if (game.drawOffer === null) return false
    game.drawOffer = null
    return true
  }
  if (game.drawOffer === seat) return false
  if (game.drawOffer === null) game.drawOffer = seat
  else finish(room, game, { kind: 'agreed' }, now)
  return true
}

// Hết ván, hai bên cùng bấm tái đấu thì chơi ván mới cùng mức giờ, đổi màu cho nhau (như chess.com).
function rematch(room: RoomData, seat: Seat, yes: boolean): boolean {
  const game = room.game
  if (!game || !game.end || game.rematch[seat] === yes) return false
  game.rematch[seat] = yes
  if (game.rematch[0] && game.rematch[1]) room.game = newGame(game.number + 1, game.white === 0 ? 1 : 0, room.control)
  return true
}

// Làm theo thư của người có mã `token`. Trả về true nếu phòng có thay đổi (cần lưu lại và báo cho mọi người).
// Thư "hello" do phần nối mạng tự xử, không vào đây.
export function handle(room: RoomData, token: string | null, message: ClientMessage, now: number, random: () => number): boolean {
  const flagged = checkFlag(room, now)
  if (token === null) return flagged
  if (message.t === 'join') return join(room, token, message.name, random) || flagged
  const seat = seatOf(room, token)
  if (seat === null) return flagged
  let changed = false
  switch (message.t) {
    case 'move':
      changed = move(room, seat, message.uci, message.ply, message.lag, now)
      break
    case 'resign':
      changed = resign(room, seat, now)
      break
    case 'draw':
      changed = draw(room, seat, message.yes === true, now)
      break
    case 'rematch':
      changed = rematch(room, seat, message.yes === true)
      break
  }
  if (changed) room.updated = now
  return changed || flagged
}

function clockView(game: GameData, now: number): ClockView | null {
  const last = lastTimes(game.clock)
  if (!game.clock.control || !last) return null
  const times = { ...last }
  const turn = turnOf(game)
  const flag = flagTime(game.clock, turn)
  // Đồng hồ đang chạy thì trừ phần đã trôi của lượt này; hết ván thì dừng ở lúc hết ván.
  if (flag !== null) times[turn] = Math.max(0, flag - (game.end ? game.endedAt : now))
  return { control: game.clock.control, times, running: flag !== null && !game.end ? turn : null }
}

// Những gì người có mã `token` được thấy (không lộ mã của ai). `online[ghế]`: người ngồi ghế đó đang mở trang.
export function view(room: RoomData, token: string | null, now: number, online: [boolean, boolean]): RoomView {
  const seat = seatOf(room, token)
  const game = room.game
  const name = (s: Seat) => room.seats[s]?.name ?? ''
  let gameView: GameView | null = null
  if (game) {
    const byColor = <T,>(pick: (s: Seat) => T): Record<Color, T> =>
      game.white === 0 ? { w: pick(0), b: pick(1) } : { w: pick(1), b: pick(0) }
    const status = game.end ?? gameStatus(board(game))
    gameView = {
      number: game.number,
      you: seat === null ? null : colorOf(game, seat),
      players: byColor((s) => ({ name: name(s), online: online[s] })),
      score: byColor((s) => room.score[s]),
      moves: [...game.moves],
      clock: clockView(game, now),
      status,
      drawOffer: game.drawOffer === null ? null : colorOf(game, game.drawOffer),
      rematch: byColor((s) => game.rematch[s]),
    }
  }
  return {
    id: room.id,
    control: room.control,
    host: { name: name(0), online: online[0] },
    hostColor: room.hostColor,
    role: seat === 0 ? 'host' : seat === 1 ? 'guest' : 'visitor',
    game: gameView,
  }
}
