// Chuyển trang không cần tải lại cả web: đổi địa chỉ trên thanh địa chỉ rồi vẽ trang tương ứng.
//   /            chơi chung một máy
//   /online      tạo phòng chơi online
//   /phong/<mã>  phòng chơi online (link gửi cho bạn bè)
// Bản gộp một file (mở thẳng từ máy, hay bản chơi thử trong khung của Claude) không đổi được địa chỉ,
// nên nhớ trang đang mở trong bộ nhớ.
import { useSyncExternalStore } from 'react'

const inMemory = import.meta.env.MODE === 'single' || import.meta.env.MODE === 'demo'
let memoryPath = import.meta.env.MODE === 'demo' ? '/online' : '/'
const listeners = new Set<() => void>()

function current(): string {
  return inMemory ? memoryPath : location.pathname
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (!inMemory) window.addEventListener('popstate', listener)
  return () => {
    listeners.delete(listener)
    if (!inMemory) window.removeEventListener('popstate', listener)
  }
}

export function navigate(path: string, replace = false): void {
  if (inMemory) memoryPath = path
  else if (replace) history.replaceState(null, '', path)
  else history.pushState(null, '', path)
  window.scrollTo(0, 0)
  for (const listener of listeners) listener()
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, current)
}
