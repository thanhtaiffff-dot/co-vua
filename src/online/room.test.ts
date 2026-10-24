import { describe, expect, it } from 'vitest'
import {
  LAG_QUOTA_GAIN,
  chat,
  chatOf,
  cleanChat,
  LAG_QUOTA_MAX,
  LAG_QUOTA_START,
  checkFlag,
  cleanName,
  createRoom,
  flagDue,
  handle,
  parseClientMessage,
  parseCreateRequest,
  upgradeRoom,
  view,
  viewsOf,
  type RoomData,
} from './room'
import { CHAT_BURST, CHAT_KEEP, CHAT_LIMIT, ROOM_ID, fromUci, newRoomId, toUci, type ClientMessage, type ColorChoice } from './protocol'

const HOST = 'host-token-aaaaaaaaaaaa'
const GUEST = 'guest-token-bbbbbbbbbbb'
const BOTH: [boolean, boolean] = [true, true]

function room(color: ColorChoice = 'w', control: { minutes: number; increment: number } | null = { minutes: 3, increment: 2 }): RoomData {
  return createRoom('abcd2345', { token: HOST, name: 'Tài', control, color }, 0)
}

// Phòng đã có bạn bè vào: chủ phòng cầm Trắng (trừ khi chọn khác).
function started(color: ColorChoice = 'w', control?: { minutes: number; increment: number } | null): RoomData {
  const r = room(color, control)
  handle(r, GUEST, { t: 'join', name: 'Nam' }, 0, () => 0.9)
  return r
}

function send(r: RoomData, token: string, message: ClientMessage, now = 0): boolean {
  return handle(r, token, message, now, () => 0)
}

// Đi lần lượt các nước `ucis`, Trắng là chủ phòng; nước thứ i đi lúc `times[i]`.
function play(r: RoomData, ucis: string[], times: number[] = []): void {
  const white = r.game!.white === 0 ? HOST : GUEST
  const black = white === HOST ? GUEST : HOST
  for (const [i, uci] of ucis.entries()) {
    const ply = r.game!.moves.length
    expect(send(r, ply % 2 === 0 ? white : black, { t: 'move', uci, ply, lag: 0 }, times[i] ?? 0)).toBe(true)
  }
}

describe('tạo phòng', () => {
  it('chỉ nhận mức giờ có sẵn, màu hợp lệ và mã máy đúng dạng', () => {
    const ok = { token: HOST, name: '  Tài  ', control: { minutes: 5, increment: 0 }, color: 'random' }
    expect(parseCreateRequest(ok)).toEqual({ ...ok, name: 'Tài' })
    expect(parseCreateRequest({ ...ok, control: null })?.control).toBeNull()
    expect(parseCreateRequest({ ...ok, control: { minutes: 7, increment: 0 } })).toBeNull()
    expect(parseCreateRequest({ ...ok, color: 'red' })).toBeNull()
    expect(parseCreateRequest({ ...ok, token: 'ngắn' })).toBeNull()
    expect(parseCreateRequest('rác')).toBeNull()
  })

  it('thiếu hoặc sai kiểu ô mức giờ thì từ chối, không làm máy chủ báo lỗi', () => {
    const { control: _, ...missing } = { token: HOST, name: 'Tài', control: null, color: 'w' }
    expect(parseCreateRequest(missing)).toBeNull()
    expect(parseCreateRequest({ ...missing, control: '5+0' })).toBeNull()
    expect(parseCreateRequest({ ...missing, control: { minutes: '5', increment: 0 } })).toBeNull()
  })

  it('tên được làm gọn, tối đa 20 ký tự, không cắt đôi chữ có dấu', () => {
    expect(cleanName('  Nguyễn \n Thành   Tài ')).toBe('Nguyễn Thành Tài')
    expect(cleanName('Ê'.repeat(30))).toBe('Ê'.repeat(20))
    expect(cleanName(42)).toBe('')
  })

  it('mã phòng 8 ký tự, không có chữ dễ nhầm', () => {
    const id = newRoomId((n) => Uint8Array.from({ length: n }, (_, i) => i * 37))
    expect(id).toMatch(ROOM_ID)
    expect('abcd2345').toMatch(ROOM_ID)
    expect('abcd2340').not.toMatch(ROOM_ID)
  })

  it('đổi qua lại giữa nước đi và chữ "e2e4"', () => {
    expect(fromUci('e7e8q')).toEqual({ from: 'e7', to: 'e8', promotion: 'q' })
    expect(toUci({ from: 'g1', to: 'f3' })).toBe('g1f3')
    expect(fromUci('e2e9')).toBeNull()
  })
})

