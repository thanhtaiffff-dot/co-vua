import type { Color } from 'chess.js'
import type { MaterialSide } from '../game/rules'
import { Piece } from './Piece'

type Props = {
  color: Color
  material: MaterialSide
  active: boolean
}

export function PlayerBar({ color, material, active }: Props) {
  const opponent: Color = color === 'w' ? 'b' : 'w'
  return (
    <div className={`player${active ? ' player--active' : ''}`}>
      <span className={`player__dot player__dot--${color}`} aria-hidden="true" />
      <span className="player__name">{color === 'w' ? 'Trắng' : 'Đen'}</span>
      <span className="cg-wrap player__captured" aria-label="Quân hơn đối thủ">
        {material.pieces.map((type, i) => (
          <Piece key={i} type={type} color={opponent} />
        ))}
      </span>
      {material.score > 0 && <span className="player__score">+{material.score}</span>}
      {active && <span className="player__turn">Tới lượt</span>}
    </div>
  )
}
