// Kiểm tra máy chủ phòng chạy thật: tạo phòng, hai "người chơi" nối WebSocket, đi một ván chiếu bí nhanh,
// rồi tái đấu xem có đổi màu không; sau đó thử các giới hạn chống phá ván (người xem, số tab, thư rác, gửi dồn dập).
// Cần chạy máy chủ trước: `npm run build && npx wrangler dev`.
// Cách dùng: node tools/online/check-server.mjs [địa chỉ, mặc định http://127.0.0.1:8787]
const base = process.argv[2] ?? 'http://127.0.0.1:8787'
const wsBase = base.replace(/^http/, 'ws')

function fail(message) {
  console.error('LỖI:', message)
  process.exit(1)
}

function player(id) {
  const ws = new WebSocket(`${wsBase}/api/rooms/${id}/ws`)
  const states = []
  const waiters = []
  ws.addEventListener('message', (event) => {
    if (event.data === 'pong') return
    const message = JSON.parse(event.data)
    states.push(message)
    for (const waiter of [...waiters]) if (waiter.test(message)) waiter.resolve(message)
  })
  const opened = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve)
    ws.addEventListener('error', reject)
  })
  return {
    ws,
    states,
    async send(message) {
      await opened
      ws.send(typeof message === 'string' ? message : JSON.stringify(message))
    },
    until(test, label) {
      const found = states.find(test)
      if (found) return Promise.resolve(found)
      return new Promise((resolve, reject) => {
        const waiter = { test, resolve }
        waiters.push(waiter)
        setTimeout(() => reject(new Error('chờ quá lâu: ' + label)), 5000)
      })
    },
  }
}

const newToken = (who) => who + '-' + crypto.randomUUID().replaceAll('-', '')
const hostToken = newToken('host')
const guestToken = newToken('guest')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const bad = await fetch(`${base}/api/rooms`, { method: 'POST', body: JSON.stringify({ token: 'x' }) })
if (bad.status !== 400) fail('gửi sai mà không bị từ chối: ' + bad.status)
const noControl = await fetch(`${base}/api/rooms`, { method: 'POST', body: JSON.stringify({ token: hostToken, name: 'x', color: 'w' }) })
if (noControl.status !== 400) fail('thiếu mức giờ mà không bị từ chối lịch sự: ' + noControl.status)
const huge = await fetch(`${base}/api/rooms`, { method: 'POST', body: 'x'.repeat(100_000) })
if (huge.status !== 413) fail('gửi thư quá dài mà không bị từ chối: ' + huge.status)

const created = await fetch(`${base}/api/rooms`, {
  method: 'POST',
  body: JSON.stringify({ token: hostToken, name: 'Tài', control: { minutes: 3, increment: 2 }, color: 'random' }),
})
if (created.status !== 201) fail('tạo phòng: ' + created.status + ' ' + (await created.text()))
const { id } = await created.json()
console.log('Tạo phòng', id)

const page = await fetch(`${base}/phong/${id}`, { headers: { Accept: 'text/html', 'Sec-Fetch-Mode': 'navigate' } })
if (!(await page.text()).includes('<div id="root">')) fail('mở link phòng không ra trang web')

const host = player(id)
await host.send({ t: 'hello', token: hostToken })
const waiting = await host.until((m) => m.t === 'state', 'chủ phòng nhận tình hình')
if (waiting.room.role !== 'host' || waiting.room.game !== null) fail('chủ phòng thấy sai: ' + JSON.stringify(waiting))

const guest = player(id)
await guest.send({ t: 'hello', token: guestToken })
const invite = await guest.until((m) => m.t === 'state', 'bạn bè thấy lời mời')
if (invite.room.role !== 'visitor' || invite.room.host.name !== 'Tài') fail('bạn bè thấy sai: ' + JSON.stringify(invite))
await guest.send({ t: 'join', name: 'Nam' })
const begun = await host.until((m) => m.room?.game, 'ván bắt đầu')
const hostColor = begun.room.game.you
console.log('Máy chủ bốc cho chủ phòng cầm', hostColor === 'w' ? 'Trắng' : 'Đen')

const white = hostColor === 'w' ? host : guest
const black = hostColor === 'w' ? guest : host
const moves = ['f2f3', 'e7e5', 'g2g4', 'd8h4']
for (const [ply, uci] of moves.entries()) {
  await (ply % 2 === 0 ? white : black).send({ t: 'move', uci, ply, lag: 50 })
  await host.until((m) => m.room?.game?.moves.length === ply + 1, 'nước ' + uci)
}
const mated = await guest.until((m) => m.room?.game?.status.kind === 'checkmate', 'chiếu bí')
if (mated.room.game.status.winner !== 'b') fail('sai bên thắng')
console.log('Chiếu bí, Đen thắng. Tỉ số', JSON.stringify(mated.room.game.score))