describe('vào phòng và chọn màu', () => {
  it('chưa có bạn bè thì chưa có ván; người lạ mở link thấy lời mời', () => {
    const r = room()
    const host = view(r, HOST, 0, [true, false])
    expect(host.role).toBe('host')
    expect(host.game).toBeNull()
    expect(view(r, GUEST, 0, [true, false]).role).toBe('visitor')
  })

  it('chủ phòng chọn Đen thì bạn bè cầm Trắng', () => {
    const r = started('b')
    expect(view(r, HOST, 0, BOTH).game?.you).toBe('b')
    expect(view(r, GUEST, 0, BOTH).game?.you).toBe('w')
  })

  it('ngẫu nhiên thì máy chủ bốc lúc bạn bè vào', () => {
    const heads = room('random')
    handle(heads, GUEST, { t: 'join', name: 'Nam' }, 0, () => 0.1)
    expect(view(heads, HOST, 0, BOTH).game?.you).toBe('w')
    const tails = room('random')
    handle(tails, GUEST, { t: 'join', name: 'Nam' }, 0, () => 0.7)
    expect(view(tails, HOST, 0, BOTH).game?.you).toBe('b')
  })

  it('phòng đủ hai người thì người thứ ba chỉ được xem', () => {
    const r = started()
    expect(send(r, 'third-token-cccccccccc', { t: 'join', name: 'Lan' })).toBe(false)
    const seen = view(r, 'third-token-cccccccccc', 0, BOTH)
    expect(seen.role).toBe('visitor')
    expect(seen.game?.you).toBeNull()
    expect(seen.game?.players).toEqual({ w: { name: 'Tài', online: true, chatOff: false }, b: { name: 'Nam', online: true, chatOff: false } })
    expect(JSON.stringify(seen)).not.toContain(HOST)
  })
})

describe('đi quân', () => {
  it('chỉ nhận nước hợp lệ, đúng lượt, đúng thứ tự', () => {
    const r = started()
    expect(send(r, GUEST, { t: 'move', uci: 'e7e5', ply: 0, lag: 0 })).toBe(false) // chưa tới lượt Đen
    expect(send(r, HOST, { t: 'move', uci: 'e2e5', ply: 0, lag: 0 })).toBe(false) // đi sai luật
    expect(send(r, HOST, { t: 'move', uci: 'e2e4', ply: 0, lag: 0 })).toBe(true)
    expect(send(r, HOST, { t: 'move', uci: 'e2e4', ply: 0, lag: 0 })).toBe(false) // gửi lại lần nữa
    expect(send(r, GUEST, { t: 'move', uci: 'e7e5', ply: 0, lag: 0 })).toBe(false) // nhầm số thứ tự nước
    expect(send(r, 'third-token-cccccccccc', { t: 'move', uci: 'e7e5', ply: 1, lag: 0 })).toBe(false)
    expect(view(r, HOST, 0, BOTH).game?.moves).toEqual(['e2e4'])
  })

  it('phong cấp ghi rõ quân được chọn', () => {
    const r = started()
    play(r, ['a2a4', 'h7h5', 'a4a5', 'h5h4', 'a5a6', 'h4h3', 'a6b7', 'h3g2', 'b7a8n'])
    expect(view(r, HOST, 0, BOTH).game?.moves.at(-1)).toBe('b7a8n')
  })

  it('chiếu bí thì hết ván, cộng tỉ số cho bên thắng', () => {
    const r = started()
    play(r, ['f2f3', 'e7e5', 'g2g4', 'd8h4'])
    const game = view(r, HOST, 0, BOTH).game!
    expect(game.status).toEqual({ kind: 'checkmate', winner: 'b' })
    expect(game.score).toEqual({ w: 0, b: 1 })
    expect(send(r, HOST, { t: 'move', uci: 'a2a3', ply: 4, lag: 0 })).toBe(false)
  })
})

