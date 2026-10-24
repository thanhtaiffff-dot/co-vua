// Thông tin web tự gửi kèm góp ý (người gửi tắt được, và xem được trước khi gửi): đang ở trang nào, ván đang chơi,
// điện thoại hay máy tính, trình duyệt gì, chủ đề và bộ tiếng đang dùng, bản web nào. Nhờ vậy người gặp lỗi khỏi phải
// tự kể, còn chủ web mở lại được đúng ván đó trên lichess.
import { useEffect } from 'react'
import type { Color } from 'chess.js'
import type { TimeControl } from '../game/clock'
import type { GameResult } from '../game/rules'
import { soundSetName } from '../soundCatalog'
import { SOUND_SETS, type SoundSet } from '../sound'
import { loadSaved } from '../storage'
import { getTheme, is3d, SHAPE_NAMES } from '../theme'
import { boardInfo, pieceSetInfo } from '../themeCatalog'
import type { FeedbackContext } from './feedback'

// Bản web: mã commit lúc Cloudflare dựng web (hay ngày giờ dựng), vite.config.ts điền vào.
declare const __APP_VERSION__: string

// Ván đang mở trên trang (trang nào có ván thì báo bằng useFeedbackGame).
export type GameInfo = {
  sans: string[] // các nước đã đi, kiểu "e4", "Nf3"
  side: 'white' | 'black' // bàn cờ đang quay về phía nào
  state: string // tình hình ván, viết sẵn cho người đọc
}

let game: GameInfo | null = null

// Trang có ván cờ gọi hook này để form góp ý gửi kèm ván đang chơi.
export function useFeedbackGame(info: GameInfo): void {
  useEffect(() => {
    game = info
    return () => {
      if (game === info) game = null
    }
  }, [info])
}

export function pageName(path: string): string {
  const room = /^\/phong\/([^/]+)/.exec(path)
  if (room) return `Phòng online ${room[1].slice(0, 12)}`
  if (/^\/online\/?$/.test(path)) return 'Tạo phòng online'
  return 'Chơi một máy'
}

// Đoán loại máy và trình duyệt từ chuỗi giới thiệu của trình duyệt (user agent). Chỉ để chủ web đọc cho dễ,
// nên đoán gần đúng là đủ; app Zalo, Messenger, Facebook mở link bằng trình duyệt riêng bên trong app nên ghi rõ.
export function describeDevice(ua: string, screen: { width: number; height: number; touch: boolean; dark: boolean }): string {
  const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && screen.touch)
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPod/.test(ua) || ipad
      ? 'iOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /CrOS/.test(ua)
            ? 'ChromeOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'máy lạ'
  const phone = /Mobi|iPhone|iPod/.test(ua) || (os === 'Android' && Math.min(screen.width, screen.height) < 600)
  const kind = phone ? 'Điện thoại' : ipad || (screen.touch && (os === 'Android' || os === 'iOS')) ? 'Máy tính bảng' : 'Máy tính'
  const browsers: [RegExp, string][] = [
    [/Zalo/i, 'trong app Zalo'],
    [/FBAN|FBAV|FB_IAB|Messenger/, 'trong app Facebook/Messenger'],
    [/Instagram/, 'trong app Instagram'],
    [/SamsungBrowser\/(\d+)/, 'Samsung Internet'],
    [/EdgA?\/(\d+)/, 'Edge'],
    [/OPR\/(\d+)/, 'Opera'],
    [/CocCoc\/(\d+)|coc_coc_browser\/(\d+)/, 'Cốc Cốc'],
    [/CriOS\/(\d+)/, 'Chrome'],
    [/FxiOS\/(\d+)|Firefox\/(\d+)/, 'Firefox'],
    [/Chrome\/(\d+)/, 'Chrome'],
    [/Version\/(\d+)[\d.]* (Mobile\/\S+ )?Safari/, 'Safari'],
  ]
  let browser = 'trình duyệt lạ'
  for (const [pattern, name] of browsers) {
    const found = pattern.exec(ua)
    if (found) {
      const version = found.slice(1).find(Boolean)
      browser = version ? `${name} ${version}` : name
      break
    }
  }
  return [`${kind} ${os}`, browser, `màn ${screen.width}×${screen.height}`, screen.dark ? 'nền tối' : 'nền sáng'].join(' · ')
}

