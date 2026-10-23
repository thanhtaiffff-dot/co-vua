// Vẽ một file SVG ra PNG nền trong suốt bằng Chromium: node svg2png.mjs in.svg out.png <cỡ>
import { readFileSync } from 'fs'
import { chromium } from 'playwright'

const [, , input, output, size = '256'] = process.argv
const svg = readFileSync(input, 'utf8')
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined })
const page = await browser.newPage({ viewport: { width: +size, height: +size } })
await page.setContent(
  `<style>html,body{margin:0;background:transparent}img{display:block;width:${size}px;height:${size}px}</style>` +
    `<img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`,
)
await page.waitForFunction(() => document.querySelector('img').complete)
await page.screenshot({ path: output, omitBackground: true })
await browser.close()