describe('đồng hồ trên máy chủ', () => {
  it('chạy từ nước đầu của Trắng; trừ thời gian nghĩ, trả lại thời gian đường truyền, cộng giờ thưởng', () => {
    const r = started()
    send(r, HOST, { t: 'move', uci: 'e2e4', ply: 0, lag: 0 }, 1_000)
    let clock = view(r, HOST, 6_000, BOTH).game!.clock!
    expect(clock).toEqual({ control: { minutes: 3, increment: 2 }, times: { w: 180_000, b: 175_000 }, running: 'b' })
    send(r, GUEST, { t: 'move', uci: 'e7e5', ply: 1, lag: 400 }, 11_000) // nghĩ 10 giây, mạng mất 0,4 giây
    clock = view(r, HOST, 11_000, BOTH).game!.clock!
    expect(clock.times).toEqual({ w: 180_000, b: 172_400 })
    expect(clock.running).toBe('w')
  })

  it('thời gian đường truyền được trả lại có giới hạn: không quá quỹ bù giờ', () => {
    const r = started()
    play(r, ['e2e4'], [0])
    send(r, GUEST, { t: 'move', uci: 'e7e5', ply: 1, lag: 60_000 }, 10_000)
    expect(view(r, HOST, 10_000, BOTH).game!.clock!.times.b).toBe(180_000 - 10_000 + LAG_QUOTA_START + 2_000)
    expect(r.game!.lagQuota).toEqual([LAG_QUOTA_START, LAG_QUOTA_GAIN]) // quỹ của Đen dùng hết, nạp lại một nước
  })

  // Ván 1 phút, Trắng (chủ phòng) và Đen mỗi bên nghĩ đúng 1 giây mỗi nước: nước thứ `i` đi lúc `i` giây.
  // Đen khai mạng chậm `lag` mili giây ở mọi nước. Trả về thời gian còn lại của hai bên sau 8 nước mỗi bên.
  function eightMovesEach(lag: (i: number) => number) {
    const r = started('w', { minutes: 1, increment: 0 })
    const moves = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'd2d3', 'd7d6', 'b1c3', 'g8f6', 'c1g5', 'c8g4', 'h2h3', 'h7h6', 'a2a3', 'a7a6']
    for (const [i, uci] of moves.entries()) {
      const white = i % 2 === 0
      expect(send(r, white ? HOST : GUEST, { t: 'move', uci, ply: i, lag: white ? 0 : lag(i) }, i * 1000)).toBe(true)
    }
    return { times: view(r, HOST, (moves.length - 1) * 1000, BOTH).game!.clock!.times, room: r }
  }

  it('khai gian mạng chậm 1 giây mỗi nước thì chỉ lời được phần quỹ, không đứng yên đồng hồ', () => {
    const { times } = eightMovesEach(() => 1000)
    expect(times.w).toBe(60_000 - 7 * 1000) // nước đầu của Trắng không tính giờ
    // Đen nghĩ 8 giây, được bù quỹ đầu rồi mỗi nước sau một phần nạp thêm (bản cũ bù đủ 8 giây, đồng hồ Đen đứng yên).
    expect(times.b).toBe(60_000 - 8 * 1000 + LAG_QUOTA_START + 7 * LAG_QUOTA_GAIN)
  })

  it('mạng chậm thật (dưới mức nạp mỗi nước) thì nước nào cũng được bù đủ', () => {
    const { times, room: r } = eightMovesEach(() => 200)
    expect(times.b).toBe(60_000 - 8 * (1000 - 200))
    expect(r.game!.lagQuota[1]).toBe(Math.min(LAG_QUOTA_MAX, LAG_QUOTA_START + 8 * (LAG_QUOTA_GAIN - 200)))
  })

  it('mạng giật một lần (2 giây) sau nhiều nước bình thường thì quỹ vẫn đủ bù', () => {
    const { times } = eightMovesEach((i) => (i === 15 ? 2000 : 0))
    // Tới nước cuối, quỹ của Đen đã đầy (LAG_QUOTA_MAX = 2,1 giây) nên được bù đủ 2 giây ở nước đó. Nghĩ thật 1 giây,
    // khai 2 giây thì phần bù không quá thời gian đã trôi: đồng hồ Đen không bị cộng ngược.
    expect(LAG_QUOTA_MAX).toBeGreaterThanOrEqual(2000)
    expect(times.b).toBe(60_000 - 7 * 1000)
  })

  it('chờ thêm trước khi xử hết giờ cũng chỉ trong phạm vi quỹ', () => {
    const r = started('w', { minutes: 1, increment: 0 })
    play(r, ['e2e4'], [0])
    send(r, GUEST, { t: 'move', uci: 'e7e5', ply: 1, lag: 60_000 }, 1_000) // Đen dùng hết quỹ đầu
    send(r, HOST, { t: 'move', uci: 'g1f3', ply: 2, lag: 0 }, 2_000)
    // Tới lượt Đen từ 2 giây. Đen còn 60 - 1 + 0,9 = 59,9 giây; khai mạng chậm 60 giây nhưng quỹ chỉ còn 0,3 giây.
    expect(flagDue(r)).toBe(2_000 + 59_900 + LAG_QUOTA_GAIN)
  })

  it('ván đang chơi dở từ bản trước (chưa có quỹ) thì được cấp quỹ đầu', () => {
    const r = started()
    play(r, ['e2e4'], [0])
    const old = JSON.parse(JSON.stringify(r)) as RoomData
    delete (old.game as Partial<NonNullable<RoomData['game']>>).lagQuota
    expect(upgradeRoom(old).game!.lagQuota).toEqual([LAG_QUOTA_START, LAG_QUOTA_START])
    expect(send(old, GUEST, { t: 'move', uci: 'e7e5', ply: 1, lag: 100 }, 5_000)).toBe(true)
  })

  it('hết giờ: máy chủ tự xử thua, chờ thêm thời gian đường truyền của người đó', () => {
    const r = started('w', { minutes: 1, increment: 0 })
    play(r, ['e2e4'], [0])
    send(r, GUEST, { t: 'move', uci: 'e7e5', ply: 1, lag: 300 }, 1_000)
    // Trắng đã đi nước đầu lúc 0; tới lượt Trắng từ lúc 1 giây, còn 60 giây. Đường truyền của Trắng là 0.
    expect(flagDue(r)).toBe(61_000)
    expect(checkFlag(r, 60_999)).toBe(false)
    expect(checkFlag(r, 61_000)).toBe(true)
    const game = view(r, GUEST, 70_000, BOTH).game!
    expect(game.status).toEqual({ kind: 'timeout', winner: 'b' })
    expect(game.clock).toEqual({ control: { minutes: 1, increment: 0 }, times: { w: 0, b: 59_300 }, running: null })
    expect(game.score).toEqual({ w: 0, b: 1 })
    expect(flagDue(r)).toBeNull()
  })

  it('nước đi tới sau khi đồng hồ về 0 thì không nhận, xử hết giờ', () => {
    const r = started('w', { minutes: 1, increment: 0 })
    play(r, ['e2e4'], [0])
    expect(send(r, GUEST, { t: 'move', uci: 'e7e5', ply: 1, lag: 200 }, 60_300)).toBe(true)
    const game = view(r, HOST, 60_300, BOTH).game!
    expect(game.moves).toEqual(['e2e4'])
    expect(game.status).toEqual({ kind: 'timeout', winner: 'w' })
  })

  it('đi trước (premove) tới ngay sau nước của đối thủ thì gần như không mất giờ', () => {
    const r = started('w', { minutes: 1, increment: 0 })
    play(r, ['e2e4', 'e7e5'], [0, 5_000])
    send(r, HOST, { t: 'move', uci: 'g1f3', ply: 2, lag: 150 }, 5_150)
    expect(view(r, HOST, 5_150, BOTH).game!.clock!.times.w).toBe(60_000)
  })

  it('không tính giờ thì không có đồng hồ, không ai hết giờ', () => {
    const r = started('w', null)
    play(r, ['e2e4', 'e7e5'], [0, 99_999_999])
    expect(view(r, HOST, 0, BOTH).game!.clock).toBeNull()
    expect(flagDue(r)).toBeNull()
  })
})

