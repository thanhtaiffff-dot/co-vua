// "Thống kê ván" trong thẻ kết quả: so Trắng với Đen từng mục kiểu bảng thống kê trận bóng đá (số của Trắng bên trái, tên
// mục ở giữa, số của Đen bên phải), kèm biểu đồ thời gian nghĩ từng nước. Mặc định đóng, người không cần thì khỏi thấy;
// mở hay đóng thì máy nhớ cho ván sau. Bấm một nước (trong bảng hay cột biểu đồ) là bàn cờ hiện lại thế cờ lúc đó.
import { useState, type CSSProperties, type ReactNode } from 'react'
import type { Chess, Color, PieceSymbol } from 'chess.js'
import { formatClock, formatSpan, formatThink } from '../game/clock'
import { piecesText } from '../game/rules'
import { gameStats, moveLabel, QUICK_MS, type MoveTime, type SideStats } from '../game/stats'
import { loadSaved, save } from '../storage'
import { CapturedPieces } from './CapturedPieces'

type Props = {
  chess: Chess
  sans: string[]
  times: (number | null)[]
  clocks: Record<Color, number> | null // giờ còn lại lúc hết ván (ván tính giờ)
  name: (color: Color) => string
  shown: number // bàn cờ đang hiện thế cờ sau nước thứ mấy
  onGo: (ply: number) => void
}

const COLORS: Color[] = ['w', 'b']
const PROMOTED: Record<PieceSymbol, string> = { p: 'Tốt', n: 'Mã', b: 'Tượng', r: 'Xe', q: 'Hậu', k: 'Vua' }
const other = (color: Color): Color => (color === 'w' ? 'b' : 'w')
const fullMove = (ply: number) => Math.ceil(ply / 2)

// Một ô số: số chính ở trên, dòng nhỏ ở dưới nói thêm (vd "47s" và nước đi lúc đó).
function Value({ main, sub }: { main: ReactNode; sub?: ReactNode }) {
  return (
    <>
      <span className="stats__main">{main}</span>
      {sub !== undefined && <span className="stats__sub">{sub}</span>}
    </>
  )
}

type Row = { label: string; cell: (side: SideStats, color: Color) => ReactNode }

