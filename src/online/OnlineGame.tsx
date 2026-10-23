// Ván cờ online: bàn cờ, đồng hồ theo máy chủ, đi trước (premove), xin hòa, đầu hàng, tái đấu.
// Máy chủ là trọng tài; máy này chỉ vẽ lại theo tình hình máy chủ báo, cộng thêm nước mình vừa đi
// (hiện ngay cho mượt, không chờ máy chủ trả lời).
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Color, PieceSymbol, Square } from 'chess.js'
import type { Config } from '@lichess-org/chessground/config'
import type { Key } from '@lichess-org/chessground/types'
import { Board } from '../components/Board'
import { MoveList } from '../components/MoveList'
import { PlayerBar, type ClockFace } from '../components/PlayerBar'
import { PromotionPicker } from '../components/PromotionPicker'
import { describeControl, lowTime } from '../game/clock'
import { describeMove, gameStatus, isPromotion, legalDests, materialDiff, replay, type PlayedMove } from '../game/rules'
import { END_DELAY, playMove, playSound } from '../sound'
import { useNow } from '../useNow'
import { navigate } from '../router'
import type { ConnectionStatus } from './connection'
import { fromUci, toUci, type ClientMessage, type GameView, type OnlineStatus } from './protocol'

const SIDE: Record<Color, 'white' | 'black'> = { w: 'white', b: 'black' }
const other = (color: Color): Color => (color === 'w' ? 'b' : 'w')

type Props = {
  game: GameView
  receivedAt: number
  connection: ConnectionStatus
  send: (message: ClientMessage) => void
  lag: () => number
}

// Tên để gọi một bên: chính mình là "Bạn", người không đặt tên thì gọi theo màu quân.
function namer(game: GameView) {
  return (color: Color, capital = true) => {
    if (color === game.you) return capital ? 'Bạn' : 'bạn'
    return game.players[color].name || (color === 'w' ? 'Trắng' : 'Đen')
  }
}

