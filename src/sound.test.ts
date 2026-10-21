import { describe, expect, it } from 'vitest'
import type { MoveFacts } from './game/rules'
import { moveSounds } from './sound'

const none: MoveFacts = { capture: false, castle: false, promotion: false, check: false, mate: false }
const names = (facts: Partial<MoveFacts>) => moveSounds({ ...none, ...facts }).map(([name]) => name)

describe('nước đi kêu tiếng gì', () => {
  it('đi thường, ăn quân, nhập thành: mỗi nước một tiếng quân', () => {
    expect(names({})).toEqual(['move'])
    expect(names({ capture: true })).toEqual(['capture'])
    expect(names({ castle: true })).toEqual(['castle'])
  })

  it('chiếu, phong cấp thì có thêm tiếng báo, vang lên sau tiếng quân', () => {
    expect(names({ capture: true, check: true })).toEqual(['capture', 'check'])
    expect(names({ promotion: true })).toEqual(['move', 'promote'])
    const [[, piece], [, accent]] = moveSounds({ ...none, check: true })
    expect(accent).toBeGreaterThan(piece)
  })

  it('vừa phong cấp vừa chiếu thì báo chiếu, vì chiếu quan trọng hơn', () => {
    expect(names({ promotion: true, capture: true, check: true })).toEqual(['capture', 'check'])
  })

  it('chiếu bí thì chỉ có tiếng quân, để tiếng hết ván kêu ngay sau', () => {
    expect(names({ check: true, mate: true })).toEqual(['move'])
    expect(names({ promotion: true, check: true, mate: true })).toEqual(['move'])
  })
})
