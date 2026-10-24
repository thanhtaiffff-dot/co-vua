// Nút chọn chủ đề (hình bảng màu, cạnh nút chọn tiếng) và bảng chọn mở ra khi bấm: chọn bộ quân (2D hoặc 3D, ba dáng
// 3D) và bàn cờ riêng, phối tùy ý. Bảng không che bàn cờ (điện thoại: nằm ở đáy màn hình; máy tính: góc phải) và không
// làm tối trang, để thấy ngay bàn cờ thật đổi theo từng lần chạm.
import { Fragment, useRef, useState } from 'react'
import { boardIcon, is3d, PIECE_SHAPES, piecesIcon, setTheme, SHAPE_NAMES, useTheme } from '../theme'
import { BOARD_GROUPS, boardInfo, PIECE_GROUPS, pieceSetInfo, type PieceSetId } from '../themeCatalog'

type Props = {
  // Vừa chọn bộ quân `id` (để đầu trang cho nghe tiếng của bộ đó nếu tiếng đang theo chủ đề).
  onPickPieces?: (id: PieceSetId) => void
}

// Cuộn hàng nút ngang cho nút đang chọn nằm giữa.
function center(row: HTMLElement | null) {
  const chip = row?.querySelector<HTMLElement>('.theme-chip--on')
  if (row && chip) row.scrollLeft = chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2
}

