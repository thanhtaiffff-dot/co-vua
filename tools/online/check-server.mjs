// Kiểm tra máy chủ phòng chạy thật: tạo phòng, hai "người chơi" nối WebSocket, đi một ván chiếu bí nhanh,
// rồi tái đấu xem có đổi màu không. Cần chạy máy chủ trước: `npm run build && npx wrangler dev`.
// Cách dùng: node tools/online/check-server.mjs [địa chỉ, mặc định http://127.0.0.1:8787]
const base = process.argv[2] ?? 'http://127.0.0.1:8787'
const wsBase = base.replace(/^http/, 'ws')

function fail(message) {
  console.error('LỖI:', message)
  process.exit(1)
}

function player(id, token) {
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

const hostToken = 'host-' + crypto.randomUUID().replaceAll('-', '')
const guestToken = 'guest-' + crypto.randomUUID().replaceAll('-', '')

const bad = await fetch(`${base}/api/rooms`, { method: 'POST', body: JSON.stringify({ token: 'x' }) })
if (bad.status !== 400) fail('gửi sai mà không bị từ chối: ' + bad.status)

const created = await fetch(`${base}/api/rooms`, {
  method: 'POST',
  body: JSON.stringify({ token: hostToken, name: 'Tài', control: { minutes: 3, increment: 2 }, color: 'random' }),
})
if (created.status !== 201) fail('tạo phòng: ' + created.status + ' ' + (await created.text()))
const { id } = await created.json()
console.log('Tạo phòng', id)

const page = await fetch(`${base}/phong/${id}`, { headers: { Accept: 'text/html', 'Sec-Fetch-Mode': 'navigate' } })
if (!(await page.text()).includes('<div id="root">')) fail('mở link phòng không ra trang web')

const host = player(id, hostToken)
await host.send({ t: 'hello', token: hostToken })
const waiting = await host.until((m) => m.t === 'state', 'chủ phòng nhận tình hình')
if (waiting.room.role !== 'host' || waiting.room.game !== null) fail('chủ phòng thấy sai: ' + JSON.stringify(waiting))

const guest = player(id, guestToken)
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

const ghost = player('abcdefgh', hostToken)
const missing = await ghost.until((m) => m.t === 'error', 'phòng không tồn tại')
if (missing.code !== 'not-found') fail('phòng không có mà không báo')
console.log('Phòng không tồn tại: báo đúng')

host.ws.close()
console.log('XONG: máy chủ chạy đúng')
process.exit(0)
