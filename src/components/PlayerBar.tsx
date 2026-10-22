import type { Color } from 'chess.js'
import { formatClock } from '../game/clock'
import type { MaterialSide } from '../game/rules'
import { Piece } from './Piece'

// Đồng hồ của một bên: `running` khi đang bị trừ giờ, `low` khi sắp hết giờ.
export type ClockFace = { ms: number; running: boolean; low: boolean }

type Props = {
  color: Color
  material: MaterialSide
  active: boolean
  clock: ClockFace | null
  name?: string // chơi online: tên người chơi (để trống thì gọi theo màu quân)
  away?: boolean // chơi online: người này đang mất kết nối
}

export function PlayerBar({ color, material, active, clock, name: playerName, away }: Props) {
  const opponent: Color = color === 'w' ? 'b' : 'w'
  const name = playerName || (color === 'w' ? 'Trắng' : 'Đen')
  return (
    <div className={`player${active ? ' player--active' : ''}`}>
      <span className={`player__dot player__dot--${color}`} aria-hidden="true" />
      <span className="player__name">{name}</span>
      {away && <span className="player__away">mất kết nối</span>}
      <span className="cg-wrap player__captured" aria-label="Quân hơn đối thủ">
        {material.pieces.map((type, i) => (
          <Piece key={i} type={type} color={opponent} />
        ))}
      </span>
      {material.score > 0 && <span className="player__score">+{material.score}</span>}
      {clock ? (
        <span
          className={`clock${clock.running ? ' clock--running' : ''}${clock.low ? ' clock--low' : ''}${clock.ms <= 0 ? ' clock--out' : ''}`}
          role="timer"
          aria-label={`Đồng hồ của ${name}`}
        >
          {formatClock(clock.ms)}
        </span>
      ) : (
        active && <span className="player__turn">Tới lượt</span>
      )}
    </div>
  )
}
