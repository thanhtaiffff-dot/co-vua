// Đường dây tới máy chủ phòng (WebSocket: nối một lần, hai bên gửi thư cho nhau bất cứ lúc nào).
// Điện thoại hay rớt mạng (khoá màn hình, chuyển app, đổi wifi sang 4G), nên đường dây tự nối lại,
// và cứ vài giây gửi "ping" để đo độ trễ mạng: máy chủ dựa vào đó trả lại thời gian nằm trên đường truyền.
import type { ClientMessage, ServerMessage } from './protocol'

export type ConnectionStatus = 'connecting' | 'open' | 'offline'

export type ConnectionEvents = {
  message: (message: ServerMessage) => void
  status: (status: ConnectionStatus) => void
}

export type Connection = {
  send: (message: ClientMessage) => void
  lag: () => number // thời gian một thư đi tới máy chủ rồi quay về, tính bằng ms
  close: () => void
}

const PING_EVERY = 4000
const PING_TIMEOUT = 9000 // quá lâu không có "pong" thì coi như đường dây chết, nối lại

export function connectSocket(url: string, token: string, events: ConnectionEvents): Connection {
  let ws: WebSocket | null = null
  let closed = false
  let retries = 0
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let pingTimer: ReturnType<typeof setInterval> | undefined
  let pingSent = 0
  let rtt = 0
  // Thư gửi lúc đang mất mạng thì để dành, nối lại xong gửi tiếp (máy chủ tự bỏ thư đã lỗi thời).
  const queue: ClientMessage[] = []

  function ping() {
    if (ws?.readyState !== WebSocket.OPEN) return
    if (pingSent && performance.now() - pingSent > PING_TIMEOUT) {
      ws.close()
      return
    }
    if (!pingSent) {
      pingSent = performance.now()
      ws.send('ping')
    }
  }

  function open() {
    clearTimeout(retryTimer)
    if (closed) return
    events.status('connecting')
    const socket = new WebSocket(url)
    ws = socket
    socket.onopen = () => {
      retries = 0
      pingSent = 0
      socket.send(JSON.stringify({ t: 'hello', token } satisfies ClientMessage))
      for (const message of queue.splice(0)) socket.send(JSON.stringify(message))
      events.status('open')
      ping()
      clearInterval(pingTimer)
      pingTimer = setInterval(ping, PING_EVERY)
    }
    socket.onmessage = (event) => {
      if (event.data === 'pong') {
        const sample = performance.now() - pingSent
        // Lấy trung bình trượt cho đỡ nhảy lung tung vì một lần mạng chập chờn.
        rtt = rtt === 0 ? sample : rtt * 0.7 + sample * 0.3
        pingSent = 0
        return
      }
      let message: ServerMessage
      try {
        message = JSON.parse(event.data as string) as ServerMessage
      } catch {
        return
      }
      if (message.t === 'error') closed = true // phòng không tồn tại: thôi khỏi nối lại
      events.message(message)
    }
    socket.onclose = () => {
      if (ws !== socket) return
      ws = null
      clearInterval(pingTimer)
      if (closed) return
      events.status('offline')
      // Nối lại sau 0,5 giây, rồi giãn dần tới tối đa 5 giây.
      retryTimer = setTimeout(open, Math.min(5000, 500 * 2 ** retries++))
    }
  }

  // Quay lại trang (mở khoá màn hình, chuyển từ app khác về) hay có mạng lại thì nối ngay, khỏi chờ.
  function wake() {
    if (document.visibilityState === 'visible' && !ws && !closed) open()
  }
  document.addEventListener('visibilitychange', wake)
  window.addEventListener('online', wake)
  open()

  return {
    send(message) {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message))
      else if (queue.length < 20) queue.push(message)
    },
    lag: () => Math.round(rtt),
    close() {
      closed = true
      clearTimeout(retryTimer)
      clearInterval(pingTimer)
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('online', wake)
      ws?.close()
      ws = null
    },
  }
}
