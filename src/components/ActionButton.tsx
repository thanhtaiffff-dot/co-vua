// Nút chỉ có hình cho các việc phụ trong ván (đi lại, xin hòa, đầu hàng, ván mới, tự xoay bàn, chat...): gọn mắt,
// rê chuột vào (hay bấm phím Tab tới) mới hiện chữ trong bong bóng phía trên nút. Lúc cần nói rõ (vd "Bấm lần nữa để
// đầu hàng") thì bong bóng hiện luôn, cả trên điện thoại không rê chuột được.
import type { ReactNode } from 'react'

export const ACTION_ICONS = {
  undo: (
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </>
  ),
  flag: (
    <>
      <path d="M5.5 21V4" />
      <path d="M5.5 4.5h11.5l-2.6 4.3 2.6 4.3H5.5" />
    </>
  ),
  newGame: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3.5" />
      <path d="M12 8.5v7M8.5 12h7" />
    </>
  ),
  autoFlip: (
    <>
      <path d="M4.5 11a7.6 7.6 0 0 1 13.2-4.3L19.5 8.6" />
      <path d="M19.5 4.2v4.4h-4.4" />
      <path d="M19.5 13a7.6 7.6 0 0 1-13.2 4.3L4.5 15.4" />
      <path d="M4.5 19.8v-4.4h4.4" />
    </>
  ),
  chat: <path d="M4.5 5.5h15v10.2H9.4l-4.9 3.8z" />,
  chatOff: (
    <>
      <path d="M4.5 5.5h15v10.2H9.4l-4.9 3.8z" />
      <path d="M3.5 3.5l17 17" />
    </>
  ),
} satisfies Record<string, ReactNode>

type Props = {
  icon: keyof typeof ACTION_ICONS | 'half'
  label: string // chữ trong bong bóng, cũng là tên nút cho trình đọc màn hình
  onClick: () => void
  disabled?: boolean
  pressed?: boolean // nút bật/tắt (tự xoay bàn) hay lời xin đang chờ trả lời: nút sáng đèn
  danger?: boolean // đang chờ bấm lần nữa để xác nhận: nút đỏ
  showTip?: boolean // hiện bong bóng chữ luôn, không chờ rê chuột
  badge?: number // số tin chưa đọc (nút chat)
  toggle?: boolean // nút bật/tắt thật (có aria-pressed)
  className?: string
}

export function ActionButton({ icon, label, onClick, disabled, pressed, danger, showTip, badge, toggle, className = '' }: Props) {
  const classes = ['act', pressed && 'act--on', danger && 'act--danger', showTip && 'tip--show', className].filter(Boolean).join(' ')
  return (
    <button
      type="button"
      className={classes}
      data-tip={label}
      aria-label={badge ? `${label}, ${badge} tin chưa đọc` : label}
      aria-pressed={toggle ? Boolean(pressed) : undefined}
      disabled={disabled}
      onClick={onClick}
    >
      {icon === 'half' ? (
        <span className="act__half" aria-hidden="true">
          ½
        </span>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {ACTION_ICONS[icon]}
        </svg>
      )}
      {badge ? (
        <span className="act__badge" aria-hidden="true">
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
    </button>
  )
}