function describeSettings(): string {
  const theme = getTheme()
  const pieces = pieceSetInfo(theme.pieces)
  const look = is3d(theme) ? `3D ${SHAPE_NAMES[theme.shape].toLowerCase()}` : '2D'
  const soundOn = loadSaved<unknown>('sound', true) !== false
  const savedSet = loadSaved<unknown>('soundSet', 'wood')
  // Như đầu trang: máy chưa từng chọn kiểu tiếng mà đã chọn bộ khác Gỗ thì giữ bộ đó; còn lại tiếng theo chủ đề.
  const mode = loadSaved<unknown>('soundMode', null)
  const fixed = mode === 'fixed' || (mode !== 'theme' && savedSet !== 'wood')
  const set: SoundSet = fixed ? (SOUND_SETS.find((s) => s === savedSet) ?? 'wood') : pieces.sound
  const sound = `tiếng ${fixed ? soundSetName(set) : `theo chủ đề (${soundSetName(set)})`}, ${soundOn ? 'đang bật' : 'đang tắt'}`
  const zoom = loadSaved<unknown>('boardZoom', 1)
  const size = typeof zoom === 'number' && zoom !== 1 ? ` · cỡ bàn ${Math.round(zoom * 100)}%` : ''
  return `Quân ${pieces.name} ${look}, bàn ${boardInfo(theme.board).name} · ${sound}${size}`
}

// Gom thông tin gửi kèm lúc mở form góp ý.
export function gatherContext(path: string): FeedbackContext {
  const context: FeedbackContext = {
    page: pageName(path),
    device: describeDevice(navigator.userAgent, {
      width: innerWidth,
      height: innerHeight,
      touch: matchMedia('(pointer: coarse)').matches,
      dark: matchMedia('(prefers-color-scheme: dark)').matches,
    }),
    settings: describeSettings(),
    version: __APP_VERSION__,
  }
  if (game) {
    context.state = game.state
    context.side = game.side
    if (game.sans.length > 0) context.game = game.sans.join(' ')
  }
  return context
}

const COLOR_NAME: Record<Color, string> = { w: 'Trắng', b: 'Đen' }
const HOW: Record<Exclude<GameResult['kind'], 'playing'>, string> = {
  checkmate: 'chiếu bí',
  timeout: 'hết giờ',
  resign: 'đầu hàng',
  timeoutDraw: 'hết giờ nhưng bên kia không đủ quân chiếu bí',
  agreed: 'hai bên đồng ý',
  stalemate: 'pat',
  insufficient: 'không đủ quân chiếu bí',
  threefold: 'lặp thế cờ 3 lần',
  fifty: 'luật 50 nước',
  aborted: 'huỷ ván',
}

// Tình hình ván viết gọn cho chủ web đọc: "Tới lượt Đen · 3+2", "Trắng thắng (chiếu bí) · không tính giờ".
export function describeGame(result: GameResult, control: TimeControl | null): string {
  const clock = control ? `${control.minutes}+${control.increment}` : 'không tính giờ'
  let state: string
  if (result.kind === 'playing') state = `Tới lượt ${COLOR_NAME[result.turn]}${result.check ? ', đang bị chiếu' : ''}`
  else if (result.kind === 'aborted') state = 'Ván bị huỷ'
  else if ('winner' in result) state = `${COLOR_NAME[result.winner]} thắng (${HOW[result.kind]})`
  else state = `Hòa (${HOW[result.kind]})`
  return `${state} · ${clock}`
}
