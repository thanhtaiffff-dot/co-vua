import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import {
  analysisUrl,
  canCheckmate,
  capturedPieces,
  describeMove,
  gameStatus,
  groupPieces,
  isPromotion,
  legalDests,
  materialDiff,
  piecesText,
  replay,
  timeoutStatus,
  winnerOf,
} from './rules'

describe('nước đi hợp lệ', () => {
  it('thế cờ ban đầu có 20 nước, từ 10 quân', () => {
    const dests = legalDests(new Chess())
    expect(dests.size).toBe(10)
    expect([...dests.values()].flat()).toHaveLength(20)
  })

  it('tốt sắp phong cấp chỉ có một ô đích, dù có 4 lựa chọn quân', () => {
    const chess = new Chess('8/P7/8/8/8/8/8/k6K w - - 0 1')
    expect(legalDests(chess).get('a7')).toEqual(['a8'])
    expect(isPromotion(chess, 'a7', 'a8')).toBe(true)
    expect(isPromotion(new Chess(), 'e2', 'e4')).toBe(false)
  })
})

describe('kết thúc ván', () => {
  it('chiếu bí nhanh nhất: Đen thắng', () => {
    const chess = replay([
      { from: 'f2', to: 'f3' },
      { from: 'e7', to: 'e5' },
      { from: 'g2', to: 'g4' },
      { from: 'd8', to: 'h4' },
    ])
    const status = gameStatus(chess)
    expect(status).toEqual({ kind: 'checkmate', winner: 'b' })
    expect(winnerOf(status)).toBe('b')
  })

  it('hết nước đi mà không bị chiếu là hòa pat', () => {
    expect(gameStatus(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'))).toEqual({ kind: 'stalemate' })
  })

  it('chỉ còn hai vua là hòa', () => {
    expect(gameStatus(new Chess('8/8/8/4k3/8/8/8/4K3 w - - 0 1'))).toEqual({ kind: 'insufficient' })
  })

  it('lặp lại thế cờ 3 lần là hòa', () => {
    const shuffle = [
      { from: 'g1', to: 'f3' },
      { from: 'g8', to: 'f6' },
      { from: 'f3', to: 'g1' },
      { from: 'f6', to: 'g8' },
    ] as const
    const status = gameStatus(replay([...shuffle, ...shuffle]))
    expect(status).toEqual({ kind: 'threefold' })
    expect(winnerOf(status)).toBeNull()
  })

  it('50 nước không ăn quân, không đi tốt là hòa', () => {
    expect(gameStatus(new Chess('8/8/8/4k3/8/8/4P3/4K3 w - - 100 80'))).toEqual({ kind: 'fifty' })
  })

  it('đang chơi thì báo lượt và trạng thái bị chiếu', () => {
    const chess = replay([
      { from: 'e2', to: 'e4' },
      { from: 'f7', to: 'f6' },
      { from: 'd1', to: 'h5' },
    ])
    expect(gameStatus(chess)).toEqual({ kind: 'playing', turn: 'b', check: true })
  })
})

describe('chênh lệch quân', () => {
  it('ăn được tốt thì hơn 1 điểm, ăn lại thì cân bằng', () => {
    const afterCapture = replay([
      { from: 'e2', to: 'e4' },
      { from: 'd7', to: 'd5' },
      { from: 'e4', to: 'd5' },
    ])
    expect(materialDiff(afterCapture).w).toEqual({ pieces: ['p'], score: 1 })
    expect(materialDiff(afterCapture).b).toEqual({ pieces: [], score: 0 })

    const recaptured = replay([
      { from: 'e2', to: 'e4' },
      { from: 'd7', to: 'd5' },
      { from: 'e4', to: 'd5' },
      { from: 'd8', to: 'd5' },
    ])
    expect(materialDiff(recaptured)).toEqual({ w: { pieces: [], score: 0 }, b: { pieces: [], score: 0 } })
  })

  it('tính đúng khi có hậu phong cấp', () => {
    const diff = materialDiff(new Chess('3qk3/8/8/8/8/8/8/Q2QK3 w - - 0 1'))
    expect(diff.w).toEqual({ pieces: ['q'], score: 9 })
  })
})

describe('quân đã bị ăn', () => {
  it('ghi đủ quân mỗi bên ăn được, xếp từ nhẹ tới nặng', () => {
    // 1. e4 d5 2. exd5 Qxd5 3. Nc3 Qxa2 4. Rxa2
    const chess = replay([
      { from: 'e2', to: 'e4' },
      { from: 'd7', to: 'd5' },
      { from: 'e4', to: 'd5' },
      { from: 'd8', to: 'd5' },
      { from: 'b1', to: 'c3' },
      { from: 'd5', to: 'a2' },
      { from: 'a1', to: 'a2' },
    ])
    expect(capturedPieces(chess)).toEqual({ w: ['p', 'q'], b: ['p', 'p'] })
  })

  it('bắt tốt qua đường và ăn quân phong cấp cũng tính', () => {
    const enPassant = new Chess('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2')
    enPassant.move('exd6')
    expect(capturedPieces(enPassant)).toEqual({ w: ['p'], b: [] })
    const promoted = new Chess('1r2k3/P7/8/8/8/8/8/4K3 w - - 0 1')
    promoted.move('a8=Q')
    promoted.move('Rxa8')
    expect(capturedPieces(promoted)).toEqual({ w: [], b: ['q'] })
  })

  it('gom quân cùng loại để xếp chồng, đọc thành lời', () => {
    expect(groupPieces(['p', 'p', 'n', 'r', 'r'])).toEqual([['p', 'p'], ['n'], ['r', 'r']])
    expect(piecesText(['p', 'p', 'n', 'q'])).toBe('2 tốt, 1 mã, 1 hậu')
    expect(piecesText([])).toBe('')
  })
})

describe('mở ván trên lichess để phân tích', () => {
  it('ghi các nước lên địa chỉ, bỏ dấu chiếu, quay bàn theo phía người xem', () => {
    expect(analysisUrl(['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#'], 'white')).toBe(
      'https://lichess.org/analysis/pgn/1.e4_e5_2.Qh5_Nc6_3.Bc4_Nf6_4.Qxf7',
    )
    expect(analysisUrl(['e4', 'e5', 'exd8=Q+'], 'black')).toBe('https://lichess.org/analysis/pgn/1.e4_e5_2.exd8%3DQ?color=black')
  })
})

describe('hết giờ', () => {
  it('hết giờ là thua', () => {
    const status = timeoutStatus(new Chess(), 'w')
    expect(status).toEqual({ kind: 'timeout', winner: 'b' })
    expect(winnerOf(status)).toBe('b')
  })

  it('đối thủ chỉ còn vua thì hết giờ vẫn hòa', () => {
    const status = timeoutStatus(new Chess('8/8/8/4k3/8/8/3PPP2/4K3 b - - 0 1'), 'w')
    expect(status).toEqual({ kind: 'timeoutDraw', flagged: 'w' })
    expect(winnerOf(status)).toBeNull()
  })

  it('còn chiếu bí được hay không, xét theo quân còn lại của hai bên', () => {
    const can = (fen: string) => canCheckmate(new Chess(fen), 'w')
    expect(can('4k3/8/8/8/8/8/8/4K2R w - - 0 1')).toBe(true) // Xe
    expect(can('4k3/4p3/8/8/8/8/8/4KN2 w - - 0 1')).toBe(true) // Mã, Đen còn tốt để tự chắn
    expect(can('4k3/4q3/8/8/8/8/8/4KN2 w - - 0 1')).toBe(false) // Mã gặp Hậu
    expect(can('4k3/8/8/8/8/8/8/3NKN2 w - - 0 1')).toBe(true) // hai Mã
    expect(can('4k3/4r3/8/8/8/8/8/4KB2 w - - 0 1')).toBe(false) // Tượng gặp Xe
    expect(can('4k3/4p3/8/8/8/8/8/4KB2 w - - 0 1')).toBe(true) // Tượng, Đen còn tốt để tự chắn
    expect(can('4kb2/8/8/8/8/8/8/4KB2 w - - 0 1')).toBe(true) // Tượng gặp Tượng khác màu ô
    expect(can('4k1b1/8/8/8/8/8/8/4KB2 w - - 0 1')).toBe(false) // Tượng gặp Tượng cùng màu ô
  })
})

describe('một nước đi gây ra gì (để chọn tiếng)', () => {
  const none = { capture: false, castle: false, promotion: false, check: false, mate: false }

  it('nước thường không có gì đặc biệt', () => {
    expect(describeMove(new Chess(), { from: 'e2', to: 'e4' })).toEqual(none)
  })

  it('ăn quân, kể cả bắt tốt qua đường', () => {
    const chess = replay([
      { from: 'e2', to: 'e4' },
      { from: 'd7', to: 'd5' },
    ])
    expect(describeMove(chess, { from: 'e4', to: 'd5' })).toEqual({ ...none, capture: true })
    const enPassant = new Chess('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2')
    expect(describeMove(enPassant, { from: 'e5', to: 'd6' })).toEqual({ ...none, capture: true })
  })

  it('nhập thành cánh vua và cánh hậu', () => {
    const chess = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')
    expect(describeMove(chess, { from: 'e1', to: 'g1' })).toEqual({ ...none, castle: true })
    expect(describeMove(chess, { from: 'e1', to: 'c1' })).toEqual({ ...none, castle: true })
  })

  it('chiếu và chiếu bí', () => {
    const check = replay([
      { from: 'e2', to: 'e4' },
      { from: 'f7', to: 'f6' },
    ])
    expect(describeMove(check, { from: 'd1', to: 'h5' })).toEqual({ ...none, check: true })
    const mate = replay([
      { from: 'f2', to: 'f3' },
      { from: 'e7', to: 'e5' },
      { from: 'g2', to: 'g4' },
    ])
    expect(describeMove(mate, { from: 'd8', to: 'h4' })).toEqual({ ...none, check: true, mate: true })
  })

  it('phong cấp (Hậu mới chiếu luôn vua Đen), ván đang chơi không bị đụng tới', () => {
    const fen = '8/P7/8/8/8/8/8/k6K w - - 0 1'
    const chess = new Chess(fen)
    expect(describeMove(chess, { from: 'a7', to: 'a8', promotion: 'q' })).toEqual({ ...none, promotion: true, check: true })
    expect(chess.fen()).toBe(fen)
  })
})
