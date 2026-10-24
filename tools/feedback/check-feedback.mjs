// Kiểm tra phần góp ý trên máy chủ chạy thật: gửi góp ý, các kiểu thư bị từ chối, ô bẫy máy dò tự động, giới hạn gửi
// dồn, và đưa góp ý thành Issue trên GitHub. Không đụng tới GitHub thật: script tự mở một "GitHub giả" ở cổng 8790,
// ghi lại các Issue máy chủ tạo, và có lúc cố tình trả lỗi để xem góp ý có được giữ lại rồi gửi lại không.
// Cần chạy máy chủ trước, trỏ vào GitHub giả:
//   npm run build && npx wrangler dev --var GITHUB_API:http://127.0.0.1:8790 --var GITHUB_TOKEN:token-thu
// Mỗi lần chạy lại thì chạy lại cả máy chủ (xoá thư mục .wrangler/state), vì máy chủ nhớ lượt gửi trong một giờ.
// Cách dùng: node tools/feedback/check-feedback.mjs [địa chỉ, mặc định http://127.0.0.1:8787]
import { createServer } from 'node:http'

const base = process.argv[2] ?? 'http://127.0.0.1:8787'
const REPO = 'thanhtaiffff-dot/co-vua-gop-y'

// GitHub giả: `answer` là mã trả lời cho lần tạo Issue tới (201 là nhận).
const issues = []
let answer = 201
let calls = 0
const github = createServer((request, response) => {
  let body = ''
  request.on('data', (chunk) => (body += chunk))
  request.on('end', () => {
    calls++
    if (request.method !== 'POST' || request.url !== `/repos/${REPO}/issues`) {
      response.writeHead(404).end('{}')
      return
    }
    if (answer === 201) issues.push({ headers: request.headers, ...JSON.parse(body) })
    response.writeHead(answer, { 'Content-Type': 'application/json' }).end('{}')
  })
})
await new Promise((resolve) => github.listen(8790, '127.0.0.1', resolve))

function fail(message) {
  console.error('LỖI:', message)
  process.exit(1)
}

function send(body, headers = { 'Content-Type': 'application/json' }) {
  return fetch(`${base}/api/feedback`, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) })
}

// Chờ tới khi điều kiện đúng (máy chủ gửi Issue sau khi đã trả lời người gửi), tối đa 5 giây.
async function until(check) {
  for (let i = 0; i < 50 && !check(); i++) await new Promise((resolve) => setTimeout(resolve, 100))
  return check()
}

const good = (text) => ({ kind: 'bug', text, contact: 'Người thử', context: { page: 'Chơi một máy', game: 'e4 e5 Nf3', device: 'máy thử', settings: '', version: 'thử' }, website: '' })

// Thư sai kiểu, quá dài, thiếu nội dung: bị từ chối ngay (không tính lượt).
let response = await send(JSON.stringify(good('chữ thường')), { 'Content-Type': 'text/plain' })
if (response.status !== 415) fail('gửi không phải JSON mà không bị từ chối: ' + response.status)
response = await send('x'.repeat(100_000))
if (response.status !== 413) fail('gửi thư quá dài mà không bị từ chối: ' + response.status)
response = await send({ kind: 'spam', text: 'mua ngay' })
if (response.status !== 400) fail('gửi sai loại góp ý mà không bị từ chối: ' + response.status)
response = await send({ ...good('x'.repeat(1001)) })
if (response.status !== 400) fail('góp ý quá 1000 ký tự mà không bị từ chối: ' + response.status)
response = await send('{hỏng')
if (response.status !== 400) fail('gửi JSON hỏng mà không bị từ chối: ' + response.status)

// Ô bẫy có chữ: máy chủ trả lời như đã nhận, nhưng không tạo Issue.
response = await send({ ...good('máy dò tự động'), website: 'http://spam.example' })
if (response.status !== 201) fail('ô bẫy: máy chủ không giả vờ nhận: ' + response.status)

// Góp ý đầu tiên gặp lúc GitHub trục trặc: người gửi vẫn được báo đã nhận, góp ý nằm chờ.
answer = 500
const evil = '<img src=x onerror=alert(1)> @ai-do ![ảnh](https://lua-dao.example/x.png)\n```\n# thoát khối'
response = await send(good(evil))
if (response.status !== 201) fail('GitHub trục trặc mà người gửi bị báo lỗi: ' + response.status)
if (!(await until(() => calls > 0)) || issues.length) fail('máy chủ không thử gửi lên GitHub, hay tạo Issue dù GitHub báo lỗi')
answer = 201

