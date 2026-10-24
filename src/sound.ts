// Âm thanh của bàn cờ. Phát bằng Web Audio để bấm là kêu ngay (thẻ <audio> trên điện thoại hay bị trễ).
// Trình duyệt chỉ cho phát tiếng sau khi người chơi chạm vào trang, nên bộ phát được bật ở lần chạm đầu tiên.
import type { MoveFacts } from './game/rules'

// Các bộ tiếng, tạo bằng `npm run sounds` (xem tools/sounds/make-sounds.mjs). Mỗi bộ là một thư mục trong src/sounds.
// Tên tiếng Việt và nhóm của từng bộ nằm ở soundCatalog.ts.
export const SOUND_SETS = [
  'wood',
  'steel',
  'bronze',
  'cast-iron',
  'crystal',
  'glass-marbles',
  'thick-glass',
  'polished-stone',
  'pebbles',
  'stone-table',
  'hand-drum',
  'festival-drum',
  'bass-drum',
  'bass-808',
  '8bit',
  'bubble',
] as const
export type SoundSet = (typeof SOUND_SETS)[number]

export const SOUND_NAMES = ['move', 'capture', 'castle', 'check', 'promote', 'end', 'draw', 'lowTime', 'start'] as const
export type SoundName = (typeof SOUND_NAMES)[number]

// Đường dẫn tới mọi file tiếng (bản gộp một file thì là chính dữ liệu "data:..."). Máy chỉ tải bộ đang dùng.
const URLS = import.meta.glob<string>('./sounds/*/*.mp3', { eager: true, import: 'default' })

// File của tiếng `name` trong bộ `set`, ví dụ lowTime của bộ Gỗ là sounds/wood/low-time.mp3.
export function soundUrl(set: SoundSet, name: SoundName): string | undefined {
  const file = name.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase())
  return URLS[`./sounds/${set}/${file}.mp3`]
}

// Bộ mà mỗi tiếng là một nốt nhạc: chỉ được lệch cao thấp rất ít, kẻo nghe như đàn lạc dây.
const TUNED = new Set<SoundSet>(['bass-808'])

// Tiếng báo chiếu, phong cấp vang lên ngay sau tiếng quân đặt xuống.
const ACCENT_DELAY = 0.03
// Ván kết thúc bằng một nước đi (chiếu bí, hòa) thì tiếng hết ván chờ tiếng quân đặt xuống xong mới kêu.
export const END_DELAY = 0.2

// Một chuỗi tiếng: [tên tiếng, lúc phát tính bằng giây].
export type Sample = [SoundName, number][]

let ctx: AudioContext | null = null
let output: GainNode | null = null
let enabled = true
let current: SoundSet = 'wood'
let lastTouch = 0
// Tiếng đã đọc xong của từng bộ. Mỗi bộ chỉ đọc một lần, lúc cần tới.
const buffers = new Map<SoundSet, Map<SoundName, AudioBuffer>>()
const loading = new Map<SoundSet, Promise<void>>()

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

// Đọc cả bộ `set` cho sẵn sàng phát. Chưa có bộ phát (chưa chạm vào trang) thì để lúc mở khoá mới đọc.
function load(set: SoundSet): Promise<void> {
  const audio = ctx
  if (!audio) return Promise.resolve()
  let done = loading.get(set)
  if (!done) {
    const ready = new Map<SoundName, AudioBuffer>()
    buffers.set(set, ready)
    done = Promise.all(
      SOUND_NAMES.map(async (name) => {
        const url = soundUrl(set, name)
        if (!url) return
        try {
          ready.set(name, await audio.decodeAudioData(await read(url)))
        } catch {
          // Máy không đọc được tiếng nào thì tiếng đó im, ván vẫn chơi bình thường.
        }
      }),
    ).then(() => {})
    loading.set(set, done)
  }
  return done
}

// Đổi sang bộ tiếng `set`. Xong khi bộ đó đã sẵn sàng phát.
export function selectSoundSet(set: SoundSet): Promise<void> {
  current = set
  return load(set)
}

