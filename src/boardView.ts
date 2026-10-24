// Cỡ bàn cờ và chế độ toàn màn hình, chỉnh bằng thanh nút cạnh bàn cờ. Bàn cờ mặc định to vừa màn hình (công thức
// --board trong index.css); mỗi lần Thu nhỏ bớt một phần mười, tối thiểu còn một nửa. Cỡ đã chỉnh lưu trong máy.
import { useSyncExternalStore } from 'react'
import { loadSaved, save } from './storage'

export const ZOOM_MIN = 0.5
export const ZOOM_MAX = 1
const ZOOM_STEP = 0.1

// Cỡ đã lưu (hỏng hay ngoài khoảng cho phép thì về mặc định, làm tròn tới một nấc).
export function restoreZoom(saved: unknown): number {
  if (typeof saved !== 'number' || !Number.isFinite(saved)) return ZOOM_MAX
  return Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, saved)) * 10) / 10
}

let zoom = restoreZoom(loadSaved<unknown>('boardZoom', null))
const listeners = new Set<() => void>()

function apply(): void {
  document.documentElement.style.setProperty('--board-zoom', String(zoom))
  for (const listener of listeners) listener()
}

if (typeof document !== 'undefined') apply()

// Phóng to (1) hay thu nhỏ (-1) một nấc.
export function zoomBoard(direction: 1 | -1): void {
  const next = restoreZoom(zoom + direction * ZOOM_STEP)
  if (next === zoom) return
  zoom = next
  save('boardZoom', zoom)
  apply()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useBoardZoom(): number {
  return useSyncExternalStore(subscribe, () => zoom)
}

// Toàn màn hình: ẩn thanh địa chỉ, thanh tab của trình duyệt cho bàn cờ to thêm. iPhone (và trang nằm trong khung không
// cho phép) không làm được, khi đó không hiện nút.
function subscribeFullscreen(listener: () => void): () => void {
  document.addEventListener('fullscreenchange', listener)
  return () => document.removeEventListener('fullscreenchange', listener)
}

export function useFullscreen(): { supported: boolean; on: boolean; toggle: () => void } {
  const on = useSyncExternalStore(subscribeFullscreen, () => Boolean(document.fullscreenElement))
  return {
    supported: typeof document !== 'undefined' && document.fullscreenEnabled === true,
    on,
    toggle: () => {
      const request = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()
      request.catch(() => {})
    },
  }
}
