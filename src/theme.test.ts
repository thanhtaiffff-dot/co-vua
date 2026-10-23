import { describe, expect, it } from 'vitest'
import { SOUND_SETS } from './sound'
import { DEFAULT_THEME, PIECE_SHAPES, boardIcon, boardUrl, is3d, piecesIcon, restoreTheme, sheetOf, sheetUrl, themeCss } from './theme'
import { BOARD_LIST, BOARDS, PIECE_LIST, PIECE_SETS } from './themeCatalog'

// Ảnh chủ đề dạng dữ liệu "data:...", để đọc cỡ ảnh ngay trong bài kiểm tra.
const INLINE = import.meta.glob<string>('./themes/**/*.{webp,png}', { eager: true, import: 'default', query: '?inline' })

// Bề ngang, bề cao của một ảnh WebP hoặc PNG, đọc từ phần đầu file.
function imageSize(path: string): [number, number] {
  const uri = INLINE[path]
  const bytes = Uint8Array.from(atob(uri.slice(uri.indexOf(',') + 1)), (c) => c.charCodeAt(0))
  const u24 = (at: number) => bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16)
  const u32be = (at: number) => ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0
  const chunk = String.fromCharCode(...bytes.slice(12, 16))
  if (path.endsWith('.png')) return [u32be(16), u32be(20)]
  if (chunk === 'VP8X') return [u24(24) + 1, u24(27) + 1]
  if (chunk === 'VP8 ') return [(bytes[26] | (bytes[27] << 8)) & 0x3fff, (bytes[28] | (bytes[29] << 8)) & 0x3fff]
  const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24)
  return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1]
}

const theme = (change: Partial<typeof DEFAULT_THEME>) => ({ ...DEFAULT_THEME, ...change })

describe('bảng chọn chủ đề', () => {
  it('bộ quân nào, bàn nào cũng có mặt đúng một lần và có tên', () => {
    expect(PIECE_LIST.map((info) => info.id).toSorted()).toEqual([...PIECE_SETS].toSorted())
    expect(BOARD_LIST.map((info) => info.id).toSorted()).toEqual([...BOARDS].toSorted())
    for (const info of [...PIECE_LIST, ...BOARD_LIST]) expect(info.name, info.id).not.toBe('')
  })

  it('bộ quân nào cũng có bộ tiếng cùng chất liệu', () => {
    for (const info of PIECE_LIST) expect(SOUND_SETS, info.id).toContain(info.sound)
  })
})

describe('ảnh chủ đề', () => {
  it('bộ quân nào cũng có ảnh 2D, ảnh 3D đủ ba dáng (nếu có 3D) và ảnh nhỏ cho bảng chọn', () => {
    for (const info of PIECE_LIST) {
      if (info.id !== 'classic') expect(sheetUrl(info.id, '2d'), info.id).toBeTypeOf('string')
      expect(piecesIcon(info.id, theme({ style: '2d' })), info.id).toBeTypeOf('string')
      for (const shape of PIECE_SHAPES) {
        const icon = piecesIcon(info.id, theme({ style: '3d', shape }))
        if (info.has3d) {
          expect(sheetUrl(info.id, `3d-${shape}`), `${info.id} ${shape}`).toBeTypeOf('string')
          expect(icon, `${info.id} ${shape}`).toMatch(`3d-${shape}-icon`)
        } else {
          expect(sheetUrl(info.id, `3d-${shape}`), `${info.id} ${shape}`).toBeUndefined()
          expect(icon, `${info.id} ${shape}`).toMatch('2d-icon')
        }
      }
    }
  })

  it('bàn nào cũng có ảnh nhỏ; bàn khác Cổ điển có ảnh bàn', () => {
    for (const info of BOARD_LIST) {
      expect(boardIcon(info.id), info.id).toBeTypeOf('string')
      if (info.id !== 'classic') expect(boardUrl(info.id), info.id).toBeTypeOf('string')
    }
  })

  it('ảnh gộp quân đúng cỡ: 6 cột x 2 hàng, khe giữa các ô như trong code', () => {
    let checked = 0
    for (const path of Object.keys(INLINE)) {
      const match = /pieces\/([^/]+)\/(2d|3d-\w+)\.\w+$/.exec(path)
      if (!match) continue
      const sheet = sheetOf(match[1] as (typeof PIECE_SETS)[number], match[2])
      expect(imageSize(path), path).toEqual([6 * sheet.w + 5 * sheet.gap, 2 * sheet.h + sheet.gap])
      checked++
    }
    // Mọi bộ (trừ Cổ điển) có ảnh 2D; bộ có 3D thêm ba dáng.
    const sets = PIECE_LIST.filter((info) => info.id !== 'classic')
    expect(checked).toBe(sets.length + 3 * sets.filter((info) => info.has3d).length)
  })
})

