import { describe, expect, it } from 'vitest'
import type { MoveFacts } from './game/rules'
import { moveSounds, SOUND_NAMES, SOUND_SETS, soundUrl } from './sound'
import { SET_SAMPLE, SOUND_EVENTS, SOUND_LIST } from './soundCatalog'

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

describe('các bộ tiếng', () => {
  it('bộ nào cũng có đủ tiếng cho mọi việc', () => {
    for (const set of SOUND_SETS) {
      for (const name of SOUND_NAMES) expect(soundUrl(set, name), `${set}/${name}`).toBeTypeOf('string')
    }
  })

  it('tiếng của mỗi bộ nằm trong thư mục của bộ đó', () => {
    expect(soundUrl('8bit', 'lowTime')).toMatch(/8bit\/low-time/)
  })
})

describe('bảng chọn tiếng', () => {
  it('bộ nào cũng có mặt đúng một lần, có tên và lời tả', () => {
    expect(SOUND_LIST.map((info) => info.id).toSorted()).toEqual([...SOUND_SETS].toSorted())
    for (const info of SOUND_LIST) {
      expect(info.name, info.id).not.toBe('')
      expect(info.about, info.id).not.toBe('')
    }
  })

  it('nghe riêng được mọi tiếng, theo đúng thứ tự thời gian', () => {
    const heard = new Set(SOUND_EVENTS.flatMap((event) => event.sample.map(([name]) => name)))
    expect([...heard].toSorted()).toEqual([...SOUND_NAMES].toSorted())
    for (const sample of [SET_SAMPLE, ...SOUND_EVENTS.map((event) => event.sample)]) {
      const times = sample.map(([, at]) => at)
      expect(times).toEqual(times.toSorted((a, b) => a - b))
    }
  })
})
