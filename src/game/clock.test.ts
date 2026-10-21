import { describe, expect, it } from 'vitest'
import { DEFAULT_CONTROL, flagTime, formatClock, lastTimes, lowTime, newClock, recordMove, restoreClock, undoMove } from './clock'

const BLITZ = { minutes: 3, increment: 2 }

describe('đồng hồ chạy', () => {
  it('chưa đi nước nào thì đồng hồ đứng yên, mỗi bên đủ giờ', () => {
    const clock = newClock(BLITZ)
    expect(lastTimes(clock)).toEqual({ w: 180_000, b: 180_000 })
    expect(flagTime(clock, 'w')).toBeNull()
  })

  it('nước đầu của Trắng không bị trừ giờ, sau đó giờ của Đen bắt đầu chạy', () => {
    const clock = recordMove(newClock(BLITZ), 'w', 5_000)
    expect(lastTimes(clock)).toEqual({ w: 180_000, b: 180_000 })
    expect(flagTime(clock, 'b')).toBe(5_000 + 180_000)
  })

  it('đi xong thì trừ thời gian đã nghĩ rồi cộng giờ thưởng', () => {
    let clock = recordMove(newClock(BLITZ), 'w', 0)
    clock = recordMove(clock, 'b', 10_000) // Đen nghĩ 10 giây
    expect(lastTimes(clock)).toEqual({ w: 180_000, b: 172_000 })
    clock = recordMove(clock, 'w', 40_000) // Trắng nghĩ 30 giây
    expect(lastTimes(clock)).toEqual({ w: 152_000, b: 172_000 })
    expect(flagTime(clock, 'b')).toBe(40_000 + 172_000)
  })

  it('đi lại thì đồng hồ quay về như trước nước đó và chạy tiếp từ bây giờ', () => {
    let clock = recordMove(newClock(BLITZ), 'w', 0)
    clock = recordMove(clock, 'b', 10_000)
    clock = undoMove(clock, 60_000)
    expect(lastTimes(clock)).toEqual({ w: 180_000, b: 180_000 })
    expect(flagTime(clock, 'b')).toBe(60_000 + 180_000)
    expect(flagTime(undoMove(clock, 70_000), 'w')).toBeNull()
  })

  it('không tính giờ thì không có đồng hồ', () => {
    const clock = recordMove(newClock(null), 'w', 0)
    expect(lastTimes(clock)).toBeNull()
    expect(flagTime(clock, 'b')).toBeNull()
  })
})

describe('hiển thị', () => {
  it('phút:giây, dưới 10 giây thì có phần mười giây', () => {
    expect(formatClock(600_000)).toBe('10:00')
    expect(formatClock(59_999)).toBe('0:59')
    expect(formatClock(10_000)).toBe('0:10')
    expect(formatClock(9_950)).toBe('0:09.9')
    expect(formatClock(-5)).toBe('0:00.0')
    expect(formatClock(3_725_000)).toBe('1:02:05')
  })

  it('mức báo sắp hết giờ nằm trong khoảng 10 giây tới 1 phút', () => {
    expect(lowTime({ minutes: 1, increment: 0 })).toBe(10_000)
    expect(lowTime({ minutes: 3, increment: 0 })).toBe(22_500)
    expect(lowTime({ minutes: 30, increment: 0 })).toBe(60_000)
  })
})

describe('đọc lại đồng hồ đã lưu', () => {
  it('giữ nguyên đồng hồ hợp lệ', () => {
    const clock = recordMove(newClock(BLITZ), 'w', 0)
    expect(restoreClock(JSON.parse(JSON.stringify(clock)), 1)).toEqual(clock)
  })

  it('chưa lưu gì thì dùng mức mặc định', () => {
    expect(restoreClock(null, 0)).toEqual(newClock(DEFAULT_CONTROL))
  })

  it('ván cũ chưa có đồng hồ thì chơi tiếp không tính giờ', () => {
    expect(restoreClock(null, 6)).toEqual(newClock(null))
    expect(restoreClock({ control: BLITZ, times: [], turnStart: 0 }, 2)).toEqual(newClock(null))
  })

  it('đã chọn không tính giờ thì giữ lựa chọn đó', () => {
    expect(restoreClock(newClock(null), 0)).toEqual(newClock(null))
  })
})
