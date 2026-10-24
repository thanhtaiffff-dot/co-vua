import { describe, expect, it } from 'vitest'
import { createIssue, feedbackIssue, type IssueDraft } from './issue'

const at = Date.parse('2026-10-24T13:15:00Z')

describe('feedbackIssue', () => {
  const feedback = {
    kind: 'bug' as const,
    text: 'Bấm Đấu ván nữa mà bên kia không thấy gì\n@ai đó ![ảnh](https://lua-dao.example/x.png) <b>đậm</b>',
    contact: 'Nam',
    context: { page: 'Phòng online x7k2m9ab', game: 'e4 e5 Nf3', side: 'black' as const, state: 'Bạn cầm Đen, ván 2', device: 'Điện thoại Android', settings: 'Quân Gỗ', version: 'abc1234' },
  }

  it('tiêu đề có loại và dòng đầu, nhãn theo loại, thân có đủ thông tin', () => {
    const issue = feedbackIssue(feedback, at)
    expect(issue.title).toBe('🐞 Báo lỗi: Bấm Đấu ván nữa mà bên kia không thấy gì')
    expect(issue.labels).toEqual(['Báo lỗi'])
    expect(issue.body).toContain('```text\nNam\n```')
    expect(issue.body).toContain('Ván: 3 nước đã đi · Bạn cầm Đen, ván 2')
    expect(issue.body).toContain('Nước đi: e4 e5 Nf3')
    expect(issue.body).toContain('[Mở ván trên lichess](https://lichess.org/analysis/pgn/1.e4_e5_2.Nf3?color=black)')
    expect(issue.body).toContain('Gửi lúc 24/10/2026 20:15 (giờ Việt Nam)')
  })

  it('chữ người chơi gõ nằm trọn trong khối chữ thô, kể cả khi có dấu `', () => {
    const issue = feedbackIssue({ ...feedback, text: 'thử ``` thoát khối\n````\n# tiêu đề giả' }, at)
    expect(issue.body).toContain('`````text\nthử ``` thoát khối\n````\n# tiêu đề giả\n`````')
    // Nội dung có @, ảnh, HTML cũng nằm trong khối chữ thô.
    const plain = feedbackIssue(feedback, at).body
    const start = plain.indexOf('```text\nBấm')
    expect(plain.indexOf('<b>đậm</b>')).toBeGreaterThan(start)
    expect(plain.indexOf('\n```', start + 3)).toBeGreaterThan(plain.indexOf('<b>đậm</b>'))
  })

  it('nước đi lạ thì không làm link lichess; không tên, không kèm thông tin', () => {
    const odd = feedbackIssue({ ...feedback, context: { ...feedback.context, game: 'e4 )](javascript:x)' } }, at)
    expect(odd.body).not.toContain('lichess')
    const bare = feedbackIssue({ kind: 'praise', text: 'x'.repeat(80), contact: '', context: null }, at)
    expect(bare.title).toBe(`❤️ Khen: ${'x'.repeat(59)}…`)
    expect(bare.body).toContain('Không để tên')
    expect(bare.body).not.toContain('Thông tin kèm')
  })

  it('cắt tiêu đề dài không xẻ đôi emoji', () => {
    expect(feedbackIssue({ kind: 'idea', text: `${'a'.repeat(58)}🔥🔥🔥`, contact: '', context: null }, at).title).toBe(`💡 Ý tưởng: ${'a'.repeat(58)}🔥…`)
  })
})

describe('createIssue', () => {
  const draft: IssueDraft = { title: 't', body: 'b', labels: ['Khen'] }
  const reply = (status: number, headers: Record<string, string> = {}) => new Response('{}', { status, headers })

  it('gửi đúng chỗ, đúng token, có User-Agent', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const fetcher = (async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return reply(201)
    }) as unknown as typeof fetch
    expect(await createIssue('github_pat_x', 'chu/repo', draft, undefined, fetcher)).toBe('ok')
    expect(calls[0].url).toBe('https://api.github.com/repos/chu/repo/issues')
    const headers = calls[0].init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer github_pat_x')
    expect(headers['User-Agent']).toBeTruthy()
    expect(JSON.parse(calls[0].init.body as string)).toEqual(draft)
  })

  it('đọc lỗi GitHub: token hỏng, trục trặc, mất mạng; nhãn bị từ chối thì gửi lại không nhãn', async () => {
    const answer = (...statuses: [number, Record<string, string>?][]) => {
      const bodies: unknown[] = []
      const fetcher = (async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(init.body as string))
        const [status, headers] = statuses.shift() ?? [500]
        return reply(status, headers)
      }) as unknown as typeof fetch
      return { fetcher, bodies }
    }
    expect(await createIssue('t', 'chu/repo', draft, undefined, answer([401]).fetcher)).toBe('token')
    expect(await createIssue('t', 'chu/repo', draft, undefined, answer([404]).fetcher)).toBe('token')
    expect(await createIssue('t', 'chu/repo', draft, undefined, answer([403]).fetcher)).toBe('token')
    expect(await createIssue('t', 'chu/repo', draft, undefined, answer([403, { 'x-ratelimit-remaining': '0' }]).fetcher)).toBe('retry')
    expect(await createIssue('t', 'chu/repo', draft, undefined, answer([502]).fetcher)).toBe('retry')
    const relabel = answer([422], [201])
    expect(await createIssue('t', 'chu/repo', draft, undefined, relabel.fetcher)).toBe('ok')
    expect(relabel.bodies[1]).toMatchObject({ labels: [] })
    const offline = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    expect(await createIssue('t', 'chu/repo', draft, undefined, offline)).toBe('retry')
  })
})
