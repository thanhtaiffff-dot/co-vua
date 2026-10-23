// Chủ đề đang dùng: bộ quân (2D, hoặc 3D với một trong ba dáng) và bàn cờ, chọn riêng từng thứ, lưu trong máy.
// Bàn cờ chessground vẽ mỗi quân là một thẻ <piece class="pawn white"> tô ảnh bằng CSS, nên đổi chủ đề chỉ là viết lại
// một khối CSS nhỏ: ảnh quân, ảnh bàn, màu chữ toạ độ. Quân 3D cao hơn ô cờ nên nhô lên che bớt ô phía sau, như bàn thật.
import { useSyncExternalStore } from 'react'
import { loadSaved, save } from './storage'
import { BOARDS, PIECE_SETS, boardInfo, pieceSetInfo, type BoardId, type PieceSetId } from './themeCatalog'

export const PIECE_SHAPES = ['round', 'faceted', 'modern'] as const
export type PieceShape = (typeof PIECE_SHAPES)[number]
export type PieceStyle = '2d' | '3d'
export type Theme = { pieces: PieceSetId; board: BoardId; style: PieceStyle; shape: PieceShape }

// Mặc định giữ nguyên giao diện cũ: quân cburnett trên bàn nâu.
export const DEFAULT_THEME: Theme = { pieces: 'classic', board: 'classic', style: '2d', shape: 'round' }

// Đường dẫn tới mọi ảnh chủ đề (bản gộp một file thì là chính dữ liệu "data:..."). Máy chỉ tải ảnh của chủ đề đang dùng.
const FILES = import.meta.glob<string>('./themes/**/*.{webp,png}', { eager: true, import: 'default' })

function file(path: string): string | undefined {
  return FILES[`./themes/${path}.webp`] ?? FILES[`./themes/${path}.png`]
}

// Mỗi bộ quân, mỗi kiểu là một tấm ảnh gộp 6 cột (Tốt, Mã, Tượng, Xe, Hậu, Vua) x 2 hàng (trắng, đen), giữa các ô có khe
// trong suốt cho khỏi lem. Cỡ ô (điểm ảnh) phải khớp tools/themes/export.py. Ô quân 3D cao hơn ô vuông: phần nhô lên trên.
export type Sheet = { w: number; h: number; gap: number }
const SHEET_2D: Sheet = { w: 160, h: 160, gap: 4 }
const SHEET_3D: Sheet = { w: 192, h: 253, gap: 4 }
const SHEET_8BIT: Sheet = { w: 32, h: 32, gap: 2 }

// Cỡ ô của ảnh gộp quân `pieces` kiểu `kind` ("2d", "3d-round"...).
export function sheetOf(pieces: PieceSetId, kind: string): Sheet {
  if (kind !== '2d') return SHEET_3D
  return pieces === '8bit' ? SHEET_8BIT : SHEET_2D
}
const ROLES = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'] as const
const COLORS = ['white', 'black'] as const

// Kiểu quân thật sự hiện ra: bộ không có quân 3D (Cổ điển, 8-bit) thì luôn là 2D.
export function is3d(theme: Theme): boolean {
  return theme.style === '3d' && pieceSetInfo(theme.pieces).has3d
}

function variant(pieces: PieceSetId, theme: Theme): string {
  return theme.style === '3d' && pieceSetInfo(pieces).has3d ? `3d-${theme.shape}` : '2d'
}

// Ảnh nhỏ (con Mã trắng) của bộ quân `pieces` trong bảng chọn, theo kiểu và dáng đang chọn.
export function piecesIcon(pieces: PieceSetId, theme: Theme): string | undefined {
  return file(`pieces/${pieces}/${variant(pieces, theme)}-icon`)
}

export function boardIcon(board: BoardId): string | undefined {
  return file(`boards/${board}-icon`)
}

export function sheetUrl(pieces: PieceSetId, kind: string): string | undefined {
  return file(`pieces/${pieces}/${kind}`)
}

export function boardUrl(board: BoardId): string | undefined {
  return file(`boards/${board}`)
}

const percent = (x: number) => `${+(x * 100).toFixed(4)}%`

// Tô ảnh gộp `url` cho mọi quân khớp `scope`: phóng tấm ảnh sao cho một ô vừa khít quân, rồi dịch tới đúng ô.
// Ảnh ghi một lần cho cả 12 quân (gọi đủ tên từng quân để thắng CSS của bộ cburnett).
function sheetRules(scope: string, url: string, sheet: Sheet): string {
  const size = `${percent((6 * sheet.w + 5 * sheet.gap) / sheet.w)} ${percent((2 * sheet.h + sheet.gap) / sheet.h)}`
  const each = ROLES.flatMap((role) => COLORS.map((color) => `${scope}.${role}.${color}`))
  const rules = [`${scope} { background-size: ${size}; }`, `${each.join(', ')} { background-image: url("${url}"); }`]
  ROLES.forEach((role, column) =>
    COLORS.forEach((color, row) => rules.push(`${scope}.${role}.${color} { background-position: ${column * 20}% ${row * 100}%; }`)),
  )
  return rules.join('\n')
}