describe('thư gửi lên máy chủ', () => {
  it('đọc đúng các loại thư hợp lệ', () => {
    expect(parseClientMessage(JSON.stringify({ t: 'hello', token: HOST }))).toEqual({ t: 'hello', token: HOST })
    expect(parseClientMessage('{"t":"join","name":"Nam"}')).toEqual({ t: 'join', name: 'Nam' })
    expect(parseClientMessage('{"t":"move","uci":"e7e8q","ply":3,"lag":120}')).toEqual({ t: 'move', uci: 'e7e8q', ply: 3, lag: 120 })
    expect(parseClientMessage('{"t":"move","uci":"e2e4","ply":0}')).toEqual({ t: 'move', uci: 'e2e4', ply: 0, lag: 0 })
    expect(parseClientMessage('{"t":"resign"}')).toEqual({ t: 'resign' })
    expect(parseClientMessage('{"t":"draw","yes":false}')).toEqual({ t: 'draw', yes: false })
    expect(parseClientMessage('{"t":"rematch","yes":true}')).toEqual({ t: 'rematch', yes: true })
    expect(parseClientMessage('{"t":"takeback","yes":false}')).toEqual({ t: 'takeback', yes: false })
  })

  it('thư rác thì bỏ qua, không làm máy chủ báo lỗi', () => {
    for (const junk of ['null', '42', '"hello"', '[]', '{}', 'không phải JSON', '{"t":"fly"}', '{"t":"draw","yes":"có"}', '{"t":"takeback"}']) {
      expect(parseClientMessage(junk)).toBeNull()
    }
    expect(parseClientMessage(JSON.stringify({ t: 'hello', token: 'A'.repeat(50_000) }))).toBeNull()
    expect(parseClientMessage('{"t":"hello"}')).toBeNull()
    expect(parseClientMessage('{"t":"move","uci":"e2e9","ply":0,"lag":0}')).toBeNull()
    expect(parseClientMessage('{"t":"move","uci":"e2e4","ply":0.5,"lag":0}')).toBeNull()
    expect(parseClientMessage(JSON.stringify({ t: 'join', name: 'x'.repeat(1000) }))).toBeNull()
  })
})

