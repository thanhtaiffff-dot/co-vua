// Nút loa ở đầu trang: bấm để tắt hoặc bật âm thanh.
type Props = {
  on: boolean
  onToggle: () => void
}

export function SoundToggle({ on, onToggle }: Props) {
  const label = on ? 'Tắt âm thanh' : 'Bật âm thanh'
  return (
    <button type="button" className={`icon-btn${on ? '' : ' icon-btn--off'}`} onClick={onToggle} aria-pressed={on} aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9.5h3.2L12 5.6v12.8l-4.8-3.9H4z" fill="currentColor" />
        {on ? (
          <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        ) : (
          <path d="m15.5 9.5 5 5m0-5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        )}
      </svg>
    </button>
  )
}
