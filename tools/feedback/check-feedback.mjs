// Kiểm tra phần góp ý trên máy chủ chạy thật: gửi góp ý, các kiểu thư bị từ chối, ô bẫy máy dò tự động, giới hạn gửi
// dồn, và hộp thư của chủ web (cần chìa khoá: không đúng chìa thì không đọc, không sửa, không xoá được).
// Cần chạy máy chủ trước: `npm run build && npx wrangler dev`. Mỗi lần chạy lại thì chạy lại cả máy chủ (xoá thư mục
// .wrangler/state để có hộp thư trống), vì máy chủ nhớ lượt gửi trong một giờ.
// Cách dùng: OWNER_KEY=<chìa hộp thư> node tools/feedback/check-feedback.mjs [địa chỉ, mặc định http://127.0.0.1:8787]
// Không có OWNER_KEY thì chỉ thử phần gửi góp ý.
const base = process.argv[2] ?? 'http://127.0.0.1:8787'
const key = process.env.OWNER_KEY

function fail(message) {
  console.error('LỖI:', message)
  process.exit(1)
}

function send(body, headers = { 'Content-Type': 'application/json' }) {
  return fetch(`${base}/api/feedback`, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) })
}

function owner(path = '', init = {}, ownerKey = key) {
  const headers = { Authorization: `Bearer ${ownerKey}` }
  if (init.body) headers['Content-Type'] = 'application/json'
  return fetch(`${base}/api/feedback${path}`, { ...init, headers })
}

const good = (text) => ({ kind: 'bug', text, contact: 'Người thử', context: { page: 'Chơi một máy', device: 'máy thử', settings: '', version: 'thử' }, website: '' })

// Thư sai kiểu, quá dài, thiếu nội dung: bị từ chối trước khi tới hộp thư (không tính lượt).
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

// Ô bẫy có chữ: máy chủ trả lời như đã nhận, nhưng không lưu.
response = await send({ ...good('máy dò tự động'), website: 'http://spam.example' })
if (response.status !== 201) fail('ô bẫy: máy chủ không giả vờ nhận: ' + response.status)

// Góp ý có mã lạ: lưu nguyên dạng chữ (giao diện chỉ hiện chữ, không chạy mã).
const evil = '<img src=x onerror=alert(1)> <script>alert(2)</script> https://lua-dao.example'
const sent = [evil, 'góp ý 2', 'góp ý 3', 'góp ý 4', 'góp ý 5']
for (const text of sent) {
  response = await send(good(text))
  if (response.status !== 201) fail(`không nhận góp ý thật "${text}": ${response.status}`)
}
// Góp ý thứ 6 trong một giờ từ cùng một máy: bị từ chối.
response = await send(good('góp ý 6'))
if (response.status !== 429 || (await response.json()).error !== 'slow') fail('gửi dồn quá 5 góp ý một giờ mà không bị chặn: ' + response.status)
console.log('Gửi góp ý: ổn (thư sai bị từ chối, ô bẫy, chặn gửi dồn sau 5 góp ý)')

// Hộp thư: không có chìa, sai chìa thì không đọc, không sửa, không xoá được.
for (const [path, init] of [
  ['', {}],
  ['/unread', {}],
  ['/1', { method: 'DELETE' }],
  ['/1', { method: 'PATCH', body: JSON.stringify({ status: 'done' }) }],
  ['/seen', { method: 'POST', body: JSON.stringify({ ids: [1] }) }],
]) {
  const none = await fetch(`${base}/api/feedback${path}`, { method: init.method ?? 'GET', body: init.body })
  if (none.status !== 401) fail(`không có chìa mà ${init.method ?? 'GET'} ${path} được: ${none.status}`)
  const wrong = await owner(path, init, 'chia-khoa-sai-0123456789abcdef')
  if (wrong.status !== 401) fail(`sai chìa mà ${init.method ?? 'GET'} ${path} được: ${wrong.status}`)
}
console.log('Hộp thư không có chìa: ổn (bị từ chối hết)')

if (!key) {
  console.log('Không có OWNER_KEY nên bỏ qua phần đọc hộp thư.')
  process.exit(0)
}

let page = await (await owner()).json()
const mine = page.items.filter((item) => sent.includes(item.text))
if (mine.length !== sent.length) fail(`hộp thư thiếu góp ý: có ${mine.length}/${sent.length}`)
if (page.items.some((item) => item.text === 'máy dò tự động')) fail('góp ý của ô bẫy bị lưu')
if (!page.items.some((item) => item.text === evil)) fail('góp ý có mã lạ không còn nguyên dạng chữ')
if (page.items[0].id < page.items[page.items.length - 1].id) fail('hộp thư không xếp mới nhất lên trên')
const newCount = (await (await owner('/unread')).json()).unread
if (newCount < sent.length) fail('số góp ý mới sai: ' + newCount)

const target = mine[0]
response = await owner('/seen', { method: 'POST', body: JSON.stringify({ ids: mine.map((item) => item.id) }) })
if (!response.ok) fail('không đánh dấu đã thấy được: ' + response.status)
const after = (await (await owner('/unread')).json()).unread
if (after !== newCount - mine.length) fail(`đánh dấu đã thấy mà số mới không giảm: ${newCount} → ${after}`)
response = await owner(`/${target.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'done' }) })
if (!response.ok) fail('không đánh dấu đã xử lý được: ' + response.status)
page = await (await owner('?open=1')).json()
if (page.items.some((item) => item.id === target.id)) fail('lọc "chưa xử lý" vẫn hiện góp ý đã xử lý')
page = await (await owner('?kind=idea')).json()
if (page.items.length !== 0) fail('lọc theo loại "Ý tưởng" lại hiện góp ý báo lỗi')
response = await owner(`/${target.id}`, { method: 'DELETE' })
if (!(await response.json()).ok) fail('không xoá được góp ý')
page = await (await owner()).json()
if (page.items.some((item) => item.id === target.id)) fail('góp ý đã xoá vẫn còn')
response = await owner('/seen', { method: 'POST', body: JSON.stringify({ ids: 'tất cả' }) })
if (response.status !== 400) fail('danh sách đã thấy sai mà không bị từ chối: ' + response.status)
console.log(`Hộp thư có chìa: ổn (${page.counts.all} góp ý; đọc, lọc, đánh dấu đã thấy, đã xử lý, xoá)`)