describe('báo tình hình cho cả phòng', () => {
  it('soạn phần chung một lần, mỗi vai chỉ khác "mình là ai"', () => {
    const r = started('b')
    play(r, ['e2e4', 'e7e5'], [0, 1_000])
    const views = viewsOf(r, 2_000, BOTH)
    expect(views(0)).toEqual(view(r, HOST, 2_000, BOTH))
    expect(views(1)).toEqual(view(r, GUEST, 2_000, BOTH))
    expect(views(null)).toEqual(view(r, 'third-token-cccccccccc', 2_000, BOTH))
    expect([views(0).role, views(1).role, views(null).role]).toEqual(['host', 'guest', 'visitor'])
    expect([views(0).game?.you, views(1).game?.you, views(null).game?.you]).toEqual(['b', 'w', null])
  })
})

describe('đầu hàng, xin hòa, tái đấu', () => {
  it('chưa ai đi quá một nước thì bấm thôi là huỷ ván, không tính tỉ số', () => {
    const r = started()
    play(r, ['e2e4'])
    send(r, GUEST, { t: 'resign' })
    const game = view(r, HOST, 0, BOTH).game!
    expect(game.status).toEqual({ kind: 'aborted' })
    expect(game.score).toEqual({ w: 0, b: 0 })
  })

  it('đầu hàng thì đối thủ thắng', () => {
    const r = started()
    play(r, ['e2e4', 'e7e5'])
    send(r, HOST, { t: 'resign' })
    expect(view(r, HOST, 0, BOTH).game!.status).toEqual({ kind: 'resign', winner: 'b' })
  })

  it('xin hòa: đối thủ đồng ý thì hòa, mỗi bên nửa điểm', () => {
    const r = started()
    play(r, ['e2e4', 'e7e5'])
    send(r, HOST, { t: 'draw', yes: true })
    expect(view(r, GUEST, 0, BOTH).game!.drawOffer).toBe('w')
    send(r, GUEST, { t: 'draw', yes: true })
    const game = view(r, GUEST, 0, BOTH).game!
    expect(game.status).toEqual({ kind: 'agreed' })
    expect(game.score).toEqual({ w: 0.5, b: 0.5 })
  })

  it('đối thủ từ chối, hoặc đi tiếp thay vì trả lời, thì lời xin hòa mất', () => {
    const r = started()
    play(r, ['e2e4', 'e7e5'])
    send(r, HOST, { t: 'draw', yes: true })
    send(r, GUEST, { t: 'draw', yes: false })
    expect(view(r, GUEST, 0, BOTH).game!.drawOffer).toBeNull()
    send(r, HOST, { t: 'draw', yes: true })
    play(r, ['g1f3']) // chính người xin đi tiếp: lời xin vẫn còn
    expect(view(r, GUEST, 0, BOTH).game!.drawOffer).toBe('w')
    play(r, ['b8c6'])
    expect(view(r, GUEST, 0, BOTH).game!.drawOffer).toBeNull()
  })

  it('tái đấu: cả hai đồng ý thì ván mới đổi màu, tỉ số cộng dồn', () => {
    const r = started()
    play(r, ['f2f3', 'e7e5', 'g2g4', 'd8h4'])
    expect(send(r, HOST, { t: 'rematch', yes: true })).toBe(true)
    expect(view(r, GUEST, 0, BOTH).game!.rematch).toEqual({ w: true, b: false })
    send(r, GUEST, { t: 'rematch', yes: true })
    const game = view(r, HOST, 0, BOTH).game!
    expect(game.number).toBe(2)
    expect(game.you).toBe('b')
    expect(game.moves).toEqual([])
    expect(game.score).toEqual({ w: 1, b: 0 }) // Nam thắng ván 1, giờ Nam cầm Trắng
    expect(game.clock?.times).toEqual({ w: 180_000, b: 180_000 })
  })

  it('đang chơi thì không tái đấu được; rút lời mời tái đấu được', () => {
    const r = started()
    expect(send(r, HOST, { t: 'rematch', yes: true })).toBe(false)
    send(r, HOST, { t: 'resign' })
    send(r, HOST, { t: 'rematch', yes: true })
    send(r, HOST, { t: 'rematch', yes: false })
    expect(view(r, GUEST, 0, BOTH).game!.rematch).toEqual({ w: false, b: false })
  })
})