// Hết ván rồi thì không đi tiếp được: máy chủ chỉ gửi lại tình hình cũ cho người gửi.
const seen = white.states.length
await white.send({ t: 'move', uci: 'a2a3', ply: 4, lag: 0 })
const echo = await white.until((m) => white.states.indexOf(m) >= seen, 'gửi lại tình hình')
if (echo.room.game.moves.length !== 4) fail('máy chủ nhận nước đi sau khi hết ván')

await host.send({ t: 'rematch', yes: true })
await guest.send({ t: 'rematch', yes: true })
const second = await host.until((m) => m.room?.game?.number === 2, 'tái đấu')
if (second.room.game.you === hostColor) fail('tái đấu mà không đổi màu')
console.log('Tái đấu: chủ phòng đổi sang cầm', second.room.game.you === 'w' ? 'Trắng' : 'Đen')

// Thư đầu tiên `p` nhận được (thoả `test`) kể từ lúc đánh dấu `mark` = p.states.length.
const next = (p, mark, test, label) => p.until((m) => p.states.indexOf(m) >= mark && test(m), label)

// Xin đi lại ở ván 2: bị từ chối thì thôi; lượt sau xin lại, được đồng ý thì ván lùi một nước, thời gian nghĩ cũng lùi theo.
const white2 = second.room.game.you === 'w' ? host : guest
const black2 = white2 === host ? guest : host
let mark = black2.states.length
await white2.send({ t: 'move', uci: 'e2e4', ply: 0, lag: 0 })
await next(black2, mark, (m) => m.room?.game?.moves.length === 1, 'ván 2 nước đầu')
mark = black2.states.length
await white2.send({ t: 'takeback', yes: true })
await next(black2, mark, (m) => m.room?.game?.takeback === 'w', 'thấy lời xin đi lại')
mark = white2.states.length
await black2.send({ t: 'takeback', yes: false })
await next(white2, mark, (m) => m.room?.game?.takebackDeclined === 'w', 'bị từ chối cho đi lại')
mark = white2.states.length
await black2.send({ t: 'move', uci: 'e7e5', ply: 1, lag: 0 })
await next(white2, mark, (m) => m.room?.game?.moves.length === 2, 'ván 2 nước thứ hai')
mark = black2.states.length
await white2.send({ t: 'move', uci: 'g1f3', ply: 2, lag: 0 })
await next(black2, mark, (m) => m.room?.game?.moves.length === 3, 'ván 2 nước thứ ba')
mark = black2.states.length
await white2.send({ t: 'takeback', yes: true })
await next(black2, mark, (m) => m.room?.game?.takeback === 'w', 'thấy lời xin đi lại lần hai')
mark = white2.states.length
await black2.send({ t: 'takeback', yes: true })
const undone = await next(white2, mark, (m) => m.room?.game?.moves.length === 2, 'ván lùi lại')
const { moves: kept, moveTimes } = undone.room.game
if (kept.join(' ') !== 'e2e4 e7e5' || moveTimes.length !== 2 || moveTimes[0] !== null || typeof moveTimes[1] !== 'number')
  fail('đi lại sai: ' + JSON.stringify(undone.room.game))
console.log('Xin đi lại: từ chối được, đồng ý thì ván lùi lại; thời gian nghĩ', JSON.stringify(moveTimes))

// Hết ván 2, chủ phòng mời đấu tiếp, bạn bè từ chối: lời mời mất, chủ phòng không mời lại được nữa.
mark = host.states.length
await white2.send({ t: 'resign' })
await next(host, mark, (m) => m.room?.game?.status.kind === 'resign', 'ván 2 hết')
const hostColor2 = second.room.game.you
mark = host.states.length
const guestMark = guest.states.length
await host.send({ t: 'rematch', yes: true })
await next(guest, guestMark, (m) => m.room?.game?.rematch?.[hostColor2] === true, 'bạn bè thấy lời mời đấu tiếp')
await guest.send({ t: 'rematch', yes: false })
await next(host, mark, (m) => m.room?.game?.rematchDeclined === hostColor2, 'chủ phòng thấy bị từ chối')
mark = host.states.length
await host.send({ t: 'rematch', yes: true })
const refused = await next(host, mark, (m) => m.t === 'state', 'mời lại sau khi bị từ chối')
if (refused.room.game.number !== 2 || refused.room.game.rematch[hostColor2]) fail('bị từ chối rồi mà vẫn mời lại được')
console.log('Từ chối đấu ván nữa: lời mời mất, người mời không mời lại được')

// Ping thì máy chủ tự trả pong.
const pong = new Promise((resolve) => host.ws.addEventListener('message', (e) => e.data === 'pong' && resolve()))
await host.send('ping')
await Promise.race([pong, new Promise((_, reject) => setTimeout(() => reject(new Error('không có pong')), 3000))])
console.log('Ping → pong: được')

// Bạn bè rời đi thì chủ phòng thấy chấm online tắt.
guest.ws.close()
const guestColor = second.room.game.you === 'w' ? 'b' : 'w'
await host.until((m) => m.room?.game?.number === 2 && !m.room.game.players[guestColor].online, 'thấy bạn bè rời phòng')
console.log('Bạn bè rời phòng: chủ phòng thấy ngay')

