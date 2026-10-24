import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { gameStats, moveLabel, QUICK_MS } from './stats'

function play(sans: string[]): Chess {
  const chess = new Chess()
  for (const san of sans) chess.move(san)
  return chess
}

describe('thống kê ván', () => {
  it('thời gian nghĩ: tổng, trung bình, lâu nhất, nhanh nhất, số nước đi vội; nước không biết thời gian thì bỏ qua', () => {
    // Mưu Học Sinh: Trắng chiếu bí ở nước thứ 7.
    const chess = play(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'])
    const stats = gameStats(chess, [null, 3000, 12_000, 1500, 31_000, 800, 4000])
    expect(stats.w.moves).toBe(4)
    expect(stats.b.moves).toBe(3)
    expect(stats.w.spent).toBe(47_000)
    expect(stats.w.average).toBeCloseTo(47_000 / 3)
    expect(stats.w.longest).toEqual({ ply: 5, ms: 31_000 })
    expect(stats.w.fastest).toEqual({ ply: 7, ms: 4000 })
    expect(stats.w.quick).toBe(0)
    expect(stats.b.spent).toBe(5300)
    expect(stats.b.longest).toEqual({ ply: 2, ms: 3000 })
    expect(stats.b.fastest).toEqual({ ply: 6, ms: 800 })
    expect(stats.b.quick).toBe(2)
    expect(QUICK_MS).toBe(2000)
  })

  it('không biết thời gian nước nào thì không có số liệu thời gian', () => {
    const stats = gameStats(play(['e4', 'e5']), [])
    expect(stats.w.spent).toBeNull()
    expect(stats.w.average).toBeNull()
    expect(stats.w.longest).toBeNull()
    expect(stats.b.fastest).toBeNull()
    expect(stats.b.quick).toBe(0)
  })

  it('quân đã ăn và điểm, số lần chiếu tính cả nước chiếu bí', () => {
    const chess = play(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'])
    const stats = gameStats(chess, [])
    expect(stats.w.captured).toEqual(['p'])
    expect(stats.w.points).toBe(1)
    expect(stats.w.checks).toBe(1)
    expect(stats.b.captured).toEqual([])
    expect(stats.b.points).toBe(0)
    expect(stats.b.checks).toBe(0)
  })

  it('nhập thành: cánh nào, ở nước thứ mấy', () => {
    const chess = play(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'd6', 'O-O', 'Be6', 'd3', 'Qd7', 'Nc3', 'O-O-O'])
    const stats = gameStats(chess, [])
    expect(stats.w.castle).toEqual({ side: 'king', ply: 7 })
    expect(stats.b.castle).toEqual({ side: 'queen', ply: 12 })
  })

  it('phong cấp: quân gì, ở nước thứ mấy; quân phong cấp bị ăn thì tính đúng quân đó', () => {
    const chess = new Chess('4k3/1P6/8/8/8/8/6p1/4K2R w K - 0 1')
    for (const move of ['b8=Q+', 'Kd7', 'Qb7+', 'Ke6', 'Rh6+', 'Ke5', 'Qb2+', 'Kd5', 'Qxg2+']) chess.move(move)
    const stats = gameStats(chess, [])
    expect(stats.w.promotions).toEqual([{ piece: 'q', ply: 1 }])
    expect(stats.w.checks).toBe(5)
    expect(stats.w.captured).toEqual(['p'])
  })

  it('nước viết kiểu sách cờ', () => {
    expect(moveLabel(1, 'e4')).toBe('1. e4')
    expect(moveLabel(2, 'e5')).toBe('1... e5')
    expect(moveLabel(23, 'Qxd5')).toBe('12. Qxd5')
  })
})
