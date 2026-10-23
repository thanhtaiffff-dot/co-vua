// Các bộ quân và bàn cờ hiện trong bảng chọn chủ đề: chia nhóm theo chất liệu, cùng tên với bộ tiếng.
// Quân và bàn chọn riêng, phối tùy ý. Ảnh nằm trong src/themes (tạo bằng tools/themes, xem README).
import type { SoundSet } from './sound'

export const PIECE_SETS = [
  'classic',
  'wood',
  'steel',
  'steel-brushed',
  'bronze',
  'cast-iron',
  'crystal',
  'glass-marbles',
  'thick-glass',
  'polished-stone',
  'pebbles',
  'stone-table',
  '8bit',
  'bubble',
] as const
export type PieceSetId = (typeof PIECE_SETS)[number]

export const BOARDS = [
  'classic',
  'wood',
  'steel',
  'bronze',
  'cast-iron',
  'crystal',
  'glass-marbles',
  'thick-glass',
  'polished-stone',
  'polished-stone-gray',
  'pebbles',
  'stone-table',
  '8bit',
  'bubble',
] as const
export type BoardId = (typeof BOARDS)[number]

// `sound`: bộ tiếng cùng chất liệu, dùng khi tiếng để "Theo chủ đề". `has3d`: có quân 3D (ba dáng).
export type PieceSetInfo = { id: PieceSetId; name: string; sound: SoundSet; has3d: boolean }
// `light`, `dark`: màu chữ toạ độ viết trên ô tối và trên ô sáng (lấy theo màu ô, chỉnh cho đủ rõ).
export type BoardInfo = { id: BoardId; name: string; light: string; dark: string }
export type Group<T> = { name: string; items: T[] }

const pieces = (id: PieceSetId, name: string, sound: SoundSet, has3d = true): PieceSetInfo => ({ id, name, sound, has3d })

export const PIECE_GROUPS: Group<PieceSetInfo>[] = [
  { name: 'Cổ điển', items: [pieces('classic', 'Cổ điển', 'wood', false)] },
  { name: 'Gỗ', items: [pieces('wood', 'Gỗ', 'wood')] },
  {
    name: 'Kim loại',
    items: [
      pieces('steel', 'Thép', 'steel'),
      pieces('steel-brushed', 'Thép xước', 'steel'),
      pieces('bronze', 'Đồng', 'bronze'),
      pieces('cast-iron', 'Gang', 'cast-iron'),
    ],
  },
  {
    name: 'Thủy tinh',
    items: [pieces('crystal', 'Pha lê', 'crystal'), pieces('glass-marbles', 'Bi ve', 'glass-marbles'), pieces('thick-glass', 'Kính dày', 'thick-glass')],
  },
  {
    name: 'Đá',
    items: [pieces('polished-stone', 'Cẩm thạch', 'polished-stone'), pieces('pebbles', 'Sỏi', 'pebbles'), pieces('stone-table', 'Bàn đá', 'stone-table')],
  },
  { name: 'Vui nhộn', items: [pieces('8bit', '8-bit', '8bit', false), pieces('bubble', 'Bong bóng', 'bubble')] },
]

export const BOARD_GROUPS: Group<BoardInfo>[] = [
  { name: 'Cổ điển', items: [{ id: 'classic', name: 'Cổ điển', light: '#f0d9b5', dark: '#b58863' }] },
  { name: 'Gỗ', items: [{ id: 'wood', name: 'Gỗ', light: '#ddbe90', dark: '#5a3721' }] },
  {
    name: 'Kim loại',
    items: [
      { id: 'steel', name: 'Thép', light: '#ccd0d5', dark: '#61666d' },
      { id: 'bronze', name: 'Đồng', light: '#dab26a', dark: '#683e20' },
      { id: 'cast-iron', name: 'Gang', light: '#a9abae', dark: '#383a3c' },
    ],
  },
  {
    name: 'Thủy tinh',
    items: [
      { id: 'crystal', name: 'Pha lê', light: '#ffffff', dark: '#687a8f' },
      { id: 'glass-marbles', name: 'Bi ve', light: '#e8ebed', dark: '#5c7a9f' },
      { id: 'thick-glass', name: 'Kính dày', light: '#d1efe5', dark: '#307c5d' },
    ],
  },
  {
    name: 'Đá',
    items: [
      { id: 'polished-stone', name: 'Cẩm thạch', light: '#deddda', dark: '#2a5043' },
      { id: 'polished-stone-gray', name: 'Cẩm thạch xám', light: '#e8e7e5', dark: '#6e7075' },
      { id: 'pebbles', name: 'Sỏi', light: '#dad4c6', dark: '#535251' },
      { id: 'stone-table', name: 'Bàn đá', light: '#b6b4ad', dark: '#525456' },
    ],
  },
  {
    name: 'Vui nhộn',
    items: [
      { id: '8bit', name: '8-bit', light: '#a2ce8f', dark: '#2e5b4b' },
      { id: 'bubble', name: 'Bong bóng', light: '#ffffff', dark: '#3f7ca1' },
    ],
  },
]

// Mọi bộ quân, mọi bàn theo đúng thứ tự trong bảng chọn.
export const PIECE_LIST: PieceSetInfo[] = PIECE_GROUPS.flatMap((group) => group.items)
export const BOARD_LIST: BoardInfo[] = BOARD_GROUPS.flatMap((group) => group.items)

export function pieceSetInfo(id: PieceSetId): PieceSetInfo {
  return PIECE_LIST.find((info) => info.id === id) ?? PIECE_LIST[0]
}

export function boardInfo(id: BoardId): BoardInfo {
  return BOARD_LIST.find((info) => info.id === id) ?? BOARD_LIST[0]
}
