/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build:single` gộp cả web vào đúng một file HTML: bấm đúp là chơi được, không cần mạng.
// Bản thường thì để file tiếng riêng, không nhét vào code: có nhiều bộ tiếng, máy chỉ tải bộ đang dùng.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'single' ? [react(), viteSingleFile()] : [react()],
  build: mode === 'single' ? { outDir: 'dist-single' } : { assetsInlineLimit: (file) => (file.endsWith('.mp3') ? false : undefined) },
}))