describe('xin đi lại', () => {
  it('vừa đi xong thì xin lùi nước đó; đối thủ cho thì ván và đồng hồ quay về như trước nước đó', () => {
    const r = started()
    play(r, ['e2e4', 'e7e5', 'g1f3'], [0, 10_000, 15_000])
    expect(send(r, HOST, { t: 'takeback', yes: true }, 16_000)).toBe(true)
    expect(view(r, GUEST, 16_000, BOTH).game!.takeback).toBe('w')
    expect(send(r, GUEST, { t: 'takeback', yes: true }, 17_000)).toBe(true)
    const game = view(r, HOST, 17_000, BOTH).game!
    expect(game.moves).toEqual(['e2e4', 'e7e5'])
    expect(game.moveTimes).toEqual([null, 10_000])
    // Đồng hồ như ngay sau nước của Đen, rồi Trắng nghĩ lại nước đó từ lúc được đi lại.
    expect(game.clock).toEqual({ control: { minutes: 3, increment: 2 }, times: { w: 180_000, b: 172_000 }, running: 'w' })
    expect(view(r, HOST, 20_000, BOTH).game!.clock!.times.w).toBe(177_000)
    expect(game.takeback).toBeNull()
  })

  it('đang tới lượt mình mà xin thì lùi cả nước đối thủ vừa đi lẫn nước trước đó của mình', () => {
    const r = started()
    play(r, ['e2e4', 'e7e5', 'g1f3', 'b8c6'])
    send(r, HOST, { t: 'takeback', yes: true })
    send(r, GUEST, { t: 'takeback', yes: true })
    expect(view(r, HOST, 0, BOTH).game!.moves).toEqual(['e2e4', 'e7e5'])
  })

  it('không cho, hay đi tiếp thay vì trả lời, thì lời xin mất; mỗi lượt chỉ xin một lần', () => {
    const r = started()
    play(r, ['e2e4', 'e7e5', 'g1f3'])
    send(r, HOST, { t: 'takeback', yes: true })
    expect(send(r, GUEST, { t: 'takeback', yes: false })).toBe(true)
    let game = view(r, HOST, 0, BOTH).game!
    expect([game.takeback, game.takebackDeclined, game.moves.length]).toEqual([null, 'w', 3])
    expect(game.takebackAsked).toEqual({ w: true, b: false })
    expect(send(r, HOST, { t: 'takeback', yes: true })).toBe(false) // bị từ chối rồi thì thôi, khỏi xin dồn dập
    play(r, ['b8c6'])
    game = view(r, HOST, 0, BOTH).game!
    expect([game.takebackDeclined, game.takebackAsked]).toEqual([null, { w: false, b: false }])
    // Nước mới đi rồi thì được xin lại; đối thủ đi tiếp thay vì trả lời thì lời xin mất.
    expect(send(r, GUEST, { t: 'takeback', yes: true })).toBe(true)
    play(r, ['f1c4'])
    expect(view(r, HOST, 0, BOTH).game!.takeback).toBeNull()
    expect(view(r, HOST, 0, BOTH).game!.moves.length).toBe(5)
  })

  it('rút lời xin được, nhưng lượt đó không xin lại được nữa', () => {
    const r = started()
    play(r, ['e2e4'])
    send(r, HOST, { t: 'takeback', yes: true })
    expect(send(r, HOST, { t: 'takeback', yes: false })).toBe(true)
    const game = view(r, GUEST, 0, BOTH).game!
    expect([game.takeback, game.takebackDeclined]).toEqual([null, null])
    expect(send(r, HOST, { t: 'takeback', yes: true })).toBe(false)
  })

  it('chưa có nước của mình để lùi, người xem, hay ván đã hết thì không xin được', () => {
    const r = started()
    play(r, ['e2e4'])
    expect(send(r, GUEST, { t: 'takeback', yes: true })).toBe(false) // Đen chưa đi nước nào
    expect(send(r, 'third-token-cccccccccc', { t: 'takeback', yes: true })).toBe(false)
    expect(send(r, GUEST, { t: 'takeback', yes: false })).toBe(false) // không có lời xin nào để từ chối
    play(r, ['e7e5'])
    send(r, HOST, { t: 'resign' })
    expect(send(r, HOST, { t: 'takeback', yes: true })).toBe(false)
  })

  it('ván lùi lại thì lời xin hòa đang chờ cũng thôi', () => {
    const r = started()
    play(r, ['e2e4', 'e7e5', 'g1f3'])
    send(r, HOST, { t: 'draw', yes: true })
    send(r, HOST, { t: 'takeback', yes: true })
    send(r, GUEST, { t: 'takeback', yes: true })
    expect(view(r, GUEST, 0, BOTH).game!.drawOffer).toBeNull()
  })
})

