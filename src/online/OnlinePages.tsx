// Các trang chơi online: tạo phòng (/online) và phòng chơi (/phong/<mã>). Trong phòng, trước khi ván bắt đầu,
// chủ phòng thấy link để gửi cho bạn bè; bạn bè mở link thấy lời mời và nút "Vào chơi".
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Color } from 'chess.js'
import type { Config } from '@lichess-org/chessground/config'
import { Avatar } from '../components/Avatar'
import { Board } from '../components/Board'
import { BoardTools } from '../components/BoardTools'
import { Piece } from '../components/Piece'
import { TimeControlPicker } from '../components/TimeControlPicker'
import { TopBar } from '../components/TopBar'
import { PageFoot } from '../feedback/FeedbackForm'
import { DEFAULT_CONTROL, TIME_CONTROLS, describeControl, formatClock, sameControl, type TimeControl } from '../game/clock'
import { navigate } from '../router'
import { playSound } from '../sound'
import { loadSaved, save } from '../storage'
import type { Backend } from './backend'
import { myName, myToken, saveMyName } from './identity'
import { OnlineGame } from './OnlineGame'
import { MAX_VISITORS, ROOM_ID, type ColorChoice, type RoomView } from './protocol'
import { useRoom } from './useRoom'
import './online.css'

const COLOR_NAME: Record<Color, string> = { w: 'Trắng', b: 'Đen' }

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <TopBar switchTo={{ path: '/', label: 'Chơi một máy' }} />
      {children}
      <PageFoot />
    </div>
  )
}

// Bàn cờ thế ban đầu để trang trí cạnh thẻ tạo phòng, thẻ mời: quay về phía màu mình sẽ cầm.
function PreviewBoard({ side }: { side: Color }) {
  const config = useMemo<Config>(() => ({ orientation: side === 'w' ? 'white' : 'black', viewOnly: true }), [side])
  return (
    <section className="board-col lobby__board" aria-hidden="true">
      <div className="board-frame">
        <Board config={config} onMove={() => {}} />
      </div>
    </section>
  )
}

function Lobby({ side, children }: { side: Color; children: ReactNode }) {
  return (
    <main className="table lobby">
      <PreviewBoard side={side} />
      <aside className="side">{children}</aside>
    </main>
  )
}

