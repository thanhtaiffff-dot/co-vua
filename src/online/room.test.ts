import { describe, expect, it } from 'vitest'
import { MAX_LAG_CREDIT, checkFlag, cleanName, createRoom, flagDue, handle, parseCreateRequest, view, type RoomData } from './room'
import { ROOM_ID, fromUci, newRoomId, toUci, type ClientMessage, type ColorChoice } from './protocol'

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
    expect(seen.game?.players).toEqual({ w: { name: 'Tài', online: true }, b: { name: 'Nam', online: true } })
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

  it('thời gian đường truyền được trả lại có giới hạn', () => {
    const r = started()
    play(r, ['e2e4'], [0])
    send(r, GUEST, { t: 'move', uci: 'e7e5', ply: 1, lag: 60_000 }, 10_000)
    expect(view(r, HOST, 10_000, BOTH).game!.clock!.times.b).toBe(180_000 - 10_000 + MAX_LAG_CREDIT + 2_000)
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