describe('đấu ván nữa: từ chối', () => {
  function finished(): RoomData {
    const r = started()
    play(r, ['f2f3', 'e7e5', 'g2g4', 'd8h4'])
    return r
  }

  it('bên kia từ chối thì lời mời mất, người mời không mời lại được nữa', () => {
    const r = finished()
    send(r, HOST, { t: 'rematch', yes: true })
    expect(send(r, GUEST, { t: 'rematch', yes: false })).toBe(true)
    const game = view(r, HOST, 0, BOTH).game!
    expect(game.rematch).toEqual({ w: false, b: false })
    expect(game.rematchDeclined).toBe('w')
    expect(game.number).toBe(1)
    expect(send(r, HOST, { t: 'rematch', yes: true })).toBe(false)
  })

  it('người đã từ chối đổi ý mời lại thì vẫn đấu tiếp được', () => {
    const r = finished()
    send(r, HOST, { t: 'rematch', yes: true })
    send(r, GUEST, { t: 'rematch', yes: false })
    expect(send(r, GUEST, { t: 'rematch', yes: true })).toBe(true)
    expect(view(r, HOST, 0, BOTH).game!.rematchDeclined).toBeNull()
    send(r, HOST, { t: 'rematch', yes: true })
    expect(view(r, HOST, 0, BOTH).game!.number).toBe(2)
  })

  it('chưa ai mời thì không có gì để từ chối', () => {
    const r = finished()
    expect(send(r, GUEST, { t: 'rematch', yes: false })).toBe(false)
  })
})

describe('thời gian nghĩ mỗi nước', () => {
  it('máy chủ gửi thời gian nghĩ từng nước, đã trừ thời gian đường truyền', () => {
    const r = started()
    send(r, HOST, { t: 'move', uci: 'e2e4', ply: 0, lag: 0 }, 1_000)
    send(r, GUEST, { t: 'move', uci: 'e7e5', ply: 1, lag: 400 }, 11_000)
    expect(view(r, HOST, 11_000, BOTH).game!.moveTimes).toEqual([null, 9_600])
  })

  it('không tính giờ vẫn ghi thời gian nghĩ', () => {
    const r = started('w', null)
    play(r, ['e2e4', 'e7e5', 'g1f3'], [1_000, 6_000, 9_000])
    expect(view(r, GUEST, 9_000, BOTH).game!.moveTimes).toEqual([null, 5_000, 3_000])
  })

  it('ván đang chơi dở từ bản trước (chưa ghi thời gian nghĩ) thì các nước cũ là "không biết", nước sau tính tiếp', () => {
    const r = started('w', null)
    play(r, ['e2e4', 'e7e5'], [1_000, 2_000])
    const old = JSON.parse(JSON.stringify(r)) as RoomData
    const clock = old.game!.clock as Partial<NonNullable<RoomData['game']>['clock']>
    delete clock.spent
    clock.turnStart = 0 // bản trước không ghi lúc bắt đầu lượt khi không tính giờ
    delete (old.game as Partial<NonNullable<RoomData['game']>>).takebackAsked
    const upgraded = upgradeRoom(old)
    expect(upgraded.game!.takebackAsked).toEqual([false, false])
    expect(send(upgraded, HOST, { t: 'move', uci: 'g1f3', ply: 2, lag: 0 }, 7_000)).toBe(true)
    expect(view(upgraded, HOST, 7_000, BOTH).game!.moveTimes).toEqual([null, null, 5_000])
  })
})

