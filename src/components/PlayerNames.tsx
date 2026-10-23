// Ô nhập tên hai người chơi chung một máy. Chỉ đổi được trước khi ván bắt đầu (cùng chỗ chọn thời gian).
// Nút giữa đổi màu cho hai người (ván sau đổi bên).
import type { Color } from 'chess.js'
import { NAME_LIMIT, type Names } from '../names'

type Props = {
  names: Names
  onChange: (names: Names) => void
}

const SIDES: { color: Color; label: string }[] = [
  { color: 'w', label: 'Trắng' },
  { color: 'b', label: 'Đen' },
]

export function PlayerNames({ names, onChange }: Props) {
  return (
    <div className="card names" role="group" aria-labelledby="names-title">
      <p className="card__heading" id="names-title">
        Tên người chơi
      </p>
      <div className="names__row">
        {SIDES.map(({ color, label }, i) => (
          <label key={color} className={`names__field names__field--${color}`} style={{ order: i * 2 }}>
            <span className="names__label">
              <span className={`player__dot player__dot--${color}`} aria-hidden="true" />
              {label}
            </span>
            <input
              className="field__input"
              value={names[color]}
              maxLength={NAME_LIMIT}
              placeholder="Nhập tên"
              autoComplete="off"
              enterKeyHint="done"
              onChange={(e) => onChange({ ...names, [color]: e.target.value })}
            />
          </label>
        ))}
        <button
          type="button"
          className="names__swap"
          style={{ order: 1 }}
          aria-label="Đổi màu cho hai người"
          title="Đổi màu cho hai người"
          onClick={() => onChange({ w: names.b, b: names.w })}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />
          </svg>
        </button>
      </div>
      <p className="card__hint">Để trống thì gọi theo màu quân. Ván sau đổi bên thì bấm nút giữa.</p>
    </div>
  )
}
