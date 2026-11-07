// "Người gác cửa": đếm lượt tạo phòng và lượt gửi góp ý theo từng mạng, chặn ai gửi dồn dập trước khi việc đó chạm tới
// phòng chơi hay hàng chờ góp ý. Hai việc đó ghi và đọc cơ sở dữ liệu của Cloudflare, mà gói miễn phí chỉ cho cả web
// 100.000 dòng ghi và 5 triệu dòng đọc mỗi ngày: kẻ phá chỉ cần tạo vài chục nghìn phòng là mọi ván online đứng tới
// 7 giờ sáng hôm sau. Máy chủ chạy phần này trong worker/gate.ts; tách ra đây cho dễ kiểm tra.
//
// Mỗi loại việc có hai mức, kiểu "xô nước": xô đầy thì làm liền được bấy nhiêu lần, mỗi lần múc một gáo, xô tự đầy lại dần.
// - mỗi mạng: `burst` lần liền, sau đó `perHour` lần mỗi giờ;
// - cả web: `site` lần mỗi giờ, để lỡ có ai phá bằng nhiều mạng thì ván đang chơi vẫn chạy, chỉ tạm chưa tạo phòng mới được.
import { PER_HOUR } from './feedback/feedback'

export type GateKind = 'room' | 'feedback'
// ok: cho qua; slow: mạng này gửi dồn dập quá; busy: cả web đang quá nhiều.
export type GateResult = 'ok' | 'slow' | 'busy'

type Rule = { burst: number; perHour: number; site: number }

export const GATE_RULES: Record<GateKind, Rule> = {
  // Người chơi thật tạo vài phòng mỗi giờ là cùng.
  room: { burst: 20, perHour: 20, site: 300 },
  // Khớp với giới hạn của hàng chờ góp ý (PER_HOUR mỗi mạng mỗi giờ); cả web 60 góp ý mỗi giờ là dư.
  feedback: { burst: PER_HOUR, perHour: PER_HOUR, site: 60 },
}

const HOUR = 60 * 60 * 1000

type Bucket = { tokens: number; at: number }

export class Gatekeeper {
  private buckets = new Map<string, Bucket>()
  private swept = 0

  // Cho mạng `who` làm việc `kind` lúc `now` không. Được thì trừ một lượt ở cả hai mức; không được thì không trừ gì.
  allow(kind: GateKind, who: string, now: number): GateResult {
    this.sweep(now)
    const rule = GATE_RULES[kind]
    const mine = this.fill(`${kind}:${who}`, rule.burst, rule.perHour, now)
    if (mine.tokens < 1) return 'slow'
    const site = this.fill(`${kind}:*`, rule.site, rule.site, now)
    if (site.tokens < 1) return 'busy'
    mine.tokens -= 1
    site.tokens -= 1
    return 'ok'
  }

  // Xô `key` (chứa tối đa `size` lượt, đầy lại `perHour` lượt mỗi giờ) tính tới lúc `now`.
  private fill(key: string, size: number, perHour: number, now: number): Bucket {
    let bucket = this.buckets.get(key)
    if (!bucket) {
      bucket = { tokens: size, at: now }
      this.buckets.set(key, bucket)
    }
    bucket.tokens = Math.min(size, bucket.tokens + (Math.max(0, now - bucket.at) * perHour) / HOUR)
    bucket.at = now
    return bucket
  }

  // Xô một giờ không ai đụng tới thì đã đầy lại, bỏ đi cho đỡ tốn bộ nhớ (lần sau cần thì tạo xô đầy mới). Mỗi phút dọn một lần.
  private sweep(now: number): void {
    if (now - this.swept < 60_000) return
    this.swept = now
    for (const [key, bucket] of this.buckets) if (now - bucket.at >= HOUR) this.buckets.delete(key)
  }
}

// Mạng của một địa chỉ IP: IPv4 giữ nguyên; IPv6 lấy 4 nhóm đầu (dải /64), vì mỗi nhà hay mỗi điện thoại được cấp cả
// một dải như vậy và phần đuôi tự đổi liên tục, kẻ phá đổi đuôi là thành "mạng mới" nếu tính cả địa chỉ.
export function networkOf(ip: string): string {
  const v4 = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip)
  if (v4) return v4[1]
  if (!ip.includes(':')) return ip
  const [head, tail] = ip.toLowerCase().split('::')
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const groups = tail === undefined ? left : [...left, ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right]
  return groups
    .slice(0, 4)
    .map((group) => group.replace(/^0+(?=.)/, ''))
    .join(':')
}
