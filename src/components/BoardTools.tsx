// Thanh nút chỉnh bàn cờ, như chess.com: Lật bàn, Phóng to, Thu nhỏ, Toàn màn hình. Máy tính: cột dọc sát mép phải
// bàn cờ. Điện thoại: hàng ngang dưới bàn cờ, không có Phóng to, Thu nhỏ vì bàn cờ đã rộng hết màn hình.
import type { ReactNode } from 'react'
import { useBoardZoom, useFullscreen, zoomBoard, ZOOM_MAX, ZOOM_MIN } from '../boardView'

type Props = {
  onFlip?: () => void // không có thì không hiện nút Lật bàn
  flipDisabled?: boolean
  flipTitle?: string // lời giải thích khi nút Lật bàn bị khoá
}

const ICONS = {
  flip: <path d="M7 20V4M3 8l4-4 4 4M17 4v16M13 16l4 4 4-4" />,
  bigger: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L21 21M10.5 7.5v6M7.5 10.5h6" />
    </>
  ),
  smaller: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L21 21M7.5 10.5h6" />
    </>
  ),
  full: <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />,
  exit: <path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" />,
} satisfies Record<string, ReactNode>

function Tool({
  icon,
  label,
  onClick,
  disabled,
  title,
  className = '',
}: {
  icon: keyof typeof ICONS
  label: string
  onClick: () => void
  disabled?: boolean
  title?: string
  className?: string
}) {
  return (
    <button type="button" className={`board-tool ${className}`} aria-label={label} title={title ?? label} disabled={disabled} onClick={onClick}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {ICONS[icon]}
      </svg>
    </button>
  )
}

export function BoardTools({ onFlip, flipDisabled, flipTitle }: Props) {
  const zoom = useBoardZoom()
  const fullscreen = useFullscreen()
  return (
    <div className="board-tools" role="toolbar" aria-label="Chỉnh bàn cờ">
      {onFlip && <Tool icon="flip" label="Lật bàn" onClick={onFlip} disabled={flipDisabled} title={flipDisabled ? flipTitle : undefined} />}
      <Tool icon="bigger" label="Phóng to bàn cờ" className="board-tool--zoom" onClick={() => zoomBoard(1)} disabled={zoom >= ZOOM_MAX} />
      <Tool icon="smaller" label="Thu nhỏ bàn cờ" className="board-tool--zoom" onClick={() => zoomBoard(-1)} disabled={zoom <= ZOOM_MIN} />
      {fullscreen.supported && (
        <Tool icon={fullscreen.on ? 'exit' : 'full'} label={fullscreen.on ? 'Thoát toàn màn hình' : 'Toàn màn hình'} onClick={fullscreen.toggle} />
      )}
    </div>
  )
}
