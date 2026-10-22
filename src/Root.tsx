// Chọn trang theo địa chỉ: /phong/<mã> là phòng chơi online, /online là trang tạo phòng, còn lại là chơi một máy.
import App from './App'
import { serverBackend } from './online/backend'
import { demoBackend } from './online/demo'
import { CreatePage, RoomPage } from './online/OnlinePages'
import { usePath } from './router'

// Bản gộp một file (`npm run build:single`, `build:demo`) không có máy chủ, nên dùng máy chủ giả ngay trong trình duyệt;
// bản thật nói chuyện với máy chủ trên Cloudflare.
const backend = import.meta.env.MODE === 'single' || import.meta.env.MODE === 'demo' ? demoBackend : serverBackend

export function Root() {
  const path = usePath()
  const room = /^\/phong\/([^/]+)\/?$/.exec(path)
  if (room) return <RoomPage key={room[1]} backend={backend} id={room[1].toLowerCase()} />
  if (/^\/online\/?$/.test(path)) return <CreatePage backend={backend} />
  return <App />
}
