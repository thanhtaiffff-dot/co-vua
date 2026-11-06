// Nút ⓘ và bảng "Mẹo và ghi công": gom các dòng giải thích dài (mẹo đi trước, tự xoay bàn, xem lại nước cũ) và dòng
// ghi công các bộ quân, bàn cờ, tiếng vào một chỗ, để màn hình chơi chỉ còn bàn cờ và các nút. Máy tính: nút ở đầu
// trang. Điện thoại hẹp: nút nằm cuối trang, cạnh nút Góp ý (đầu trang hết chỗ).
import { useEffect, useRef } from 'react'

const openers = new Set<() => void>()

function openAbout(): void {
  for (const open of openers) open()
}

export function AboutButton({ place }: { place: 'top' | 'foot' }) {
  return (
    <button
      type="button"
      className={`icon-btn about-btn about-btn--${place}`}
      onClick={openAbout}
      aria-haspopup="dialog"
      aria-label="Mẹo và ghi công"
      data-tip="Mẹo và ghi công"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="8.6" />
        <path d="M12 11v5.4" />
        <path d="M12 7.7v.01" strokeWidth="2.4" />
      </svg>
    </button>
  )
}

const TIPS: { title: string; text: string }[] = [
  { title: 'Đi trước', text: 'Chơi online, lúc đối thủ đang nghĩ cứ kéo sẵn các nước tiếp theo (tối đa 12 nước). Tới lượt bạn là nước đầu tự đi. Chạm ô trống để huỷ hết.' },
  { title: 'Xem lại nước cũ', text: 'Bấm một nước trong cột nước đi, hay bấm phím ← → trên máy tính. Bàn cờ có viền xanh là đang xem thế cờ cũ.' },
  { title: 'Hai người chung một máy', text: 'Bật nút tự xoay bàn (hai mũi tên vòng) cạnh bàn cờ: đi xong bàn tự quay về phía người tới lượt.' },
  { title: 'Nút chỉ có hình', text: 'Rê chuột vào nút để xem tên. Đầu hàng, huỷ ván, ván mới phải bấm hai lần mới chạy, nên lỡ tay không sao.' },
]

export function AboutSheet() {
  const dialog = useRef<HTMLDialogElement>(null)
  const pressedBackdrop = useRef(false)

  useEffect(() => {
    const open = () => {
      const box = dialog.current
      if (box && !box.open) box.showModal()
    }
    openers.add(open)
    return () => {
      openers.delete(open)
    }
  }, [])

  function close() {
    dialog.current?.close()
  }

  return (
    // Chạm ra vùng tối bên ngoài bảng cũng là đóng.
    <dialog
      ref={dialog}
      className="sound-sheet about-sheet"
      aria-labelledby="about-title"
      onPointerDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (pressedBackdrop.current && e.target === e.currentTarget) close()
      }}
    >
      <header className="sound-sheet__head">
        <div className="sound-sheet__heading">
          <h2 className="sound-sheet__title" id="about-title">
            Mẹo và ghi công
          </h2>
        </div>
        <button type="button" className="sound-sheet__close" onClick={close} aria-label="Đóng">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6.5 6.5 11 11m0-11-11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <div className="about">
        <dl className="about__tips">
          {TIPS.map((tip) => (
            <div key={tip.title} className="about__tip">
              <dt>{tip.title}</dt>
              <dd>{tip.text}</dd>
            </div>
          ))}
        </dl>
        <p className="about__credits">
          Luật cờ: chess.js · Bàn cờ: chessground của lichess · Quân cờ: bộ cburnett của Colin M.L. Burnett (GPL), quân 2D chất liệu dựng từ bộ
          này; quân 3D, bàn chủ đề tự dựng · Tiếng thu thật: Kenney (CC0) · Chữ: Geist
        </p>
      </div>
    </dialog>
  )
}
