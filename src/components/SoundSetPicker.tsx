// Ô chọn bộ tiếng, nằm cạnh nút loa. Bên trong là ô chọn sẵn có của trình duyệt, phủ trong suốt lên nút
// hình nốt nhạc: trên điện thoại bấm vào sẽ hiện danh sách to, dễ chọn.
import { SOUND_SETS, type SoundSet } from '../sound'

const LABEL: Record<SoundSet, string> = { wood: 'Gỗ', '8bit': '8-bit', bubble: 'Bong bóng' }

type Props = {
  value: SoundSet
  onChange: (set: SoundSet) => void
}

export function SoundSetPicker({ value, onChange }: Props) {
  return (
    <label className="icon-btn sound-set" title={`Bộ tiếng: ${LABEL[value]}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9.2 17.4V7.6l11-2.6v10.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="m9.2 8.4 11-2.6" fill="none" stroke="currentColor" strokeWidth="2.8" />
        <ellipse cx="6.9" cy="17.5" rx="2.6" ry="2.05" transform="rotate(-20 6.9 17.5)" fill="currentColor" />
        <ellipse cx="17.9" cy="15.3" rx="2.6" ry="2.05" transform="rotate(-20 17.9 15.3)" fill="currentColor" />
      </svg>
      <span className="sound-set__name">{LABEL[value]}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as SoundSet)} aria-label="Bộ tiếng">
        {SOUND_SETS.map((set) => (
          <option key={set} value={set}>
            {LABEL[set]}
          </option>
        ))}
      </select>
    </label>
  )
}
