import type { Color, PieceSymbol } from 'chess.js'
import { formatClock } from '../game/clock'
import { piecesText } from '../game/rules'
import { Avatar } from './Avatar'
import { CapturedPieces } from './CapturedPieces'

// Đồng hồ của một bên: `running` khi đang bị trừ giờ, `low` khi sắp hết giờ.
export type ClockFace = { ms: number; running: boolean; low: boolean }

type Props = {
  color: Color
  name: string // tên người chơi đã nhập ('' là chưa nhập): hiện trên thanh và vẽ ảnh đại diện
  fallback?: string // chữ hiện thay khi chưa nhập tên (online: "Bạn", "Đối thủ"); không có thì thanh không có chữ
  rival: string // tên người bên kia đã nhập, để hai ảnh đại diện không trùng màu
  label: string // tên để máy đọc màn hình đọc, không bao giờ trống (vd "Trắng")
  captured: PieceSymbol[] // quân của đối thủ mà bên này đã ăn, xếp từ nhẹ tới nặng
  score: number // hơn đối thủ bao nhiêu điểm quân (0 là không hơn)
  active: boolean
  clock: ClockFace | null
  away?: boolean // chơi online: người này đang mất kết nối
  online?: boolean // chơi online: hiện chấm kết nối ở góc ảnh đại diện
}

// Thanh người chơi: ảnh đại diện, tên, quân đã ăn được (quân cùng loại xếp chồng lên nhau như chess.com), điểm quân hơn,
// đồng hồ. Không ghi "Trắng", "Đen": quân bên nào nằm phía nào ai cũng thấy, còn màu quân nằm luôn ở đồng hồ (hộp sáng
// là Trắng, hộp tối là Đen, như đồng hồ cờ thật).
export function PlayerBar({ color, name, fallback = '', rival, label, captured, score, active, clock, away, online }: Props) {
  const opponent: Color = color === 'w' ? 'b' : 'w'
  const said = piecesText(captured)
  const shown = name || fallback
  return (
    <div className={`player${active ? ' player--active' : ''}`}>
      <Avatar name={name} rival={rival} black={color === 'b'} status={online ? (away ? 'off' : 'on') : undefined} />
      <div className="player__info">
        {(shown || away) && (
          <div className="player__line">
            {shown && <span className="player__name">{shown}</span>}
            {away && <span className="player__away">mất kết nối</span>}
          </div>
        )}
        <div className="cg-wrap player__captured" aria-label={said ? `${label} đã ăn ${said}` : `${label} chưa ăn quân nào`}>
          <CapturedPieces pieces={captured} color={opponent} />
          {score > 0 && <span className="player__score">+{score}</span>}
        </div>
      </div>
      {clock ? (
        <span
          className={`clock clock--${color}${active ? ' clock--turn' : ''}${clock.running ? ' clock--running' : ''}${clock.low ? ' clock--low' : ''}${clock.ms <= 0 ? ' clock--out' : ''}`}
          role="timer"
          aria-label={`Đồng hồ của ${label}`}
        >
          {clock.running && <ClockIcon />}
          {formatClock(clock.ms)}
        </span>
      ) : (
        active && <span className="player__turn">Tới lượt</span>
      )}
    </div>
  )
}

// Hình đồng hồ nhỏ có kim nhích mỗi giây, chỉ hiện ở đồng hồ đang chạy (như chess.com).
function ClockIcon() {
  return (
    <svg className="clock__icon" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path className="clock__hand" d="M8 8V3.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
