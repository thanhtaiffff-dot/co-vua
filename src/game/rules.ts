// Luật cờ: mọi thứ đều nhờ chess.js, file này chỉ "dịch" kết quả sang dạng giao diện cần.
import { Chess, SQUARES, type Color, type PieceSymbol, type Square } from 'chess.js'

export type PlayedMove = { from: Square; to: Square; promotion?: PieceSymbol }

export type GameStatus =
  | { kind: 'playing'; turn: Color; check: boolean }
  | { kind: 'checkmate' | 'timeout'; winner: Color }
  | { kind: 'timeoutDraw'; flagged: Color }
  | { kind: 'stalemate' | 'insufficient' | 'threefold' | 'fifty' }

// Kết quả một ván: ngoài các kiểu tự xử trên bàn cờ, chơi online còn có đầu hàng, hai bên đồng ý hòa,
// và huỷ ván (một bên thôi khi chưa ai đi quá một nước, không tính thắng thua).
export type GameResult = GameStatus | { kind: 'resign'; winner: Color } | { kind: 'agreed' } | { kind: 'aborted' }

export type MaterialSide = { pieces: PieceSymbol[]; score: number }

// Những gì một nước đi gây ra, để chọn tiếng cho đúng.
export type MoveFacts = { capture: boolean; castle: boolean; promotion: boolean; check: boolean; mate: boolean }

const VALUES: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

// Điểm của một quân, để so ai hơn quân: Tốt 1, Mã 3, Tượng 3, Xe 5, Hậu 9.
export function pieceValue(type: PieceSymbol): number {
  return VALUES[type]
}

const MATERIAL_ORDER: PieceSymbol[] = ['q', 'r', 'b', 'n', 'p']
// Quân đã ăn xếp từ nhẹ tới nặng, như chess.com.
const CAPTURE_ORDER: PieceSymbol[] = ['p', 'n', 'b', 'r', 'q']

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

// Thử đi nước `move` trên một bàn chép lại (ván đang chơi không bị đụng tới) để biết nước đó
// có ăn quân không (kể cả bắt tốt qua đường), có nhập thành, phong cấp, chiếu hay chiếu bí không.
export function describeMove(chess: Chess, move: PlayedMove): MoveFacts {
  const copy = new Chess(chess.fen())
  const played = copy.move(move)
  return {
    capture: played.captured !== undefined,
    castle: played.isKingsideCastle() || played.isQueensideCastle(),
    promotion: played.isPromotion(),
    check: copy.inCheck(),
    mate: copy.isCheckmate(),
  }
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

// Những quân mỗi bên đã ăn được của đối thủ, theo các nước đã đi (quân phong cấp bị ăn thì tính đúng quân đó).
export function capturedPieces(chess: Chess): Record<Color, PieceSymbol[]> {
  const captured: Record<Color, PieceSymbol[]> = { w: [], b: [] }
  for (const move of chess.history({ verbose: true })) if (move.captured) captured[move.color].push(move.captured)
  for (const list of Object.values(captured)) list.sort((a, b) => CAPTURE_ORDER.indexOf(a) - CAPTURE_ORDER.indexOf(b))
  return captured
}

// Gom các quân cùng loại đứng liền nhau (quân đã xếp từ nhẹ tới nặng): [p, p, n] thành [[p, p], [n]].
export function groupPieces(pieces: PieceSymbol[]): PieceSymbol[][] {
  const groups: PieceSymbol[][] = []
  for (const type of pieces) {
    const last = groups.at(-1)
    if (last && last[0] === type) last.push(type)
    else groups.push([type])
  }
  return groups
}

const PIECE_NAME: Record<PieceSymbol, string> = { p: 'tốt', n: 'mã', b: 'tượng', r: 'xe', q: 'hậu', k: 'vua' }

// Các quân viết thành lời, vd "2 tốt, 1 mã" (cho trình đọc màn hình).
export function piecesText(pieces: PieceSymbol[]): string {
  return groupPieces(pieces)
    .map((group) => `${group.length} ${PIECE_NAME[group[0]]}`)
    .join(', ')
}

// Bên thắng của một ván đã xong; null là hòa hoặc huỷ.
export function winnerOf(result: GameResult): Color | null {
  return 'winner' in result ? result.winner : null
}

// Mở ván trên bàn phân tích của lichess (web cờ miễn phí, có máy chấm từng nước). Lichess đọc các nước ngay trên
// địa chỉ: dấu cách viết thành "_", dấu chiếu "+", "#" bỏ đi (lichess tự biết), tối đa 5000 ký tự.
export function analysisUrl(sans: string[], orientation: 'white' | 'black'): string {
  const moves = sans.map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}.${san}` : san).replace(/[+#]/g, ''))
  const path = encodeURIComponent(moves.join('_').slice(0, 4900))
  return `https://lichess.org/analysis/pgn/${path}${orientation === 'black' ? '?color=black' : ''}`
}
