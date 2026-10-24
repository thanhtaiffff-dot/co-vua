// Hộp thư góp ý giả cho bản chơi thử (chưa có máy chủ thật): góp ý gửi đi nằm ngay trong trình duyệt này, cùng vài
// góp ý mẫu để xem hộp thư trông thế nào. Cách đếm, lọc, chia trang giống hộp thư thật (worker/feedback-box.ts).
// Cài đặt báo mail cũng lưu được, nhưng bản chơi thử không gửi thư thật.
import { loadSaved, save } from '../storage'
import type { FeedbackBackend } from './api'
import { countFeedback, PAGE_SIZE, parseFeedback, type FeedbackItem } from './feedback'
import { parseMailSave, type MailSettings } from './mail'

const HOUR = 60 * 60 * 1000

function samples(now: number): FeedbackItem[] {
  return [
    {
      id: 1,
      at: now - 26 * HOUR,
      kind: 'praise',
      text: 'Bộ tiếng Bass 808 đeo tai nghe đánh đã thật sự 🔥 (góp ý mẫu)',
      contact: 'Minh',
      context: null,
      status: 'seen',
    },
    {
      id: 2,
      at: now - 5 * HOUR,
      kind: 'idea',
      text: 'Thêm chế độ chơi với máy để lúc không có ai online vẫn tập được. (góp ý mẫu)',
      contact: '',
      context: null,
      status: 'new',
    },
    {
      id: 3,
      at: now - 40 * 60 * 1000,
      kind: 'bug',
      text: 'Đang chơi thì bấm Lật bàn hai lần liền, quân 3D bị lệch một chút rồi mới về đúng chỗ. (góp ý mẫu)',
      contact: 'Zalo 09xx xxx xxx',
      context: {
        page: 'Phòng online x7k2m9ab',
        game: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4',
        side: 'black',
        state: 'Bạn cầm Đen, ván 1 · Tới lượt Trắng',
        device: 'Điện thoại Android · Samsung Internet 27 · màn 384×832 · nền tối',
        settings: 'Quân Thép 3D bo tròn, bàn Gỗ · tiếng theo chủ đề (Thép), đang bật',
        version: 'bản thử',
      },
      status: 'new',
    },
  ]
}

function load(): FeedbackItem[] {
  const saved = loadSaved<unknown>('feedbackDemo', null)
  return Array.isArray(saved) ? (saved as FeedbackItem[]) : samples(Date.now())
}

function store(items: FeedbackItem[]): void {
  save('feedbackDemo', items)
}

function update(change: (items: FeedbackItem[]) => FeedbackItem[]): Promise<void> {
  store(change(load()))
  return Promise.resolve()
}

const NO_MAIL: MailSettings = { on: false, email: '', keyHint: null, sentToday: 0, lastSentAt: null, problem: null }

function loadMail(): MailSettings {
  const saved = loadSaved<unknown>('mailDemo', null)
  return saved && typeof saved === 'object' ? { ...NO_MAIL, ...(saved as Partial<MailSettings>) } : { ...NO_MAIL }
}

export const demoFeedback: FeedbackBackend = {
  demo: true,
  async send(feedback) {
    const input = parseFeedback(feedback)
    if (!input || input === 'trap') return
    const items = load()
    const id = Math.max(0, ...items.map((item) => item.id)) + 1
    store([...items, { ...input, id, at: Date.now(), status: 'new' }])
  },
  async list(_key, query) {
    const all = load().sort((a, b) => b.id - a.id)
    const rows = all.filter(
      (item) => (!query.kind || item.kind === query.kind) && (!query.open || item.status !== 'done') && (!query.before || item.id < query.before),
    )
    const counts = countFeedback(all.map((item) => ({ kind: item.kind, status: item.status, n: 1 })))
    return { items: rows.slice(0, PAGE_SIZE), more: rows.length > PAGE_SIZE, counts }
  },
  async unread() {
    return load().filter((item) => item.status === 'new').length
  },
  markSeen: (_key, ids) => update((items) => items.map((item) => (item.status === 'new' && ids.includes(item.id) ? { ...item, status: 'seen' } : item))),
  setDone: (_key, id, done) => update((items) => items.map((item) => (item.id === id ? { ...item, status: done ? 'done' : 'seen' } : item))),
  remove: (_key, id) => update((items) => items.filter((item) => item.id !== id)),
  async mail() {
    return loadMail()
  },
  async saveMail(_key, change) {
    const parsed = parseMailSave(change)
    const old = loadMail()
    const keyHint = parsed?.key ? parsed.key.slice(-4) : old.keyHint
    if (!parsed || (parsed.on && (!keyHint || !parsed.email))) throw new Error('Cài đặt báo mail không đúng')
    const next = { ...old, on: parsed.on, email: parsed.email, keyHint }
    save('mailDemo', next)
    return next
  },
  async testMail() {
    return { problem: 'demo', settings: loadMail() }
  },
}
