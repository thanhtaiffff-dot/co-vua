// Chat giữa hai người chơi trong phòng online. Máy tính: khung chat là cột bên trái bàn cờ. Điện thoại: nút Chat nổi ở
// góc dưới (có chấm đỏ đếm tin chưa đọc), bấm thì khung chat trượt lên từ cạnh dưới; tin mới của đối thủ hiện thành
// bong bóng thoại cạnh tên họ vài giây, để đang đánh vẫn đọc được mà không phải mở khung chat.
// Chữ trong tin hiện đúng như chữ thường (React tự chặn mã độc), link không bấm được.
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { CHAT_BURST, CHAT_LIMIT, CHAT_PER_SECOND, type ChatLine } from './protocol'
import type { ChatPhase, ChatRole } from './useChat'
import './chat.css'

const QUICK: Record<ChatPhase, string[]> = {
  start: ['Chào nha', 'Chơi vui nha', 'Chúc may mắn', 'Bạn cũng vậy'],
  middle: ['Ghê vậy', 'Nghĩ lẹ lên', 'Sai rồi nha', 'Hên thôi'],
  end: ['Ván hay', 'Phục', 'Cảm ơn', 'Ván nữa không?'],
}

const EMOJI = ['😂', '🤣', '😁', '😎', '😏', '🤔', '😳', '😱', '😭', '😤', '😡', '🥲', '🙏', '👏', '👍', '👎', '🔥', '💀', '🤡', '🐢', '⏰', '🎉', '♟️', '👑']

type PanelProps = {
  lines: ChatLine[]
  mine: ChatRole
  them: string // tên đối thủ
  themOff: boolean // đối thủ đã tắt chat
  off: boolean // mình đã tắt chat
  phase: ChatPhase
  onSend: (text: string) => void
  onToggle: () => void
  onClose?: () => void // chỉ có khi khung chat là tấm trượt trên điện thoại
}

