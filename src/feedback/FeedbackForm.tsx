// Nút Góp ý (hình phong thư, rê chuột vào mới chạy ra chữ "Góp ý" cho đầu trang khỏi rườm rà) và form góp ý mở ra khi
// bấm: điện thoại thì trượt lên từ cạnh dưới, máy tính thì hiện giữa màn hình, như bảng chọn bộ tiếng.
// Form gồm loại góp ý, nội dung, tên hay cách liên lạc (không bắt buộc), và thông tin ván, máy gửi kèm (tắt được,
// xem được trước khi gửi). Máy của chủ web thấy thêm số góp ý mới và lối vào hộp thư.
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { myName } from '../online/identity'
import { navigate, usePath } from '../router'
import { FeedbackError, feedbackBackend, ownerKey, refreshUnread, useUnread, type FeedbackProblem } from './api'
import { gatherContext } from './context'
import { CONTACT_MAX, FEEDBACK_KINDS, KIND_INFO, OWNER_NAME, TEXT_MAX, type FeedbackContext, type FeedbackKind } from './feedback'
import { onOpenFeedback, openFeedback } from './sheetState'
import './feedback.css'

const PROBLEM_TEXT: Record<FeedbackProblem, string> = {
  slow: 'Bạn vừa gửi nhiều góp ý liền, nghỉ tay một lát rồi gửi tiếp nhé.',
  busy: 'Hôm nay web đã nhận rất nhiều góp ý, mai bạn gửi lại giúp nhé.',
  full: 'Hộp góp ý đang đầy, vài hôm nữa bạn gửi lại giúp nhé.',
  network: 'Chưa gửi được: kiểm tra mạng rồi bấm Gửi lại nhé.',
  key: 'Chưa gửi được, bạn thử lại nhé.',
  bad: 'Chưa gửi được, bạn thử lại nhé.',
}

