/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build:single` gộp cả web vào đúng một file HTML: bấm đúp là chơi được, không cần mạng
// (phần chơi online thì dùng máy chủ giả và một bạn bè ảo). `npm run build:demo` cũng vậy nhưng mở sẵn trang chơi online.
// Bản thường thì để file tiếng và ảnh chủ đề riêng, không nhét vào code: có nhiều bộ, máy chỉ tải bộ đang dùng.
// `npm run dev` chuyển các địa chỉ /api (chơi online) sang máy chủ chạy bằng `npm run dev:server`.

// Bản web ghi vào góp ý, để biết người góp ý đang dùng bản nào: mã commit khi Cloudflare dựng web, còn dựng trên máy
// thì ghi ngày giờ dựng (giờ Việt Nam).
function appVersion(mode: string): string {
  const commit = process.env.WORKERS_CI_COMMIT_SHA?.slice(0, 7)
  if (commit) return commit
  const time = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' })
  const name: Record<string, string> = { production: 'tự dựng', development: 'đang làm', demo: 'bản chơi thử', single: 'bản một file' }
  return `${name[mode] ?? mode} ${time}`
}

export default defineConfig(({ mode }) => {
  const single = mode === 'single' || mode === 'demo'
  return {
    plugins: single ? [react(), viteSingleFile()] : [react()],
    define: { __APP_VERSION__: JSON.stringify(appVersion(mode)) },
    build: single
      ? { outDir: `dist-${mode}` }
      : { assetsInlineLimit: (file) => (file.endsWith('.mp3') || file.includes('/src/themes/') ? false : undefined) },
    server: { proxy: { '/api': { target: 'http://127.0.0.1:8787', ws: true } } },
  }
})
