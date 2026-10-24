import type { Color, PieceSymbol } from 'chess.js'
import { formatClock } from '../game/clock'
import { piecesText } from '../game/rules'
import { CapturedPieces } from './CapturedPieces'

// Đồng hồ của một bên: `running` khi đang bị trừ giờ, `low` khi sắp hết giờ.
export type ClockFace = { ms: number; running: boolean; low: boolean }

type Props = {
  color: Color
  name: string
  captured: PieceSymbol[] // quân của đối thủ mà bên này đã ăn, xếp từ nhẹ tới nặng
  score: number // hơn đối thủ bao nhiêu điểm quân (0 là không hơn)
  active: boolean
  clock: ClockFace | null
  away?: boolean // chơi online: người này đang mất kết nối
}

// Thanh người chơi: tên, quân đã ăn được (quân cùng loại xếp chồng lên nhau như chess.com), điểm quân hơn, đồng hồ.
export function PlayerBar({ color, name, captured, score, active, clock, away }: Props) {
  const opponent: Color = color === 'w' ? 'b' : 'w'
  const said = piecesText(captured)
  return (
    <div className={`player${active ? ' player--active' : ''}`}>
      <span className={`player__dot player__dot--${color}`} aria-hidden="true" />
      <div className="player__info">
        <div className="player__line">
          <span className="player__name">{name}</span>
          {away && <span className="player__away">mất kết nối</span>}
        </div>
        <div className="cg-wrap player__captured" aria-label={said ? `${name} đã ăn ${said}` : `${name} chưa ăn quân nào`}>
          <CapturedPieces pieces={captured} color={opponent} />
          {score > 0 && <span className="player__score">+{score}</span>}
        </div>
      </div>
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