describe('chat', () => {
  const VISITOR = 'third-token-cccccccccc'

  it('hai người chơi chat được, ghi người gửi và ván thứ mấy; người xem không gửi, không thấy', () => {
    const r = started()
    expect(chat(r, HOST, 'Chào nha', 1_000)).toEqual({ id: 1, by: 'host', text: 'Chào nha', at: 1_000, game: 1 })
    expect(chat(r, GUEST, 'Chơi vui nha', 2_000)?.by).toBe('guest')
    expect(chat(r, VISITOR, 'mách nước nè', 3_000)).toBeNull()
    expect(chatOf(r, HOST)?.map((line) => line.text)).toEqual(['Chào nha', 'Chơi vui nha'])
    expect(chatOf(r, GUEST)).toHaveLength(2)
    expect(chatOf(r, VISITOR)).toBeNull()
  })

  it('bạn bè chưa vào phòng thì chưa chat được', () => {
    expect(chat(room(), HOST, 'Có ai không', 0)).toBeNull()
  })

  it('câu chat được làm gọn: một dòng, bỏ ký tự vô hình, cắt ở CHAT_LIMIT ký tự, câu rỗng thì bỏ', () => {
    expect(cleanChat('  Ghê\n\n  vậy\t ')).toBe('Ghê vậy')
    expect(cleanChat('a\u202Eb\u200Bc\u0007')).toBe('abc')
    expect(cleanChat('👨\u200D👩\u200D👧')).toBe('👨\u200D👩\u200D👧') // giữ ký tự nối emoji gia đình
    expect(cleanChat('e\u0302\u0301')).toBe('ế') // gõ tách dấu thì gộp lại như chữ thường
    expect([...cleanChat('😀'.repeat(300))]).toHaveLength(CHAT_LIMIT)
    const r = started()
    expect(chat(r, HOST, ' \n\u200B ', 0)).toBeNull()
  })

  it('chữ chồng dấu chỉ giữ hai dấu mỗi chữ', () => {
    expect(cleanChat('x' + '\u0300\u0301\u0302\u0303')).toBe('x\u0300\u0301')
  })

  it(`gửi liền tối đa ${CHAT_BURST} câu, sau đó mỗi giây một câu`, () => {
    const r = started()
    for (let i = 0; i < CHAT_BURST; i++) expect(chat(r, HOST, 'spam ' + i, 1_000)).not.toBeNull()
    expect(chat(r, HOST, 'quá dày', 1_000)).toBeNull()
    expect(chat(r, GUEST, 'người kia vẫn gửi được', 1_000)).not.toBeNull()
    expect(chat(r, HOST, 'chưa đủ một giây', 1_900)).toBeNull()
    expect(chat(r, HOST, 'đủ một giây', 2_000)).not.toBeNull()
    expect(chat(r, HOST, 'lại phải chờ', 2_000)).toBeNull()
  })

  it(`máy chủ giữ ${CHAT_KEEP} câu gần nhất, số thứ tự vẫn tăng tiếp`, () => {
    const r = started()
    for (let i = 0; i < CHAT_KEEP + 20; i++) chat(r, i % 2 ? GUEST : HOST, 'câu ' + i, i * 2_000)
    const lines = chatOf(r, HOST)!
    expect(lines).toHaveLength(CHAT_KEEP)
    expect(lines[0].text).toBe('câu 20')
    expect(lines.at(-1)!.id).toBe(CHAT_KEEP + 20)
  })

  it('chat còn nguyên qua ván sau, câu mới ghi ván thứ hai', () => {
    const r = started()
    chat(r, HOST, 'ván 1', 0)
    play(r, ['f2f3', 'e7e5', 'g2g4', 'd8h4'])
    send(r, HOST, { t: 'rematch', yes: true })
    send(r, GUEST, { t: 'rematch', yes: true })
    chat(r, GUEST, 'gỡ nè', 10_000)
    expect(chatOf(r, HOST)!.map((line) => [line.text, line.game])).toEqual([
      ['ván 1', 1],
      ['gỡ nè', 2],
    ])
  })

  it('tắt chat thì bên kia thấy, và người tắt không gửi được nữa cho tới khi bật lại', () => {
    const r = started()
    expect(send(r, GUEST, { t: 'chatOff', off: true })).toBe(true)
    expect(send(r, GUEST, { t: 'chatOff', off: true })).toBe(false) // tắt rồi thì không đổi gì
    expect(view(r, HOST, 0, BOTH).game!.players.b.chatOff).toBe(true)
    expect(view(r, HOST, 0, BOTH).game!.players.w.chatOff).toBe(false)
    expect(chat(r, GUEST, 'alo', 0)).toBeNull()
    expect(chat(r, HOST, 'tắt chat chi vậy', 0)).not.toBeNull() // người kia vẫn gửi; máy chủ giữ cho lúc bật lại
    send(r, GUEST, { t: 'chatOff', off: false })
    expect(chat(r, GUEST, 'bật lại rồi', 0)).not.toBeNull()
    expect(send(r, VISITOR, { t: 'chatOff', off: true })).toBe(false)
  })

  it('đọc thư chat: phải có chữ, không quá dài; thư tắt chat phải có đúng/sai', () => {
    expect(parseClientMessage(JSON.stringify({ t: 'chat', text: 'GG' }))).toEqual({ t: 'chat', text: 'GG' })
    expect(parseClientMessage(JSON.stringify({ t: 'chat', text: 42 }))).toBeNull()
    expect(parseClientMessage(JSON.stringify({ t: 'chat', text: 'x'.repeat(5_000) }))).toBeNull()
    expect(parseClientMessage(JSON.stringify({ t: 'chatOff', off: true }))).toEqual({ t: 'chatOff', off: true })
    expect(parseClientMessage(JSON.stringify({ t: 'chatOff', off: 'yes' }))).toBeNull()
  })

  it('phòng lưu từ bản trước (chưa có chat) vẫn chat được', () => {
    const r = started()
    const old = JSON.parse(JSON.stringify(r)) as Partial<RoomData> & RoomData
    delete (old as Partial<RoomData>).chat
    delete (old as Partial<RoomData>).chatNext
    for (const seat of old.seats) {
      const s = seat as Partial<typeof seat>
      delete s.chatOff
      delete s.chatBudget
      delete s.chatAt
    }
    const upgraded = upgradeRoom(old)
    expect(chat(upgraded, HOST, 'chào', 0)?.id).toBe(1)
    expect(view(upgraded, GUEST, 0, BOTH).game!.players.w.chatOff).toBe(false)
  })
})
