import { useEffect, useRef } from 'react'

export function MoveList({ sans }: { sans: string[] }) {
  const box = useRef<HTMLDivElement>(null)

  // Tự cuộn tới nước mới nhất, chỉ trong khung danh sách (không kéo cả trang).
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight
  }, [sans.length])

  const rows: { number: number; white: string; black?: string }[] = []
  for (let i = 0; i < sans.length; i += 2) {
    rows.push({ number: i / 2 + 1, white: sans[i], black: sans[i + 1] })
  }

  return (
    <div className="moves" ref={box} aria-label="Danh sách nước đi">
      {rows.length === 0 && <p className="moves__empty">Chưa có nước nào. Trắng đi trước.</p>}
      <ol className="moves__list">
        {rows.map((row, i) => {
          const last = i === rows.length - 1
          return (
            <li key={row.number} className="moves__row">
              <span className="moves__number">{row.number}.</span>
              <span className={`moves__san${last && !row.black ? ' moves__san--last' : ''}`}>{row.white}</span>
              <span className={`moves__san${last && row.black ? ' moves__san--last' : ''}`}>{row.black ?? ''}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
