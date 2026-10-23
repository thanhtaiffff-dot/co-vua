/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build:single` gộp cả web vào đúng một file HTML: bấm đúp là chơi được, không cần mạng
// (phần chơi online thì dùng máy chủ giả và một bạn bè ảo). `npm run build:demo` cũng vậy nhưng mở sẵn trang chơi online.
// Bản thường thì để file tiếng và ảnh chủ đề riêng, không nhét vào code: có nhiều bộ, máy chỉ tải bộ đang dùng.
// `npm run dev` chuyển các địa chỉ /api (chơi online) sang máy chủ chạy bằng `npm run dev:server`.
export default defineConfig(({ mode }) => {
  const single = mode === 'single' || mode === 'demo'
  return {
    plugins: single ? [react(), viteSingleFile()] : [react()],
    build: single
      ? { outDir: `dist-${mode}` }
      : { assetsInlineLimit: (file) => (file.endsWith('.mp3') || file.includes('/src/themes/') ? false : undefined) },
    server: { proxy: { '/api': { target: 'http://127.0.0.1:8787', ws: true } } },
  }
})
