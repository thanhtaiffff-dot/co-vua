// Thống kê một ván cho bảng "Thống kê ván" ở thẻ kết quả, tính riêng cho Trắng và Đen: thời gian nghĩ (tổng, trung
// bình, nước lâu nhất, nhanh nhất, số nước đi vội), quân đã ăn, số lần chiếu, nhập thành, phong cấp.
import type { Chess, Color, PieceSymbol } from 'chess.js'
import { capturedPieces, pieceValue } from './rules'

// Một nước trong ván: `ply` là nước thứ mấy (1 là nước đầu của Trắng), `ms` là thời gian nghĩ nước đó.
export type MoveTime = { ply: number; ms: number }

export type SideStats = {
  moves: number // số nước đã đi
  spent: number | null // tổng thời gian nghĩ các nước biết thời gian; null là không biết nước nào
  average: number | null // nghĩ trung bình mỗi nước (chỉ tính các nước biết thời gian)
  longest: MoveTime | null
  fastest: MoveTime | null
  quick: number // số nước nghĩ chưa tới QUICK_MS
  captured: PieceSymbol[] // quân đối thủ đã ăn được, xếp từ nhẹ tới nặng
  points: number // điểm của các quân đã ăn (Tốt 1, Mã 3, Tượng 3, Xe 5, Hậu 9)
  checks: number // số lần chiếu (kể cả nước chiếu bí)
  castle: { side: 'king' | 'queen'; ply: number } | null
  promotions: { piece: PieceSymbol; ply: number }[]
}

// Nghĩ chưa tới 2 giây là đi vội (hay đi trước sẵn): đáng đếm riêng để biết ai đánh nhanh.
export const QUICK_MS = 2000

function emptySide(): SideStats {
  return { moves: 0, spent: null, average: null, longest: null, fastest: null, quick: 0, captured: [], points: 0, checks: 0, castle: null, promotions: [] }
}

// `times[i]`: thời gian nghĩ của nước thứ i + 1 (ms); null hay thiếu là không biết (nước đầu của Trắng lúc đồng hồ chưa
// chạy, ván lưu từ bản cũ).
export function gameStats(chess: Chess, times: readonly (number | null | undefined)[]): Record<Color, SideStats> {
  const stats: Record<Color, SideStats> = { w: emptySide(), b: emptySide() }
  const known: Record<Color, number> = { w: 0, b: 0 }
  chess.history({ verbose: true }).forEach((move, i) => {
    const side = stats[move.color]
    const ply = i + 1
    side.moves++
    if (/[+#]/.test(move.san)) side.checks++
    if (move.isKingsideCastle()) side.castle = { side: 'king', ply }
    if (move.isQueensideCastle()) side.castle = { side: 'queen', ply }
    if (move.promotion) side.promotions.push({ piece: move.promotion, ply })
    const ms = times[i]
    if (ms === null || ms === undefined) return
    known[move.color]++
    side.spent = (side.spent ?? 0) + ms
    if (ms < QUICK_MS) side.quick++
    if (!side.longest || ms > side.longest.ms) side.longest = { ply, ms }
    if (!side.fastest || ms < side.fastest.ms) side.fastest = { ply, ms }
  })
  const captured = capturedPieces(chess)
  for (const color of ['w', 'b'] as const) {
    const side = stats[color]
    if (side.spent !== null) side.average = side.spent / known[color]
    side.captured = captured[color]
    side.points = side.captured.reduce((sum, type) => sum + pieceValue(type), 0)
  }
  return stats
}

// Nước thứ `ply` viết kiểu sách cờ: "12. Qxd5" cho Trắng, "12... Nf6" cho Đen.
export function moveLabel(ply: number, san: string): string {
  const number = Math.ceil(ply / 2)
  return ply % 2 === 1 ? `${number}. ${san}` : `${number}... ${san}`
}
