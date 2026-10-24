// Đi trước nhiều nước (như chess.com): lúc đối thủ đang nghĩ, người chơi kéo sẵn một chuỗi nước. Bàn cờ hiện quân mình
// ở chỗ mới sau các nước đó (nên kéo tiếp được từ chỗ mới), các ô của nước đi trước tô màu. Tới lượt mình thì đi nước
// đầu hàng nếu nó còn hợp lệ; nước nào không đi được (quân bị ăn, đường bị chắn…) thì huỷ cả chuỗi còn lại.
import type { Chess, Color, PieceSymbol, Square } from 'chess.js'
import type { PlayedMove } from '../game/rules'

export type Premove = { from: Square; to: Square }

// Tối đa bấy nhiêu nước đi trước một lúc, đủ cho một đòn phối hợp dài mà không lỡ tay xếp cả ván.
export const MAX_PREMOVES = 12

type BoardPiece = { type: PieceSymbol; color: Color }

const FILES = 'abcdefgh'
const ROLE_LETTER: Record<PieceSymbol, string> = { p: 'p', n: 'n', b: 'b', r: 'r', q: 'q', k: 'k' }

// Vua đi từ ô ban đầu sang ngang hai ô, hay tới ô Xe của mình: đó là nhập thành. Trả về nước nhập thành theo cách
// chess.js hiểu (vua tới cột g hoặc c), cùng đường đi của Xe.
function castling(piece: BoardPiece, premove: Premove): { king: Square; rook: [Square, Square] } | null {
  const rank = piece.color === 'w' ? '1' : '8'
  if (piece.type !== 'k' || premove.from !== `e${rank}` || premove.to[1] !== rank) return null
  const file = premove.to[0]
  if (file === 'g' || file === 'h') return { king: `g${rank}` as Square, rook: [`h${rank}` as Square, `f${rank}` as Square] }
  if (file === 'c' || file === 'a') return { king: `c${rank}` as Square, rook: [`a${rank}` as Square, `d${rank}` as Square] }
  return null
}

// Thế cờ người chơi đang thấy khi đã đặt sẵn các nước đi trước: quân mình dời tới ô đích (quân đứng ở đó coi như bị ăn),
// nhập thành thì dời cả Xe, tốt tới hàng cuối thì thành Hậu. Trả về phần xếp quân của FEN cho bàn cờ, và các ô cần tô.
export function premoveBoard(chess: Chess, color: Color, premoves: Premove[]): { fen: string; squares: Map<Square, string> } {
  const pieces = new Map<Square, BoardPiece>()
  for (const row of chess.board()) for (const piece of row) if (piece) pieces.set(piece.square, { type: piece.type, color: piece.color })
  const squares = new Map<Square, string>()
  for (const premove of premoves) {
    const piece = pieces.get(premove.from)
    if (!piece || piece.color !== color) break
    const castle = castling(piece, premove)
    const rook = castle ? pieces.get(castle.rook[0]) : undefined
    pieces.delete(premove.from)
    if (castle && rook?.type === 'r' && rook.color === color) {
      pieces.delete(castle.rook[0])
      pieces.set(castle.king, piece)
      pieces.set(castle.rook[1], rook)
    } else {
      const last = premove.to[1] === (color === 'w' ? '8' : '1')
      pieces.set(premove.to, piece.type === 'p' && last ? { type: 'q', color } : piece)
    }
    squares.set(premove.from, 'current-premove')
    squares.set(premove.to, 'current-premove')
  }
  const ranks: string[] = []
  for (let rank = 8; rank >= 1; rank--) {
    let line = ''
    let empty = 0
    for (const file of FILES) {
      const piece = pieces.get(`${file}${rank}` as Square)
      if (!piece) {
        empty++
        continue
      }
      if (empty) line += empty
      empty = 0
      const letter = ROLE_LETTER[piece.type]
      line += piece.color === 'w' ? letter.toUpperCase() : letter
    }
    ranks.push(empty ? line + empty : line)
  }
  return { fen: ranks.join('/'), squares }
}

// Nước đi trước `premove` thành nước đi thật trên thế cờ `chess` (tới lượt người đặt), hoặc null nếu giờ không đi được.
// Phong cấp thì tự lên Hậu (như lichess), vì không kịp hỏi.
export function premoveToMove(chess: Chess, premove: Premove): PlayedMove | null {
  const piece = chess.get(premove.from)
  if (!piece || piece.color !== chess.turn()) return null
  const to = castling(piece, premove)?.king ?? premove.to
  const legal = chess.moves({ square: premove.from, verbose: true }).find((move) => move.to === to)
  if (!legal) return null
  return legal.promotion ? { from: premove.from, to, promotion: 'q' } : { from: premove.from, to }
}
