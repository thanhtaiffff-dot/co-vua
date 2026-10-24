import { describe, expect, it } from 'vitest'
import { defang, feedbackMail, MAIL_FROM, mailDay, parseMailSave, resendProblem, sendWithResend, testMail } from './mail'

const origin = 'https://chess.thanhtaiffff.workers.dev'

describe('parseMailSave', () => {
  it('nhận cài đặt đúng, bỏ trống chìa là giữ chìa cũ', () => {
    expect(parseMailSave({ on: true, email: ' tai@gmail.com ', key: ' re_abc12345_XYZ ' })).toEqual({ on: true, email: 'tai@gmail.com', key: 're_abc12345_XYZ' })
    expect(parseMailSave({ on: false, email: '', key: '' })).toEqual({ on: false, email: '' })
  })

  it('từ chối mail sai, chìa sai, thiếu ô', () => {
    expect(parseMailSave({ on: true, email: 'tai@' })).toBeNull()
    expect(parseMailSave({ on: true, email: 'tai@gmail.com', key: 'sk_live_123456789' })).toBeNull()
    expect(parseMailSave({ on: true, email: 'tai@gmail.com', key: 42 })).toBeNull()
    expect(parseMailSave({ on: 'yes', email: 'tai@gmail.com' })).toBeNull()
    expect(parseMailSave({ on: true })).toBeNull()
    expect(parseMailSave(null)).toBeNull()
  })
})

describe('mailDay', () => {
  it('đổi ngày lúc nửa đêm giờ Việt Nam', () => {
    expect(mailDay(Date.parse('2026-10-24T16:59:59Z'))).toBe('2026-10-24')
    expect(mailDay(Date.parse('2026-10-24T17:00:00Z'))).toBe('2026-10-25')
  })
})

describe('defang', () => {
  it('làm hỏng link và tên miền để không bấm được', () => {
    expect(defang('vào https://lua-dao.example/qua nhận quà')).toBe('vào hxxps://lua-dao[.]example/qua nhận quà')
    expect(defang('http://a.b.vn')).toBe('hxxp://a[.]b[.]vn')
    expect(defang('www.abc.vn')).toBe('www[.]abc[.]vn')
    expect(defang('giống chess.com nhé')).toBe('giống chess[.]com nhé')
  })

  it('để nguyên mail, số, chữ thường', () => {
    for (const text of ['mail minh.nguyen@gmail.com nhé', 'v.v. và 3.5 điểm', 'e4 e5 Nf3', 'Lật bàn.Rồi đi tiếp', 'bản 1.2.3']) expect(defang(text)).toBe(text)
  })
})

describe('feedbackMail', () => {
  const feedback = {
    kind: 'bug' as const,
    text: 'Bấm Đấu ván nữa mà bên kia không thấy gì\nxem https://lua-dao.example',
    contact: 'Nam',
    context: { page: 'Phòng online x7k2m9ab', game: 'e4 e5 Nf3', state: 'Bạn cầm Đen, ván 2', device: 'Điện thoại Android', settings: 'Quân Gỗ', version: 'abc1234' },
  }

  it('tiêu đề có loại và dòng đầu, thân thư có đủ thông tin và link hộp thư', () => {
    const mail = feedbackMail(feedback, origin, false)
    expect(mail.subject).toBe('🐞 Báo lỗi: Bấm Đấu ván nữa mà bên kia không thấy gì')
    expect(mail.text).toContain('🐞 Báo lỗi mới trên web cờ vua')
    expect(mail.text).toContain('— Nam')
    expect(mail.text).toContain('Ván: 3 nước đã đi · Bạn cầm Đen, ván 2')
    expect(mail.text).toContain('hxxps://lua-dao[.]example')
    expect(mail.text).not.toContain('https://lua-dao')
    expect(mail.text).toContain('Link trong góp ý đã bị làm hỏng cố ý')
    expect(mail.text).toContain(`Mở hộp thư: ${origin}/hop-thu`)
    expect(mail.text).not.toContain('#khoa=')
    expect(mail.text).not.toContain('đã gửi đủ')
  })

  it('góp ý không tên, không kèm thông tin; thư cuối ngày thì báo đã đủ thư', () => {
    const mail = feedbackMail({ kind: 'praise', text: 'x'.repeat(80), contact: '', context: null }, origin, true)
    expect(mail.subject).toBe(`❤️ Khen: ${'x'.repeat(59)}…`)
    expect(mail.text).toContain('— Không để tên')
    expect(mail.text).not.toContain('Trang:')
    expect(mail.text).not.toContain('làm hỏng cố ý')
    expect(mail.text).toContain('Hôm nay đã gửi đủ 20 thư')
  })

  it('cắt tiêu đề dài không xẻ đôi emoji', () => {
    const mail = feedbackMail({ kind: 'idea', text: `${'a'.repeat(58)}🔥🔥🔥`, contact: '', context: null }, origin, false)
    expect(mail.subject).toBe(`💡 Ý tưởng: ${'a'.repeat(58)}🔥…`)
  })

  it('thư thử có link hộp thư', () => {
    expect(testMail(origin).text).toContain(`${origin}/hop-thu`)
  })
})

