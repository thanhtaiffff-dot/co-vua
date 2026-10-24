// Ảnh đại diện trên thanh người chơi (như chess.com): chữ cái đầu của tên trên nền màu riêng của tên đó; chưa nhập tên
// thì là hình con tốt. Chơi online thì góc ảnh có chấm nhỏ: xanh là còn trong phòng, xám là mất kết nối.
import { avatarColor, avatarLetter } from '../avatar'

type Props = {
  name: string // tên người chơi đã nhập; để trống thì hiện hình con tốt
  rival?: string // tên người bên kia, để hai ảnh đại diện không trùng màu
  black?: boolean // người này cầm quân Đen
  status?: 'on' | 'off' // chơi online: còn trong phòng hay mất kết nối
  waiting?: boolean // chỗ ngồi còn trống, đang chờ bạn bè vào
}

export function Avatar({ name, rival = '', black = false, status, waiting }: Props) {
  const letter = avatarLetter(name)
  return (
    <span
      className={`avatar${letter ? '' : ' avatar--blank'}${waiting ? ' avatar--waiting' : ''}`}
      style={letter ? { background: avatarColor(name, rival, black) } : undefined}
      aria-hidden="true"
    >
      {letter || (
        <svg className="avatar__pawn" viewBox="0 0 24 24">
          <circle cx="12" cy="7" r="3.4" />
          <path d="M9.3 11.2h5.4l-.8 1.5c1.5 1.4 2.3 3.6 2.5 5.9H7.6c.2-2.3 1-4.5 2.5-5.9z" />
          <rect x="6.3" y="19.3" width="11.4" height="2.4" rx="1.1" />
        </svg>
      )}
      {status && <span className={`avatar__status avatar__status--${status}`} />}
    </span>
  )
}