export function ChatPanel({ lines, mine, them, themOff, off, phase, onSend, onToggle, onClose }: PanelProps) {
  const [draft, setDraft] = useState('')
  const [picking, setPicking] = useState(false)
  const [slow, setSlow] = useState(false)
  const list = useRef<HTMLOListElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const budget = useRef({ tokens: CHAT_BURST, at: 0 })
  const stick = useRef(true) // đang xem cuối khung chat: có tin mới thì cuộn theo

  useLayoutEffect(() => {
    const box = list.current
    if (box && stick.current) box.scrollTop = box.scrollHeight
  }, [lines.length, themOff, off])

  useEffect(() => {
    if (!slow) return
    const timer = setTimeout(() => setSlow(false), 2000)
    return () => clearTimeout(timer)
  }, [slow])

  function send(text: string): boolean {
    const clean = text.trim()
    if (!clean) return false
    if (!spend(budget.current)) {
      setSlow(true)
      return false
    }
    stick.current = true
    onSend(clean)
    return true
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (send(draft)) {
      setDraft('')
      setPicking(false)
    }
  }

  function addEmoji(emoji: string) {
    setDraft((text) => (text + emoji).slice(0, CHAT_LIMIT))
    input.current?.focus()
  }

  return (
    <section className={`chat${onClose ? ' chat--sheet' : ''}${off ? ' chat--off' : ''}`} aria-label={`Chat với ${them}`}>
      <header className="chat__head">
        <h2 className="chat__title">
          Chat <span className="chat__with">với {them}</span>
        </h2>
        <button type="button" className="chat__toggle" aria-pressed={!off} onClick={onToggle}>
          {off ? 'Bật chat' : 'Tắt chat'}
        </button>
        {onClose && (
          <button type="button" className="chat__close" aria-label="Đóng chat" onClick={onClose}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </header>

      {off ? (
        <p className="chat__off">Bạn đã tắt chat: không thấy tin, không nghe tiếng. {them} sẽ thấy là bạn đã tắt chat.</p>
      ) : (
        <>
          <ol
            className="chat__lines"
            ref={list}
            aria-live="polite"
            onScroll={(event) => {
              const box = event.currentTarget
              stick.current = box.scrollHeight - box.scrollTop - box.clientHeight < 24
            }}
          >
            {lines.length === 0 && <li className="chat__empty">Chưa có tin nào. Chào {them} một câu đi!</li>}
            {lines.map((line, i) => {
              const before = lines[i - 1]
              const divider = before ? before.game !== line.game : line.game > 1
              const own = line.by === mine
              const named = !own && (divider || !before || before.by !== line.by)
              return (
                <li key={line.id} className={`chat__line${own ? ' chat__line--mine' : ''}`}>
                  {divider && <span className="chat__divider">Ván {line.game}</span>}
                  {named && <span className="chat__name">{them}</span>}
                  <span className="chat__text" title={clockTime(line.at)}>
                    {line.text}
                  </span>
                </li>
              )
            })}
            {themOff && <li className="chat__note">{them} đã tắt chat, sẽ thấy tin của bạn khi bật lại.</li>}
          </ol>

          <div className="chat__quick">
            {QUICK[phase].map((text) => (
              <button key={text} type="button" className="chat__chip" onClick={() => send(text)}>
                {text}
              </button>
            ))}
          </div>

          {picking && (
            <div className="chat__emoji" role="group" aria-label="Chọn emoji">
              {EMOJI.map((emoji) => (
                <button key={emoji} type="button" onClick={() => addEmoji(emoji)}>
                  {emoji}
                </button>
              ))}
            </div>
          )}

          <form className="chat__form" onSubmit={submit}>
            <button type="button" className="chat__emoji-btn" aria-label="Emoji" aria-expanded={picking} onClick={() => setPicking((p) => !p)}>
              😊
            </button>
            <input
              ref={input}
              className="chat__input"
              value={draft}
              maxLength={CHAT_LIMIT}
              placeholder={slow ? 'Gửi chậm lại chút nha…' : 'Nhắn gì đó…'}
              enterKeyHint="send"
              autoComplete="off"
              aria-label="Tin nhắn"
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" className="chat__send" aria-label="Gửi" disabled={!draft.trim()}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 12l16-8-6 16-2.5-6.5z" />
              </svg>
            </button>
          </form>
          {slow && (
            <p className="chat__slow" role="status">
              Gửi chậm lại chút nha.
            </p>
          )}
        </>
      )}
    </section>
  )
}

// Mức gửi giống máy chủ (gửi liền CHAT_BURST câu, sau đó CHAT_PER_SECOND câu mỗi giây), để báo "gửi chậm lại"
// ngay tại chỗ thay vì để máy chủ lặng lẽ bỏ câu. Trả về false khi phải chờ.
function spend(budget: { tokens: number; at: number }): boolean {
  const now = Date.now()
  budget.tokens = Math.min(CHAT_BURST, budget.tokens + ((now - budget.at) * CHAT_PER_SECOND) / 1000)
  budget.at = now
  if (budget.tokens < 1) return false
  budget.tokens -= 1
  return true
}

function clockTime(at: number): string {
  return new Date(at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

// Nút Chat nổi ở góc dưới trên điện thoại, có chấm đỏ đếm tin chưa đọc.
export function ChatButton({ unread, off, onClick }: { unread: number; off: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`chat-fab${off ? ' chat-fab--off' : ''}`}
      aria-label={unread > 0 ? `Chat, ${unread} tin chưa đọc` : off ? 'Chat (đang tắt)' : 'Chat'}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5h16v11H9l-5 4z" />
        {off && <path d="M3 3l18 18" />}
      </svg>
      {unread > 0 && <span className="chat-fab__badge">{unread > 9 ? '9+' : unread}</span>}
    </button>
  )
}

// Bong bóng thoại đè lên thanh tên đối thủ vài giây (chừa đồng hồ), như lời người đó vừa nói. Nằm ngay trên thanh tên
// nên không che bàn cờ, và cuộn trang tới đâu thấy thanh tên là thấy bong bóng.
export function ChatBubble({ text }: { text: string }) {
  return (
    <div className="chat-bubble" role="status">
      <span className="chat-bubble__text">{text}</span>
    </div>
  )
}
