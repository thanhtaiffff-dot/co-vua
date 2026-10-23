import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Color, PieceSymbol, Square } from 'chess.js'
import type { Config } from '@lichess-org/chessground/config'
import type { Key } from '@lichess-org/chessground/types'
import { Board } from './components/Board'
import { MoveList, MoveStrip } from './components/MoveList'
import { PlayerBar, type ClockFace } from './components/PlayerBar'
import { PlayerNames } from './components/PlayerNames'
import { PromotionPicker } from './components/PromotionPicker'
import { ResultCard } from './components/ResultCard'
import { TimeControlPicker } from './components/TimeControlPicker'
import { TopBar } from './components/TopBar'
import { describeControl, flagTime, lastTimes, lowTime, newClock, recordMove, restoreClock, undoMove, type ClockState } from './game/clock'
import {
  capturedPieces,
  describeMove,
  gameStatus,
  isPromotion,
  legalDests,
  materialDiff,
  replay,
  timeoutStatus,
  type GameStatus,
  type PlayedMove,
} from './game/rules'
import { END_DELAY, playMove, playSound } from './sound'
import { restoreNames, type Names } from './names'
import { loadSaved, save } from './storage'
import { useNow } from './useNow'
import { showBoard, useReview } from './useReview'

const COLOR_NAME: Record<Color, string> = { w: 'Trắng', b: 'Đen' }
const SIDE: Record<Color, 'white' | 'black'> = { w: 'white', b: 'black' }

function statusText(status: GameStatus, name: (color: Color) => string): string {
  if (status.kind !== 'playing') return ''
  return status.check ? `${name(status.turn)} đang bị chiếu!` : `Tới lượt ${name(status.turn)}`
}