// Khối CSS của chủ đề. Thêm "html" vào trước để thắng CSS có sẵn của chessground (bộ cburnett, bàn nâu).
export function themeCss(theme: Theme): string {
  const rules: string[] = []
  if (theme.pieces !== 'classic') {
    const flat = sheetUrl(theme.pieces, '2d')
    // Ảnh 2D dùng cho mọi chỗ có quân: bàn cờ, quân đã ăn, bảng phong cấp, huy hiệu màu quân.
    if (flat) rules.push(sheetRules('html .cg-wrap piece', flat, sheetOf(theme.pieces, '2d')))
    const tall = is3d(theme) ? sheetUrl(theme.pieces, `3d-${theme.shape}`) : undefined
    if (tall) {
      // Quân 3D chỉ dùng trên bàn cờ. Ô quân cao hơn ô cờ, đáy ô quân trùng đáy ô cờ (lề % tính theo bề ngang bàn,
      // mà bàn vuông nên cũng là theo bề cao). Bàn chừa thêm chỗ phía trên cho hàng quân trên cùng nhô lên.
      const rise = (SHEET_3D.h - SHEET_3D.w) / SHEET_3D.w / 8
      rules.push(sheetRules('html.pieces-3d cg-board piece', tall, SHEET_3D))
      rules.push(`html.pieces-3d cg-board piece { height: ${percent(SHEET_3D.h / SHEET_3D.w / 8)}; margin-top: -${percent(rise)}; }`)
      rules.push(`html.pieces-3d .board-frame { margin-top: ${percent(rise)}; }`)
    }
  }
  if (theme.board !== 'classic') {
    const url = boardUrl(theme.board)
    const info = boardInfo(theme.board)
    if (url) rules.push(`html .board-frame cg-board { background-image: url("${url}"); background-size: 100% 100%; }`)
    rules.push(`html:root { --board-light: ${info.light}; --board-dark: ${info.dark}; }`)
  }
  // 8-bit vẽ bằng điểm ảnh to: phóng lên giữ nét vuông, không làm mờ. Quân luôn ghi rõ cách vẽ, kẻo bắt chước bàn cờ.
  if (theme.board === '8bit') rules.push('html .board-frame cg-board { image-rendering: pixelated; }')
  if (theme.board === '8bit' || theme.pieces === '8bit')
    rules.push(`html .cg-wrap piece { image-rendering: ${theme.pieces === '8bit' ? 'pixelated' : 'auto'}; }`)
  return rules.join('\n')
}

// Đọc lại lựa chọn đã lưu; thiếu hay sai thứ gì (bộ đã bỏ, dữ liệu hỏng) thì thứ đó về mặc định.
export function restoreTheme(saved: unknown): Theme {
  const data = (saved !== null && typeof saved === 'object' ? saved : {}) as Record<string, unknown>
  const pick = <T extends string>(list: readonly T[], value: unknown, fallback: T): T => list.find((item) => item === value) ?? fallback
  return {
    pieces: pick(PIECE_SETS, data.pieces, DEFAULT_THEME.pieces),
    board: pick(BOARDS, data.board, DEFAULT_THEME.board),
    style: pick(['2d', '3d'] as const, data.style, DEFAULT_THEME.style),
    shape: pick(PIECE_SHAPES, data.shape, DEFAULT_THEME.shape),
  }
}

// `current`: lựa chọn mới nhất (bảng chọn hiện theo cái này). `shown`: chủ đề đang vẽ trên trang, chậm hơn một chút
// vì chờ tải ảnh; bàn cờ theo cái này để đổi cách xếp quân đúng lúc ảnh mới hiện ra.
let current = restoreTheme(loadSaved<unknown>('theme', null))
let shown = current
const listeners = new Set<() => void>()
let style: HTMLStyleElement | null = null
let turn = 0

function apply(theme: Theme): void {
  if (!style) {
    style = document.createElement('style')
    style.id = 'theme'
    document.head.append(style)
  }
  style.textContent = themeCss(theme)
  document.documentElement.classList.toggle('pieces-3d', is3d(theme))
  shown = theme
  for (const listener of listeners) listener()
}

// Đổi chủ đề: tải xong ảnh mới rồi mới vẽ lại, để quân không biến mất trong lúc chờ mạng (lâu quá 3 giây thì vẽ luôn).
function show(theme: Theme): void {
  const mine = ++turn
  const urls = [sheetUrl(theme.pieces, '2d'), is3d(theme) ? sheetUrl(theme.pieces, `3d-${theme.shape}`) : undefined, boardUrl(theme.board)]
  const ready = urls.map((url) => {
    if (!url) return Promise.resolve()
    const image = new Image()
    image.src = url
    return image.decode().catch(() => {})
  })
  const late = new Promise((resolve) => setTimeout(resolve, 3000))
  Promise.race([Promise.all(ready), late]).then(() => {
    if (mine === turn) apply(theme)
  })
}

if (typeof document !== 'undefined') apply(current)

export function getTheme(): Theme {
  return current
}

export function setTheme(change: Partial<Theme>): void {
  current = { ...current, ...change }
  save('theme', current)
  show(current)
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme)
}

// Bàn cờ đang vẽ quân 3D hay không.
export function useShown3d(): boolean {
  return useSyncExternalStore(subscribe, () => is3d(shown))
}