function Envelope() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.4" y="5.6" width="17.2" height="12.8" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="m4.2 7 7.8 6.1L19.8 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// `place`: "top" ở đầu trang (màn hình đủ rộng), "foot" ở cuối trang (điện thoại hẹp, đầu trang hết chỗ).
export function FeedbackButton({ place }: { place: 'top' | 'foot' }) {
  const unread = useUnread()
  return (
    <button
      type="button"
      className={`icon-btn fb-btn fb-btn--${place}`}
      onClick={openFeedback}
      aria-haspopup="dialog"
      aria-label={unread ? `Góp ý. Hộp thư có ${unread} góp ý mới` : 'Góp ý'}
    >
      <span className="fb-btn__label" aria-hidden="true">
        Góp ý
      </span>
      <Envelope />
      {!!unread && (
        <span className="fb-btn__badge" aria-hidden="true">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  )
}

// Cuối trang: chỉ điện thoại hẹp mới thấy (xem feedback.css).
export function PageFoot() {
  return (
    <footer className="page-foot">
      <FeedbackButton place="foot" />
    </footer>
  )
}

function Line({ name, value }: { name: string; value?: string }) {
  if (!value) return null
  return (
    <>
      <dt>{name}</dt>
      <dd>{value}</dd>
    </>
  )
}

// Thông tin gửi kèm, hiện cho người gửi xem trước (và cho chủ web đọc trong hộp thư).
export function ContextLines({ context }: { context: FeedbackContext }) {
  const moves = context.game ? context.game.split(' ').length : 0
  return (
    <dl className="fb-context">
      <Line name="Trang" value={context.page} />
      <Line name="Ván" value={[moves ? `${moves} nước đã đi` : '', context.state ?? ''].filter(Boolean).join(' · ')} />
      <Line name="Máy" value={context.device} />
      <Line name="Cài đặt" value={context.settings} />
      <Line name="Bản web" value={context.version} />
    </dl>
  )
}

export function FeedbackSheet() {
  const path = usePath()
  const dialog = useRef<HTMLDialogElement>(null)
  const pressedBackdrop = useRef(false)
  const [kind, setKind] = useState<FeedbackKind | null>(null)
  const [text, setText] = useState('')
  const [contact, setContact] = useState(myName)
  const [attach, setAttach] = useState(true)
  const [peek, setPeek] = useState(false) // đang mở xem thông tin gửi kèm
  const [trap, setTrap] = useState('')
  const [context, setContext] = useState<FeedbackContext | null>(null)
  const [phase, setPhase] = useState<'edit' | 'sending' | 'sent'>('edit')
  const [problem, setProblem] = useState<FeedbackProblem | null>(null)
  const unread = useUnread()
  const owner = ownerKey() !== null
  const ready = text.replace(/\s/g, '').length >= 2 && phase === 'edit'

  // Nút nào trên trang bấm Góp ý thì mở form. Thông tin gửi kèm gom lúc mở, đúng như lúc người gửi đang thấy.
  // Lần trước đã gửi xong thì mở ra form mới; chưa gửi thì chữ đã gõ vẫn còn.
  useEffect(
    () =>
      onOpenFeedback(() => {
        const box = dialog.current
        if (!box || box.open) return
        setContext(gatherContext(path))
        setProblem(null)
        setPhase((was) => (was === 'sent' ? 'edit' : was))
        box.showModal()
        const kinds = [...box.querySelectorAll<HTMLInputElement>('.fb-kinds input')]
        const first = kinds.find((input) => input.checked) ?? kinds[0]
        first?.focus({ preventScroll: true })
      }),
    [path],
  )

  function close() {
    dialog.current?.close()
  }

  function again() {
    setPhase('edit')
    requestAnimationFrame(() => dialog.current?.querySelector<HTMLInputElement>('.fb-kind input')?.focus())
  }

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!ready) return
    setPhase('sending')
    setProblem(null)
    try {
      await feedbackBackend.send({ kind: kind ?? 'other', text, contact: contact.trim(), context: attach ? context : null, website: trap })
      setPhase('sent')
      setText('')
      setKind(null)
      if (owner) void refreshUnread()
    } catch (error) {
      setProblem(error instanceof FeedbackError ? error.problem : 'bad')
      setPhase('edit')
    }
  }

  function openInbox() {
    close()
    navigate('/hop-thu')
  }

  return (
    // Chạm ra vùng tối bên ngoài bảng cũng là đóng.
    <dialog
      ref={dialog}
      className="sound-sheet fb-sheet"
      aria-labelledby="fb-title"
      onPointerDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (pressedBackdrop.current && e.target === e.currentTarget) close()
      }}
    >
      <header className="sound-sheet__head">
        <div className="sound-sheet__heading">
          <h2 className="sound-sheet__title" id="fb-title">
            Góp ý
          </h2>
          <p className="sound-sheet__hint">Gửi thẳng tới {OWNER_NAME}, không ai khác đọc được.</p>
        </div>
        <button type="button" className="sound-sheet__close" onClick={close} aria-label="Đóng">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6.5 6.5 11 11m0-11-11 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      {phase === 'sent' ? (
        <div className="fb-body fb-done" role="status">
          <span className="fb-done__mark" aria-hidden="true">
            ✓
          </span>
          <p className="fb-done__title">Đã gửi, cảm ơn bạn!</p>
          <div className="fb-actions">
            {owner && (
              <button type="button" className="btn" onClick={openInbox}>
                Mở hộp thư
              </button>
            )}
            <button type="button" className="btn" onClick={again}>
              Gửi thêm
            </button>
            <button type="button" className="btn btn--primary" onClick={close}>
              Xong
            </button>
          </div>
        </div>
      ) : (
        <form className="fb-body" onSubmit={send}>
          {owner && (
            <button type="button" className="fb-owner" onClick={openInbox}>
              <span>Hộp thư góp ý</span>
              {!!unread && <span className="fb-owner__new">{unread} mới</span>}
              <span aria-hidden="true">›</span>
            </button>
          )}

          <div className="fb-kinds" role="radiogroup" aria-label="Loại góp ý">
            {FEEDBACK_KINDS.map((id) => (
              <label key={id} className={`fb-kind${kind === id ? ' fb-kind--on' : ''}`}>
                <input type="radio" name="fb-kind" value={id} checked={kind === id} onChange={() => setKind(id)} />
                <span className="fb-kind__icon" aria-hidden="true">
                  {KIND_INFO[id].icon}
                </span>
                <span>{KIND_INFO[id].name}</span>
              </label>
            ))}
          </div>

          <textarea
            className="fb-input fb-text"
            aria-label="Nội dung góp ý"
            placeholder={kind ? KIND_INFO[kind].hint : 'Bạn muốn góp ý gì cho web?'}
            value={text}
            maxLength={TEXT_MAX}
            rows={4}
            onChange={(e) => setText(e.target.value)}
          />
          {text.length > TEXT_MAX - 200 && (
            <span className="fb-count" aria-live="polite">
              {text.length}/{TEXT_MAX}
            </span>
          )}

          <input
            className="fb-input"
            aria-label="Tên hoặc cách liên lạc (không bắt buộc)"
            placeholder="Tên hoặc Zalo (không bắt buộc)"
            value={contact}
            maxLength={CONTACT_MAX}
            autoComplete="nickname"
            onChange={(e) => setContact(e.target.value)}
          />

          {/* Ô bẫy: người thật không thấy, chỉ máy dò tự động mới điền. */}
          <input className="fb-trap" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={trap} onChange={(e) => setTrap(e.target.value)} />

          <div className="fb-attach">
            <label className="switch">
              <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} />
              <span className="switch__track" aria-hidden="true" />
              <span>Kèm thông tin ván và máy</span>
            </label>
            {attach && (
              <button type="button" className="link-button" aria-expanded={peek} onClick={() => setPeek(!peek)}>
                {peek ? 'Ẩn' : 'Xem'}
              </button>
            )}
          </div>
          {attach && peek && context && <ContextLines context={context} />}

          {problem && (
            <p className="fb-problem" role="alert">
              {PROBLEM_TEXT[problem]}
            </p>
          )}

          <button type="submit" className="btn btn--primary fb-send" disabled={!ready}>
            {phase === 'sending' ? 'Đang gửi…' : problem ? 'Gửi lại' : 'Gửi'}
          </button>
        </form>
      )}
    </dialog>
  )
}
