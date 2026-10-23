// Chạy phòng chụp trong Chromium không màn hình: node drive.mjs jobs.json
// jobs.json: [{ out: "out/x.png", piece: "king", material: {...}, ...tuỳ chọn }]
// Máy đã có sẵn Chromium ở chỗ khác thì chỉ tới nó: CHROMIUM=/đường/dẫn/chromium node drive.mjs jobs.json
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join, extname } from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'

const root = dirname(fileURLToPath(import.meta.url))
const jobs = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const types = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json' }

// Vẽ bằng card đồ hoạ giả lập (SwiftShader) cho ảnh ra giống nhau trên mọi máy.
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage()
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.type(), m.text().slice(0, 400))
})
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.route('http://render.local/**', (route) => {
  const path = decodeURIComponent(new URL(route.request().url()).pathname)
  try {
    const body = readFileSync(join(root, path))
    route.fulfill({ body, contentType: types[extname(path)] ?? 'application/octet-stream' })
  } catch {
    route.fulfill({ status: 404, body: 'not found' })
  }
})
await page.goto('http://render.local/index.html')
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 })
for (const job of jobs) {
  const t = Date.now()
  const res = await page.evaluate((j) => (j.board ? window.renderBoard(j) : j.flat ? window.renderFlat(j) : window.renderSprite(j)), job)
  const out = join(root, job.out)
  mkdirSync(dirname(out), { recursive: true })
  const urls = Array.isArray(res) ? res : [res]
  writeFileSync(out, Buffer.from(urls[0].split(',')[1], 'base64'))
  // Ảnh phụ (lớp nét của quân 2D) ghi cạnh ảnh chính: x.png → x.ink.png
  if (urls[1]) writeFileSync(out.replace(/\.png$/, '.ink.png'), Buffer.from(urls[1].split(',')[1], 'base64'))
  console.log(job.out, ((Date.now() - t) / 1000).toFixed(1) + 's')
}
await browser.close()