describe('lựa chọn đã lưu', () => {
  it('chưa lưu, dữ liệu hỏng, hay bộ không còn nữa thì thứ đó về mặc định', () => {
    expect(restoreTheme(null)).toEqual(DEFAULT_THEME)
    expect(restoreTheme('hỏng')).toEqual(DEFAULT_THEME)
    expect(restoreTheme({ pieces: 'vàng', board: 'wood', style: '4d', shape: 'modern' })).toEqual(
      theme({ board: 'wood', shape: 'modern' }),
    )
  })

  it('giữ nguyên lựa chọn hợp lệ', () => {
    const saved = { pieces: 'steel-brushed', board: '8bit', style: '3d', shape: 'faceted' } as const
    expect(restoreTheme(saved)).toEqual(saved)
  })
})

describe('CSS của chủ đề', () => {
  it('mặc định (Cổ điển trên bàn nâu) giữ nguyên giao diện cũ', () => {
    expect(themeCss(DEFAULT_THEME)).toBe('')
  })

  it('mỗi quân lấy đúng ô của nó trong ảnh gộp', () => {
    const css = themeCss(theme({ pieces: 'steel' }))
    expect(css).toMatch(/piece\.pawn\.white \{[^}]*background-position: 0% 0%/)
    expect(css).toMatch(/piece\.knight\.black \{[^}]*background-position: 20% 100%/)
    expect(css).toMatch(/piece\.king\.black \{[^}]*background-position: 100% 100%/)
  })

  it('quân 3D chỉ dùng trên bàn cờ; quân nhỏ (quân đã ăn, phong cấp) vẫn là 2D cùng bộ', () => {
    const css = themeCss(theme({ pieces: 'wood', style: '3d', shape: 'modern' }))
    expect(css).toMatch(/html\.pieces-3d cg-board piece\.queen\.white[^{]*\{ background-image: url\("[^"]*3d-modern/)
    expect(css).toMatch(/html \.cg-wrap piece\.queen\.white[^{]*\{ background-image: url\("[^"]*2d/)
    expect(is3d(theme({ pieces: 'wood', style: '3d' }))).toBe(true)
  })

  it('bộ chỉ có 2D (Cổ điển, 8-bit) thì vẫn vẽ 2D dù đang chọn 3D', () => {
    for (const pieces of ['classic', '8bit'] as const) {
      expect(is3d(theme({ pieces, style: '3d' })), pieces).toBe(false)
      expect(themeCss(theme({ pieces, style: '3d' })), pieces).not.toContain('pieces-3d')
    }
  })

  it('bàn có ảnh thì đổi ảnh nền và màu chữ toạ độ; 8-bit giữ nét điểm ảnh', () => {
    const css = themeCss(theme({ board: '8bit' }))
    expect(css).toContain('html .board-frame cg-board { background-image: url(')
    expect(css).toContain('--board-light: #a2ce8f; --board-dark: #2e5b4b;')
    expect(css).toContain('image-rendering: pixelated')
    expect(css).toMatch(/html \.cg-wrap piece \{ image-rendering: auto; \}/)
  })
})