function unlock(): void {
  lastTouch = performance.now()
  if (!ctx) {
    if (typeof AudioContext === 'undefined') return
    ctx = new AudioContext()
    output = ctx.createGain()
    output.gain.value = 0.9
    output.connect(ctx.destination)
    // iPhone đời cũ cần phát một tiếng (dù im lặng) ngay trong lần chạm thì mới mở khoá.
    const silence = ctx.createBufferSource()
    silence.buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
    silence.connect(ctx.destination)
    silence.start()
    load(current)
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

// Phát tiếng `name` của bộ `set` sau `delay` giây; trả về nguồn phát (để dừng được), hoặc null nếu không phát.
// Bộ phát đang dừng mà người chơi không vừa chạm vào trang (ví dụ báo hết giờ lúc vừa tải lại trang) thì bỏ qua,
// kẻo tiếng dồn lại rồi kêu một loạt khi bộ phát chạy tiếp.
function start(set: SoundSet, name: SoundName, delay: number): AudioBufferSourceNode | null {
  const buffer = buffers.get(set)?.get(name)
  if (!ctx || !output || !buffer) return null
  if (ctx.state !== 'running' && performance.now() - lastTouch > 1000) return null
  const source = ctx.createBufferSource()
  source.buffer = buffer
  // Tiếng quân cờ mỗi lần cao thấp khác nhau chút xíu cho tự nhiên, không đều đều như máy.
  if (name === 'move' || name === 'capture' || name === 'castle') {
    const spread = TUNED.has(set) ? 0.01 : 0.04
    source.playbackRate.value = 1 - spread / 2 + Math.random() * spread
  }
  source.connect(output)
  source.start(ctx.currentTime + delay)
  return source
}

// Phát tiếng `name` của bộ đang dùng sau `delay` giây (tắt tiếng thì thôi).
export function playSound(name: SoundName, delay = 0): void {
  if (enabled) start(current, name, delay)
}

let sample: AudioBufferSourceNode[] = []
let sampleTurn = 0

// Nghe thử chuỗi tiếng `steps` của bộ `set` mà không đổi bộ đang dùng; nút tắt tiếng không chặn, vì người chơi tự
// bấm nghe. Đoạn đang nghe dở thì dừng lại. Trả về số giây đoạn nghe kéo dài, hoặc 0 nếu không phát được (máy không
// đọc được tiếng, hay đã bấm nghe đoạn khác trong lúc chờ đọc tiếng).
export async function playSample(set: SoundSet, steps: Sample): Promise<number> {
  stopSample()
  const turn = ++sampleTurn
  await load(set)
  if (turn !== sampleTurn || !ctx) return 0
  let length = 0
  for (const [name, at] of steps) {
    const source = start(set, name, at)
    if (!source?.buffer) continue
    sample.push(source)
    length = Math.max(length, at + source.buffer.duration / source.playbackRate.value)
  }
  return length
}

export function stopSample(): void {
  sampleTurn++
  for (const source of sample) {
    try {
      source.stop()
    } catch {
      // Tiếng đã tắt rồi.
    }
  }
  sample = []
}

// Một nước đi kêu những tiếng nào, kèm độ trễ (giây): tiếng quân (đi, ăn quân, nhập thành), rồi tiếng báo chiếu
// hoặc phong cấp. Nước chiếu bí thì không báo nữa, vì tiếng hết ván sẽ vang lên ngay sau đó.
export function moveSounds(facts: MoveFacts): Sample {
  const sounds: Sample = [[facts.castle ? 'castle' : facts.capture ? 'capture' : 'move', 0]]
  if (facts.mate) return sounds
  if (facts.check) sounds.push(['check', ACCENT_DELAY])
  else if (facts.promotion) sounds.push(['promote', ACCENT_DELAY])
  return sounds
}

export function playMove(facts: MoveFacts): void {
  for (const [name, delay] of moveSounds(facts)) playSound(name, delay)
}

// Tiếng "tách" nhỏ khi có câu chat mới: hai nốt ngắn tự tạo bằng Web Audio, không theo bộ tiếng quân cờ, để nghe là
// biết có tin nhắn chứ không nhầm với tiếng đối thủ đi quân. Tắt tiếng thì thôi.
export function playChatSound(): void {
  if (!enabled || !ctx || !output) return
  if (ctx.state !== 'running' && performance.now() - lastTouch > 1000) return
  const now = ctx.currentTime
  for (const [frequency, at] of [
    [988, 0],
    [1319, 0.07],
  ]) {
    const tone = ctx.createOscillator()
    const volume = ctx.createGain()
    tone.frequency.value = frequency
    volume.gain.setValueAtTime(0.0001, now + at)
    volume.gain.exponentialRampToValueAtTime(0.16, now + at + 0.008)
    volume.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.09)
    tone.connect(volume).connect(output)
    tone.start(now + at)
    tone.stop(now + at + 0.1)
  }
}
