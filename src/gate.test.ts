import { describe, expect, it } from 'vitest'
import { GATE_RULES, Gatekeeper, networkOf } from './gate'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

// Gọi `allow` liền `times` lần, trả về các kết quả.
function burst(keeper: Gatekeeper, kind: 'room' | 'feedback', who: string, times: number, now = 0) {
  return Array.from({ length: times }, () => keeper.allow(kind, who, now))
}

describe('Gatekeeper', () => {
  it('mỗi mạng tạo liền được 20 phòng, sau đó 3 phút thêm một phòng', () => {
    const keeper = new Gatekeeper()
    expect(burst(keeper, 'room', 'a', 20)).toEqual(Array(20).fill('ok'))
    expect(keeper.allow('room', 'a', 0)).toBe('slow')
    expect(keeper.allow('room', 'a', 2 * MINUTE)).toBe('slow')
    expect(keeper.allow('room', 'a', 3 * MINUTE)).toBe('ok')
    expect(keeper.allow('room', 'a', 3 * MINUTE)).toBe('slow')
    // Một giờ không tạo thì xô đầy lại, nhưng không quá 20.
    expect(burst(keeper, 'room', 'a', 21, 5 * HOUR)).toEqual([...Array(20).fill('ok'), 'slow'])
  })

  it('mạng này gửi dồn không ảnh hưởng mạng khác, và tạo phòng với góp ý đếm riêng', () => {
    const keeper = new Gatekeeper()
    burst(keeper, 'room', 'a', 30)
    expect(keeper.allow('room', 'a', 0)).toBe('slow')
    expect(keeper.allow('room', 'b', 0)).toBe('ok')
    expect(keeper.allow('feedback', 'a', 0)).toBe('ok')
  })

  it('góp ý: mỗi mạng liền được bằng giới hạn mỗi giờ của hàng chờ', () => {
    const keeper = new Gatekeeper()
    const { perHour } = GATE_RULES.feedback
    expect(burst(keeper, 'feedback', 'a', perHour + 1)).toEqual([...Array(perHour).fill('ok'), 'slow'])
  })

  it('cả web: quá mức mỗi giờ thì mạng nào cũng phải chờ, ván đang chơi không bị gì', () => {
    const keeper = new Gatekeeper()
    const { burst: size, site } = GATE_RULES.room
    // Kẻ phá dùng nhiều mạng, mỗi mạng tạo hết phần của mình.
    for (let n = 0; n < site / size; n++) expect(burst(keeper, 'room', `kẻ phá ${n}`, size)).toEqual(Array(size).fill('ok'))
    expect(keeper.allow('room', 'người thật', 0)).toBe('busy')
    // Mỗi giờ cả web được `site` phòng, tức cứ 12 giây thêm một phòng (site = 300).
    expect(keeper.allow('room', 'người thật', HOUR / site)).toBe('ok')
    expect(keeper.allow('room', 'người thật', HOUR / site)).toBe('busy')
  })

  it('bị từ chối thì không trừ lượt nào', () => {
    const keeper = new Gatekeeper()
    const { burst: size, site } = GATE_RULES.room
    for (let n = 0; n < site / size; n++) burst(keeper, 'room', `kẻ phá ${n}`, size)
    // Người thật bị báo "busy" nhiều lần cũng không mất phần của mình: cả web có chỗ lại là tạo liền được 20 phòng.
    burst(keeper, 'room', 'người thật', 50)
    expect(burst(keeper, 'room', 'người thật', size + 1, HOUR)).toEqual([...Array(size).fill('ok'), 'slow'])
  })

  it('dọn xô của mạng đã im một giờ cho đỡ tốn bộ nhớ', () => {
    const keeper = new Gatekeeper()
    const buckets = (keeper as unknown as { buckets: Map<string, unknown> }).buckets
    for (let n = 0; n < 50; n++) keeper.allow('room', `mạng ${n}`, 0)
    expect(buckets.size).toBe(51) // 50 mạng và một xô cả web
    keeper.allow('room', 'mạng mới', 30 * MINUTE)
    expect(buckets.size).toBe(52)
    keeper.allow('room', 'mạng mới', 61 * MINUTE)
    expect([...buckets.keys()].sort()).toEqual(['room:*', 'room:mạng mới'])
  })
})

describe('networkOf', () => {
  it('IPv4 giữ nguyên, kể cả khi viết kiểu IPv6', () => {
    expect(networkOf('113.161.42.7')).toBe('113.161.42.7')
    expect(networkOf('::ffff:113.161.42.7')).toBe('113.161.42.7')
  })

  it('IPv6 lấy dải /64: đổi phần đuôi vẫn là cùng một mạng', () => {
    expect(networkOf('2001:ee0:4f0b:a1c0:1d2e:3f4a:5b6c:7d8e')).toBe('2001:ee0:4f0b:a1c0')
    expect(networkOf('2001:EE0:4F0B:A1C0::1')).toBe('2001:ee0:4f0b:a1c0')
    expect(networkOf('2001:0ee0:4f0b:a1c0:0:0:0:2')).toBe('2001:ee0:4f0b:a1c0')
    expect(networkOf('2001:ee0:4f0b:a1c1::1')).not.toBe(networkOf('2001:ee0:4f0b:a1c0::1'))
  })

  it('IPv6 viết tắt bằng :: ở đầu, giữa hay cuối', () => {
    expect(networkOf('2001:db8::1')).toBe('2001:db8:0:0')
    expect(networkOf('2001:db8:0:0:5::')).toBe('2001:db8:0:0')
    expect(networkOf('::1')).toBe('0:0:0:0')
    expect(networkOf('::')).toBe('0:0:0:0')
  })

  it('không có địa chỉ thì trả về chuỗi rỗng', () => {
    expect(networkOf('')).toBe('')
  })
})
