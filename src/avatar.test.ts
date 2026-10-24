import { describe, expect, it } from 'vitest'
import { AVATAR_COLORS, avatarColor, avatarLetter } from './avatar'

describe('ảnh đại diện', () => {
  it('lấy chữ cái đầu của tên, viết hoa, giữ cả dấu', () => {
    expect(avatarLetter('Tài')).toBe('T')
    expect(avatarLetter('  ánh  ')).toBe('Á')
    expect(avatarLetter('đức')).toBe('Đ')
    // Dấu gõ rời (chữ "a" rồi dấu sắc riêng) vẫn đi chung với chữ cái.
    expect(avatarLetter('ánh')).toBe('Á')
  })

  it('bỏ qua dấu câu ở đầu tên; emoji thì giữ nguyên', () => {
    expect(avatarLetter('(Tài)')).toBe('T')
    expect(avatarLetter('...minh')).toBe('M')
    expect(avatarLetter('😎 Tài')).toBe('😎')
    expect(avatarLetter('7up')).toBe('7')
  })

  it('chưa nhập tên thì không có chữ (hiện hình con tốt)', () => {
    expect(avatarLetter('')).toBe('')
    expect(avatarLetter('   ')).toBe('')
  })

  it('cùng một tên thì luôn ra cùng một màu, không phân biệt hoa thường', () => {
    expect(avatarColor('Tài', '', false)).toBe(avatarColor('Tài', '', false))
    expect(avatarColor('tài', '', false)).toBe(avatarColor('TÀI ', '', false))
    expect(AVATAR_COLORS).toContain(avatarColor('Minh', '', false))
  })

  it('hai người trùng màu thì bên Đen đổi sang màu khác, bên Trắng giữ nguyên', () => {
    // Tìm hai tên ra cùng một màu.
    const names = Array.from({ length: 50 }, (_, i) => `Người ${i}`)
    const first = names[0]
    const twin = names.slice(1).find((other) => avatarColor(other, '', false) === avatarColor(first, '', false))!
    expect(twin).toBeDefined()
    expect(avatarColor(first, twin, false)).toBe(avatarColor(first, '', false))
    expect(avatarColor(twin, first, true)).not.toBe(avatarColor(first, twin, false))
    // Không trùng thì bên Đen giữ màu của mình.
    const other = names.find((name) => avatarColor(name, '', false) !== avatarColor(first, '', false))!
    expect(avatarColor(other, first, true)).toBe(avatarColor(other, '', false))
  })
})