// GitHub ổn lại: góp ý sau đưa lên, kéo theo cả góp ý đang chờ (cũ trước).
const sent = [evil, 'góp ý 2', 'góp ý 3', 'góp ý 4', 'góp ý 5']
for (const text of sent.slice(1)) {
  response = await send(good(text))
  if (response.status !== 201) fail(`không nhận góp ý thật "${text}": ${response.status}`)
}
if (!(await until(() => issues.length >= sent.length))) fail(`thiếu Issue: có ${issues.length}/${sent.length}`)
if (issues.length !== sent.length) fail(`thừa Issue (tạo trùng?): ${issues.length}`)
const order = issues.map((issue) => sent.find((text) => issue.body.includes(text)))
if (order.join('|') !== sent.join('|')) fail('Issue không theo thứ tự gửi, hay thiếu nội dung: ' + order.join(' | '))
// Góp ý thứ 6 trong một giờ từ cùng một máy: bị từ chối.
response = await send(good('góp ý 6'))
if (response.status !== 429 || (await response.json()).error !== 'slow') fail('gửi dồn quá 5 góp ý một giờ mà không bị chặn: ' + response.status)
console.log('Gửi góp ý: ổn (thư sai bị từ chối, ô bẫy, chặn gửi dồn sau 5 góp ý, GitHub lỗi thì giữ lại rồi gửi sau)')

// Issue đúng dạng: đúng token, tiêu đề có loại, nhãn theo loại, chữ người chơi nằm trọn trong khối chữ thô.
const first = issues[0]
if (first.headers.authorization !== 'Bearer token-thu') fail('gửi Issue không kèm đúng token')
if (!first.headers['user-agent']) fail('gửi Issue thiếu User-Agent (GitHub bắt buộc)')
if (!first.title.startsWith('🐞 Báo lỗi: <img')) fail('tiêu đề Issue sai: ' + first.title)
if (JSON.stringify(first.labels) !== '["Báo lỗi"]') fail('nhãn Issue sai: ' + JSON.stringify(first.labels))
if (!first.body.includes('````text\n<img')) fail('nội dung không nằm trong khối chữ thô dài hơn dấu ` trong góp ý:\n' + first.body)
if (!first.body.includes('[Mở ván trên lichess](https://lichess.org/analysis/pgn/1.e4_e5_2.Nf3')) fail('Issue thiếu link mở ván')
console.log('Issue: ổn (đúng token, tiêu đề, nhãn, chữ người chơi không thành link/ảnh/@tên)')

// Token hỏng (hết hạn, bị xoá): góp ý nằm chờ, dán token mới xong thì được gửi.
answer = 401
// Đếm trước khi gửi: máy chủ có thể gọi GitHub trước cả khi người gửi nhận được trả lời.
const before = calls
response = await send(good('góp ý lúc token hỏng'), { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9' })
if (response.status !== 201) fail('token hỏng mà người gửi bị báo lỗi: ' + response.status)
if (!(await until(() => calls > before))) fail('máy chủ không thử gửi góp ý lúc token hỏng')
answer = 201
response = await send(good('góp ý sau khi có token mới'), { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.10' })
if (response.status !== 201) fail('không nhận góp ý từ máy khác: ' + response.status)
if (!(await until(() => issues.length === sent.length + 2))) fail('góp ý lúc token hỏng bị mất: ' + issues.length)
if (!issues[sent.length].body.includes('góp ý lúc token hỏng')) fail('góp ý chờ không được gửi trước')
console.log('Token hỏng: ổn (góp ý nằm chờ, có token lại thì gửi đủ)')

// Trang hộp thư cũ không còn: đọc góp ý qua máy chủ là không được.
for (const path of ['', '/unread', '/mail']) {
  response = await fetch(`${base}/api/feedback${path}`)
  if (response.status !== 404) fail(`đường hộp thư cũ GET /api/feedback${path} vẫn còn: ${response.status}`)
}
console.log('Hộp thư cũ: ổn (đã bỏ, không đọc được góp ý qua web)')
github.close()
