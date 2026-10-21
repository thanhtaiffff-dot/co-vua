import { useEffect, useMemo, useState } from 'react'
import type { Color, PieceSymbol, Square } from 'chess.js'
import type { Config } from '@lichess-org/chessground/config'
import type { Key } from '@lichess-org/chessground/types'
import { Board } from './components/Board'
import { MoveList } from './components/MoveList'
import { PlayerBar } from './components/PlayerBar'
import { PromotionPicker } from './components/PromotionPicker'
import { gameStatus, isPromotion, legalDests, materialDiff, replay, resultScore, type GameStatus, type PlayedMove } from './game/rules'
import { loadSaved, save } from './storage'

const NAME: Record<Color, string> = { w: 'Trắng', b: 'Đen' }
const SIDE: Record<Color, 'white' | 'black'> = { w: 'white', b: 'black' }

function statusText(status: GameStatus): string {
  switch (status.kind) {
    case 'playing':
      return status.check ? `${NAME[status.turn]} đang bị chiếu!` : `Tới lượt ${NAME[status.turn]}`
    case 'checkmate':
      return `Chiếu bí! ${NAME[status.winner]} thắng`
    case 'stalemate':
      return 'Hòa: hết nước đi mà không bị chiếu (pat)'
    case 'insufficient':
      return 'Hòa: không còn đủ quân để chiếu bí'
    case 'threefold':
      return 'Hòa: lặp lại thế cờ 3 lần'
    case 'fifty':
      return 'Hòa: 50 nước không ăn quân, không đi tốt'
  }
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
  const [autoFlip, setAutoFlip] = useState<boolean>(() => loadSaved('autoFlip', false))
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null)
  const [confirmNew, setConfirmNew] = useState(false)

  const chess = useMemo(() => replay(moves), [moves])
  const status = gameStatus(chess)
  const over = status.kind !== 'playing'
  const turn = chess.turn()
  const material = materialDiff(chess)
  const boardSide = autoFlip ? SIDE[turn] : orientation
  const bottom: Color = boardSide === 'white' ? 'w' : 'b'
  const top: Color = bottom === 'w' ? 'b' : 'w'

  useEffect(() => save('moves', moves), [moves])
  useEffect(() => save('autoFlip', autoFlip), [autoFlip])

  useEffect(() => {
    if (!confirmNew) return
    const timer = setTimeout(() => setConfirmNew(false), 3000)
    return () => clearTimeout(timer)
  }, [confirmNew])

  const config = useMemo<Config>(() => {
    // Đang chọn quân phong cấp: giữ nguyên bàn (tốt đứng ở ô cuối), khoá không cho đi.
    if (promotion) return { orientation: boardSide, movable: { color: undefined, dests: new Map() } }
    const last = chess.history({ verbose: true }).at(-1)
    return {
      fen: chess.fen(),
      orientation: boardSide,
      turnColor: SIDE[chess.turn()],
      check: chess.inCheck(),
      lastMove: last ? [last.from, last.to] : undefined,
      movable: {
        color: over ? undefined : SIDE[chess.turn()],
        dests: over ? new Map() : legalDests(chess),
      },
    }
  }, [chess, boardSide, over, promotion])

  function handleMove(from: Key, to: Key) {
    const move = { from: from as Square, to: to as Square }
    if (isPromotion(chess, move.from, move.to)) {
      setPromotion(move)
      return
    }
    setMoves((prev) => [...prev, move])
  }

  function pickPromotion(type: PieceSymbol) {
    if (!promotion) return
    setMoves((prev) => [...prev, { ...promotion, promotion: type }])
    setPromotion(null)
  }

  // Bỏ phong cấp: bàn cờ tự vẽ lại thế cờ cũ, tốt quay về chỗ.
  function cancelPromotion() {
    setPromotion(null)
  }

  function undo() {
    setPromotion(null)
    setMoves((prev) => prev.slice(0, -1))
  }

  function newGame() {
    if (moves.length > 0 && !over && !confirmNew) {
      setConfirmNew(true)
      return
    }
    setConfirmNew(false)
    setPromotion(null)
    setMoves([])
  }

  const score = resultScore(status)

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="brand">Cờ vua</h1>
        <span className="badge">Bản thử · chơi chung một máy</span>
      </header>

      <main className="table">
        <section className="board-col">
          <PlayerBar color={top} material={material[top]} active={!over && turn === top} />
          <div className="board-frame">
            <Board config={config} onMove={handleMove} />
            {promotion && <PromotionPicker color={turn} onPick={pickPromotion} onCancel={cancelPromotion} />}
          </div>
          <PlayerBar color={bottom} material={material[bottom]} active={!over && turn === bottom} />
        </section>

        <aside className="side">
          <div className={`status status--${status.kind}${status.kind === 'playing' && status.check ? ' status--check' : ''}`} role="status">
            {score && <span className="status__score">{score}</span>}
            <span className="status__text">{statusText(status)}</span>
            {over && <span className="status__hint">Bấm "Ván mới" để chơi tiếp.</span>}
          </div>

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

          <MoveList sans={chess.history()} />

          <p className="credits">
            Luật cờ: chess.js · Bàn cờ: chessground của lichess · Quân cờ: bộ cburnett của Colin M.L. Burnett (GPL)
          </p>
        </aside>
      </main>
    </div>
  )
}
