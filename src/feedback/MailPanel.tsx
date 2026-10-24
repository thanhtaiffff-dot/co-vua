// Mục "Báo về mail" trong hộp thư: bật, tắt việc gửi mail cho chủ web mỗi khi có góp ý mới, điền mail nhận thư và chìa
// Resend, gửi thư thử. Bình thường chỉ là một nút nhỏ dưới tên hộp thư, bấm mới mở ra (trang đỡ rối mắt).
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { FeedbackError, feedbackBackend, type MailTest } from './api'
import { isEmail, isResendKey, MAIL_PER_DAY, type MailProblem, type MailSettings } from './mail'

const PROBLEM_TEXT: Record<MailProblem, string> = {
  key: 'Resend không nhận chìa này. Chép lại chìa (bắt đầu bằng re_) rồi bấm Lưu.',
  address: 'Resend chỉ gửi được tới đúng mail của tài khoản Resend. Sửa ô Mail nhận thư cho khớp.',
  limit: 'Resend báo hết lượt gửi, mai thư lại chạy.',
  service: 'Resend đang trục trặc, lát nữa thử lại nhé.',
  network: 'Máy chủ chưa gọi được Resend, lát nữa thử lại nhé.',
}

function clock(at: number): string {
  return new Date(at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
}

export function MailPanel({ ownerKey: key, onWrongKey }: { ownerKey: string; onWrongKey: () => void }) {
  const [settings, setSettings] = useState<MailSettings | null>(null)
  const [open, setOpen] = useState(false)
  const [on, setOn] = useState(false)
  const [email, setEmail] = useState('')
  const [newKey, setNewKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  // Hiện cài đặt máy chủ vừa trả về (kèm lỗi của lần gửi thư gần nhất, nếu có).
  const show = useCallback((loaded: MailSettings) => {
    setSettings(loaded)
    setOn(loaded.on)
    setEmail(loaded.email)
    setProblem(loaded.problem ? PROBLEM_TEXT[loaded.problem] : null)
  }, [])

  function fail(error: unknown) {
    if (error instanceof FeedbackError && error.problem === 'key') return onWrongKey()
    setProblem(error instanceof FeedbackError && error.problem === 'network' ? 'Chưa lưu được: kiểm tra mạng.' : 'Máy chủ đang trục trặc, thử lại nhé.')
  }

  // Hỏi máy chủ cài đặt đang lưu lúc mở hộp thư (để nút nhỏ hiện đang bật hay tắt).
  useEffect(() => {
    let alive = true
    feedbackBackend.mail(key).then(
      (loaded) => {
        if (alive) show(loaded)
      },
      (error: unknown) => {
        if (alive && error instanceof FeedbackError && error.problem === 'key') onWrongKey()
      },
    )
    return () => {
      alive = false
    }
  }, [key, onWrongKey, show])

  async function test() {
    setBusy(true)
    setNote(null)
    setProblem(null)
    try {
      const result: MailTest = await feedbackBackend.testMail(key)
      setSettings(result.settings)
      if (result.problem === 'demo') setNote('Bản chơi thử không gửi thư thật. Trên web thật, thư sẽ tới mail của bạn.')
      else if (result.problem) setProblem(PROBLEM_TEXT[result.problem])
      else setNote(`Đã gửi thư thử tới ${result.settings.email}. Mở Gmail xem nhé (không thấy thì xem mục Thư rác).`)
    } catch (error) {
      fail(error)
    } finally {
      setBusy(false)
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!settings) return
    const typedKey = newKey.trim()
    const typedEmail = email.trim()
    setNote(null)
    if (typedKey && !isResendKey(typedKey)) return setProblem('Chìa Resend bắt đầu bằng re_, bạn chép lại giúp nhé.')
    if (typedEmail && !isEmail(typedEmail)) return setProblem('Mail chưa đúng dạng.')
    if (on && !typedEmail) return setProblem('Điền mail nhận thư trước khi bật.')
    if (on && !typedKey && !settings.keyHint) return setProblem('Dán chìa Resend trước khi bật.')
    setProblem(null)
    setBusy(true)
    // Vừa dán chìa mới hay đổi mail mà đang bật thì gửi luôn một thư thử, khỏi bấm thêm.
    const tryIt = on && (!!typedKey || typedEmail !== settings.email)
    try {
      show(await feedbackBackend.saveMail(key, { on, email: typedEmail, ...(typedKey ? { key: typedKey } : {}) }))
      setNewKey('')
      setNote(on ? 'Đã lưu: có góp ý mới là bạn nhận mail.' : 'Đã lưu: đang tắt báo mail.')
    } catch (error) {
      setBusy(false)
      return fail(error)
    }
    if (tryIt) await test()
    setBusy(false)
  }

  const changed = !!settings && (on !== settings.on || email.trim() !== settings.email || newKey.trim() !== '')
  const tryIt = !!settings && on && (newKey.trim() !== '' || email.trim() !== settings.email)

  return (
    <div className="mail">
      <button type="button" className="mail-toggle" aria-expanded={open} aria-controls="mail-panel" onClick={() => setOpen(!open)}>
        <span className={`mail-toggle__dot${settings?.on ? ' mail-toggle__dot--on' : ''}`} aria-hidden="true" />
        Báo về mail: {settings ? (settings.on ? 'đang bật' : 'đang tắt') : '…'}
        <span className="mail-toggle__chevron" aria-hidden="true">
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open && settings && (
        <form className="mail-panel" id="mail-panel" onSubmit={save}>
          <label className="switch">
            <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
            <span className="switch__track" aria-hidden="true" />
            <span>Gửi mail khi có góp ý mới</span>
          </label>

          <label className="mail-field">
            <span className="mail-field__name">Mail nhận thư</span>
            <input
              className="fb-input"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="Mail của tài khoản Resend"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="mail-field">
            <span className="mail-field__name">Chìa Resend{settings.keyHint && ` · đã lưu …${settings.keyHint}`}</span>
            <input
              className="fb-input"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder={settings.keyHint ? 'Dán chìa mới để đổi' : 'Dán chìa bắt đầu bằng re_'}
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
            />
          </label>

          {problem && (
            <p className="fb-problem" role="alert">
              {problem}
            </p>
          )}
          {note && (
            <p className="mail-note" role="status">
              {note}
            </p>
          )}

          <div className="mail-actions">
            <button type="submit" className="btn btn--primary" disabled={busy || !changed}>
              {busy ? 'Đang làm…' : tryIt ? 'Lưu và gửi thư thử' : 'Lưu'}
            </button>
            <button type="button" className="btn" disabled={busy || !settings.keyHint || !settings.email} onClick={() => void test()}>
              Gửi thư thử
            </button>
          </div>

          <p className="mail-status">
            Hôm nay đã gửi {settings.sentToday}/{MAIL_PER_DAY} thư{settings.lastSentAt ? ` · thư gần nhất ${clock(settings.lastSentAt)}` : ''}
          </p>

          <details className="mail-guide" open={!settings.keyHint}>
            <summary>Lấy chìa Resend (4 bước)</summary>
            <ol>
              <li>
                Mở{' '}
                <a href="https://resend.com/signup" target="_blank" rel="noreferrer noopener">
                  resend.com/signup
                </a>
                , đăng nhập bằng Google, đúng Gmail muốn nhận thư.
              </li>
              <li>
                Vào{' '}
                <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer noopener">
                  API Keys
                </a>
                , bấm Create API Key, đặt tên co-vua, chọn Sending access, bấm Add.
              </li>
              <li>Bấm chép chìa (bắt đầu bằng re_). Resend chỉ cho xem chìa này một lần.</li>
              <li>Dán chìa vào ô trên, điền mail của tài khoản Resend, bật công tắc rồi bấm Lưu.</li>
            </ol>
          </details>
        </form>
      )}
    </div>
  )
}
