// Các nước đã đi, viết kiểu ký hiệu cờ (e4, Nf3, O-O…), kèm thời gian nghĩ mỗi nước. Bấm một nước để xem lại thế cờ
// lúc đó. Máy tính: cột dọc bên phải bàn cờ, có hàng nút về đầu, lùi, tiến, về cuối. Điện thoại: một dải ngang ngay dưới
// bàn cờ (vuốt ngang được), để vừa bấm vừa thấy bàn cờ.
import { useEffect, useRef, type ReactNode } from 'react'
import { formatThink } from '../game/clock'

type Props = {
  sans: string[]
  times: (number | null)[] // thời gian nghĩ của từng nước (ms); null là không biết
  shown: number // bàn cờ đang hiện thế cờ sau nước thứ mấy
  onGo: (ply: number) => void
}

const ICONS: Record<'first' | 'prev' | 'next' | 'last', ReactNode> = {
  first: <path d="M6 5v14M18 6l-7 6 7 6" />,
  prev: <path d="M15 6l-6 6 6 6" />,
  next: <path d="M9 6l6 6-6 6" />,
  last: <path d="M18 5v14M6 6l7 6-7 6" />,
}

function NavButton({ icon, label, disabled, onClick, className = '' }: { icon: keyof typeof ICONS; label: string; disabled: boolean; onClick: () => void; className?: string }) {
  return (
    <button type="button" className={`nav-btn ${className}`} aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {ICONS[icon]}
      </svg>
    </button>
  )
}

// Cuộn khung `box` (chỉ khung đó, không kéo cả trang) sao cho ô `item` nằm trong tầm nhìn.
function keepInView(box: HTMLElement, item: HTMLElement, horizontal: boolean) {
  const start = horizontal ? item.offsetLeft : item.offsetTop
  const size = horizontal ? item.offsetWidth : item.offsetHeight
  const view = horizontal ? box.clientWidth : box.clientHeight
  const scroll = horizontal ? box.scrollLeft : box.scrollTop
  let next = scroll
  if (start < scroll) next = start - 8
  else if (start + size > scroll + view) next = start + size - view + 8
  if (horizontal) box.scrollLeft = next
  else box.scrollTop = next
}

function useFollow(shown: number, total: number, horizontal: boolean) {
  const box = useRef<HTMLDivElement & HTMLOListElement>(null)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const on = el.querySelector<HTMLElement>('[aria-current="true"]')
    if (shown === total || !on) {
      // Đang xem thế cờ hiện tại: luôn thấy nước mới nhất.
      if (horizontal) el.scrollLeft = el.scrollWidth
      else el.scrollTop = el.scrollHeight
    } else keepInView(el, on, horizontal)
  }, [shown, total, horizontal])
  return box
}

function Move({ ply, san, time, shown, onGo, prefix }: { ply: number; san: string; time: number | null | undefined; shown: number; onGo: (ply: number) => void; prefix: string }) {
  const on = ply === shown
  return (
    <button type="button" className={`${prefix}__move${on ? ` ${prefix}__move--on` : ''}`} aria-current={on} onClick={() => onGo(ply)}>
      <span className={`${prefix}__san`}>{san}</span>
      <span className={`${prefix}__time`}>{time == null ? '' : formatThink(time)}</span>
    </button>
  )
}

export function MoveList({ sans, times, shown, onGo }: Props) {
  const total = sans.length
  const box = useFollow(shown, total, false)
  const rows: number[] = []
  for (let i = 0; i < total; i += 2) rows.push(i)

  return (
    <section className="moves" aria-label="Các nước đã đi">
      <div className="moves__head">
        <span className="moves__title">{shown < total ? `Nước ${shown}/${total}` : 'Nước đi'}</span>
        <div className="moves__nav">
          <NavButton icon="first" label="Về lúc bắt đầu ván" disabled={shown === 0} onClick={() => onGo(0)} />
          <NavButton icon="prev" label="Lùi một nước (phím ←)" disabled={shown === 0} onClick={() => onGo(shown - 1)} />
          <NavButton icon="next" label="Tiến một nước (phím →)" disabled={shown === total} onClick={() => onGo(shown + 1)} />
          <NavButton icon="last" label="Về thế cờ hiện tại" disabled={shown === total} onClick={() => onGo(total)} className={shown < total ? 'nav-btn--live' : ''} />
        </div>
      </div>
      <div className="moves__scroll" ref={box}>
        {total === 0 && <p className="moves__empty">Chưa có nước nào. Trắng đi trước.</p>}
        <ol className="moves__list">
          {rows.map((i) => (
            <li key={i} className="moves__row">
              <span className="moves__number">{i / 2 + 1}.</span>
              <Move ply={i + 1} san={sans[i]} time={times[i]} shown={shown} onGo={onGo} prefix="moves" />
              {i + 1 < total ? <Move ply={i + 2} san={sans[i + 1]} time={times[i + 1]} shown={shown} onGo={onGo} prefix="moves" /> : <span />}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function MoveStrip({ sans, times, shown, onGo }: Props) {
  const total = sans.length
  const box = useFollow(shown, total, true)
  if (total === 0) return null
  return (
    <div className="strip" role="group" aria-label="Các nước đã đi">
      <NavButton icon="prev" label="Lùi một nước" disabled={shown === 0} onClick={() => onGo(shown - 1)} />
      <ol className="strip__list" ref={box}>
        {sans.map((san, i) => (
          <li key={i} className="strip__item">
            {i % 2 === 0 && <span className="strip__number">{i / 2 + 1}.</span>}
            <Move ply={i + 1} san={san} time={times[i]} shown={shown} onGo={onGo} prefix="strip" />
          </li>
        ))}
      </ol>
      <NavButton icon="next" label="Tiến một nước" disabled={shown === total} onClick={() => onGo(shown + 1)} />
      <NavButton icon="last" label="Về thế cờ hiện tại" disabled={shown === total} onClick={() => onGo(total)} className={shown < total ? 'nav-btn--live' : ''} />
    </div>
  )
}
