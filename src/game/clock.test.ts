import { describe, expect, it } from 'vitest'
import { DEFAULT_CONTROL, flagTime, formatClock, formatSpan, formatThink, lastTimes, lowTime, newClock, recordMove, restoreClock, undoMove } from './clock'

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

  it('chơi online: thời gian nằm trên đường truyền được trả lại, nhưng không trả quá thời gian đã nghĩ', () => {
    let clock = recordMove(newClock(BLITZ), 'w', 0)
    clock = recordMove(clock, 'b', 10_000, 300) // Đen nghĩ 9,7 giây, mạng mất 0,3 giây
    expect(lastTimes(clock)).toEqual({ w: 180_000, b: 172_300 })
    clock = recordMove(clock, 'w', 10_100, 500) // đi trước: tới nơi sau 0,1 giây, không được cộng thêm
    expect(lastTimes(clock)).toEqual({ w: 182_000, b: 172_300 })
    expect(flagTime(clock, 'b')).toBe(10_100 + 172_300)
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

describe('thời gian nghĩ mỗi nước', () => {
  it('ghi thời gian nghĩ từng nước; nước đầu của Trắng không tính', () => {
    let clock = recordMove(newClock(BLITZ), 'w', 5_000)
    clock = recordMove(clock, 'b', 9_000) // Đen nghĩ 4 giây
    clock = recordMove(clock, 'w', 21_500) // Trắng nghĩ 12,5 giây
    expect(clock.spent).toEqual([null, 4_000, 12_500])
  })

  it('không tính giờ vẫn ghi thời gian nghĩ', () => {
    let clock = recordMove(newClock(null), 'w', 1_000)
    clock = recordMove(clock, 'b', 3_000)
    expect(clock.spent).toEqual([null, 2_000])
    expect(clock.times).toEqual([])
  })

  it('chơi online: thời gian nằm trên đường truyền không tính là thời gian nghĩ', () => {
    let clock = recordMove(newClock(BLITZ), 'w', 0)
    clock = recordMove(clock, 'b', 10_000, 300)
    expect(clock.spent).toEqual([null, 9_700])
  })

  it('đi lại thì bỏ thời gian của nước đó, nước đi lại tính từ lúc bấm đi lại', () => {
    let clock = recordMove(newClock(null), 'w', 0)
    clock = recordMove(clock, 'b', 10_000)
    clock = undoMove(clock, 20_000)
    expect(clock.spent).toEqual([null])
    clock = recordMove(clock, 'b', 25_000)
    expect(clock.spent).toEqual([null, 5_000])
  })

  it('viết gọn: dưới 10 giây có phần mười, dưới 1 phút là giây, còn lại như đồng hồ', () => {
    expect(formatThink(400)).toBe('0,4s')
    expect(formatThink(9_990)).toBe('9,9s')
    expect(formatThink(12_400)).toBe('12s')
    expect(formatThink(65_000)).toBe('1:05')
    expect(formatThink(3_725_000)).toBe('1:02:05')
  })

  it('thời gian cả ván viết bằng chữ', () => {
    expect(formatSpan(45_400)).toBe('45 giây')
    expect(formatSpan(12 * 60_000 + 20_000)).toBe('12 phút')
    expect(formatSpan(65 * 60_000)).toBe('1 giờ 5 phút')
    expect(formatSpan(120 * 60_000)).toBe('2 giờ')
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
  const NOW = 99_000

  it('giữ nguyên đồng hồ hợp lệ', () => {
    let clock = recordMove(newClock(BLITZ), 'w', 0)
    clock = recordMove(clock, 'b', 3_000)
    expect(restoreClock(JSON.parse(JSON.stringify(clock)), 2, NOW)).toEqual(clock)
    const untimed = recordMove(recordMove(newClock(null), 'w', 0), 'b', 3_000)
    expect(restoreClock(JSON.parse(JSON.stringify(untimed)), 2, NOW)).toEqual(untimed)
  })

  it('chưa lưu gì thì dùng mức mặc định', () => {
    expect(restoreClock(null, 0, NOW)).toEqual(newClock(DEFAULT_CONTROL))
  })

  it('ván cũ chưa có đồng hồ thì chơi tiếp không tính giờ, thời gian nghĩ các nước cũ coi như không biết', () => {
    const untimed = { control: null, times: [], turnStart: NOW, spent: [null, null] }
    expect(restoreClock(null, 2, NOW)).toEqual(untimed)
    expect(restoreClock({ control: BLITZ, times: [], turnStart: 0 }, 2, NOW)).toEqual(untimed)
  })

  it('ván lưu từ bản cũ chưa ghi thời gian nghĩ thì vẫn giữ đồng hồ', () => {
    const times = [
      { w: 180_000, b: 180_000 },
      { w: 180_000, b: 172_000 },
    ]
    expect(restoreClock({ control: BLITZ, times, turnStart: 10_000 }, 2, NOW)).toEqual({ control: BLITZ, times, turnStart: 10_000, spent: [null, null] })
    // Bản cũ không tính giờ thì không ghi lúc bắt đầu lượt: nước tới tính từ lúc mở lại trang.
    expect(restoreClock({ control: null, times: [], turnStart: 0 }, 2, NOW).turnStart).toBe(NOW)
  })

  it('đã chọn không tính giờ thì giữ lựa chọn đó', () => {
    expect(restoreClock(newClock(null), 0, NOW)).toEqual(newClock(null))
  })
})
