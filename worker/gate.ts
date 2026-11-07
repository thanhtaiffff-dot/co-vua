// Người gác cửa của cả web: một Durable Object duy nhất, worker hỏi nó trước khi tạo phòng hay nhận góp ý
// (luật đếm nằm ở src/gate.ts). Nó chỉ đếm trong bộ nhớ, không đọc ghi cơ sở dữ liệu, nên ai gửi dồn bao nhiêu lần
// cũng không làm tốn hạn mức đọc ghi mà các phòng đang chơi cần.
// Cloudflare chỉ tắt nó khi một lúc lâu không ai hỏi, hay khi đưa bản web mới lên; lúc đó số đếm mất, mọi mạng được
// đếm lại từ đầu. Không sao: đang có người gửi dồn thì nó vẫn thức.
import { DurableObject } from 'cloudflare:workers'
import { Gatekeeper, type GateKind, type GateResult } from '../src/gate'
import type { Env } from './room-server'

export class Gate extends DurableObject<Env> {
  private keeper = new Gatekeeper()

  // Mạng `who` (mã hoá một chiều, không phải địa chỉ thật) muốn làm việc `kind`: cho qua hay không.
  allow(kind: GateKind, who: string): GateResult {
    return this.keeper.allow(kind, who, Date.now())
  }
}
