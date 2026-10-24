// Hộp thư góp ý (/hop-thu): chỉ chủ web vào được, bằng link riêng có chìa khoá (mở một lần là máy nhớ chìa).
// Góp ý mới nhất ở trên; lọc theo loại, ẩn góp ý đã xử lý; mỗi góp ý có nút Đã xử lý và Xoá (bấm hai lần cho khỏi
// lỡ tay). Góp ý có kèm ván thì mở lại được đúng ván đó trên lichess. Nội dung góp ý chỉ hiện dạng chữ: link không
// bấm được, mã lạ không chạy được. Nút "Báo về mail" mở phần cài đặt gửi mail cho chủ web khi có góp ý mới.
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { TopBar } from '../components/TopBar'
import { analysisUrl } from '../game/rules'
import { FeedbackError, feedbackBackend, ownerKey, readKey, refreshUnread, saveOwnerKey, takeKeyFromLink, type FeedbackProblem } from './api'
import { ContextLines } from './FeedbackForm'
import { emptyCounts, FEEDBACK_KINDS, KIND_INFO, type FeedbackCounts, type FeedbackItem, type FeedbackKind } from './feedback'
import { MailPanel } from './MailPanel'
import './feedback.css'

const MINUTE = 60 * 1000

// "Vừa xong", "12 phút trước", "Hôm nay 14:05", "Hôm qua 09:30", "21/10 20:15" (năm khác thì thêm năm).
function when(at: number, now: number): string {
  if (now - at < MINUTE) return 'Vừa xong'
  if (now - at < 60 * MINUTE) return `${Math.floor((now - at) / MINUTE)} phút trước`
  const date = new Date(at)
  const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  const day = (d: Date) => d.toDateString()
  if (day(date) === day(new Date(now))) return `Hôm nay ${time}`
  if (day(date) === day(new Date(now - 24 * 60 * MINUTE))) return `Hôm qua ${time}`
  const sameYear = date.getFullYear() === new Date(now).getFullYear()
  return `${date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: sameYear ? undefined : 'numeric' })} ${time}`
}

export function InboxPage() {
  return (
    <div className="app">
      <TopBar switchTo={{ path: '/', label: 'Chơi một máy' }} />
      <main className="inbox">
        <Inbox />
      </main>
    </div>
  )
}

function Inbox() {
  const [key, setKey] = useState<string | null>(() => {
    takeKeyFromLink()
    return ownerKey()
  })
  const [wrongKey, setWrongKey] = useState(false)

  function forget() {
    saveOwnerKey(null)
    setKey(null)
  }

  function open(next: string) {
    saveOwnerKey(next)
    setWrongKey(false)
    setKey(next)
  }

  if (!key) return <Locked wrong={wrongKey} onKey={open} />
  return (
    <Mailbox
      key={key}
      ownerKey={key}
      onWrongKey={() => {
        forget()
        setWrongKey(true)
      }}
      onForget={forget}
    />
  )
}

function Locked({ wrong, onKey }: { wrong: boolean; onKey: (key: string) => void }) {
  const [text, setText] = useState('')
  const key = readKey(text)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (key) onKey(key)
  }

  return (
    <section className="inbox-lock">
      <h2 className="inbox__title">Hộp thư góp ý</h2>
      <p className="inbox__note">
        {wrong ? 'Chìa khoá không đúng (hoặc đã đổi). ' : ''}Trang này chỉ dành cho người làm web: mở bằng link riêng có chìa khoá, hoặc dán link vào
        đây.
      </p>
      <form className="inbox-lock__form" onSubmit={submit}>
        <input
          className="fb-input"
          aria-label="Link hoặc chìa khoá hộp thư"
          placeholder="Dán link hoặc chìa khoá"
          value={text}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn btn--primary" disabled={!key}>
          Mở
        </button>
      </form>
    </section>
  )
}

type Filter = { kind: FeedbackKind | null; open: boolean }

