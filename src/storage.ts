// Lưu ván đang chơi trên máy này, để lỡ tải lại trang cũng không mất ván.
// Trình duyệt có thể chặn bộ nhớ (chế độ ẩn danh...), nên lỗi thì bỏ qua.
const PREFIX = 'co-vua:'

export function loadSaved<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Không lưu được thì thôi, ván vẫn chơi bình thường.
  }
}
