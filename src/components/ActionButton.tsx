// Nút chỉ có hình cho các việc phụ trong ván (đi lại, xin hòa, đầu hàng, ván mới, tự xoay bàn, chat...): gọn mắt,
// rê chuột vào (hay bấm phím Tab tới) mới hiện chữ trong bong bóng phía trên nút. Lúc cần nói rõ (vd "Bấm lần nữa để
// đầu hàng") thì bong bóng hiện luôn, cả trên điện thoại không rê chuột được.
import { ACTION_ICONS } from './actionIcons'

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
