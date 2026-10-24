// Đồng hồ cờ: chỉ ghi lại thời gian còn lại sau mỗi nước và lúc lượt hiện tại bắt đầu,
// còn đồng hồ đang chạy tới đâu thì tính ra từ giờ thật (Date.now()), nên tải lại trang vẫn đúng.
import type { Color } from 'chess.js'

// `minutes` phút cho mỗi bên, đi xong mỗi nước được cộng thêm `increment` giây.
export type TimeControl = { minutes: number; increment: number }

// Thời gian còn lại của hai bên, tính bằng mili giây.
export type Times = Record<Color, number>

export type ClockState = {
  control: TimeControl | null // null: không tính giờ
  times: Times[] // times[i]: thời gian còn lại của hai bên ngay sau nước thứ i + 1 (chỉ có khi tính giờ)
  turnStart: number // lúc lượt hiện tại bắt đầu (lúc nước gần nhất được đi, hay lúc vừa đi lại)
  // spent[i]: thời gian bên đi nước thứ i + 1 đã nghĩ (ms), ghi cả khi không tính giờ. null là không biết:
  // nước đầu của Trắng (đồng hồ chưa chạy), hay ván lưu từ bản cũ chưa ghi thời gian nghĩ.
  spent: (number | null)[]
}

// Các mức giờ quen thuộc, xếp như bảng chọn của chess.com.
export const TIME_CONTROLS: { name: string; controls: TimeControl[] }[] = [
  {
    name: 'Siêu chớp',
    controls: [
      { minutes: 1, increment: 0 },
      { minutes: 1, increment: 1 },
      { minutes: 2, increment: 1 },
    ],
  },
  {
    name: 'Chớp',
    controls: [
      { minutes: 3, increment: 0 },
      { minutes: 3, increment: 2 },
      { minutes: 5, increment: 0 },
    ],
  },
  {
    name: 'Nhanh',
    controls: [
      { minutes: 10, increment: 0 },
      { minutes: 15, increment: 10 },
      { minutes: 30, increment: 0 },
    ],
  },
]

export const DEFAULT_CONTROL: TimeControl = { minutes: 10, increment: 0 }

export function sameControl(a: TimeControl | null, b: TimeControl | null): boolean {
  return a === b || (a !== null && b !== null && a.minutes === b.minutes && a.increment === b.increment)
}

export function controlLabel(control: TimeControl): string {
  return control.increment > 0 ? `${control.minutes} | ${control.increment}` : `${control.minutes} phút`
}

export function describeControl(control: TimeControl): string {
  const base = `Mỗi bên ${control.minutes} phút`
  return control.increment > 0 ? `${base}, đi xong mỗi nước cộng ${control.increment} giây` : base
}

export function newClock(control: TimeControl | null): ClockState {
  return { control, times: [], turnStart: 0, spent: [] }
}

// Thời gian còn lại sau nước gần nhất (chưa trừ phần đang chạy của lượt hiện tại).
export function lastTimes(clock: ClockState): Times | null {
  if (!clock.control) return null
  const full = clock.control.minutes * 60_000
  return clock.times.at(-1) ?? { w: full, b: full }
}

// Lúc bên `turn` sẽ hết giờ. null khi đồng hồ chưa chạy: không tính giờ, hoặc Trắng chưa đi nước đầu.
export function flagTime(clock: ClockState, turn: Color): number | null {
  const last = clock.times.at(-1)
  return clock.control && last ? clock.turnStart + last[turn] : null
}

// Ghi lại thời gian nghĩ và giờ còn lại sau khi bên `mover` đi một nước lúc `now`.
// Nước đầu của Trắng không bị tính giờ: đồng hồ bắt đầu chạy từ lúc đó (giờ của Đen chạy trước).
// Chơi online thì `credit` là phần thời gian nước đi nằm trên đường truyền, được trả lại cho người đi.
export function recordMove(clock: ClockState, mover: Color, now: number, credit = 0): ClockState {
  const first = clock.spent.length === 0
  const spent = Math.max(0, now - clock.turnStart - credit)
  const recorded = { ...clock, spent: [...clock.spent, first ? null : spent], turnStart: now }
  const last = lastTimes(clock)
  if (!clock.control || !last) return recorded
  const next = first ? last : { ...last, [mover]: last[mover] - spent + clock.control.increment * 1000 }
  return { ...recorded, times: [...clock.times, next] }
}