const ghost = player('abcdefgh')
const missing = await ghost.until((m) => m.t === 'error', 'phòng không tồn tại')
if (missing.code !== 'not-found') fail('phòng không có mà không báo')
console.log('Phòng không tồn tại: báo đúng')

host.ws.close()

// Các giới hạn chống phá ván, trong một phòng mới không tính giờ.
const limitsHost = newToken('host')
const limitsGuest = newToken('guest')
const limitsRoom = await fetch(`${base}/api/rooms`, {
  method: 'POST',
  body: JSON.stringify({ token: limitsHost, name: 'Tài', control: null, color: 'w' }),
})
const room2 = (await limitsRoom.json()).id
const a = player(room2)
await a.send({ t: 'hello', token: limitsHost })
const b = player(room2)
await b.send({ t: 'hello', token: limitsGuest })
await b.send({ t: 'join', name: 'Nam' })
await a.until((m) => m.room?.game, 'ván ở phòng thử giới hạn bắt đầu')

// Thư rác (không phải thư, mã máy dài 50.000 ký tự, thư quá dài) thì bị bỏ qua, phòng vẫn chạy.
for (const junk of ['null', '[]', JSON.stringify({ t: 'hello', token: 'A'.repeat(50_000) }), 'x'.repeat(5000)]) await a.send(junk)
await a.send({ t: 'move', uci: 'e2e4', ply: 0, lag: 0 })
await b.until((m) => m.room?.game?.moves.length === 1, 'phòng vẫn chạy sau thư rác')
await a.until((m) => m.room?.game?.moves.length === 1, 'chủ phòng thấy nước vừa đi')
console.log('Thư rác: bị bỏ qua, phòng vẫn chạy')

// Chào lại lần nữa trên cùng đường dây thì máy chủ không gửi gì thêm cho ai.
const before = a.states.length + b.states.length
await a.send({ t: 'hello', token: limitsHost })
await sleep(500)
if (a.states.length + b.states.length !== before) fail('chào lại mà máy chủ vẫn báo cho cả phòng')
console.log('Chào lại: bị bỏ qua')

// Gửi dồn dập 60 nước đi sai: máy chủ chỉ trả lời khoảng 20 thư đầu, phần còn lại bị bỏ.
const replies = b.states.length
for (let i = 0; i < 60; i++) await b.send({ t: 'move', uci: 'a7a1', ply: 1, lag: 0 })
await sleep(800)
const answered = b.states.length - replies
if (answered > 25) fail('gửi dồn dập mà máy chủ trả lời ' + answered + ' thư')
console.log('Gửi dồn dập 60 thư: máy chủ chỉ trả lời', answered)

// Người xem: đủ chỗ thì người tới sau thấy "đủ người xem"; người chơi thì lúc nào cũng vào được.
const MAX_VISITORS = 8
const crowd = []
for (let i = 0; i < MAX_VISITORS; i++) {
  const visitor = player(room2)
  await visitor.send({ t: 'hello', token: newToken('viewer') })
  await visitor.until((m) => m.t === 'state', 'người xem thứ ' + (i + 1) + ' vào được')
  crowd.push(visitor)
}
const late = player(room2)
await late.send({ t: 'hello', token: newToken('viewer') })
const full = await late.until((m) => m.t === 'error', 'người xem thứ 9 bị từ chối')
if (full.code !== 'full') fail('người xem thứ 9 nhận sai thư: ' + JSON.stringify(full))
const back = player(room2)
await back.send({ t: 'hello', token: limitsGuest })
const seated = await back.until((m) => m.t === 'state', 'người chơi vẫn vào được khi đủ người xem')
if (seated.room.role !== 'guest') fail('người chơi vào lại mà thành vai ' + seated.room.role)
console.log(`Đủ ${MAX_VISITORS} người xem: người thứ 9 thấy "đủ người xem", người chơi vẫn vào được`)

// Một người chơi mở tới tab thứ 5 thì tab cũ nhất bị ngắt (máy chủ giữ tối đa 4 tab mỗi người).
const tabs = []
for (let i = 0; i < 4; i++) {
  const tab = player(room2)
  await tab.send({ t: 'hello', token: limitsHost })
  await tab.until((m) => m.t === 'state', 'tab thứ ' + (i + 2) + ' của chủ phòng')
  tabs.push(tab)
}
const replaced = await a.until((m) => m.t === 'error', 'tab cũ nhất bị ngắt')
if (replaced.code !== 'replaced') fail('tab cũ nhất nhận sai thư: ' + JSON.stringify(replaced))
console.log('Tab thứ 5 của một người: tab cũ nhất bị ngắt')

for (const c of [a, b, back, late, ...crowd, ...tabs]) c.ws.close()
console.log('XONG: máy chủ chạy đúng')
process.exit(0)