function statusText(status: OnlineStatus, game: GameView): string {
  const name = namer(game)
  switch (status.kind) {
    case 'playing':
      if (status.check) return `${name(status.turn)} đang bị chiếu!`
      return status.turn === game.you ? 'Tới lượt bạn' : `Tới lượt ${name(status.turn)}`
    case 'checkmate':
      return `Chiếu bí! ${name(status.winner)} thắng`
    case 'timeout':
      return `${name(other(status.winner))} hết giờ! ${name(status.winner)} thắng`
    case 'timeoutDraw':
      return `Hòa: ${name(status.flagged)} hết giờ, nhưng ${name(other(status.flagged), false)} không còn đủ quân để chiếu bí`
    case 'resign':
      return `${name(other(status.winner))} đầu hàng. ${name(status.winner)} thắng`
    case 'agreed':
      return 'Hòa: hai bên đồng ý'
    case 'aborted':
      return 'Ván đã huỷ, không tính'
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

function resultScore(status: OnlineStatus): string | null {
  if (status.kind === 'playing') return null
  if (status.kind === 'aborted') return '–'
  if ('winner' in status) return status.winner === 'w' ? '1–0' : '0–1'
  return '½–½'
}

// 1,5 điểm viết kiểu cờ: 1½
function points(score: number): string {
  const whole = Math.floor(score)
  return score % 1 ? `${whole || ''}½` : String(whole)
}

export function OnlineGame({ game, receivedAt, connection, send, lag }: Props) {
  const me = game.you
  const name = namer(game)
  // Nước mình vừa đi mà máy chủ chưa xác nhận.
  const [pending, setPending] = useState<{ number: number; ply: number; uci: string; at: number } | null>(null)
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [confirmResign, setConfirmResign] = useState(false)

  // Nước đang chờ chỉ còn hiện khi máy chủ chưa báo về nước đó (máy chủ nhận rồi, hay ván đã hết, thì thôi).
  const live = pending && pending.number === game.number && pending.ply === game.moves.length && game.status.kind === 'playing' ? pending : null
  const moves = live ? [...game.moves, live.uci] : game.moves
  const movesKey = moves.join(' ')
  const chess = useMemo(() => replay(movesKey ? movesKey.split(' ').map((uci) => fromUci(uci)!) : []), [movesKey])
  const turn = chess.turn()
  const status: OnlineStatus = game.status.kind === 'playing' ? gameStatus(chess) : game.status
  const over = status.kind !== 'playing'
  const seated = me !== null
  const picking = promotion !== null && !over
  const material = materialDiff(chess)
  const bottom: Color = flipped ? other(me ?? 'w') : (me ?? 'w')
  const top = other(bottom)

  // ---------- Đồng hồ ----------
  // Máy chủ báo thời gian còn lại lúc gửi thư; bên đang chạy giờ thì máy này tự trừ tiếp từ lúc nhận thư.
  // Mình vừa đi mà máy chủ chưa xác nhận thì dừng giờ của mình, cho giờ đối thủ chạy luôn (máy chủ báo về sẽ sửa lại cho đúng).
  const clock = game.clock
  let running = clock?.running ?? null
  const times = clock ? { ...clock.times } : null
  let since = receivedAt
  if (clock && times && live && (running === me || (running === null && live.ply === 0)) && me) {
    if (running === me) times[me] = Math.max(0, times[me] - (live.at - receivedAt)) + clock.control.increment * 1000
    running = other(me)
    since = live.at
  }
  const flagAt = times && running && !over ? since + times[running] : null
  const now = useNow(flagAt)

  function clockFace(color: Color): ClockFace | null {
    if (!clock || !times) return null
    const isRunning = flagAt !== null && color === running
    const ms = isRunning ? Math.min(times[color], Math.max(0, flagAt - now)) : times[color]
    return { ms, running: isRunning, low: ms < lowTime(clock.control) }
  }

  // Báo sắp hết giờ: chỉ báo đồng hồ của chính mình, một lần mỗi khi tụt xuống dưới mức đỏ.
  const lowWarned = useRef(false)
  useEffect(() => {
    if (!clock || !me || flagAt === null || running !== me) return
    const left = flagAt - now
    const limit = lowTime(clock.control)
    if (left > limit * 1.5) lowWarned.current = false
    else if (left < limit && left > 0 && !lowWarned.current) {
      lowWarned.current = true
      playSound('lowTime')
    }
  }, [now, flagAt, running, me, clock])

  // ---------- Âm thanh ----------
  // Kêu theo nước mới xuất hiện trên bàn (của mình lẫn đối thủ). Mở trang giữa chừng thì không kêu bù.
  const heard = useRef<{ number: number; ply: number; over: boolean } | null>(null)
  const decisive = 'winner' in status
  const aborted = status.kind === 'aborted'
  useEffect(() => {
    const list = movesKey ? movesKey.split(' ').map((uci) => fromUci(uci)!) : []
    const before = heard.current
    heard.current = { number: game.number, ply: list.length, over }
    if (!before || before.number !== game.number) return
    const moved = list.length === before.ply + 1
    if (moved) playMove(describeMove(replay(list.slice(0, -1)), list.at(-1)!))
    if (!before.over && over && !aborted) playSound(decisive ? 'end' : 'draw', moved ? END_DELAY : 0)
  }, [movesKey, game.number, over, decisive, aborted])

  // Tới lượt mình thì tên tab báo, để chuyển sang app khác (gửi link, nhắn tin) quay lại là thấy.
  const myTurn = seated && !over && turn === me
  useEffect(() => {
    const title = document.title
    if (myTurn) document.title = '● Tới lượt bạn · ' + title
    return () => {
      document.title = title
    }
  }, [myTurn])

  useEffect(() => {
    if (!confirmResign) return
    const timer = setTimeout(() => setConfirmResign(false), 3000)
    return () => clearTimeout(timer)
  }, [confirmResign])

  const config = useMemo<Config>(() => {
    const orientation = SIDE[bottom]
    if (picking) return { orientation, movable: { color: undefined, dests: new Map() } }
    const last = chess.history({ verbose: true }).at(-1)
    const canPlay = seated && !over
    return {
      fen: chess.fen(),
      orientation,
      turnColor: SIDE[turn],
      check: chess.inCheck(),
      lastMove: last ? [last.from, last.to] : undefined,
      movable: {
        color: canPlay ? SIDE[me] : undefined,
        dests: canPlay && turn === me ? legalDests(chess) : new Map(),
      },
      // Lúc đối thủ đang nghĩ, kéo quân của mình là đặt sẵn nước đi trước; tới lượt mình nó tự đi.
      premovable: { enabled: canPlay },
    }
  }, [chess, bottom, picking, seated, over, turn, me])

  function play(move: PlayedMove) {
    if (!me || over || chess.turn() !== me) return
    const uci = toUci(move)
    setPending({ number: game.number, ply: moves.length, uci, at: Date.now() })
    send({ t: 'move', uci, ply: moves.length, lag: lag() })
  }

  function handleMove(from: Key, to: Key, premove: boolean) {
    const move = { from: from as Square, to: to as Square }
    if (isPromotion(chess, move.from, move.to)) {
      // Nước đi trước mà phong cấp thì tự lên Hậu (như lichess), vì không kịp hỏi.
      if (premove) play({ ...move, promotion: 'q' })
      else setPromotion(move)
      return
    }
    play(move)
  }

  function pickPromotion(type: PieceSymbol) {
    if (!promotion) return
    play({ ...promotion, promotion: type })
    setPromotion(null)
  }

  function resign() {
    if (!confirmResign) {
      setConfirmResign(true)
      return
    }
    setConfirmResign(false)
    send({ t: 'resign' })
  }

  const score = resultScore(status)
  const opponent = me ? other(me) : null
  const early = moves.length < 2
  const offline = connection !== 'open'
  const totalGames = game.score.w + game.score.b
  const showMatch = game.number > 1 || totalGames > 0

  return (
    <main className="table">
      <section className="board-col">
        <PlayerBar
          color={top}
          name={top === me ? 'Bạn' : game.players[top].name}
          away={!game.players[top].online && top !== me}
          material={material[top]}
          active={!over && turn === top}
          clock={clockFace(top)}
        />
        <div className="board-frame">
          <Board config={config} onMove={handleMove} />
          {picking && <PromotionPicker color={turn} onPick={pickPromotion} onCancel={() => setPromotion(null)} />}
        </div>
        <PlayerBar
          color={bottom}
          name={bottom === me ? 'Bạn' : game.players[bottom].name}
          away={!game.players[bottom].online && bottom !== me}
          material={material[bottom]}
          active={!over && turn === bottom}
          clock={clockFace(bottom)}
        />
      </section>

      <aside className="side">
        {offline && (
          <p className="online-banner" role="status">
            Mất kết nối, đang nối lại… Nước đi của bạn sẽ được gửi khi có mạng.
          </p>
        )}

        <div className={`status status--${status.kind}${status.kind === 'playing' && status.check ? ' status--check' : ''}`} role="status">
          {score && <span className="status__score">{score}</span>}
          <span className="status__text">{statusText(status, game)}</span>
          {!seated && <span className="status__hint">Phòng đã đủ hai người, bạn đang xem ván này.</span>}
          <span className="status__clock">
            {game.number > 1 ? `Ván ${game.number} · ` : ''}
            {clock ? describeControl(clock.control) : 'Không tính giờ'}
          </span>
          {showMatch && (
            <span className="match">
              Tỉ số: {name('w')} <b>{points(game.score.w)}</b> – <b>{points(game.score.b)}</b> {name('b')}
            </span>
          )}
        </div>

        {seated && opponent && !over && game.drawOffer === opponent && (
          <div className="offer" role="alert">
            <p className="offer__text">{name(opponent)} xin hòa.</p>
            <div className="offer__actions">
              <button type="button" className="btn btn--primary" onClick={() => send({ t: 'draw', yes: true })}>
                Đồng ý hòa
              </button>
              <button type="button" className="btn" onClick={() => send({ t: 'draw', yes: false })}>
                Từ chối
              </button>
            </div>
          </div>
        )}

        {seated && me && opponent && over && (
          <div className="offer">
            {game.rematch[opponent] && !game.rematch[me] && <p className="offer__text">{name(opponent)} muốn đấu ván nữa (hai bên đổi màu).</p>}
            {game.rematch[me] && <p className="offer__text">Đang chờ {name(opponent, false)} đồng ý đấu ván nữa…</p>}
            <div className="offer__actions">
              {game.rematch[me] ? (
                <button type="button" className="btn" onClick={() => send({ t: 'rematch', yes: false })}>
                  Thôi không đấu nữa
                </button>
              ) : (
                <button type="button" className="btn btn--primary" onClick={() => send({ t: 'rematch', yes: true })}>
                  {game.rematch[opponent] ? 'Đồng ý đấu tiếp' : 'Đấu ván nữa'}
                </button>
              )}
              <button type="button" className="btn" onClick={() => navigate('/online')}>
                Tạo phòng mới
              </button>
            </div>
          </div>
        )}

        <div className="controls">
          {seated && !over && (
            <>
              <button
                type="button"
                className="btn"
                disabled={early || (me !== null && game.drawOffer === me)}
                onClick={() => send({ t: 'draw', yes: true })}
                title={early ? 'Xin hòa được sau khi mỗi bên đi một nước' : undefined}
              >
                {me !== null && game.drawOffer === me ? 'Đã xin hòa' : 'Xin hòa'}
              </button>
              <button type="button" className={`btn${confirmResign ? ' btn--confirm' : ''}`} onClick={resign}>
                {confirmResign ? 'Bấm lần nữa' : early ? 'Huỷ ván' : 'Đầu hàng'}
              </button>
            </>
          )}
          <button type="button" className="btn" onClick={() => setFlipped((f) => !f)}>
            Lật bàn
          </button>
        </div>

        {seated && !over && <p className="online-tip">Mẹo: lúc đối thủ đang nghĩ, cứ kéo sẵn nước tiếp theo (đi trước). Tới lượt bạn là nó tự đi. Chạm ô trống để huỷ.</p>}

        <MoveList sans={chess.history()} />
      </aside>
    </main>
  )
}