export function GameStats({ chess, sans, times, clocks, name, shown, onGo }: Props) {
  const [open, setOpen] = useState<boolean>(() => loadSaved<unknown>('statsOpen', false) === true)
  const stats = gameStats(chess, times)
  const timed = COLORS.some((color) => stats[color].spent !== null)
  const total = (stats.w.spent ?? 0) + (stats.b.spent ?? 0)

  function moveCell(move: MoveTime | null): ReactNode {
    if (!move) return '—'
    return (
      <Value
        main={formatThink(move.ms)}
        sub={
          <button type="button" className="link-button stats__move" onClick={() => onGo(move.ply)}>
            {moveLabel(move.ply, sans[move.ply - 1])}
          </button>
        }
      />
    )
  }

  const rows: Row[] = [
    { label: 'Số nước', cell: (side) => side.moves },
    ...(timed
      ? [
          { label: 'Tổng giờ nghĩ', cell: (side: SideStats) => (side.spent === null ? '—' : formatThink(side.spent)) },
          { label: 'Trung bình mỗi nước', cell: (side: SideStats) => (side.average === null ? '—' : formatThink(side.average)) },
          { label: 'Nghĩ lâu nhất', cell: (side: SideStats) => moveCell(side.longest) },
          { label: 'Đi nhanh nhất', cell: (side: SideStats) => moveCell(side.fastest) },
          { label: `Đi dưới ${QUICK_MS / 1000} giây`, cell: (side: SideStats) => `${side.quick} nước` },
        ]
      : []),
    ...(clocks ? [{ label: 'Giờ còn lại', cell: (_: SideStats, color: Color) => formatClock(clocks[color]) }] : []),
    {
      label: 'Quân đã ăn',
      cell: (side, color) =>
        side.captured.length === 0 ? (
          'Không'
        ) : (
          <Value
            main={
              <span className="cg-wrap stats__pieces" role="img" aria-label={piecesText(side.captured)}>
                <CapturedPieces pieces={side.captured} color={other(color)} />
              </span>
            }
            sub={`${side.points} điểm`}
          />
        ),
    },
    { label: 'Số lần chiếu', cell: (side) => side.checks },
    {
      label: 'Nhập thành',
      cell: (side) =>
        side.castle ? <Value main={`Cánh ${side.castle.side === 'king' ? 'vua' : 'hậu'}`} sub={`nước ${fullMove(side.castle.ply)}`} /> : 'Không',
    },
    {
      label: 'Phong cấp',
      cell: (side) =>
        side.promotions.length === 0 ? (
          'Không'
        ) : (
          <Value main={side.promotions.map((p) => PROMOTED[p.piece]).join(', ')} sub={`nước ${side.promotions.map((p) => fullMove(p.ply)).join(', ')}`} />
        ),
    },
  ]

  return (
    <details
      className="stats"
      open={open}
      onToggle={(event) => {
        const now = event.currentTarget.open
        setOpen(now)
        save('statsOpen', now)
      }}
    >
      <summary className="stats__toggle">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M5 20V11M12 20V5M19 20v-7" />
        </svg>
        <span>Thống kê ván</span>
        <svg
          className="stats__chevron"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>

      <div className="stats__body">
        <p className="stats__summary">
          {fullMove(sans.length)} nước{total > 0 && <> · ván dài {formatSpan(total)}</>}
        </p>
        {/* 4 cột: tên mỗi bên chiếm nửa bảng ở hàng đầu; các hàng dưới là số Trắng | tên mục (2 cột giữa) | số Đen */}
        <table className="stats__table">
          <colgroup>
            <col className="stats__col-side" />
            <col />
            <col />
            <col className="stats__col-side" />
          </colgroup>
          <thead>
            <tr>
              {COLORS.map((color) => (
                <th key={color} scope="col" colSpan={2} className={`stats__player stats__player--${color}`}>
                  <span className="stats__who">
                    <span className={`player__dot player__dot--${color}`} aria-hidden="true" />
                    <span className="stats__name">{name(color)}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="stats__value stats__value--w">{row.cell(stats.w, 'w')}</td>
                <th scope="row" colSpan={2} className="stats__label">
                  {row.label}
                </th>
                <td className="stats__value stats__value--b">{row.cell(stats.b, 'b')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {timed && <ThinkChart sans={sans} times={times} name={name} shown={shown} onGo={onGo} />}
      </div>
    </details>
  )
}

// Biểu đồ cột thời gian nghĩ từng nước, như lichess: cột của Trắng mọc lên trên đường giữa, của Đen mọc xuống dưới,
// cột càng cao là nghĩ càng lâu. Rê chuột (hay chạm) vào cột để đọc số; bấm cột nào là tới nước đó.
function ThinkChart({ sans, times, name, shown, onGo }: Pick<Props, 'sans' | 'times' | 'name' | 'shown' | 'onGo'>) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(...times.map((time) => time ?? 0))
  if (!(max > 0)) return null
  const pairs = Math.ceil(sans.length / 2)
  const focus = hover ?? (shown > 0 && shown <= sans.length ? shown : null)
  const time = (ply: number) => {
    const ms = times[ply - 1]
    return ms == null ? 'không rõ thời gian' : formatThink(ms)
  }
  const readout =
    focus === null
      ? 'Rê chuột hay chạm vào một cột để xem nước đó.'
      : `${name(focus % 2 === 1 ? 'w' : 'b')}: ${moveLabel(focus, sans[focus - 1])} · ${time(focus)}`

  function bar(ply: number) {
    if (ply > sans.length) return <span className="think__slot" />
    const ms = times[ply - 1]
    const color = ply % 2 === 1 ? 'w' : 'b'
    const height = ms == null ? 0 : Math.max(4, (ms / max) * 100)
    return (
      <button
        type="button"
        className={`think__slot think__slot--${color}${shown === ply ? ' think__slot--on' : ''}`}
        style={{ '--h': `${height}%` } as CSSProperties}
        aria-label={`${moveLabel(ply, sans[ply - 1])}, ${time(ply)}`}
        onPointerEnter={() => setHover(ply)}
        onPointerLeave={() => setHover(null)}
        onFocus={() => setHover(ply)}
        onBlur={() => setHover(null)}
        onClick={() => onGo(ply)}
      />
    )
  }

  return (
    <figure className="think">
      <figcaption className="think__title">Thời gian nghĩ từng nước</figcaption>
      <div className="think__plot">
        <div className="think__legend" aria-hidden="true">
          <span className="think__key think__key--w">{name('w')}</span>
          <span className="think__key think__key--b">{name('b')}</span>
        </div>
        <div className="think__bars" role="group" aria-label="Thời gian nghĩ từng nước, bấm để xem lại nước đó">
          {Array.from({ length: pairs }, (_, i) => (
            <div key={i} className="think__col">
              {bar(2 * i + 1)}
              {bar(2 * i + 2)}
            </div>
          ))}
        </div>
      </div>
      <p className="think__readout" aria-live="polite">
        {readout}
      </p>
    </figure>
  )
}
