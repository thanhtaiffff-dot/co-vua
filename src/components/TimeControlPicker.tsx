import { TIME_CONTROLS, controlLabel, describeControl, sameControl, type TimeControl } from '../game/clock'

type Props = {
  value: TimeControl | null
  onChange: (control: TimeControl | null) => void
}

// Bảng chọn thời gian, chỉ hiện trước khi ván bắt đầu. Ô có cộng giờ (3 | 2...) rê chuột vào thì hiện lời giải thích.
export function TimeControlPicker({ value, onChange }: Props) {
  return (
    <div className="tc" role="group" aria-labelledby="tc-title">
      <p className="tc__title" id="tc-title">
        Thời gian mỗi bên
      </p>
      {TIME_CONTROLS.map((group) => (
        <div key={group.name} className="tc__group">
          <span className="tc__name">{group.name}</span>
          <div className="tc__choices">
            {group.controls.map((control) => {
              const on = sameControl(control, value)
              return (
                <button
                  key={controlLabel(control)}
                  type="button"
                  className={`tc__choice${on ? ' tc__choice--on' : ''}`}
                  aria-pressed={on}
                  aria-label={describeControl(control)}
                  data-tip={control.increment > 0 ? describeControl(control) : undefined}
                  onClick={() => onChange(control)}
                >
                  {controlLabel(control)}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <button
        type="button"
        className={`tc__choice tc__choice--wide${value === null ? ' tc__choice--on' : ''}`}
        aria-pressed={value === null}
        onClick={() => onChange(null)}
      >
        Không tính giờ
      </button>
    </div>
  )
}
