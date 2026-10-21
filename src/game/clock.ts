// Đồng hồ cờ: chỉ ghi lại thời gian còn lại sau mỗi nước và lúc lượt hiện tại bắt đầu,
// còn đồng hồ đang chạy tới đâu thì tính ra từ giờ thật (Date.now()), nên tải lại trang vẫn đúng.
import type { Color } from 'chess.js'

// `minutes` phút cho mỗi bên, đi xong mỗi nước được cộng thêm `increment` giây.
export type TimeControl = { minutes: number; increment: number }

// Thời gian còn lại của hai bên, tính bằng mili giây.
export type Times = Record<Color, number>

export type ClockState = {
  control: TimeControl | null // null: không tính giờ
  times: Times[] // times[i]: thời gian còn lại của hai bên ngay sau nước thứ i + 1
  turnStart: number // lúc lượt hiện tại bắt đầu (lúc nước gần nhất được đi)
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
  return { control, times: [], turnStart: 0 }
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

// Ghi lại giờ sau khi bên `mover` đi một nước lúc `now`.
// Nước đầu của Trắng không bị tính giờ: đồng hồ bắt đầu chạy từ lúc đó (giờ của Đen chạy trước).
export function recordMove(clock: ClockState, mover: Color, now: number): ClockState {
  const last = lastTimes(clock)
  if (!clock.control || !last) return clock
  const started = clock.times.length > 0
  const next = started
    ? { ...last, [mover]: last[mover] - (now - clock.turnStart) + clock.control.increment * 1000 }
    : last
  return { ...clock, times: [...clock.times, next], turnStart: now }
}

// Đi lại thì đồng hồ cũng quay về như lúc trước nước đó, rồi chạy tiếp từ bây giờ.
export function undoMove(clock: ClockState, now: number): ClockState {
  return { ...clock, times: clock.times.slice(0, -1), turnStart: now }
}

// Dưới mức này đồng hồ chuyển màu đỏ: 1/8 thời gian ban đầu, trong khoảng 10 giây tới 1 phút (giống lichess).
export function lowTime(control: TimeControl): number {
  return Math.min(60_000, Math.max(10_000, control.minutes * 60_000 * 0.125))
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
export function restoreClock(saved: unknown, moveCount: number): ClockState {
  const { control, times, turnStart } = (typeof saved === 'object' && saved !== null ? saved : {}) as Partial<ClockState>
  if (control === null) return newClock(null)
  const validControl = typeof control?.minutes === 'number' && control.minutes > 0 && typeof control.increment === 'number'
  if (!control || !validControl) return newClock(moveCount > 0 ? null : DEFAULT_CONTROL)
  if (moveCount === 0) return newClock(control)
  const validTimes =
    Array.isArray(times) &&
    times.length === moveCount &&
    times.every((t) => typeof t?.w === 'number' && typeof t?.b === 'number')
  return validTimes && typeof turnStart === 'number' ? { control, times, turnStart } : newClock(null)
}
