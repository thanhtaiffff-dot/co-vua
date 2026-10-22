// Thư qua lại giữa máy người chơi và máy chủ phòng khi chơi online. Máy chủ là "trọng tài": giữ ván cờ và
// đồng hồ, nhận nước đi, báo cho cả hai bên. Máy người chơi chỉ gửi ý muốn (đi nước này, xin hòa...) và vẽ lại
// theo những gì máy chủ báo.
import type { Color } from 'chess.js'
import type { TimeControl, Times } from '../game/clock'
import type { GameStatus, PlayedMove } from '../game/rules'

// Chủ phòng chọn cầm Trắng, Đen, hoặc để máy chủ bốc thăm lúc bạn bè vào phòng.
export type ColorChoice = Color | 'random'

// Kết quả ván online: ngoài các kiểu của ván chơi chung một máy còn có đầu hàng, hai bên đồng ý hòa,
// và huỷ ván (một bên thôi khi chưa ai đi quá một nước, không tính thắng thua).
export type OnlineStatus = GameStatus | { kind: 'resign'; winner: Color } | { kind: 'agreed' } | { kind: 'aborted' }

// Gửi lên khi bấm "Tạo phòng". `token` là mã bí mật riêng của máy này, để máy chủ nhận ra chủ phòng.
export type CreateRequest = { token: string; name: string; control: TimeControl | null; color: ColorChoice }
export type CreateResponse = { id: string }

export type PlayerView = { name: string; online: boolean }

// Đồng hồ như máy chủ thấy lúc gửi thư: thời gian còn lại của hai bên và bên nào đang bị trừ giờ.
export type ClockView = { control: TimeControl; times: Times; running: Color | null }

export type GameView = {
  number: number // ván thứ mấy trong phòng (tái đấu thì tăng lên)
  you: Color | null // màu của người đang mở trang; null là người ngoài đứng xem
  players: Record<Color, PlayerView>
  score: Record<Color, number> // tỉ số cả trận của người đang cầm màu đó, tính từ ván đầu trong phòng
  moves: string[] // các nước đã đi, viết kiểu "e2e4", phong cấp thì thêm quân: "e7e8q"
  clock: ClockView | null // null: không tính giờ
  status: OnlineStatus
  drawOffer: Color | null // bên đang xin hòa
  rematch: Record<Color, boolean> // bên nào đã bấm tái đấu
}

export type RoomView = {
  id: string
  control: TimeControl | null
  host: PlayerView
  hostColor: ColorChoice
  role: 'host' | 'guest' | 'visitor' // người đang mở trang là chủ phòng, khách, hay người ngoài
  game: GameView | null // null: đang chờ bạn bè vào phòng
}

export type ClientMessage =
  | { t: 'hello'; token: string } // gửi đầu tiên mỗi lần nối mạng, để máy chủ biết mình là ai
  | { t: 'join'; name: string } // bạn bè bấm "Vào chơi"
  | { t: 'move'; uci: string; ply: number; lag: number } // ply: nước thứ mấy; lag: thời gian đường truyền đi về (ms)
  | { t: 'resign' } // đầu hàng (chưa ai đi quá một nước thì là huỷ ván)
  | { t: 'draw'; yes: boolean } // xin hòa, đồng ý hòa; `yes: false` là từ chối hoặc rút lời xin
  | { t: 'rematch'; yes: boolean } // xin tái đấu, đồng ý tái đấu; `yes: false` là thôi

export type ServerMessage = { t: 'state'; room: RoomView } | { t: 'error'; code: 'not-found' }

// Mỗi phòng có mã 8 ký tự, bỏ các chữ dễ nhầm (l, 1, o, 0, i).
export const ROOM_ID = /^[a-hjkmnp-z2-9]{8}$/
const ROOM_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

export function newRoomId(randomBytes: (n: number) => Uint8Array): string {
  return Array.from(randomBytes(8), (byte) => ROOM_ALPHABET[byte % ROOM_ALPHABET.length]).join('')
}

export function toUci(move: PlayedMove): string {
  return move.from + move.to + (move.promotion ?? '')
}

export function fromUci(uci: string): PlayedMove | null {
  const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(uci)
  if (!match) return null
  const move = { from: match[1], to: match[2] } as PlayedMove
  if (match[3]) move.promotion = match[3] as PlayedMove['promotion']
  return move
}