// Đi lại thì đồng hồ cũng quay về như lúc trước nước đó, rồi chạy tiếp từ bây giờ.
export function undoMove(clock: ClockState, now: number): ClockState {
  return { ...clock, times: clock.times.slice(0, -1), spent: clock.spent.slice(0, -1), turnStart: now }
}

// Dưới mức này đồng hồ chuyển màu đỏ: 1/8 thời gian ban đầu, trong khoảng 10 giây tới 1 phút (giống lichess).
export function lowTime(control: TimeControl): number {
  return Math.min(60_000, Math.max(10_000, control.minutes * 60_000 * 0.125))
}

// Thời gian nghĩ một nước, viết gọn cho cột nước đi: 0,4s · 12s · 1:05 · 1:02:05.
export function formatThink(ms: number): string {
  const time = Math.max(0, ms)
  if (time < 10_000) return `${Math.floor(time / 1000)},${Math.floor((time % 1000) / 100)}s`
  if (time < 60_000) return `${Math.floor(time / 1000)}s`
  return formatClock(time)
}

// Thời gian dài viết bằng chữ, cho dòng tóm tắt ván: 45 giây · 12 phút · 1 giờ 5 phút.
export function formatSpan(ms: number): string {
  const seconds = Math.round(Math.max(0, ms) / 1000)
  if (seconds < 60) return `${seconds} giây`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} phút`
  return `${Math.floor(minutes / 60)} giờ${minutes % 60 ? ` ${minutes % 60} phút` : ''}`
}

// 10:00, 0:42; dưới 10 giây hiện cả phần mười giây (0:09.4) như lichess.
export function formatClock(ms: number): string {
  const time = Math.max(0, ms)
  if (time < 10_000) return `0:0${Math.floor(time / 1000)}.${Math.floor((time % 1000) / 100)}`
  const seconds = Math.floor(time / 1000)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor(seconds / 60) % 60
  const ss = String(seconds % 60).padStart(2, '0')
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${ss}` : `${minutes}:${ss}`
}

// Đọc lại đồng hồ đã lưu trên máy. Dữ liệu hỏng hoặc không khớp với ván (ví dụ ván lưu từ bản cũ
// chưa có đồng hồ) thì ván đó chơi tiếp không tính giờ; ván chưa đi nước nào thì dùng mức mặc định.
// Ván lưu từ bản cũ chưa ghi thời gian nghĩ thì các nước đã đi coi như không biết.
export function restoreClock(saved: unknown, moveCount: number, now: number): ClockState {
  const { control, times, turnStart, spent } = (typeof saved === 'object' && saved !== null ? saved : {}) as Partial<ClockState>
  const validSpent = Array.isArray(spent) && spent.length === moveCount && spent.every((s) => s === null || typeof s === 'number')
  const thinking = validSpent ? spent : Array<null>(moveCount).fill(null)
  // Không tính giờ: chỉ giữ thời gian nghĩ. Bản cũ không ghi lúc bắt đầu lượt khi không tính giờ,
  // nên với ván lưu từ bản cũ, nước tới tính thời gian nghĩ từ `now`.
  const untimed = (): ClockState => ({
    ...newClock(null),
    spent: thinking,
    turnStart: validSpent && typeof turnStart === 'number' ? turnStart : now,
  })
  if (control === null) return untimed()
  const validControl = typeof control?.minutes === 'number' && control.minutes > 0 && typeof control.increment === 'number'
  if (!control || !validControl) return moveCount > 0 ? untimed() : newClock(DEFAULT_CONTROL)
  if (moveCount === 0) return newClock(control)
  const validTimes =
    Array.isArray(times) &&
    times.length === moveCount &&
    times.every((t) => typeof t?.w === 'number' && typeof t?.b === 'number')
  return validTimes && typeof turnStart === 'number' ? { control, times, turnStart, spent: thinking } : untimed()
}