function Mailbox({ ownerKey: key, onWrongKey, onForget }: { ownerKey: string; onWrongKey: () => void; onForget: () => void }) {
  const [filter, setFilter] = useState<Filter>({ kind: null, open: false })
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [counts, setCounts] = useState<FeedbackCounts>(emptyCounts)
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState<FeedbackProblem | null>(null)
  // Góp ý còn mới lúc mở hộp thư: giữ chữ "Mới" suốt lần xem này, dù máy chủ đã ghi là đã thấy.
  const [fresh, setFresh] = useState<Set<number>>(() => new Set())
  const [now, setNow] = useState(() => Date.now())
  const turn = useRef(0)

  const fail = useCallback(
    (error: unknown) => {
      const why = error instanceof FeedbackError ? error.problem : 'bad'
      if (why === 'key') onWrongKey()
      else setProblem(why)
    },
    [onWrongKey],
  )

  // Tải một trang góp ý (`before`: trang sau, tiếp nối danh sách đang có). Góp ý mới hiện ra thì báo máy chủ là đã thấy.
  const load = useCallback(
    async (before?: number) => {
      const mine = ++turn.current
      setLoading(true)
      try {
        const page = await feedbackBackend.list(key, { kind: filter.kind ?? undefined, open: filter.open, before })
        if (mine !== turn.current) return
        setItems((old) => (before ? [...old, ...page.items] : page.items))
        setCounts(page.counts)
        setMore(page.more)
        setProblem(null)
        setNow(Date.now())
        const seen = page.items.filter((item) => item.status === 'new').map((item) => item.id)
        if (seen.length > 0) {
          setFresh((old) => new Set([...old, ...seen]))
          await feedbackBackend.markSeen(key, seen)
          void refreshUnread()
        }
      } catch (error) {
        if (mine === turn.current) fail(error)
      } finally {
        if (mine === turn.current) setLoading(false)
      }
    },
    [key, filter, fail],
  )

  // Tải hộp thư từ máy chủ lúc mở trang và mỗi lần đổi bộ lọc: việc với bên ngoài nên nằm trong effect.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void load()
  }, [load])

  async function setDone(item: FeedbackItem, done: boolean) {
    const status = done ? 'done' : 'seen'
    setItems((old) => old.map((one) => (one.id === item.id ? { ...one, status } : one)))
    setCounts((old) => ({ ...old, open: old.open + (done ? -1 : 1) }))
    try {
      await feedbackBackend.setDone(key, item.id, done)
    } catch (error) {
      fail(error)
      void load()
    }
  }

  async function remove(item: FeedbackItem) {
    setItems((old) => old.filter((one) => one.id !== item.id))
    setCounts((old) => ({ ...old, all: old.all - 1, open: old.open - (item.status === 'done' ? 0 : 1), [item.kind]: old[item.kind] - 1 }))
    try {
      await feedbackBackend.remove(key, item.id)
    } catch (error) {
      fail(error)
      void load()
    }
  }

  const shown = filter.kind ? counts[filter.kind] : counts.all
  return (
    <>
      <header className="inbox__head">
        <h2 className="inbox__title">Hộp thư góp ý</h2>
        <p className="inbox__note">
          {counts.all} góp ý · {counts.open} chưa xử lý
          {feedbackBackend.demo && ' · bản chơi thử: góp ý nằm ngay trong trình duyệt này, có sẵn 3 góp ý mẫu'}
        </p>
      </header>

      <MailPanel ownerKey={key} onWrongKey={onWrongKey} />

      <div className="inbox__filters">
        <div className="inbox-chips" role="radiogroup" aria-label="Lọc theo loại">
          <label className={`inbox-chip${filter.kind === null ? ' inbox-chip--on' : ''}`}>
            <input type="radio" name="inbox-kind" checked={filter.kind === null} onChange={() => setFilter({ ...filter, kind: null })} />
            Tất cả <span className="inbox-chip__n">{counts.all}</span>
          </label>
          {FEEDBACK_KINDS.map((id) => (
            <label key={id} className={`inbox-chip${filter.kind === id ? ' inbox-chip--on' : ''}`}>
              <input type="radio" name="inbox-kind" checked={filter.kind === id} onChange={() => setFilter({ ...filter, kind: id })} />
              <span aria-hidden="true">{KIND_INFO[id].icon}</span> {KIND_INFO[id].name} <span className="inbox-chip__n">{counts[id]}</span>
            </label>
          ))}
        </div>
        <label className="switch">
          <input type="checkbox" checked={filter.open} onChange={(e) => setFilter({ ...filter, open: e.target.checked })} />
          <span className="switch__track" aria-hidden="true" />
          <span>Ẩn góp ý đã xử lý</span>
        </label>
      </div>

      {problem && (
        <p className="inbox__problem" role="alert">
          {problem === 'network' ? 'Chưa tải được hộp thư: kiểm tra mạng.' : 'Máy chủ đang trục trặc.'}{' '}
          <button type="button" className="link-button" onClick={() => void load()}>
            Thử lại
          </button>
        </p>
      )}

      {items.length === 0 && !loading && !problem && (
        <p className="inbox__empty">{shown === 0 ? 'Chưa có góp ý nào.' : 'Không còn góp ý nào chưa xử lý ở mục này.'}</p>
      )}

      <ol className="inbox__list">
        {items.map((item) => (
          <li key={item.id}>
            <Letter item={item} fresh={fresh.has(item.id)} now={now} onDone={(done) => void setDone(item, done)} onRemove={() => void remove(item)} />
          </li>
        ))}
      </ol>

      {loading && <p className="inbox__empty">Đang tải…</p>}
      {more && !loading && (
        <button type="button" className="btn inbox__more" onClick={() => void load(items[items.length - 1]?.id)}>
          Xem thêm
        </button>
      )}

      {!feedbackBackend.demo && (
        <p className="inbox__foot">
          <button type="button" className="link-button" onClick={onForget}>
            Quên chìa khoá trên máy này
          </button>
        </p>
      )}
    </>
  )
}

