import { describe, expect, it } from 'vitest'
import { restoreZoom, ZOOM_MAX, ZOOM_MIN } from './boardView'

describe('cỡ bàn cờ đã lưu', () => {
  it('chưa lưu hay hỏng thì về cỡ to nhất (vừa màn hình)', () => {
    expect(restoreZoom(null)).toBe(ZOOM_MAX)
    expect(restoreZoom('0.7')).toBe(ZOOM_MAX)
    expect(restoreZoom(Number.NaN)).toBe(ZOOM_MAX)
  })

  it('ngoài khoảng cho phép thì kẹp lại, lệch thì làm tròn tới một nấc', () => {
    expect(restoreZoom(0.2)).toBe(ZOOM_MIN)
    expect(restoreZoom(3)).toBe(ZOOM_MAX)
    expect(restoreZoom(0.7000000001)).toBe(0.7)
    expect(restoreZoom(0.6 + 0.1)).toBe(0.7)
  })
})
