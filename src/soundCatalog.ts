// Các bộ tiếng hiện trong bảng chọn tiếng: chia nhóm theo chất liệu, mỗi bộ có tên và một câu tả tiếng nghe ra sao.
// Kèm các đoạn nghe thử, dựng từ đúng những tiếng mà ván cờ thật sẽ kêu.
import type { MoveFacts } from './game/rules'
import { END_DELAY, moveSounds, type Sample, type SoundSet } from './sound'

export type SoundSetInfo = { id: SoundSet; name: string; about: string }
export type SoundGroup = { name: string; sets: SoundSetInfo[] }

export const SOUND_GROUPS: SoundGroup[] = [
  { name: 'Mặc định', sets: [{ id: 'wood', name: 'Gỗ', about: 'Quân gỗ trên bàn gỗ: "cộc" ấm, tròn.' }] },
  {
    name: 'Kim loại',
    sets: [
      { id: 'steel', name: 'Thép', about: '"Cạch" gọn, sáng, tắt nhanh.' },
      { id: 'bronze', name: 'Đồng', about: 'Trầm, ngân ấm. Thắng thì vua xoay như đồng xu.' },
      { id: 'cast-iron', name: 'Gang', about: '"Cộc" đục và nặng, gần như không ngân.' },
    ],
  },
  {
    name: 'Thủy tinh',
    sets: [
      { id: 'crystal', name: 'Pha lê', about: '"Ting" trong, ngân nhẹ.' },
      { id: 'glass-marbles', name: 'Bi ve', about: '"Tách" khô như viên bi, có cú nảy nhỏ.' },
      { id: 'thick-glass', name: 'Kính dày', about: '"Cộp" trầm, tròn, ít ngân.' },
    ],
  },
  {
    name: 'Đá',
    sets: [
      { id: 'polished-stone', name: 'Cẩm thạch', about: '"Cách" sắc, hơi ngân như sứ.' },
      { id: 'pebbles', name: 'Sỏi', about: '"Lách cách" khô và nhanh như sỏi nảy.' },
      { id: 'stone-table', name: 'Bàn đá', about: '"Cộc" đục, chắc, trầm.' },
    ],
  },
  {
    name: 'Trống',
    sets: [
      { id: 'hand-drum', name: 'Trống tay', about: 'Bongo, conga vỗ bằng tay: "bốc bốp" dày, ấm.' },
      { id: 'festival-drum', name: 'Trống hội', about: 'Trống con, trống cái đánh dùi gỗ: "tùng" dày, sâu, ngân lâu.' },
    ],
  },
  {
    name: 'Bass',
    sets: [
      { id: 'bass-drum', name: 'Trống bass', about: 'Trống cái của dàn trống: "thùm" sâu. Đeo tai nghe mới nghe đủ.' },
      { id: 'bass-808', name: 'Bass 808', about: 'Bass điện tử nhạc remix: "bùm" sâu, căng, trượt nốt khi thắng.' },
    ],
  },
  {
    name: 'Vui nhộn',
    sets: [
      { id: '8bit', name: '8-bit', about: 'Tiếng máy chơi game đời cũ.' },
      { id: 'bubble', name: 'Bong bóng', about: 'Tiếng bọt nước "bóp" tròn, êm.' },
    ],
  },
]

// Mọi bộ theo đúng thứ tự trong bảng chọn.
export const SOUND_LIST: SoundSetInfo[] = SOUND_GROUPS.flatMap((group) => group.sets)

export function soundSetName(set: SoundSet): string {
  return SOUND_LIST.find((info) => info.id === set)?.name ?? set
}

const quiet: MoveFacts = { capture: false, castle: false, promotion: false, check: false, mate: false }
const later = (start: number, sample: Sample): Sample => sample.map(([name, at]) => [name, start + at])

// Chạm vào một bộ thì nghe đoạn này (khoảng 2–3 giây): đi quân, ăn quân, một nước chiếu, rồi tiếng thắng.
export const SET_SAMPLE: Sample = [
  ...moveSounds(quiet),
  ...later(0.42, moveSounds({ ...quiet, capture: true })),
  ...later(0.9, moveSounds({ ...quiet, check: true })),
  ['end', 1.55],
]

// Nghe riêng từng việc, phát y như lúc chơi: tiếng chiếu vang ngay sau tiếng quân, tiếng thắng sau nước chiếu bí.
export const SOUND_EVENTS: { name: string; sample: Sample }[] = [
  { name: 'Đi quân', sample: moveSounds(quiet) },
  { name: 'Ăn quân', sample: moveSounds({ ...quiet, capture: true }) },
  { name: 'Nhập thành', sample: moveSounds({ ...quiet, castle: true }) },
  { name: 'Chiếu', sample: moveSounds({ ...quiet, check: true }) },
  { name: 'Phong cấp', sample: moveSounds({ ...quiet, promotion: true }) },
  { name: 'Thắng', sample: [...moveSounds({ ...quiet, capture: true, check: true, mate: true }), ['end', END_DELAY]] },
  { name: 'Hòa', sample: [...moveSounds(quiet), ['draw', END_DELAY]] },
  { name: 'Sắp hết giờ', sample: [['lowTime', 0]] },
  { name: 'Ván mới', sample: [['start', 0]] },
]
