// Ảnh đại diện trên thanh người chơi: chữ cái đầu của tên trên nền màu riêng của tên đó. Máy nào cũng tính ra cùng một
// chữ, một màu, nên hai người chơi online thấy giống nhau.
export const AVATAR_COLORS = ['#c0573f', '#a8670f', '#80731a', '#4d8c47', '#24857d', '#3b72b5', '#6a5ab3', '#ad4f7d']

// Chữ cái đầu của tên, viết hoa, giữ cả dấu ("ánh" ra "Á"); tên mở đầu bằng dấu câu thì lấy chữ cái, chữ số hay emoji
// đầu tiên. Chưa nhập tên thì trả về chuỗi rỗng.
export function avatarLetter(name: string): string {
  const text = name.trim()
  if (!text) return ''
  const letters = typeof Intl.Segmenter === 'function' ? Array.from(new Intl.Segmenter('vi', { granularity: 'grapheme' }).segment(text), (s) => s.segment) : [...text]
  const first = letters.find((letter) => /[\p{L}\p{N}\p{Extended_Pictographic}]/u.test(letter)) ?? letters[0]
  return first.toLocaleUpperCase('vi')
}

function colorIndex(name: string): number {
  let hash = 0
  for (const char of name.trim().toLocaleLowerCase('vi')) hash = (hash * 31 + char.codePointAt(0)!) >>> 0
  return hash % AVATAR_COLORS.length
}

// Màu nền ảnh đại diện của `name`. Hai người chơi trùng màu thì bên Đen (`black`) lấy màu kế tiếp, để hai ảnh không
// giống nhau.
export function avatarColor(name: string, rival: string, black: boolean): string {
  const index = colorIndex(name)
  const clash = black && rival.trim() !== '' && colorIndex(rival) === index
  return AVATAR_COLORS[(index + (clash ? 1 : 0)) % AVATAR_COLORS.length]
}
