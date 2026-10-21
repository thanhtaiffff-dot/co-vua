// Luật cờ: mọi thứ đều nhờ chess.js, file này chỉ "dịch" kết quả sang dạng giao diện cần.
import { Chess, SQUARES, type Color, type PieceSymbol, type Square } from 'chess.js'

export type PlayedMove = { from: Square; to: Square; promotion?: PieceSymbol }

export type GameStatus =
  | { kind: 'playing'; turn: Color; check: boolean }
  | { kind: 'checkmate' | 'timeout'; winner: Color }
  | { kind: 'timeoutDraw'; flagged: Color }
  | { kind: 'stalemate' | 'insufficient' | 'threefold' | 'fifty' }

export type MaterialSide = { pieces: PieceSymbol[]; score: number }

const VALUES: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
const MATERIAL_ORDER: PieceSymbol[] = ['q', 'r', 'b', 'n', 'p']

// Dựng lại ván từ danh sách nước đi, để "đi lại" chỉ là bỏ nước cuối.
// Dựng lại từ đầu cũng giữ đúng lịch sử cho luật lặp lại 3 lần.
export function replay(moves: PlayedMove[]): Chess {
  const chess = new Chess()
  for (const move of moves) chess.move(move)
  return chess
}

// Các ô mỗi quân được phép tới, theo dạng bàn cờ chessground cần.
export function legalDests(chess: Chess): Map<Square, Square[]> {
  const dests = new Map<Square, Square[]>()
  for (const square of SQUARES) {
    const targets = chess.moves({ square, verbose: true }).map((m) => m.to)
    if (targets.length > 0) dests.set(square, [...new Set(targets)])
  }
  return dests
}

export function isPromotion(chess: Chess, from: Square, to: Square): boolean {
  return chess.moves({ square: from, verbose: true }).some((m) => m.to === to && m.promotion)
}

// Ván hòa được xử tự động, không cần người chơi bấm đòi hòa.
export function gameStatus(chess: Chess): GameStatus {
  if (chess.isCheckmate()) return { kind: 'checkmate', winner: chess.turn() === 'w' ? 'b' : 'w' }
  if (chess.isStalemate()) return { kind: 'stalemate' }
  if (chess.isInsufficientMaterial()) return { kind: 'insufficient' }
  if (chess.isThreefoldRepetition()) return { kind: 'threefold' }
  if (chess.isDrawByFiftyMoves()) return { kind: 'fifty' }
  return { kind: 'playing', turn: chess.turn(), check: chess.inCheck() }
}

// Hết giờ là thua, trừ khi đối thủ không còn cách nào chiếu bí: khi đó hòa (luật FIDE).
export function timeoutStatus(chess: Chess, flagged: Color): GameStatus {
  const winner: Color = flagged === 'w' ? 'b' : 'w'
  return canCheckmate(chess, winner) ? { kind: 'timeout', winner } : { kind: 'timeoutDraw', flagged }
}

// Bên `color` còn chiếu bí được không, kể cả khi phải nhờ đối thủ đi hớ. Xét theo cách của lichess:
// chỉ còn vua thì không; một Mã cần đối thủ còn quân khác ngoài Hậu (quân đó tự chắn đường thoát của vua);
// Tượng chỉ đi một màu ô cần đối thủ còn Mã, tốt hoặc Tượng đi màu ô kia.
export function canCheckmate(chess: Chess, color: Color): boolean {
  const own: { type: PieceSymbol; light: boolean }[] = []
  const theirs: { type: PieceSymbol; light: boolean }[] = []
  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece || piece.type === 'k') continue
      const side = piece.color === color ? own : theirs
      side.push({ type: piece.type, light: chess.squareColor(piece.square) === 'light' })
    }
  }

  if (own.length === 0) return false
  if (own.some((p) => p.type === 'p' || p.type === 'r' || p.type === 'q')) return true
  const knights = own.filter((p) => p.type === 'n').length
  const bishops = own.filter((p) => p.type === 'b')
  if (knights >= 2 || (knights === 1 && bishops.length > 0)) return true
  if (knights === 1) return theirs.some((p) => p.type !== 'q')
  if (bishops.some((b) => b.light !== bishops[0].light)) return true
  return theirs.some((p) => p.type === 'n' || p.type === 'p' || (p.type === 'b' && p.light !== bishops[0].light))
}

// Chênh lệch quân trên bàn (kiểu lichess): bên nào hơn quân thì hiện quân hơn và số điểm hơn.
// Tính theo quân còn lại chứ không theo quân bị ăn, nên phong cấp vẫn đúng.
export function materialDiff(chess: Chess): Record<Color, MaterialSide> {
  const count: Record<Color, Record<PieceSymbol, number>> = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
  }
  for (const row of chess.board()) {
    for (const piece of row) if (piece) count[piece.color][piece.type]++
  }

  const result: Record<Color, MaterialSide> = { w: { pieces: [], score: 0 }, b: { pieces: [], score: 0 } }
  let balance = 0
  for (const type of MATERIAL_ORDER) {
    const diff = count.w[type] - count.b[type]
    balance += diff * VALUES[type]
    const side: Color = diff > 0 ? 'w' : 'b'
    for (let i = 0; i < Math.abs(diff); i++) result[side].pieces.push(type)
  }
  if (balance > 0) result.w.score = balance
  if (balance < 0) result.b.score = -balance
  return result
}

export function resultScore(status: GameStatus): string | null {
  if (status.kind === 'playing') return null
  if (status.kind === 'checkmate' || status.kind === 'timeout') return status.winner === 'w' ? '1–0' : '0–1'
  return '½–½'
}
