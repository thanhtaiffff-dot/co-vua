// Phần "não" của chat: tin nào chưa đọc, tin nào hiện bong bóng, khi nào kêu; và màn hình đủ rộng để đặt khung chat
// cạnh bàn cờ không. Giao diện nằm ở ChatPanel.tsx.
import { useEffect, useState } from 'react'
import { playChatSound } from '../sound'
import type { ChatLine } from './protocol'

export type ChatRole = ChatLine['by']

// Lúc nào trong ván: đầu ván, giữa ván, hết ván. Mỗi lúc một bộ câu nhanh.
export type ChatPhase = 'start' | 'middle' | 'end'

// Bong bóng thoại hiện bấy nhiêu ms rồi tắt.
const BUBBLE_FOR = 4000

// Theo dõi tin của đối thủ: bao nhiêu tin chưa đọc, tin nào đang hiện bong bóng; có tin mới thì kêu "tách".
// `visible`: khung chat đang hiện trên màn hình (cột trái trên máy tính, hay tấm trượt đang mở): coi như đã đọc hết,
// khỏi hiện bong bóng. Tin có sẵn lúc vừa mở trang (số thứ tự tới `base`) là chuyện cũ, không kêu, không báo.
export function useChatAlerts(lines: ChatLine[], base: number, mine: ChatRole, off: boolean, visible: boolean) {
  const theirs = lines.filter((line) => line.by !== mine)
  const newest = theirs.at(-1)
  const newestId = newest?.id ?? 0

  const [read, setRead] = useState(0)
  if (visible && !off && newestId > read) setRead(newestId)
  const unread = off ? 0 : theirs.filter((line) => line.id > Math.max(read, base)).length

  // Tin mới nhất đã báo (và có kêu không), bong bóng đang hiện. Tính ngay lúc vẽ để bong bóng hiện cùng lúc với tin.
  const [told, setTold] = useState({ id: 0, ring: false })
  const [bubble, setBubble] = useState<ChatLine | null>(null)
  if (newest && newestId > Math.max(told.id, base)) {
    setTold({ id: newestId, ring: !off })
    if (!off && !visible) setBubble(newest)
  }

  useEffect(() => {
    if (told.ring) playChatSound()
  }, [told])

  useEffect(() => {
    if (!bubble) return
    const timer = setTimeout(() => setBubble(null), BUBBLE_FOR)
    return () => clearTimeout(timer)
  }, [bubble])

  return { unread, bubble: off || visible ? null : bubble }
}

// Màn hình đang khớp điều kiện `query` không (ví dụ đủ rộng để đặt khung chat cạnh bàn cờ).
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches)
  useEffect(() => {
    const list = matchMedia(query)
    const update = () => setMatches(list.matches)
    update()
    list.addEventListener('change', update)
    return () => list.removeEventListener('change', update)
  }, [query])
  return matches
}