function NameField({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  return (
    <label className="field">
      <span className="field__label">Tên của bạn</span>
      <input
        className="field__input"
        value={value}
        maxLength={20}
        placeholder="Để trống cũng được"
        autoComplete="nickname"
        enterKeyHint="done"
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

function ColorBadge({ color }: { color: ColorChoice }) {
  if (color === 'random') {
    return (
      <span className="cg-wrap color-badge color-badge--random" aria-hidden="true">
        <Piece type="k" color="w" />
        <Piece type="k" color="b" />
      </span>
    )
  }
  return (
    <span className="cg-wrap color-badge" aria-hidden="true">
      <Piece type="k" color={color} />
    </span>
  )
}

const COLOR_CHOICES: { value: ColorChoice; label: string }[] = [
  { value: 'w', label: 'Trắng' },
  { value: 'random', label: 'Ngẫu nhiên' },
  { value: 'b', label: 'Đen' },
]

function savedControl(): TimeControl | null {
  const saved = loadSaved<unknown>('onlineControl', DEFAULT_CONTROL)
  if (saved === null) return null
  return TIME_CONTROLS.flatMap((group) => group.controls).find((c) => sameControl(c, saved as TimeControl)) ?? DEFAULT_CONTROL
}

export function CreatePage({ backend }: { backend: Backend }) {
  const [name, setName] = useState(myName)
  const [control, setControl] = useState<TimeControl | null>(savedControl)
  const [color, setColor] = useState<ColorChoice>(() => {
    const saved = loadSaved<unknown>('onlineColor', 'random')
    return saved === 'w' || saved === 'b' ? saved : 'random'
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function create() {
    setBusy(true)
    setError('')
    saveMyName(name)
    save('onlineControl', control)
    save('onlineColor', color)
    try {
      const id = await backend.createRoom({ token: myToken(), name: name.trim(), control, color })
      navigate(`/phong/${id}`)
    } catch {
      setError('Chưa tạo được phòng. Kiểm tra mạng rồi bấm lại nhé.')
      setBusy(false)
    }
  }

  return (
    <Shell>
      <Lobby side={color === 'b' ? 'b' : 'w'}>
        <div className="card">
          <h2 className="card__title">Chơi với bạn bè qua link</h2>
          <p className="card__text">Tạo phòng rồi gửi link cho bạn bè. Bạn bè mở link, bấm "Vào chơi" là bắt đầu.</p>
          <NameField value={name} onChange={setName} />
        </div>

        <TimeControlPicker value={control} onChange={setControl} />

        <div className="card" role="group" aria-labelledby="color-title">
          <p className="card__heading" id="color-title">
            Bạn cầm quân
          </p>
          <div className="color-choices">
            {COLOR_CHOICES.map((choice) => (
              <button
                key={choice.value}
                type="button"
                className={`color-choice${color === choice.value ? ' color-choice--on' : ''}`}
                aria-pressed={color === choice.value}
                onClick={() => setColor(choice.value)}
              >
                <ColorBadge color={choice.value} />
                <span>{choice.label}</span>
              </button>
            ))}
          </div>
          <p className="card__hint">Ngẫu nhiên thì máy chủ bốc thăm lúc bạn bè vào phòng, không ai chọn được. Đấu ván sau thì hai bên tự đổi màu.</p>
        </div>

        <button type="button" className="btn btn--primary btn--big" onClick={create} disabled={busy}>
          {busy ? 'Đang tạo phòng…' : 'Tạo phòng'}
        </button>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </Lobby>
    </Shell>
  )
}

// Thanh tên một chỗ ngồi lúc chờ: giống thanh người chơi trong ván (ảnh đại diện, chữ, đồng hồ đứng yên ở mức giờ ban
// đầu). `name` là tên đã nhập để vẽ ảnh đại diện; chỗ còn trống thì ảnh nhấp nháy chờ bạn bè vào.
type Seat = { color: ColorChoice; name: string; text: string; control: TimeControl | null; empty?: boolean }

function SeatBar({ color, name, text, control, empty = false }: Seat) {
  return (
    <div className="player">
      <Avatar name={name} waiting={empty} />
      <span className={`player__name${empty ? ' player__name--empty' : ''}`} role={empty ? 'status' : undefined}>
        {text}
      </span>
      {empty && <span className="waiting__dot" aria-hidden="true" />}
      {control && (
        <span className={`clock${color === 'random' ? '' : ` clock--${color}`}`} role="timer" aria-label={`Đồng hồ của ${text}`}>
          {formatClock(control.minutes * 60_000)}
        </span>
      )}
    </div>
  )
}

// Chủ phòng chờ bạn bè: thấy luôn bàn cờ như lúc vào ván (cả trên điện thoại), link mời nằm bên cạnh hoặc bên dưới.
// Màu ngẫu nhiên thì tạm quay bàn về phía Trắng; bạn bè vào phòng, máy chủ bốc xong thì bàn tự quay đúng phía mình.
function Waiting({ room, backend }: { room: RoomView; backend: Backend }) {
  const link = backend.link(room.id)
  const [copied, setCopied] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const canShare = typeof navigator.share === 'function' && !backend.demo
  const bottom: Color = room.hostColor === 'b' ? 'b' : 'w'
  const guestColor: ColorChoice = room.hostColor === 'random' ? 'random' : room.hostColor === 'w' ? 'b' : 'w'
  const config = useMemo<Config>(() => ({ orientation: bottom === 'w' ? 'white' : 'black', viewOnly: true }), [bottom])

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      // Máy không cho chép tự động: bôi đen sẵn link để người chơi tự chép.
      input.current?.select()
    }
  }

  async function share() {
    try {
      await navigator.share({ title: 'Chơi cờ vua với mình nhé', text: 'Vào chơi cờ vua với mình nhé:', url: link })
    } catch {
      // Người chơi đóng bảng chia sẻ: không sao.
    }
  }

  return (
    <main className="table">
      <section className="board-col">
        <SeatBar color={guestColor} name="" text="Đang chờ bạn bè…" control={room.control} empty />
        <div className="board-frame">
          <Board config={config} onMove={() => {}} />
        </div>
        <SeatBar color={room.hostColor} name={room.host.name} text={room.host.name || 'Bạn'} control={room.control} />
        <div className="board-under">
          <BoardTools />
        </div>
      </section>

      <aside className="side">
        <div className="card">
          <h2 className="card__title">Gửi link mời bạn bè</h2>
          <p className="card__text">Bạn bè mở link là vào chơi được ngay, không cần tài khoản.</p>
          <input ref={input} className="field__input share__link" value={link} readOnly onFocus={(e) => e.target.select()} aria-label="Link mời" />
          <div className="share__actions">
            {canShare && (
              <button type="button" className="btn btn--primary" onClick={share}>
                Gửi qua Zalo, Messenger…
              </button>
            )}
            <button type="button" className={`btn${canShare ? '' : ' btn--primary'}`} onClick={copy}>
              {copied ? 'Đã chép link!' : 'Chép link'}
            </button>
          </div>
          {backend.demo && (
            <div className="demo-note">
              <p>Đây là bản chơi thử: link trên chưa gửi cho bạn bè được. Bấm nút dưới để một "bạn bè ảo" vào phòng đánh với bạn.</p>
              <button type="button" className="btn btn--primary" onClick={() => backend.demo?.addFriend(room.id)}>
                Cho bạn bè ảo vào phòng
              </button>
            </div>
          )}
        </div>
        <RoomFacts room={room} you />
      </aside>
    </main>
  )
}

function RoomFacts({ room, you }: { room: RoomView; you: boolean }) {
  const hostColor = room.hostColor
  const yourColor = hostColor === 'random' ? 'random' : you ? hostColor : hostColor === 'w' ? 'b' : 'w'
  return (
    <dl className="card facts">
      <div className="facts__row">
        <dt>Thời gian</dt>
        <dd>{room.control ? describeControl(room.control) : 'Không tính giờ'}</dd>
      </div>
      <div className="facts__row">
        <dt>Bạn cầm</dt>
        <dd className="facts__color">
          <ColorBadge color={yourColor} />
          {yourColor === 'random' ? 'Ngẫu nhiên, máy chủ bốc lúc vào phòng' : COLOR_NAME[yourColor]}
        </dd>
      </div>
    </dl>
  )
}

function Invite({ room, send, ready }: { room: RoomView; send: (name: string) => void; ready: boolean }) {
  const [name, setName] = useState(myName)
  const [sent, setSent] = useState(false)
  const side: Color = room.hostColor === 'w' ? 'b' : 'w'

  function join() {
    saveMyName(name)
    setSent(true)
    send(name.trim())
  }

  return (
    <Lobby side={side}>
      <div className="card">
        <h2 className="card__title">{room.host.name ? `${room.host.name} mời bạn chơi cờ` : 'Bạn được mời chơi cờ'}</h2>
        <p className="card__text">Bấm "Vào chơi" là ván bắt đầu ngay.</p>
        <NameField value={name} onChange={setName} />
        <button type="button" className="btn btn--primary btn--big" onClick={join} disabled={!ready || sent}>
          {sent ? 'Đang vào…' : 'Vào chơi'}
        </button>
      </div>
      <RoomFacts room={room} you={false} />
    </Lobby>
  )
}

// `action`: nút ở dưới; mặc định là tạo phòng mới, `retry` là nối lại phòng này (tải lại trang).
function Notice({ title, text, action = 'create' }: { title: string; text: string; action?: 'create' | 'retry' | null }) {
  return (
    <main className="notice">
      <div className="card">
        <h2 className="card__title">{title}</h2>
        <p className="card__text">{text}</p>
        {action === 'create' && (
          <button type="button" className="btn btn--primary" onClick={() => navigate('/online')}>
            Tạo phòng mới
          </button>
        )}
        {action === 'retry' && (
          <button type="button" className="btn btn--primary" onClick={() => location.reload()}>
            Thử lại
          </button>
        )}
      </div>
    </main>
  )
}

export function RoomPage({ backend, id }: { backend: Backend; id: string }) {
  return <Shell>{ROOM_ID.test(id) ? <Room backend={backend} id={id} /> : <Missing />}</Shell>
}

function Missing() {
  return <Notice title="Không tìm thấy phòng này" text="Link có thể bị gõ sai, hoặc phòng đã bỏ không quá 30 ngày nên bị xoá." />
}

function Room({ backend, id }: { backend: Backend; id: string }) {
  const { room, receivedAt, status, error, chat, send, lag } = useRoom(backend, id)

  // Ván bắt đầu (bạn bè vừa vào phòng, hay vừa đồng ý tái đấu) thì kêu tiếng "ván mới". Mở trang giữa ván thì thôi.
  const number = room ? (room.game?.number ?? 0) : null
  const lastNumber = useRef<number | null>(null)
  useEffect(() => {
    if (number === null) return
    if (lastNumber.current !== null && number > lastNumber.current) playSound('start')
    lastNumber.current = number
  }, [number])

  if (error === 'not-found') return <Missing />
  if (error === 'full')
    return <Notice title="Phòng đã đủ người xem" text={`Mỗi phòng cho tối đa ${MAX_VISITORS} người xem cùng lúc. Chờ có người rời phòng rồi thử lại nhé.`} action="retry" />
  if (error === 'replaced')
    return <Notice title="Phòng đang mở ở nơi khác" text="Bạn mở phòng này ở quá nhiều tab hoặc máy, nên tab này đã tạm ngắt. Bấm Thử lại để chơi tiếp ở đây." action="retry" />
  if (!room) return <Notice title="Đang vào phòng…" text="Đang nối tới máy chủ." action={null} />
  if (room.game)
    return <OnlineGame game={room.game} role={room.role} chat={chat} receivedAt={receivedAt} connection={status} send={send} lag={lag} />
  if (room.role === 'host') return <Waiting room={room} backend={backend} />
  return <Invite room={room} ready={status === 'open'} send={(name) => send({ t: 'join', name })} />
}
