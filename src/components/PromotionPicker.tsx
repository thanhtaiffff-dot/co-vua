import type { Color, PieceSymbol } from 'chess.js'
import { Piece } from './Piece'

const CHOICES: { type: PieceSymbol; name: string }[] = [
  { type: 'q', name: 'Hậu' },
  { type: 'r', name: 'Xe' },
  { type: 'b', name: 'Tượng' },
  { type: 'n', name: 'Mã' },
]

type Props = {
  color: Color
  onPick: (type: PieceSymbol) => void
  onCancel: () => void
}

export function PromotionPicker({ color, onPick, onCancel }: Props) {
  return (
    <div className="promotion" role="dialog" aria-label="Chọn quân phong cấp" onClick={onCancel}>
      <div className="promotion__panel" onClick={(e) => e.stopPropagation()}>
        <p className="promotion__title">Phong cấp thành</p>
        <div className="cg-wrap promotion__choices">
          {CHOICES.map(({ type, name }) => (
            <button key={type} type="button" className="promotion__choice" onClick={() => onPick(type)}>
              <Piece type={type} color={color} />
              <span>{name}</span>
            </button>
          ))}
        </div>
        <button type="button" className="link-button" onClick={onCancel}>
          Đi nước khác
        </button>
      </div>
    </div>
  )
}
