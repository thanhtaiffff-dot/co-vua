// Tên hai người chơi chung một máy, hiện trên thanh người chơi và thẻ kết quả thay cho "Trắng", "Đen".
import type { Color } from 'chess.js'

export type Names = Record<Color, string>

export const NAME_LIMIT = 20

// Đọc lại tên đã lưu; thiếu hay sai thì để trống (gọi theo màu quân).
export function restoreNames(saved: unknown): Names {
  const data = (saved !== null && typeof saved === 'object' ? saved : {}) as Record<string, unknown>
  const clean = (value: unknown) => (typeof value === 'string' ? [...value].slice(0, NAME_LIMIT).join('') : '')
  return { w: clean(data.w), b: clean(data.b) }
}
