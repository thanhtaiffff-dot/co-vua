import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { premoveBoard, premoveToMove } from './premove'

describe('bàn cờ khi đã đặt sẵn nước đi trước', () => {
  it('quân mình dời tới ô đích, kéo tiếp được từ chỗ mới; các ô được tô', () => {
    const chess = new Chess()
    chess.move('e4') // tới lượt Đen; Trắng đặt sẵn Nf3 rồi Ng5
    const { fen, squares } = premoveBoard(chess, 'w', [
      { from: 'g1', to: 'f3' },
      { from: 'f3', to: 'g5' },
    ])
    expect(fen).toBe('rnbqkbnr/pppppppp/8/6N1/4P3/8/PPPP1PPP/RNBQKB1R')
    expect([...squares.keys()].sort()).toEqual(['f3', 'g1', 'g5'])
  })

  it('đặt sẵn nước ăn quân: quân đối thủ ở ô đích tạm biến mất', () => {
    const chess = new Chess('4k3/8/8/3p4/4P3/8/8/4K3 b - - 0 1')
    expect(premoveBoard(chess, 'w', [{ from: 'e4', to: 'd5' }]).fen).toBe('4k3/8/8/3P4/8/8/8/4K3')
  })

  it('nhập thành (vua sang hai ô hay tới ô Xe) thì dời cả Xe; tốt tới hàng cuối thành Hậu', () => {
    const chess = new Chess('r3k2r/1P6/8/8/8/8/8/R3K2R b KQkq - 0 1')
    expect(premoveBoard(chess, 'w', [{ from: 'e1', to: 'h1' }]).fen).toBe('r3k2r/1P6/8/8/8/8/8/R4RK1')
    expect(premoveBoard(chess, 'w', [{ from: 'e1', to: 'c1' }]).fen).toBe('r3k2r/1P6/8/8/8/8/8/2KR3R')
    expect(premoveBoard(chess, 'w', [{ from: 'b7', to: 'a8' }]).fen).toBe('Q3k2r/8/8/8/8/8/8/R3K2R')
  })

  it('chuỗi bị đứt (ô đi không còn quân mình) thì dừng ở đó', () => {
    const chess = new Chess()
    chess.move('e4')
    const { fen } = premoveBoard(chess, 'w', [
      { from: 'a3', to: 'a4' },
      { from: 'g1', to: 'f3' },
    ])
    expect(fen).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR')
  })
})

describe('tới lượt thì đi nước đi trước', () => {
  it('nước còn hợp lệ thì đi', () => {
    const chess = new Chess()
    expect(premoveToMove(chess, { from: 'g1', to: 'f3' })).toEqual({ from: 'g1', to: 'f3' })
  })

  it('quân đã bị ăn, đường bị chắn, hay không phải lượt mình thì không đi', () => {
    const chess = new Chess('4k3/8/8/8/8/8/4p3/R3K3 w Q - 0 1')
    expect(premoveToMove(chess, { from: 'a1', to: 'a8' })).toEqual({ from: 'a1', to: 'a8' })
    expect(premoveToMove(chess, { from: 'b2', to: 'b4' })).toBeNull() // không có quân
    expect(premoveToMove(chess, { from: 'e1', to: 'e3' })).toBeNull() // đi sai luật
    expect(premoveToMove(chess, { from: 'e2', to: 'e1' })).toBeNull() // quân đối thủ
  })

  it('nhập thành kéo vua tới ô Xe vẫn đi được; phong cấp tự lên Hậu', () => {
    const castle = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')
    expect(premoveToMove(castle, { from: 'e1', to: 'h1' })).toEqual({ from: 'e1', to: 'g1' })
    expect(premoveToMove(castle, { from: 'e1', to: 'a1' })).toEqual({ from: 'e1', to: 'c1' })
    const promote = new Chess('4k3/1P6/8/8/8/8/8/4K3 w - - 0 1')
    expect(premoveToMove(promote, { from: 'b7', to: 'b8' })).toEqual({ from: 'b7', to: 'b8', promotion: 'q' })
  })
})