// Điện thoại màn thấp: bảng ở đáy che mất hàng dưới của bàn cờ thì cuộn trang lên cho thấy cả bàn (nếu đủ chỗ;
// không thì vẫn giữ mép trên của bàn, kể cả phần quân 3D nhô lên).
function revealBoard(panel: HTMLElement) {
  const frame = document.querySelector<HTMLElement>('.board-frame')
  const board = frame?.getBoundingClientRect()
  if (!frame || !board?.height || matchMedia('(min-width: 900px)').matches) return
  // Bảng đang trượt lên nên chưa nằm đúng chỗ: tính theo chỗ nó sẽ dừng (sát đáy màn hình).
  const hidden = board.bottom + 8 - (innerHeight - panel.offsetHeight)
  const room = board.top - parseFloat(getComputedStyle(frame).marginTop) - 8
  const by = Math.min(hidden, room)
  if (by > 0) window.scrollBy({ top: by, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
}

export function ThemePicker({ onPickPieces }: Props) {
  const theme = useTheme()
  const panel = useRef<HTMLDialogElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const pieceRow = useRef<HTMLDivElement>(null)
  const boardRow = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const set = pieceSetInfo(theme.pieces)
  const board = boardInfo(theme.board)
  const threeD = is3d(theme)
  const summary = `Quân ${set.name} ${threeD ? `3D ${SHAPE_NAMES[theme.shape].toLowerCase()}` : '2D'} trên bàn ${board.name}`

  function show() {
    const box = panel.current
    if (!box || box.open) return
    box.show()
    setOpen(true)
    center(pieceRow.current)
    center(boardRow.current)
    pieceRow.current?.querySelector<HTMLElement>('.theme-chip--on input')?.focus({ preventScroll: true })
    revealBoard(box)
  }

  // Đóng bảng. Con trỏ bàn phím đang ở trong bảng thì đưa về nút mở bảng, kẻo lạc mất.
  function hide() {
    const box = panel.current
    if (!box?.open) return
    if (box.contains(document.activeElement)) button.current?.focus()
    box.close()
  }

  function pickPieces(id: PieceSetId) {
    setTheme({ pieces: id })
    onPickPieces?.(id)
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        className="icon-btn theme-btn"
        onClick={() => (panel.current?.open ? hide() : show())}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Chủ đề: ${summary}. Bấm để đổi`}
        title="Chủ đề quân và bàn cờ"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3.4a8.6 8.6 0 1 0 0 17.2c1.2 0 1.9-.7 1.9-1.7 0-.5-.2-.9-.5-1.2-.3-.4-.5-.8-.5-1.3 0-1 .8-1.7 1.8-1.7h2.1a3.8 3.8 0 0 0 3.8-3.8c0-4.1-3.9-7.5-8.6-7.5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <circle cx="7.3" cy="11.6" r="1.45" fill="currentColor" />
          <circle cx="9.6" cy="7.6" r="1.45" fill="currentColor" />
          <circle cx="14.4" cy="7.4" r="1.45" fill="currentColor" />
        </svg>
        <span className="theme-btn__name">Chủ đề</span>
      </button>

      <dialog
        ref={panel}
        className="theme-panel"
        aria-labelledby="theme-panel-title"
        onClose={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            hide()
          }
        }}
      >
        <header className="theme-panel__head">
          <div className="theme-panel__heading">
            <h2 className="theme-panel__title" id="theme-panel-title">
              Chủ đề
            </h2>
            <p className="theme-panel__summary" aria-live="polite">
              {summary}
            </p>
          </div>
          <div className="seg" role="group" aria-label="Kiểu quân">
            <button type="button" aria-pressed={!threeD} onClick={() => setTheme({ style: '2d' })}>
              2D
            </button>
            <button type="button" aria-pressed={threeD} disabled={!set.has3d} onClick={() => setTheme({ style: '3d' })}>
              3D
            </button>
          </div>
          <button type="button" className="sound-sheet__close" onClick={hide} aria-label="Đóng">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6.5 6.5 11 11m0-11-11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="theme-panel__body">
          {threeD && (
            <div className="seg seg--shapes" role="group" aria-label="Dáng quân 3D">
              {PIECE_SHAPES.map((shape) => (
                <button key={shape} type="button" aria-pressed={theme.shape === shape} onClick={() => setTheme({ shape })}>
                  {SHAPE_NAMES[shape]}
                </button>
              ))}
            </div>
          )}
          <h3 className="theme-panel__label" id="theme-pieces-label">
            Quân{!set.has3d && <span className="theme-panel__note"> · bộ {set.name} chỉ có 2D</span>}
          </h3>
          <div className="theme-chips" ref={pieceRow} role="radiogroup" aria-labelledby="theme-pieces-label">
            {PIECE_GROUPS.map((group, index) => (
              <Fragment key={group.name}>
                {index > 0 && <span className="theme-chips__gap" aria-hidden="true" />}
                {group.items.map((info) => {
                  const on = info.id === theme.pieces
                  return (
                    <label key={info.id} className={`theme-chip${on ? ' theme-chip--on' : ''}${info.id === '8bit' ? ' theme-chip--pixel' : ''}`}>
                      <input type="radio" name="theme-pieces" value={info.id} checked={on} onChange={() => pickPieces(info.id)} />
                      <img src={piecesIcon(info.id, theme)} alt="" width={32} height={32} loading="lazy" decoding="async" />
                      <span>{info.name}</span>
                    </label>
                  )
                })}
              </Fragment>
            ))}
          </div>

          <h3 className="theme-panel__label" id="theme-board-label">
            Bàn
          </h3>
          <div className="theme-chips" ref={boardRow} role="radiogroup" aria-labelledby="theme-board-label">
            {BOARD_GROUPS.map((group, index) => (
              <Fragment key={group.name}>
                {index > 0 && <span className="theme-chips__gap" aria-hidden="true" />}
                {group.items.map((info) => {
                  const on = info.id === theme.board
                  return (
                    <label
                      key={info.id}
                      className={`theme-chip theme-chip--board${on ? ' theme-chip--on' : ''}${info.id === '8bit' ? ' theme-chip--pixel' : ''}`}
                    >
                      <input type="radio" name="theme-board" value={info.id} checked={on} onChange={() => setTheme({ board: info.id })} />
                      <img src={boardIcon(info.id)} alt="" width={32} height={32} loading="lazy" decoding="async" />
                      <span>{info.name}</span>
                    </label>
                  )
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </dialog>
    </>
  )
}