describe('resendProblem', () => {
  it('đọc lỗi Resend ra lý do dễ hiểu', () => {
    expect(resendProblem(401, { name: 'validation_error', message: 'API key is invalid' })).toBe('key')
    expect(resendProblem(400, { name: 'validation_error', message: 'API key is invalid' })).toBe('key')
    expect(resendProblem(401, { name: 'missing_api_key', message: 'Missing API Key' })).toBe('key')
    expect(resendProblem(403, { name: 'restricted_api_key', message: 'This API key is not active' })).toBe('key')
    expect(resendProblem(403, { name: 'validation_error', message: 'You can only send testing emails to your own email address (a@b.com).' })).toBe('address')
    expect(resendProblem(429, { name: 'daily_quota_exceeded', message: 'You have reached your daily email sending quota.' })).toBe('limit')
    expect(resendProblem(422, { name: 'validation_error', message: 'Invalid `to` field.' })).toBe('address')
    expect(resendProblem(500, {})).toBe('service')
  })
})

describe('sendWithResend', () => {
  it('gửi đúng chỗ, đúng chìa, đúng người nhận', async () => {
    let sent: { url: string; init: RequestInit } | null = null
    const fetcher = (async (url: string, init: RequestInit) => {
      sent = { url, init }
      return new Response(JSON.stringify({ id: 'thu-1' }), { status: 200 })
    }) as unknown as typeof fetch
    expect(await sendWithResend('re_test_12345678', 'tai@gmail.com', testMail(origin), fetcher)).toBeNull()
    expect(sent).not.toBeNull()
    const { url, init } = sent as unknown as { url: string; init: RequestInit }
    expect(url).toBe('https://api.resend.com/emails')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_test_12345678')
    expect((init.headers as Record<string, string>)['User-Agent']).toBe('co-vua/1.0')
    expect(JSON.parse(init.body as string)).toMatchObject({ from: MAIL_FROM, to: ['tai@gmail.com'] })
  })

  it('mất mạng hay Resend báo lỗi thì trả lý do', async () => {
    const offline = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    expect(await sendWithResend('re_test_12345678', 'tai@gmail.com', testMail(origin), offline)).toBe('network')
    const refused = (async () => new Response(JSON.stringify({ statusCode: 403, name: 'validation_error', message: 'You can only send testing emails to your own email address' }), { status: 403 })) as unknown as typeof fetch
    expect(await sendWithResend('re_test_12345678', 'ban@gmail.com', testMail(origin), refused)).toBe('address')
    const broken = (async () => new Response('<html>lỗi</html>', { status: 502 })) as unknown as typeof fetch
    expect(await sendWithResend('re_test_12345678', 'tai@gmail.com', testMail(origin), broken)).toBe('service')
  })
})
