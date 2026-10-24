// Thư qua lại giữa máy người chơi và máy chủ phòng khi chơi online. Máy chủ là "trọng tài": giữ ván cờ và
// đồng hồ, nhận nước đi, báo cho cả hai bên. Máy người chơi chỉ gửi ý muốn (đi nước này, xin hòa...) và vẽ lại
// theo những gì máy chủ báo.
import type { Color } from 'chess.js'
import type { TimeControl, Times } from '../game/clock'
import type { GameResult, PlayedMove } from '../game/rules'

// Chủ phòng chọn cầm Trắng, Đen, hoặc để máy chủ bốc thăm lúc bạn bè vào phòng.
export type ColorChoice = Color | 'random'

// Kết quả ván online: ngoài các kiểu của ván chơi chung một máy còn có đầu hàng, hai bên đồng ý hòa,
// và huỷ ván (một bên thôi khi chưa ai đi quá một nước, không tính thắng thua).
export type OnlineStatus = GameResult

// Gửi lên khi bấm "Tạo phòng". `token` là mã bí mật riêng của máy này, để máy chủ nhận ra chủ phòng.
export type CreateRequest = { token: string; name: string; control: TimeControl | null; color: ColorChoice }
export type CreateResponse = { id: string }

// chatOff: người này đã tắt chat (bên kia thấy dòng báo, khỏi nói một mình).
export type PlayerView = { name: string; online: boolean; chatOff: boolean }

// Đồng hồ như máy chủ thấy lúc gửi thư: thời gian còn lại của hai bên và bên nào đang bị trừ giờ.
export type ClockView = { control: TimeControl; times: Times; running: Color | null }

export type GameView = {
  number: number // ván thứ mấy trong phòng (tái đấu thì tăng lên)
  you: Color | null // màu của người đang mở trang; null là người ngoài đứng xem
  players: Record<Color, PlayerView>
  score: Record<Color, number> // tỉ số cả trận của người đang cầm màu đó, tính từ ván đầu trong phòng
  moves: string[] // các nước đã đi, viết kiểu "e2e4", phong cấp thì thêm quân: "e7e8q"
  moveTimes: (number | null)[] // thời gian nghĩ từng nước (ms, đã trừ thời gian đường truyền); null là không biết
  clock: ClockView | null // null: không tính giờ
  status: OnlineStatus
  drawOffer: Color | null // bên đang xin hòa
  takeback: Color | null // bên đang xin đi lại
  takebackDeclined: Color | null // bên vừa bị từ chối cho đi lại (tới nước sau thì thôi)
  takebackAsked: Record<Color, boolean> // bên đã xin đi lại trong lượt này (mỗi lượt xin một lần)
  rematch: Record<Color, boolean> // bên nào đã bấm tái đấu
  rematchDeclined: Color | null // bên vừa bị từ chối đấu ván nữa
}

export type RoomView = {
  id: string
  control: TimeControl | null
  host: PlayerView
  hostColor: ColorChoice
  role: 'host' | 'guest' | 'visitor' // người đang mở trang là chủ phòng, khách, hay người ngoài
  game: GameView | null // null: đang chờ bạn bè vào phòng
}

// Một câu chat giữa hai người chơi. Màu quân đổi qua các ván nên ghi theo người gửi là chủ phòng hay khách;
// `game`: gửi trong ván thứ mấy, để khung chat kẻ vạch "Ván 2" khi đấu ván nữa.
export type ChatLine = { id: number; by: 'host' | 'guest'; text: string; at: number; game: number }

export type ClientMessage =
  | { t: 'hello'; token: string } // gửi đầu tiên mỗi lần nối mạng, để máy chủ biết mình là ai
  | { t: 'join'; name: string } // bạn bè bấm "Vào chơi"
  | { t: 'move'; uci: string; ply: number; lag: number } // ply: nước thứ mấy; lag: thời gian đường truyền đi về (ms)
  | { t: 'resign' } // đầu hàng (chưa ai đi quá một nước thì là huỷ ván)
  | { t: 'draw'; yes: boolean } // xin hòa, đồng ý hòa; `yes: false` là từ chối hoặc rút lời xin
  | { t: 'takeback'; yes: boolean } // xin đi lại, đồng ý cho đi lại; `yes: false` là từ chối hoặc rút lời xin
  | { t: 'rematch'; yes: boolean } // xin tái đấu, đồng ý tái đấu; `yes: false` là từ chối hoặc rút lời mời
  | { t: 'chat'; text: string } // gửi một câu chat (chỉ hai người chơi)
  | { t: 'chatOff'; off: boolean } // tắt hoặc bật lại chat của mình

// Máy chủ báo lỗi rồi ngắt đường dây, máy người chơi thôi không nối lại:
// - not-found: không có phòng này;
// - full: phòng đã đủ MAX_VISITORS người xem;
// - replaced: người này mở phòng ở quá nhiều tab hoặc máy, tab cũ nhất bị ngắt để nhường chỗ cho tab mới.
export type ErrorCode = 'not-found' | 'full' | 'replaced'

// Chat gửi riêng, không nằm trong thư tình hình, để mỗi nước đi khỏi phải gửi lại cả trăm câu chat.
// `all`: đây là toàn bộ chat (lúc vừa nối mạng); không thì là câu mới thêm. Người xem không nhận chat.
export type ServerMessage = { t: 'state'; room: RoomView } | { t: 'chat'; lines: ChatLine[]; all: boolean } | { t: 'error'; code: ErrorCode }

// Mỗi phòng cho tối đa bấy nhiêu người xem cùng lúc (không tính hai người chơi), để kẻ có link không mở
// hàng trăm đường dây làm đơ ván.
export const MAX_VISITORS = 8

// Mỗi câu chat dài tối đa CHAT_LIMIT ký tự; máy chủ giữ CHAT_KEEP câu gần nhất của cả phòng (qua các ván).
// Mỗi người gửi liền một lúc tối đa CHAT_BURST câu, sau đó CHAT_PER_SECOND câu mỗi giây; dày hơn thì máy chủ bỏ.
export const CHAT_LIMIT = 200
export const CHAT_KEEP = 100
export const CHAT_BURST = 5
export const CHAT_PER_SECOND = 1

// Mỗi phòng có mã 8 ký tự, bỏ các chữ dễ nhầm (l, 1, o, 0, i).
export const ROOM_ID = /^[a-hjkmnp-z2-9]{8}$/
const ROOM_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

export function newRoomId(randomBytes: (n: number) => Uint8Array): string {
  return Array.from(randomBytes(8), (byte) => ROOM_ALPHABET[byte % ROOM_ALPHABET.length]).join('')
}

// Bên `by` được đi lại thì lùi mấy nửa nước: đang tới lượt đối thủ (mình vừa đi) thì lùi nước của mình; đang tới lượt
// mình (đối thủ vừa đi) thì lùi cả nước của đối thủ lẫn nước của mình trước đó, để lại tới lượt mình.
export function takebackPlies(moveCount: number, by: Color): number {
  return (moveCount % 2 === 0 ? 'w' : 'b') === by ? 2 : 1
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
