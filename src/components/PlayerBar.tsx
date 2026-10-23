import type { Color, PieceSymbol } from 'chess.js'
import { formatClock } from '../game/clock'
import { Piece } from './Piece'

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

const PIECE_NAME: Record<PieceSymbol, string> = { p: 'tốt', n: 'mã', b: 'tượng', r: 'xe', q: 'hậu', k: 'vua' }

// Thanh người chơi: tên, quân đã ăn được (quân cùng loại xếp chồng lên nhau như chess.com), điểm quân hơn, đồng hồ.
export function PlayerBar({ color, name, captured, score, active, clock, away }: Props) {
  const opponent: Color = color === 'w' ? 'b' : 'w'
  const groups: PieceSymbol[][] = []
  for (const type of captured) {
    const last = groups.at(-1)
    if (last && last[0] === type) last.push(type)
    else groups.push([type])
  }
  const said = groups.map((group) => `${group.length} ${PIECE_NAME[group[0]]}`).join(', ')
  return (
    <div className={`player${active ? ' player--active' : ''}`}>
      <span className={`player__dot player__dot--${color}`} aria-hidden="true" />
      <div className="player__info">
        <div className="player__line">
          <span className="player__name">{name}</span>
          {away && <span className="player__away">mất kết nối</span>}
        </div>
        <div className="cg-wrap player__captured" aria-label={said ? `${name} đã ăn ${said}` : `${name} chưa ăn quân nào`}>
          {groups.map((group, i) => (
            <span key={i} className="player__group">
              {group.map((type, j) => (
                <Piece key={j} type={type} color={opponent} />
              ))}
            </span>
          ))}
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
