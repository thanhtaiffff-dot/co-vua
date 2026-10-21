import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { canCheckmate, gameStatus, isPromotion, legalDests, materialDiff, replay, resultScore, timeoutStatus } from './rules'

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
    expect(resultScore(status)).toBe('0–1')
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
    expect(resultScore(status)).toBe('½–½')
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
    expect(resultScore(gameStatus(chess))).toBeNull()
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

describe('hết giờ', () => {
  it('hết giờ là thua', () => {
    const status = timeoutStatus(new Chess(), 'w')
    expect(status).toEqual({ kind: 'timeout', winner: 'b' })
    expect(resultScore(status)).toBe('0–1')
  })

  it('đối thủ chỉ còn vua thì hết giờ vẫn hòa', () => {
    const status = timeoutStatus(new Chess('8/8/8/4k3/8/8/3PPP2/4K3 b - - 0 1'), 'w')
    expect(status).toEqual({ kind: 'timeoutDraw', flagged: 'w' })
    expect(resultScore(status)).toBe('½–½')
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