export default function App() {
  const [moves, setMoves] = useState<PlayedMove[]>(() => {
    const saved = loadSaved<PlayedMove[]>('moves', [])
    try {
      replay(saved)
      return saved
    } catch {
      return []
    }
  })
  const [clock, setClock] = useState<ClockState>(() => restoreClock(loadSaved<unknown>('clock', null), moves.length, Date.now()))
  const [names, setNames] = useState<Names>(() => restoreNames(loadSaved<unknown>('names', null)))
  const [autoFlip, setAutoFlip] = useState<boolean>(() => loadSaved('autoFlip', false))
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null)
  const [confirmNew, setConfirmNew] = useState(false)

  const chess = useMemo(() => replay(moves), [moves])
  const sans = useMemo(() => chess.history(), [chess])
  const turn = chess.turn()
  const boardStatus = gameStatus(chess)
  // Lúc bên đang tới lượt hết giờ; null khi đồng hồ không chạy.
  const flagAt = boardStatus.kind === 'playing' ? flagTime(clock, turn) : null
  const now = useNow(flagAt)
  const status = flagAt !== null && now >= flagAt ? timeoutStatus(chess, turn) : boardStatus
  const over = status.kind !== 'playing'
  const picking = promotion !== null && !over
  const boardSide = autoFlip ? SIDE[turn] : orientation
  const bottom: Color = boardSide === 'white' ? 'w' : 'b'
  const top: Color = bottom === 'w' ? 'b' : 'w'
  // Tên người chơi đã nhập; để trống thì gọi theo màu quân.
  const name = useCallback((color: Color) => names[color].trim() || COLOR_NAME[color], [names])

  // Xem lại thế cờ cũ: bàn cờ, quân đã ăn hiện theo thế cờ đang xem; tiến từng nước thì kêu tiếng nước đó.
  const stepSound = useCallback((ply: number) => playMove(describeMove(replay(moves.slice(0, ply - 1)), moves[ply - 1])), [moves])
  const review = useReview(moves.length, stepSound)
  const shownChess = useMemo(() => (review.reviewing ? replay(moves.slice(0, review.shown)) : chess), [review.reviewing, review.shown, moves, chess])
  const captured = capturedPieces(shownChess)
  const material = materialDiff(shownChess)

  useEffect(() => save('moves', moves), [moves])
  useEffect(() => save('clock', clock), [clock])
  useEffect(() => save('names', names), [names])
  useEffect(() => save('autoFlip', autoFlip), [autoFlip])

  // Tiếng hết ván: kêu đúng lúc ván vừa kết thúc, không kêu lại khi tải lại trang. Hết ván vì một nước đi
  // (chiếu bí, hòa) thì chờ tiếng quân đặt xuống xong; hết giờ thì kêu ngay.
  const lastKind = useRef(status.kind)
  useEffect(() => {
    if (lastKind.current === 'playing' && status.kind !== 'playing') {
      const decisive = status.kind === 'checkmate' || status.kind === 'timeout'
      const byClock = status.kind === 'timeout' || status.kind === 'timeoutDraw'
      playSound(decisive ? 'end' : 'draw', byClock ? 0 : END_DELAY)
    }
    lastKind.current = status.kind
  }, [status.kind])

  // Báo sắp hết giờ: kêu một lần khi đồng hồ đang chạy tụt xuống dưới mức đỏ. Được cộng giờ lên hẳn
  // (quá 1,5 lần mức đỏ), hoặc đi lại, ván mới, thì lần sau tụt xuống lại báo tiếp.
  const lowWarned = useRef<Record<Color, boolean>>({ w: false, b: false })
  useEffect(() => {
    if (!clock.control || flagAt === null || over) return
    const left = flagAt - now
    const limit = lowTime(clock.control)
    if (left > limit * 1.5) lowWarned.current[turn] = false
    else if (left < limit && left > 0 && !lowWarned.current[turn]) {
      lowWarned.current[turn] = true
      playSound('lowTime')
    }
  }, [now, flagAt, turn, clock.control, over])

  useEffect(() => {
    if (!confirmNew) return
    const timer = setTimeout(() => setConfirmNew(false), 3000)
    return () => clearTimeout(timer)
  }, [confirmNew])

  const config = useMemo<Config>(() => {
    // Đang chọn quân phong cấp: giữ nguyên bàn (tốt đứng ở ô cuối), khoá không cho đi.
    if (picking) return { orientation: boardSide, movable: { color: undefined, dests: new Map() } }
    // Đang xem lại thế cờ cũ, hay ván đã xong: chỉ xem, không đi được.
    const locked = over || review.reviewing
    const last = shownChess.history({ verbose: true }).at(-1)
    return {
      fen: shownChess.fen(),
      orientation: boardSide,
      turnColor: SIDE[shownChess.turn()],
      check: shownChess.inCheck(),
      lastMove: last ? [last.from, last.to] : undefined,
      movable: {
        color: locked ? undefined : SIDE[shownChess.turn()],
        dests: locked ? new Map() : legalDests(shownChess),
      },
    }
  }, [shownChess, boardSide, over, picking, review.reviewing])

  // Đồng hồ hiện trên thanh người chơi: bên đang tới lượt bị trừ dần theo giờ thật.
  function clockFace(color: Color): ClockFace | null {
    const last = lastTimes(clock)
    if (!clock.control || !last) return null
    const running = flagAt !== null && color === turn
    // Không bao giờ hiện nhiều hơn lúc bắt đầu lượt, kể cả khi `now` chưa kịp cập nhật.
    const ms = running ? Math.min(last[color], Math.max(0, flagAt - now)) : last[color]
    return { ms, running: running && !over, low: ms < lowTime(clock.control) }
  }

  // Đi một nước: ghi nước đi, thời gian nghĩ và giờ của bên vừa đi. Lỡ hết giờ rồi thì không nhận nước đó nữa.
  function play(move: PlayedMove) {
    const time = Date.now()
    if (flagAt !== null && time >= flagAt) return
    playMove(describeMove(chess, move))
    setMoves((prev) => [...prev, move])
    setClock((prev) => recordMove(prev, turn, time))
  }

  function handleMove(from: Key, to: Key) {
    const move = { from: from as Square, to: to as Square }
    if (isPromotion(chess, move.from, move.to)) {
      setPromotion(move)
      return
    }
    play(move)
  }

  function pickPromotion(type: PieceSymbol) {
    if (!promotion) return
    play({ ...promotion, promotion: type })
    setPromotion(null)
  }

  // Bỏ phong cấp: bàn cờ tự vẽ lại thế cờ cũ, tốt quay về chỗ.
  function cancelPromotion() {
    setPromotion(null)
  }

  // Đi lại nước vừa đi (bấm nhầm): ván, đồng hồ, thời gian nghĩ quay về như trước nước đó.
  function undo() {
    setPromotion(null)
    setMoves((prev) => prev.slice(0, -1))
    setClock((prev) => undoMove(prev, Date.now()))
  }

  function newGame() {
    if (moves.length > 0 && !over && !confirmNew) {
      setConfirmNew(true)
      return
    }
    setConfirmNew(false)
    setPromotion(null)
    setMoves([])
    setClock((prev) => newClock(prev.control))
    playSound('start')
  }

  const times = clock.spent

  return (
    <div className="app">
      <TopBar switchTo={{ path: '/online', label: 'Chơi online' }} />

      <main className="table">
        <section className="board-col">
          <PlayerBar color={top} name={name(top)} captured={captured[top]} score={material[top].score} active={!over && turn === top} clock={clockFace(top)} />
          <div className={`board-frame${review.reviewing ? ' board-frame--review' : ''}`}>
            <Board config={config} onMove={handleMove} />
            {picking && <PromotionPicker color={turn} onPick={pickPromotion} onCancel={cancelPromotion} />}
          </div>
          <PlayerBar
            color={bottom}
            name={name(bottom)}
            captured={captured[bottom]}
            score={material[bottom].score}
            active={!over && turn === bottom}
            clock={clockFace(bottom)}
          />
          <MoveStrip sans={sans} times={times} shown={review.shown} onGo={review.go} />
        </section>

        <aside className="side">
          {over ? (
            <ResultCard
              result={status}
              name={name}
              sans={sans}
              times={times}
              orientation={boardSide}
              onReview={() => {
                review.go(0)
                showBoard()
              }}
              hint={'Bấm "Ván mới" để chơi tiếp.'}
            />
          ) : (
            <div className={`status${status.kind === 'playing' && status.check ? ' status--check' : ''}`} role="status">
              <span className="status__text">{statusText(status, name)}</span>
              {review.reviewing && <span className="status__hint">Đang xem lại thế cờ cũ. Bấm nút ▶| (sáng màu) để về ván đang chơi.</span>}
              {clock.control && moves.length > 0 && <span className="status__clock">{describeControl(clock.control)}</span>}
            </div>
          )}

          {moves.length === 0 && (
            <>
              <PlayerNames names={names} onChange={setNames} />
              <TimeControlPicker value={clock.control} onChange={(control) => setClock(newClock(control))} />
            </>
          )}

          <div className="controls">
            <button type="button" className="btn" onClick={undo} disabled={moves.length === 0}>
              Đi lại
            </button>
            <button type="button" className="btn" onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))} disabled={autoFlip}>
              Lật bàn
            </button>
            <button type="button" className={`btn btn--primary${confirmNew ? ' btn--confirm' : ''}`} onClick={newGame}>
              {confirmNew ? 'Bấm lần nữa' : 'Ván mới'}
            </button>
          </div>

          <label className="switch">
            <input id="auto-flip" type="checkbox" checked={autoFlip} onChange={(e) => setAutoFlip(e.target.checked)} />
            <span className="switch__track" aria-hidden="true" />
            <span>Tự xoay bàn theo lượt (hai người chung một điện thoại)</span>
          </label>

          <MoveList sans={sans} times={times} shown={review.shown} onGo={review.go} />

          <p className="credits">
            Luật cờ: chess.js · Bàn cờ: chessground của lichess · Quân cờ: bộ cburnett của Colin M.L. Burnett (GPL), quân 2D chất liệu dựng từ
            bộ này; quân 3D, bàn chủ đề tự dựng · Tiếng thu thật: Kenney (CC0)
          </p>
        </aside>
      </main>
    </div>
  )
}
