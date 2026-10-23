import { useCallback, useEffect, useState } from 'react'

export type Review = {
  shown: number // bàn cờ đang hiện thế cờ sau nước thứ mấy (0 là lúc bắt đầu ván)
  reviewing: boolean // đang xem thế cờ cũ, không phải thế cờ hiện tại
  go: (ply: number) => void // tới thế cờ sau nước thứ `ply`; từ số nước hiện có trở lên là về thế cờ hiện tại
}

// Xem lại các nước đã đi: bấm một nước trong cột nước đi, hay dùng nút mũi tên, phím ← → (Home, End để về đầu, về cuối).
// Ván có thêm nước mới hay vừa đi lại (số nước đổi) thì tự về thế cờ hiện tại, để không lỡ lượt mình.
// `onStep(ply)`: vừa tiến đúng một nước tới thế cờ sau nước `ply` (để kêu tiếng nước đó).
export function useReview(total: number, onStep?: (ply: number) => void): Review {
  const [view, setView] = useState<{ ply: number; total: number } | null>(null)
  const shown = view && view.total === total ? view.ply : total

  const go = useCallback(
    (ply: number) => {
      const next = Math.max(0, Math.min(total, ply))
      if (next === shown) return
      if (next === shown + 1) onStep?.(next)
      setView(next === total ? null : { ply: next, total })
    },
    [total, shown, onStep],
  )

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      // Đang gõ chữ (ô tên), hay đang mở bảng chọn, thì phím mũi tên là của chỗ đó.
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('input, textarea, select, [contenteditable="true"], dialog')) return
      const keys: Record<string, number> = { ArrowLeft: shown - 1, ArrowRight: shown + 1, Home: 0, End: total }
      if (!(event.key in keys)) return
      event.preventDefault()
      go(keys[event.key])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, shown, total])

  return { shown, reviewing: shown < total, go }
}

// Đưa bàn cờ vào tầm nhìn. Điện thoại: thẻ kết quả nằm dưới bàn cờ, bấm "Xem lại từng nước" thì cuộn lên cho thấy bàn.
export function showBoard(): void {
  const board = document.querySelector('.board-col')
  if (!board) return
  const rect = board.getBoundingClientRect()
  if (rect.top >= 0 && rect.bottom <= window.innerHeight) return
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  board.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' })
}
