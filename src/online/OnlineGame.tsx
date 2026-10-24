// Ván cờ online: bàn cờ, đồng hồ theo máy chủ, đi trước nhiều nước, xin đi lại, xin hòa, đầu hàng, đấu ván nữa,
// xem lại nước cũ. Máy chủ là trọng tài; máy này chỉ vẽ lại theo tình hình máy chủ báo, cộng thêm nước mình vừa đi
// (hiện ngay cho mượt, không chờ máy chủ trả lời).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Color, PieceSymbol, Square } from 'chess.js'
import type { Config } from '@lichess-org/chessground/config'
import type { Key } from '@lichess-org/chessground/types'
import { Board } from '../components/Board'
import { BoardTools } from '../components/BoardTools'
import { MoveList, MoveStrip } from '../components/MoveList'
import { PlayerBar, type ClockFace } from '../components/PlayerBar'
import { PromotionPicker } from '../components/PromotionPicker'
import { ResultCard } from '../components/ResultCard'
import { describeGame, useFeedbackGame } from '../feedback/context'
import { describeControl, lowTime } from '../game/clock'
import { capturedPieces, describeMove, gameStatus, isPromotion, legalDests, materialDiff, replay, type PlayedMove } from '../game/rules'
import { END_DELAY, playMove, playSound } from '../sound'
import { useNow } from '../useNow'
import { showBoard, useReview } from '../useReview'
import { navigate } from '../router'
import { loadSaved, save } from '../storage'
import { ChatBubble, ChatButton, ChatPanel } from './ChatPanel'
import type { ConnectionStatus } from './connection'
import { MAX_PREMOVES, premoveBoard, premoveToMove, type Premove } from './premove'
import { fromUci, takebackPlies, toUci, type ClientMessage, type GameView, type OnlineStatus, type RoomView } from './protocol'
import { useChatAlerts, useMediaQuery, type ChatPhase } from './useChat'
import type { ChatLog } from './useRoom'

const SIDE: Record<Color, 'white' | 'black'> = { w: 'white', b: 'black' }
const COLOR_NAME: Record<Color, string> = { w: 'Trắng', b: 'Đen' }
const other = (color: Color): Color => (color === 'w' ? 'b' : 'w')
const NO_PREMOVES: Premove[] = []
// Màn hình rộng thế này trở lên thì khung chat là cột bên trái bàn cờ; hẹp hơn thì là nút Chat nổi (khớp chat.css).
const CHAT_SIDE_QUERY = '(min-width: 1180px)'

// Ván vẫn đi tiếp từ thế cờ `anchor` (các nước viết liền, cách nhau dấu cách), không bị lùi lại hay rẽ sang hướng khác.
function continues(moves: string, anchor: string): boolean {
  return anchor === '' || moves === anchor || moves.startsWith(anchor + ' ')
}

type Props = {
  game: GameView
  role: RoomView['role']
  chat: ChatLog
  receivedAt: number
  connection: ConnectionStatus
  send: (message: ClientMessage) => void
  lag: () => number
}

// 1,5 điểm viết kiểu cờ: 1½
function points(score: number): string {
  const whole = Math.floor(score)
  return score % 1 ? `${whole || ''}½` : String(whole)
}

