// Âm thanh của bàn cờ. Phát bằng Web Audio để bấm là kêu ngay (thẻ <audio> trên điện thoại hay bị trễ).
// Trình duyệt chỉ cho phát tiếng sau khi người chơi chạm vào trang, nên bộ phát được bật ở lần chạm đầu tiên.
import type { MoveFacts } from './game/rules'
import capture from './sounds/wood/capture.mp3'
import castle from './sounds/wood/castle.mp3'
import check from './sounds/wood/check.mp3'
import draw from './sounds/wood/draw.mp3'
import end from './sounds/wood/end.mp3'
import lowTime from './sounds/wood/low-time.mp3'
import move from './sounds/wood/move.mp3'
import promote from './sounds/wood/promote.mp3'
import start from './sounds/wood/start.mp3'

// Bộ tiếng "Gỗ", tạo bằng `npm run sounds` (xem tools/sounds/make-sounds.mjs).
const FILES = { move, capture, castle, check, promote, end, draw, lowTime, start }

export type SoundName = keyof typeof FILES

// Tiếng báo chiếu, phong cấp vang lên ngay sau tiếng quân đặt xuống.
const ACCENT_DELAY = 0.03

let ctx: AudioContext | null = null
let output: GainNode | null = null
const buffers = new Map<SoundName, AudioBuffer>()
let enabled = true
let lastTouch = 0

export function setSoundEnabled(on: boolean): void {
  enabled = on
}

// Bản gộp một file (`npm run build:single`) nhét tiếng thẳng vào trang dạng "data:...", đọc tại chỗ cho chắc.
async function read(url: string): Promise<ArrayBuffer> {
  if (url.startsWith('data:')) {
    const text = atob(url.slice(url.indexOf(',') + 1))
    return Uint8Array.from(text, (c) => c.charCodeAt(0)).buffer
  }
  const response = await fetch(url)
  return response.arrayBuffer()
}

function unlock(): void {
  lastTouch = performance.now()
  if (!ctx) {
    if (typeof AudioContext === 'undefined') return
    const audio = new AudioContext()
    output = audio.createGain()
    output.gain.value = 0.9
    output.connect(audio.destination)
    // iPhone đời cũ cần phát một tiếng (dù im lặng) ngay trong lần chạm thì mới mở khoá.
    const silence = audio.createBufferSource()
    silence.buffer = audio.createBuffer(1, 1, audio.sampleRate)
    silence.connect(audio.destination)
    silence.start()
    for (const [name, url] of Object.entries(FILES) as [SoundName, string][]) {
      read(url)
        .then((data) => audio.decodeAudioData(data))
        .then((buffer) => buffers.set(name, buffer))
        .catch(() => {
          // Máy không đọc được tiếng nào thì tiếng đó im, ván vẫn chơi bình thường.
        })
    }
    ctx = audio
  }
  if (ctx.state !== 'running') ctx.resume().catch(() => {})
}

// Gắn vào trang một lần. Lần chạm, bấm phím nào cũng nhân tiện mở khoá bộ phát; điện thoại có cuộc gọi tới
// hay chuyển sang app khác thì bộ phát bị tạm dừng, chạm lại là chạy tiếp. Trả về hàm gỡ ra.
export function setupSound(): () => void {
  const events = ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const
  for (const event of events) window.addEventListener(event, unlock, { capture: true, passive: true })
  return () => {
    for (const event of events) window.removeEventListener(event, unlock, { capture: true })
  }
}

// Phát tiếng `name` sau `delay` giây. Bộ phát đang dừng mà người chơi không vừa chạm vào trang (ví dụ báo hết giờ
// lúc vừa tải lại trang) thì bỏ qua, kẻo tiếng dồn lại rồi kêu một loạt khi bộ phát chạy tiếp.
export function playSound(name: SoundName, delay = 0): void {
  const buffer = buffers.get(name)
  if (!enabled || !ctx || !output || !buffer) return
  if (ctx.state !== 'running' && performance.now() - lastTouch > 1000) return
  const source = ctx.createBufferSource()
  source.buffer = buffer
  // Tiếng quân cờ mỗi lần cao thấp khác nhau chút xíu cho tự nhiên, không đều đều như máy.
  if (name === 'move' || name === 'capture' || name === 'castle') source.playbackRate.value = 0.98 + Math.random() * 0.04
  source.connect(output)
  source.start(ctx.currentTime + delay)
}

// Một nước đi kêu những tiếng nào, kèm độ trễ (giây): tiếng quân (đi, ăn quân, nhập thành), rồi tiếng báo chiếu
// hoặc phong cấp. Nước chiếu bí thì không báo nữa, vì tiếng hết ván sẽ vang lên ngay sau đó.
export function moveSounds(facts: MoveFacts): [SoundName, number][] {
  const sounds: [SoundName, number][] = [[facts.castle ? 'castle' : facts.capture ? 'capture' : 'move', 0]]
  if (facts.mate) return sounds
  if (facts.check) sounds.push(['check', ACCENT_DELAY])
  else if (facts.promotion) sounds.push(['promote', ACCENT_DELAY])
  return sounds
}

export function playMove(facts: MoveFacts): void {
  for (const [name, delay] of moveSounds(facts)) playSound(name, delay)
}
