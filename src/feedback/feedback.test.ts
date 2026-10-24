import { describe, expect, it } from 'vitest'
import { describeDevice, describeGame, pageName } from './context'
import { cleanText, CONTACT_MAX, countFeedback, parseFeedback, parseQuery, TEXT_MAX } from './feedback'

const context = {
  page: 'Chơi một máy',
  device: 'Điện thoại Android · Chrome 130 · màn 384×832 · nền tối',
  settings: 'Quân Gỗ 2D, bàn Gỗ',
  version: 'abc1234',
}

describe('parseFeedback', () => {
  it('nhận góp ý đúng, làm sạch chữ', () => {
    expect(parseFeedback({ kind: 'bug', text: '  Lật bàn\r\n\r\n\r\n\r\nbị  lệch  ', contact: ' Nam ', context, website: '' })).toEqual({
      kind: 'bug',
      text: 'Lật bàn\n\nbị lệch',
      contact: 'Nam',
      context,
    })
  })

  it('từ chối góp ý thiếu, sai loại, quá ngắn, quá dài', () => {
    expect(parseFeedback(null)).toBeNull()
    expect(parseFeedback([])).toBeNull()
    expect(parseFeedback({ kind: 'spam', text: 'xin chào' })).toBeNull()
    expect(parseFeedback({ kind: 'idea', text: ' a \n ' })).toBeNull()
    expect(parseFeedback({ kind: 'idea', text: 42 })).toBeNull()
    expect(parseFeedback({ kind: 'idea', text: 'x'.repeat(TEXT_MAX + 1) })).toBeNull()
    expect(parseFeedback({ kind: 'idea', text: 'hay', contact: 'x'.repeat(CONTACT_MAX + 1) })).toBeNull()
  })

  it('ô bẫy có chữ là máy dò tự động', () => {
    expect(parseFeedback({ kind: 'praise', text: 'Tuyệt', website: 'http://spam.example' })).toBe('trap')
  })

  it('thông tin kèm: bỏ ô sai, cắt ô quá dài, không để lọt ô lạ', () => {
    const parsed = parseFeedback({
      kind: 'bug',
      text: 'lỗi',
      context: { ...context, game: 'e4 '.repeat(2000), side: 'sideways', state: 7, evil: '<script>' },
    })
    expect(parsed).not.toBe('trap')
    const got = parsed && parsed !== 'trap' ? parsed.context : null
    expect(got?.game?.length).toBe(3000)
    expect(got).not.toHaveProperty('side')
    expect(got).not.toHaveProperty('state')
    expect(got).not.toHaveProperty('evil')
    expect(parseFeedback({ kind: 'bug', text: 'lỗi', context: 'chuỗi' })).toMatchObject({ context: null })
  })
})

describe('cleanText', () => {
  it('bỏ ký tự điều khiển, ký tự đảo chiều và ký tự vô hình', () => {
    expect(cleanText('a\u0000b‮c​d﻿', false)).toBe('abcd')
  })

  it('một dòng thì gộp xuống dòng thành dấu cách', () => {
    expect(cleanText(' Zalo\n0909\t123 ', false)).toBe('Zalo 0909 123')
  })
})

describe('parseQuery', () => {
  it('đọc bộ lọc của hộp thư, bỏ giá trị lạ', () => {
    expect(parseQuery(new URLSearchParams('kind=bug&open=1&before=42'))).toEqual({ kind: 'bug', open: true, before: 42 })
    expect(parseQuery(new URLSearchParams('kind=drop&open=yes&before=-3'))).toEqual({})
  })
})

describe('countFeedback', () => {
  it('đếm theo loại và trạng thái', () => {
    const counts = countFeedback([
      { kind: 'bug', status: 'new', n: 2 },
      { kind: 'bug', status: 'done', n: 1 },
      { kind: 'idea', status: 'seen', n: 3 },
    ])
    expect(counts).toEqual({ all: 6, new: 2, open: 5, bug: 3, idea: 3, praise: 0, other: 0 })
  })
})

describe('describeDevice', () => {
  const phone = { width: 384, height: 832, touch: true, dark: true }
  it('Samsung Internet trên điện thoại Android', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36'
    expect(describeDevice(ua, phone)).toBe('Điện thoại Android · Samsung Internet 27 · màn 384×832 · nền tối')
  })

  it('mở link trong app Zalo', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 13; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 Zalo android/12100'
    expect(describeDevice(ua, phone)).toBe('Điện thoại Android · trong app Zalo · màn 384×832 · nền tối')
  })

  it('Safari trên iPhone, Chrome trên máy tính Windows', () => {
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
    expect(describeDevice(iphone, { ...phone, width: 390, dark: false })).toBe('Điện thoại iOS · Safari 18 · màn 390×832 · nền sáng')
    const windows = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
    expect(describeDevice(windows, { width: 1536, height: 730, touch: false, dark: false })).toBe('Máy tính Windows · Chrome 130 · màn 1536×730 · nền sáng')
  })
})

describe('describeGame', () => {
  it('viết gọn tình hình ván', () => {
    expect(describeGame({ kind: 'playing', turn: 'b', check: true }, { minutes: 3, increment: 2 })).toBe('Tới lượt Đen, đang bị chiếu · 3+2')
    expect(describeGame({ kind: 'checkmate', winner: 'w' }, null)).toBe('Trắng thắng (chiếu bí) · không tính giờ')
    expect(describeGame({ kind: 'threefold' }, { minutes: 10, increment: 0 })).toBe('Hòa (lặp thế cờ 3 lần) · 10+0')
    expect(describeGame({ kind: 'aborted' }, null)).toBe('Ván bị huỷ · không tính giờ')
  })
})

describe('pageName', () => {
  it('đặt tên trang theo địa chỉ', () => {
    expect(pageName('/')).toBe('Chơi một máy')
    expect(pageName('/online')).toBe('Tạo phòng online')
    expect(pageName('/phong/x7k2m9ab')).toBe('Phòng online x7k2m9ab')
    expect(pageName('/hop-thu')).toBe('Hộp thư góp ý')
  })
})