export function OnlineGame({ game, role, chat, receivedAt, connection, send, lag }: Props) {
  const me = game.you
  const seated = me !== null
  const opponent = me ? other(me) : null
  // Tên hiện trên thanh người chơi và tỉ số: tên người đó đã nhập; để trống thì mình là "Bạn", người kia gọi theo màu quân.
  const name = (color: Color) => game.players[color].name || (color === me ? 'Bạn' : COLOR_NAME[color])
  // Tên trong câu: chính mình thì gọi là "bạn".
  const who = (color: Color, capital = true) => (color === me ? (capital ? 'Bạn' : 'bạn') : name(color))

  // Nước mình vừa đi mà máy chủ chưa xác nhận.
  const [pending, setPending] = useState<{ number: number; ply: number; uci: string; at: number } | null>(null)
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [confirmResign, setConfirmResign] = useState(false)
  // Các nước đi trước đang xếp hàng, đặt trong ván thứ `number` lúc thế cờ là `anchor`.
  const [queue, setQueue] = useState<{ number: number; anchor: string; premoves: Premove[] }>({ number: 0, anchor: '', premoves: NO_PREMOVES })

  // Máy chủ báo tình hình mới mà đã có nước đang chờ (hay ván đã đổi) thì bỏ nước đang chờ, kẻo về sau ván lùi lại
  // (hai bên đồng ý đi lại) đúng tới chỗ đó thì nó hiện lại.
  const [seen, setSeen] = useState(game)
  if (seen !== game) {
    setSeen(game)
    if (pending && (pending.number !== game.number || pending.ply !== game.moves.length)) setPending(null)
  }
  // Nước đang chờ chỉ còn hiện khi máy chủ chưa báo về nước đó (máy chủ nhận rồi, hay ván đã hết, thì thôi).
  const live = pending && pending.number === game.number && pending.ply === game.moves.length && game.status.kind === 'playing' ? pending : null
  const moves = live ? [...game.moves, live.uci] : game.moves
  const movesKey = moves.join(' ')
  const played = useMemo(() => (movesKey ? movesKey.split(' ').map((uci) => fromUci(uci)!) : []), [movesKey])
  const chess = useMemo(() => replay(played), [played])
  const sans = useMemo(() => chess.history(), [chess])
  const turn = chess.turn()
  const status: OnlineStatus = game.status.kind === 'playing' ? gameStatus(chess) : game.status
  const over = status.kind !== 'playing'
  const picking = promotion !== null && !over
  // Nước đi trước chỉ còn giá trị khi ván vẫn đi tiếp từ thế cờ lúc đặt: hết ván, sang ván mới, hay ván bị lùi lại
  // (hai bên đồng ý đi lại) thì bỏ hết.
  const premoves = seated && !over && queue.number === game.number && continues(movesKey, queue.anchor) ? queue.premoves : NO_PREMOVES
  // Thời gian nghĩ từng nước do máy chủ đo; nước mình vừa đi thì chờ máy chủ báo.
  const times = live ? [...game.moveTimes, null] : game.moveTimes
  const bottom: Color = flipped ? other(me ?? 'w') : (me ?? 'w')
  const top = other(bottom)

  // Ván đang chơi, để góp ý gửi kèm (người gặp lỗi khỏi phải tự kể).
  const feedbackState = `${me ? `Bạn cầm ${COLOR_NAME[me]}` : 'Đang xem'}, ván ${game.number} · ${describeGame(status, game.clock?.control ?? null)}`
  const feedbackGame = useMemo(() => ({ sans, side: SIDE[bottom], state: feedbackState }), [sans, bottom, feedbackState])
  useFeedbackGame(feedbackGame)

  // ---------- Xem lại nước cũ ----------
  const stepSound = useCallback((ply: number) => playMove(describeMove(replay(played.slice(0, ply - 1)), played[ply - 1])), [played])
  const review = useReview(moves.length, stepSound)
  const shownChess = useMemo(() => (review.reviewing ? replay(played.slice(0, review.shown)) : chess), [review.reviewing, review.shown, played, chess])
  const captured = capturedPieces(shownChess)
  const material = materialDiff(shownChess)

  // ---------- Đồng hồ ----------
  // Máy chủ báo thời gian còn lại lúc gửi thư; bên đang chạy giờ thì máy này tự trừ tiếp từ lúc nhận thư.
  // Mình vừa đi mà máy chủ chưa xác nhận thì dừng giờ của mình, cho giờ đối thủ chạy luôn (máy chủ báo về sẽ sửa lại cho đúng).
  const clock = game.clock
  let running = clock?.running ?? null
  const clockTimes = clock ? { ...clock.times } : null
  let since = receivedAt
  if (clock && clockTimes && live && (running === me || (running === null && live.ply === 0)) && me) {
    if (running === me) clockTimes[me] = Math.max(0, clockTimes[me] - (live.at - receivedAt)) + clock.control.increment * 1000
    running = other(me)
    since = live.at
  }
  const flagAt = clockTimes && running && !over ? since + clockTimes[running] : null
  const now = useNow(flagAt)

  function clockFace(color: Color): ClockFace | null {
    if (!clock || !clockTimes) return null
    const isRunning = flagAt !== null && color === running
    const ms = isRunning ? Math.min(clockTimes[color], Math.max(0, flagAt - now)) : clockTimes[color]
    return { ms, running: isRunning, low: ms < lowTime(clock.control) }
  }

  // Giờ còn lại của hai bên lúc hết ván, cho bảng thống kê (ván không tính giờ thì không có).
  function endClocks(): Record<Color, number> | null {
    const white = clockFace('w')
    const black = clockFace('b')
    return white && black ? { w: white.ms, b: black.ms } : null
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
    const before = heard.current
    heard.current = { number: game.number, ply: played.length, over }
    if (!before || before.number !== game.number) return
    const moved = played.length === before.ply + 1
    if (moved) playMove(describeMove(replay(played.slice(0, -1)), played.at(-1)!))
    if (!before.over && over && !aborted) playSound(decisive ? 'end' : 'draw', moved ? END_DELAY : 0)
  }, [played, game.number, over, decisive, aborted])

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

  // ---------- Chat (chỉ hai người chơi) ----------
  const mine = role === 'visitor' ? null : role
  const chatting = mine !== null && opponent !== null
  const chatSide = useMediaQuery(CHAT_SIDE_QUERY)
  const [chatSheet, setChatSheet] = useState(false)
  // Tắt chat thì trình duyệt nhớ cho các ván sau, và báo máy chủ để bên kia biết.
  const [chatOff, setChatOff] = useState(() => loadSaved('chat-off', false))
  const serverChatOff = me ? game.players[me].chatOff : chatOff
  useEffect(() => {
    if (seated && serverChatOff !== chatOff) send({ t: 'chatOff', off: chatOff })
  }, [seated, serverChatOff, chatOff, send])
  const alerts = useChatAlerts(chat.lines, chat.base, mine ?? 'host', chatOff, chatSide || chatSheet)

  useEffect(() => {
    if (!chatSheet) return
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setChatSheet(false)
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [chatSheet])

  function toggleChat() {
    setChatOff(!chatOff)
    save('chat-off', !chatOff)
  }

  // ---------- Đi quân ----------
  const play = useCallback(
    (move: PlayedMove) => {
      if (!me || over || chess.turn() !== me) return
      const uci = toUci(move)
      setPending({ number: game.number, ply: played.length, uci, at: Date.now() })
      send({ t: 'move', uci, ply: played.length, lag: lag() })
    },
    [me, over, chess, game.number, played.length, send, lag],
  )

  // Đi nước đầu hàng trong các nước đi trước. Nước đó giờ không đi được (quân bị ăn, đường bị chắn…) thì huỷ cả chuỗi,
  // để không đi tiếp những nước đã tính cho thế cờ khác. Các nước còn lại tính tiếp từ thế cờ sau nước vừa đi.
  const firePremove = useCallback(
    (list: Premove[]) => {
      const move = premoveToMove(chess, list[0])
      if (!move) {
        setQueue((q) => ({ ...q, premoves: NO_PREMOVES }))
        return
      }
      const uci = toUci(move)
      setQueue({ number: game.number, anchor: movesKey ? `${movesKey} ${uci}` : uci, premoves: list.slice(1) })
      play(move)
    },
    [chess, game.number, movesKey, play],
  )

  // Tới lượt mình (máy chủ vừa báo nước của đối thủ) mà có nước đi trước đang chờ thì gửi ngay lên máy chủ, không chờ
  // người chơi chạm vào bàn. Gửi nước đi là việc với bên ngoài nên phải nằm trong effect, kéo theo việc bớt hàng chờ.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    if (myTurn && premoves.length > 0) firePremove(premoves)
  }, [myTurn, premoves, firePremove])

  const config = useMemo<Config>(() => {
    const orientation = SIDE[bottom]
    // Đang chọn quân phong cấp: giữ nguyên bàn (tốt đứng ở ô cuối), khoá không cho đi.
    if (picking) return { orientation, movable: { color: undefined, dests: new Map() } }
    const last = shownChess.history({ verbose: true }).at(-1)
    const shown: Config = {
      orientation,
      turnColor: SIDE[shownChess.turn()],
      check: shownChess.inCheck(),
      lastMove: last ? [last.from, last.to] : undefined,
    }
    // Người xem, ván đã xong, hay đang xem lại thế cờ cũ: chỉ xem, không đi được.
    if (!me || over || review.reviewing) {
      return { ...shown, fen: shownChess.fen(), movable: { color: undefined, dests: new Map() }, premovable: { enabled: false }, highlight: { custom: new Map() } }
    }
    // Lúc đối thủ đang nghĩ, kéo quân mình là đặt thêm một nước đi trước; bàn cờ hiện quân mình ở chỗ mới.
    const ahead = premoveBoard(chess, me, premoves)
    return {
      ...shown,
      fen: premoves.length > 0 ? ahead.fen : chess.fen(),
      movable: { color: SIDE[me], dests: turn === me && premoves.length === 0 ? legalDests(chess) : new Map() },
      premovable: { enabled: premoves.length < MAX_PREMOVES },
      highlight: { custom: ahead.squares },
    }
  }, [bottom, picking, shownChess, me, over, review.reviewing, chess, premoves, turn])

  function handleMove(from: Key, to: Key) {
    const move = { from: from as Square, to: to as Square }
    if (isPromotion(chess, move.from, move.to)) {
      setPromotion(move)
      return
    }
    play(move)
  }

  // Đặt thêm một nước đi trước vào cuối hàng. Tính theo hàng chờ mới nhất: nước đầu hàng có thể vừa được đi mà trang
  // chưa kịp vẽ lại (khi đó thế cờ của hàng chờ đi trước thế cờ trang đang thấy một nước). Chỉ bỏ hàng cũ khi ván đã
  // rẽ sang hướng khác: sang ván mới, hay ván bị lùi lại.
  function handlePremove(from: Key, to: Key) {
    const premove = { from: from as Square, to: to as Square }
    setQueue((q) => {
      const ahead = continues(q.anchor, movesKey) && q.anchor.length > movesKey.length
      const same = q.number === game.number && (ahead || continues(movesKey, q.anchor))
      const list = same ? q.premoves : NO_PREMOVES
      if (list.length >= MAX_PREMOVES) return q
      return { number: game.number, anchor: ahead ? q.anchor : movesKey, premoves: [...list, premove] }
    })
  }

  function cancelPremoves() {
    setQueue((q) => ({ ...q, premoves: NO_PREMOVES }))
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

  const early = moves.length < 2
  const offline = connection !== 'open'
  const showMatch = game.number > 1 || game.score.w + game.score.b > 0
  // Đi lại: lùi nước vừa đi của mình; đang tới lượt mình thì lùi cả nước đối thủ vừa đi.
  const myTakeback = me ? takebackPlies(moves.length, me) : 0
  const canTakeback = me !== null && !over && game.takeback === null && !game.takebackAsked[me] && moves.length >= myTakeback
  const askedOffer = me !== null && game.takeback === me
  const drawOffered = me !== null && game.drawOffer === me

  const chatPhase: ChatPhase = over ? 'end' : moves.length < 4 ? 'start' : 'middle'
  const chatPanel = (onClose?: () => void) =>
    mine &&
    opponent && (
      <ChatPanel
        lines={chat.lines}
        mine={mine}
        them={name(opponent)}
        themOff={game.players[opponent].chatOff}
        off={chatOff}
        phase={chatPhase}
        onSend={(text) => send({ t: 'chat', text })}
        onToggle={toggleChat}
        onClose={onClose}
      />
    )
  // Bong bóng thoại hiện trên thanh tên đối thủ.
  const bubble = (color: Color) => alerts.bubble && color === opponent && <ChatBubble key={alerts.bubble.id} text={alerts.bubble.text} />

  const match = showMatch && (
    <p className="match">
      Tỉ số: {name('w')} <b>{points(game.score.w)}</b> – <b>{points(game.score.b)}</b> {name('b')}
    </p>
  )

  return (
    <main className={`table${chatting ? ' table--chat' : ''}`}>
      {chatting && chatSide && <aside className="chat-col">{chatPanel()}</aside>}
      {chatting && !chatSide && (chatSheet ? chatPanel(() => setChatSheet(false)) : <ChatButton unread={alerts.unread} off={chatOff} onClick={() => setChatSheet(true)} />)}

      <section className="board-col">
        <div className="bar-anchor">
          <PlayerBar
            color={top}
            name={name(top)}
            away={!game.players[top].online && top !== me}
            captured={captured[top]}
            score={material[top].score}
            active={!over && turn === top}
            clock={clockFace(top)}
          />
          {bubble(top)}
        </div>
        <div className={`board-frame${review.reviewing ? ' board-frame--review' : ''}`}>
          <Board config={config} onMove={handleMove} onPremove={handlePremove} onPremoveCancel={premoves.length > 0 ? cancelPremoves : undefined} />
          {picking && <PromotionPicker color={turn} onPick={pickPromotion} onCancel={() => setPromotion(null)} />}
        </div>
        <div className="bar-anchor">
          <PlayerBar
            color={bottom}
            name={name(bottom)}
            away={!game.players[bottom].online && bottom !== me}
            captured={captured[bottom]}
            score={material[bottom].score}
            active={!over && turn === bottom}
            clock={clockFace(bottom)}
          />
          {bubble(bottom)}
        </div>
        <div className="board-under">
          <MoveStrip sans={sans} times={times} shown={review.shown} onGo={review.go} />
          <BoardTools onFlip={() => setFlipped((f) => !f)} />
        </div>
      </section>

      <aside className="side">
        {offline && (
          <p className="online-banner" role="status">
            Mất kết nối, đang nối lại… Nước đi của bạn sẽ được gửi khi có mạng.
          </p>
        )}

        {/* Lời xin của đối thủ để lên đầu: trên điện thoại là ngay dưới bàn cờ, khỏi phải cuộn mới thấy. */}
        {opponent && !over && game.takeback === opponent && (
          <div className="offer" role="alert">
            <p className="offer__text">
              {takebackPlies(moves.length, opponent) === 1
                ? `${name(opponent)} xin đi lại nước vừa đi.`
                : `${name(opponent)} xin đi lại nước trước. Đồng ý thì lùi 2 nước, cả nước bạn vừa đi.`}
            </p>
            <div className="offer__actions">
              <button type="button" className="btn btn--primary" onClick={() => send({ t: 'takeback', yes: true })}>
                Cho đi lại
              </button>
              <button type="button" className="btn" onClick={() => send({ t: 'takeback', yes: false })}>
                Không cho
              </button>
            </div>
          </div>
        )}

        {opponent && !over && game.drawOffer === opponent && (
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

        {opponent && askedOffer && !over && (
          <div className="offer offer--mine" role="status">
            <p className="offer__text">Đang chờ {name(opponent)} cho đi lại…</p>
            <div className="offer__actions">
              <button type="button" className="btn" onClick={() => send({ t: 'takeback', yes: false })}>
                Thôi, không xin nữa
              </button>
            </div>
          </div>
        )}

        {over ? (
          <ResultCard
            result={status}
            name={who}
            playerName={name}
            chess={chess}
            sans={sans}
            times={times}
            clocks={endClocks()}
            orientation={SIDE[bottom]}
            shown={review.shown}
            onGo={(ply) => {
              review.go(ply)
              showBoard()
            }}
          />
        ) : (
          <div className={`status${status.kind === 'playing' && status.check ? ' status--check' : ''}`} role="status">
            <span className="status__text">
              {status.kind === 'playing' && (status.check ? `${who(status.turn)} đang bị chiếu!` : `Tới lượt ${who(status.turn, false)}`)}
            </span>
            {!seated && <span className="status__hint">Phòng đã đủ hai người, bạn đang xem ván này.</span>}
            {opponent && game.takebackDeclined === me && <span className="status__hint status__hint--warn">{name(opponent)} không cho đi lại.</span>}
            {premoves.length > 0 && (
              <span className="status__hint">
                Đã đặt sẵn {premoves.length} nước đi trước
                {premoves.length >= MAX_PREMOVES ? ' (tối đa)' : ''}.{' '}
                <button type="button" className="link-button" onClick={cancelPremoves}>
                  Huỷ hết
                </button>
              </span>
            )}
            {review.reviewing && (
              <span className="status__hint">
                Đang xem lại thế cờ cũ.{' '}
                <button type="button" className="link-button" onClick={() => review.go(moves.length)}>
                  Về ván đang chơi
                </button>
              </span>
            )}
            <span className="status__clock">
              {game.number > 1 ? `Ván ${game.number} · ` : ''}
              {clock ? describeControl(clock.control) : 'Không tính giờ'}
            </span>
            {match}
          </div>
        )}

        {me && opponent && over && (
          <div className="offer">
            {match}
            {game.rematchDeclined === me ? (
              <p className="offer__text">{name(opponent)} không muốn đấu ván nữa.</p>
            ) : game.rematch[me] ? (
              <p className="offer__text">Đang chờ {name(opponent)} đồng ý đấu ván nữa…</p>
            ) : game.rematch[opponent] ? (
              <p className="offer__text">{name(opponent)} muốn đấu ván nữa (hai bên đổi màu).</p>
            ) : (
              game.rematchDeclined === opponent && <p className="offer__text">Bạn đã từ chối đấu ván nữa.</p>
            )}
            <div className="offer__actions">
              {game.rematch[opponent] && !game.rematch[me] && (
                <>
                  <button type="button" className="btn btn--primary" onClick={() => send({ t: 'rematch', yes: true })}>
                    Đồng ý đấu tiếp
                  </button>
                  <button type="button" className="btn" onClick={() => send({ t: 'rematch', yes: false })}>
                    Từ chối
                  </button>
                </>
              )}
              {game.rematch[me] && (
                <button type="button" className="btn" onClick={() => send({ t: 'rematch', yes: false })}>
                  Thôi không đấu nữa
                </button>
              )}
              {!game.rematch[me] && !game.rematch[opponent] && game.rematchDeclined !== me && (
                <button type="button" className="btn btn--primary" onClick={() => send({ t: 'rematch', yes: true })}>
                  Đấu ván nữa
                </button>
              )}
              <button type="button" className={`btn${game.rematchDeclined === me ? ' btn--primary' : ''}`} onClick={() => navigate('/online')}>
                Tạo phòng mới
              </button>
            </div>
          </div>
        )}
        {!seated && over && match && <div className="card">{match}</div>}

        {seated && !over && (
          <div className="controls controls--online">
            <button
              type="button"
              className="btn"
              disabled={!canTakeback}
              onClick={() => send({ t: 'takeback', yes: true })}
              title={me && game.takebackAsked[me] && !askedOffer ? 'Mỗi lượt chỉ xin đi lại được một lần' : undefined}
            >
              {askedOffer ? 'Đang xin đi lại' : 'Xin đi lại'}
            </button>
            <button
              type="button"
              className="btn"
              disabled={early || drawOffered}
              onClick={() => send({ t: 'draw', yes: true })}
              title={early ? 'Xin hòa được sau khi mỗi bên đi một nước' : undefined}
            >
              {drawOffered ? 'Đã xin hòa' : 'Xin hòa'}
            </button>
            <button type="button" className={`btn${confirmResign ? ' btn--confirm' : ''}`} onClick={resign}>
              {confirmResign ? 'Bấm lần nữa' : early ? 'Huỷ ván' : 'Đầu hàng'}
            </button>
          </div>
        )}

        {seated && !over && (
          <p className="online-tip">
            Mẹo: lúc đối thủ đang nghĩ, cứ kéo sẵn các nước tiếp theo (đi trước, tối đa {MAX_PREMOVES} nước). Tới lượt bạn là nước đầu tự đi. Chạm ô trống để
            huỷ hết.
          </p>
        )}

        <MoveList sans={sans} times={times} shown={review.shown} onGo={review.go} />
      </aside>
    </main>
  )
}