function Letter({ item, fresh, now, onDone, onRemove }: { item: FeedbackItem; fresh: boolean; now: number; onDone: (done: boolean) => void; onRemove: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const done = item.status === 'done'
  const info = KIND_INFO[item.kind]
  const game = item.context?.game

  // Bấm Xoá một lần thì nút đổi thành "Bấm lần nữa"; 3 giây không bấm thì thôi.
  useEffect(() => {
    if (!confirm) return
    const timer = setTimeout(() => setConfirm(false), 3000)
    return () => clearTimeout(timer)
  }, [confirm])

  return (
    <article className={`letter${done ? ' letter--done' : ''}`}>
      <header className="letter__head">
        <span className={`letter__kind letter__kind--${item.kind}`}>
          <span aria-hidden="true">{info.icon}</span> {info.name}
        </span>
        {fresh && <span className="letter__new">Mới</span>}
        <time className="letter__time" dateTime={new Date(item.at).toISOString()}>
          {when(item.at, now)}
        </time>
      </header>
      <p className="letter__text">{item.text}</p>
      {item.contact && <p className="letter__from">{item.contact}</p>}
      {item.context && (
        <details className="letter__more">
          <summary>Thông tin kèm</summary>
          <ContextLines context={item.context} />
          {game && (
            <a className="letter__game" href={analysisUrl(game.split(' '), item.context.side ?? 'white')} target="_blank" rel="noreferrer noopener">
              Mở ván trên lichess
            </a>
          )}
        </details>
      )}
      <footer className="letter__actions">
        <button type="button" className={`btn letter__done${done ? ' letter__done--on' : ''}`} aria-pressed={done} onClick={() => onDone(!done)}>
          {done ? '✓ Đã xử lý' : 'Đã xử lý'}
        </button>
        <button
          type="button"
          className={`btn${confirm ? ' btn--confirm' : ''}`}
          onClick={() => {
            if (confirm) onRemove()
            else setConfirm(true)
          }}
        >
          {confirm ? 'Bấm lần nữa' : 'Xoá'}
        </button>
      </footer>
    </article>
  )
}
