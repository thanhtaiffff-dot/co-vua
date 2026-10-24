// Quân đã ăn được của một bên, vẽ bằng đúng bộ hình quân đang dùng: quân cùng loại xếp chồng lên nhau, các loại cách
// nhau một chút (như chess.com). Dùng ở thanh người chơi và bảng thống kê ván.
import type { Color, PieceSymbol } from 'chess.js'
import { groupPieces } from '../game/rules'
import { Piece } from './Piece'

// `color` là màu của các quân bị ăn (tức màu của đối thủ).
export function CapturedPieces({ pieces, color }: { pieces: PieceSymbol[]; color: Color }) {
  return groupPieces(pieces).map((group, i) => (
    <span key={i} className="player__group">
      {group.map((type, j) => (
        <Piece key={j} type={type} color={color} />
      ))}
    </span>
  ))
}
