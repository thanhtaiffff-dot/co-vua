// Máy này là ai khi chơi online: một mã bí mật ngẫu nhiên tạo lần đầu rồi giữ trong máy (không cần đăng nhập),
// và tên người chơi tự đặt. Máy chủ nhận ra chủ phòng, hay người vừa rớt mạng vào lại, nhờ mã này.
import { loadSaved, save } from '../storage'

let token: string | null = null

export function myToken(): string {
  if (token) return token
  const saved = loadSaved<unknown>('token', null)
  if (typeof saved === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(saved)) token = saved
  else {
    const bytes = crypto.getRandomValues(new Uint8Array(18))
    token = btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_')
    save('token', token)
  }
  return token
}

export function myName(): string {
  const saved = loadSaved<unknown>('name', '')
  return typeof saved === 'string' ? saved : ''
}

export function saveMyName(name: string): void {
  save('name', name.trim())
}
