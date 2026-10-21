// Tạo các file âm thanh (MP3) cho bàn cờ, ghi vào src/sounds/<tên bộ>/.
// Tiếng gỗ là tiếng thu thật của Kenney (CC0, trong tools/sounds/kenney/); tiếng mộc cầm, chuông,
// 8-bit và bong bóng do chính file này tự tạo bằng toán, nên muốn sửa tiếng thì sửa số ở đây rồi chạy lại.
//
// Cách chạy (cần cài ffmpeg): node tools/sounds/make-sounds.mjs [tên bộ ...]
// Không ghi tên bộ thì tạo hết các bộ.
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SR = 44100 // số mẫu mỗi giây
const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '../../src/sounds')

// ---------- Đọc, ghi file (nhờ ffmpeg) ----------

function load(name) {
  const result = spawnSync('ffmpeg', ['-v', 'error', '-i', join(HERE, 'kenney', name), '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], {
    maxBuffer: 1 << 26,
  })
  if (result.status !== 0) throw new Error(`Không đọc được ${name}: ${result.stderr}`)
  // Chép ra vùng nhớ riêng để đọc thành số thực 4 byte cho thẳng hàng.
  return trimStart(new Float32Array(new Uint8Array(result.stdout).buffer))
}

function writeMp3(x, file) {
  const result = spawnSync(
    'ffmpeg',
    ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '1', '-i', '-', '-c:a', 'libmp3lame', '-b:a', '96k', file],
    { input: Buffer.from(x.buffer, x.byteOffset, x.byteLength) },
  )
  if (result.status !== 0) throw new Error(`Không ghi được ${file}: ${result.stderr}`)
}

// ---------- Xử lý tiếng ----------

const samples = (seconds) => new Float32Array(Math.ceil(seconds * SR))

// Ghép nhiều lớp tiếng chồng lên nhau: { sound, at (giây), gain (độ to) }.
function mix(...layers) {
  const length = Math.max(...layers.map(({ sound, at = 0 }) => Math.round(at * SR) + sound.length))
  const out = new Float32Array(length)
  for (const { sound, at = 0, gain = 1 } of layers) {
    const offset = Math.round(at * SR)
    for (let i = 0; i < sound.length; i++) out[offset + i] += sound[i] * gain
  }
  return out
}

// Phát nhanh hơn `rate` lần: tiếng cao và gọn hơn (như tua nhanh băng cát-sét).
function speed(x, rate) {
  const out = new Float32Array(Math.floor(x.length / rate))
  for (let i = 0; i < out.length; i++) {
    const pos = i * rate
    const j = Math.floor(pos)
    const frac = pos - j
    out[i] = x[j] * (1 - frac) + (x[j + 1] ?? 0) * frac
  }
  return out
}

// Bộ lọc âm sắc chuẩn (công thức "Audio EQ Cookbook" của Robert Bristow-Johnson).
function filter(x, type, freq, { q = Math.SQRT1_2, gainDb = 0 } = {}) {
  const w = (2 * Math.PI * freq) / SR
  const cos = Math.cos(w)
  const alpha = Math.sin(w) / (2 * q)
  const A = 10 ** (gainDb / 40)
  const coefs = {
    lowpass: [(1 - cos) / 2, 1 - cos, (1 - cos) / 2, 1 + alpha, -2 * cos, 1 - alpha],
    highpass: [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2, 1 + alpha, -2 * cos, 1 - alpha],
    bandpass: [alpha, 0, -alpha, 1 + alpha, -2 * cos, 1 - alpha],
    peak: [1 + alpha * A, -2 * cos, 1 - alpha * A, 1 + alpha / A, -2 * cos, 1 - alpha / A],
  }[type]
  const [b0, b1, b2, a0, a1, a2] = coefs
  const out = new Float32Array(x.length)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let i = 0; i < x.length; i++) {
    const y = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0
    x2 = x1
    x1 = x[i]
    y2 = y1
    y1 = y
    out[i] = y
  }
  return out
}

// Bỏ đoạn im lặng ở đầu để bấm là nghe ngay.
function trimStart(x, threshold = 0.02) {
  const peak = x.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
  const start = x.findIndex((v) => Math.abs(v) > peak * threshold)
  return x.slice(Math.max(0, start - 16))
}

// Tắt dần ở cuối cho khỏi nghe tiếng "bụp" khi cắt.
function fadeOut(x, seconds) {
  const n = Math.min(x.length, Math.round(seconds * SR))
  for (let i = 0; i < n; i++) x[x.length - n + i] *= 0.5 + 0.5 * Math.cos((Math.PI * i) / n)
  return x
}

function cut(x, seconds) {
  return fadeOut(x.slice(0, Math.round(seconds * SR)), Math.min(0.04, seconds / 3))
}

// Nén bớt đỉnh nhọn lúc vừa gõ (giảm tối đa `db` dB), để phần thân tiếng to lên mà không rè.
function limit(x, db, release = 0.03) {
  let peak = 0
  for (const v of x) peak = Math.max(peak, Math.abs(v))
  const ceiling = peak * 10 ** (-db / 20)
  const ahead = Math.round(0.002 * SR)
  const fall = Math.exp(-1 / (release * SR))
  const out = new Float32Array(x.length)
  let env = 0
  for (let i = 0; i < x.length; i++) {
    let next = 0
    for (let k = 0; k < ahead && i + k < x.length; k++) next = Math.max(next, Math.abs(x[i + k]))
    env = Math.max(next, env * fall)
    out[i] = env > ceiling ? (x[i] * ceiling) / env : x[i]
  }
  return out
}

// Tiếng to nhất trong 50 ms, tính bằng dB.
function windowDb(y) {
  const win = Math.round(0.05 * SR)
  let sum = 0
  let best = 0
  for (let i = 0; i < y.length; i++) {
    sum += y[i] * y[i]
    if (i >= win) sum -= y[i - win] * y[i - win]
    best = Math.max(best, sum)
  }
  return 10 * Math.log10(best / win + 1e-12)
}

// Độ to cảm nhận: trung bình giữa nghe bằng tai nghe (bỏ phần dưới 300 Hz) và bằng loa điện thoại
// (loa nhỏ gần như không phát được tiếng dưới 700 Hz), để tiếng nào cũng nghe rõ trên điện thoại.
function loudness(x) {
  const headphones = windowDb(filter(x, 'highpass', 300))
  const phone = windowDb(filter(filter(filter(x, 'highpass', 700), 'highpass', 700), 'lowpass', 9000))
  return (headphones + phone) / 2
}

// Chỉnh mọi tiếng về cùng mức to đã định, không để vượt trần (-1 dB) cho khỏi rè.
function finish(x, targetDb) {
  let peak = 0
  for (const v of x) peak = Math.max(peak, Math.abs(v))
  const gain = Math.min(10 ** ((targetDb - loudness(x)) / 20), 10 ** (-1 / 20) / peak)
  let end = x.length
  while (end > 0 && Math.abs(x[end - 1] * gain) < 1e-4) end--
  const out = x.slice(0, end).map((v) => v * gain)
  return fadeOut(out, 0.01)
}

// ---------- Tự tạo tiếng ----------

// Số ngẫu nhiên có hạt giống cố định: chạy lại bao nhiêu lần cũng ra đúng tiếng cũ.
function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function noise(seconds, decay, seed = 1) {
  const rand = random(seed)
  const x = samples(seconds)
  for (let i = 0; i < x.length; i++) x[i] = (rand() * 2 - 1) * Math.exp(-i / SR / decay)
  return x
}

// Một nốt nhạc gồm nhiều họa âm: [bội số tần số, độ to, thời gian tắt dần (giây)].
function tone(freq, partials, seconds, attack = 0.002) {
  const x = samples(seconds)
  for (const [ratio, amp, decay] of partials) {
    const w = (2 * Math.PI * freq * ratio) / SR
    if (freq * ratio > SR / 2.2) continue
    for (let i = 0; i < x.length; i++) x[i] += amp * Math.sin(w * i) * Math.exp(-i / SR / decay)
  }
  const n = Math.round(attack * SR)
  for (let i = 0; i < n; i++) x[i] *= i / n
  return x
}

const note = (name) => {
  const [, letter, accidental, octave] = /^([A-G])(#?)(\d)$/.exec(name)
  const semitone = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letter] + (accidental ? 1 : 0)
  return 440 * 2 ** ((semitone - 9) / 12 + (Number(octave) - 4))
}

// Mộc cầm (marimba): thanh gỗ gõ bằng dùi, họa âm thứ hai cao gấp ~4 lần, tắt rất nhanh.
function marimba(name, seconds = 1) {
  const f = note(name)
  const body = Math.min(0.6, 0.35 * (523 / f) ** 0.5)
  const bar = tone(f, [[1, 1, body], [3.93, 0.32, 0.09], [9.2, 0.08, 0.025]], seconds)
  const mallet = filter(noise(0.01, 0.002, Math.round(f)), 'lowpass', 3500)
  return mix({ sound: bar }, { sound: mallet, gain: 0.25 })
}

// Chuông nhỏ trong veo (như chuông gió / đàn celesta).
function bell(name, seconds = 1.2) {
  const f = note(name)
  return tone(f, [[1, 1, 0.7], [1.003, 0.4, 0.7], [2, 0.35, 0.3], [3, 0.12, 0.18], [4.2, 0.06, 0.1]], seconds, 0.003)
}

// Mõ gỗ: "tách" ngắn, dùng cho tiếng tích tắc.
function woodblock(freq) {
  const body = tone(freq, [[1, 1, 0.028], [2.71, 0.35, 0.012]], 0.12, 0.0008)
  const click = filter(noise(0.006, 0.0015, Math.round(freq)), 'highpass', 2000)
  return mix({ sound: body }, { sound: click, gain: 0.3 })
}

// Sóng xung của máy chơi game 8-bit. `from` -> `to`: trượt cao độ; `duty`: độ "mỏng" của tiếng.
// Cộng từng họa âm (chuỗi Fourier) thay vì vẽ sóng vuông thô, để tiếng gọn mà không rè.
function pulse({ from, to = from, seconds, duty = 0.5, decay = Infinity, vibrato = 0 }) {
  const x = samples(seconds)
  let phase = 0
  for (let i = 0; i < x.length; i++) {
    const t = i / SR
    const wobble = vibrato ? 1 + 0.012 * Math.sin(2 * Math.PI * vibrato * t) * Math.min(1, t / 0.08) : 1
    const f = from * (to / from) ** (t / seconds) * wobble
    phase += f / SR
    let v = 0
    for (let n = 1; n * f < SR / 2.2; n++) v += (Math.sin(Math.PI * n * duty) / n) * Math.cos(2 * Math.PI * n * phase)
    const edge = Math.min(1, i / (0.002 * SR), (x.length - i) / (0.004 * SR))
    x[i] = (2 / Math.PI) * v * Math.exp(-t / decay) * edge
  }
  return x
}

// Sóng tam giác 8-bit (tiếng trầm êm, hay dùng làm bè).
function triangle(name, seconds) {
  const f = note(name)
  const partials = []
  for (let n = 1; n * f < SR / 2.2; n += 2) partials.push([n, (8 / (Math.PI * Math.PI)) * (((n - 1) / 2) % 2 ? -1 : 1) / (n * n), 10])
  const x = tone(f, partials, seconds)
  return fadeOut(x, 0.03)
}

// Tiếng ồn kiểu máy 8-bit (thanh ghi dịch 15 bit như máy NES), dùng cho tiếng "rắc".
function chipNoise(seconds, decay, clock = 16000) {
  const x = samples(seconds)
  let reg = 1
  let value = 1
  let acc = 0
  for (let i = 0; i < x.length; i++) {
    acc += clock / SR
    while (acc >= 1) {
      acc -= 1
      const bit = (reg ^ (reg >> 1)) & 1
      reg = (reg >> 1) | (bit << 14)
      value = reg & 1 ? 1 : -1
    }
    x[i] = value * Math.exp(-i / SR / decay)
  }
  return x
}

// Bong bóng: tiếng "bóp" có cao độ vút lên, như bọt nước vỡ.
function bubble(from, to, decay = 0.03, seconds = 0.12) {
  const x = samples(seconds)
  let phase = 0
  for (let i = 0; i < x.length; i++) {
    const t = i / SR
    const f = from + (to - from) * (1 - Math.exp(-t / 0.025))
    phase += (2 * Math.PI * f) / SR
    const edge = Math.min(1, i / (0.001 * SR))
    x[i] = Math.sin(phase) * Math.exp(-t / decay) * edge
  }
  return x
}

function arpeggio(make, names, step, last = 1) {
  return mix(...names.map((name, i) => ({ sound: make(name), at: i * step, gain: i === names.length - 1 ? last : 0.85 })))
}

// ---------- Ba bộ tiếng ----------

// Mức to cho từng loại tiếng (dB): ăn quân to hơn đi thường một chút; tiếng báo (chiếu, hết ván...) nổi hơn tiếng đi quân
// cỡ 4–5 dB như trên lichess, đủ chú ý mà không giật mình. Chiếu và phong cấp chỉ là phần "điểm thêm":
// lúc chơi, web phát chúng chồng lên tiếng đi quân hoặc ăn quân.
const LEVEL = { move: -20, capture: -18, castle: -20, check: -19, promote: -19.5, end: -19, draw: -20, lowTime: -19, start: -21 }

const SETS = {
  // Gỗ: quân gỗ đặt xuống bàn gỗ (tiếng thu thật), thông báo bằng mộc cầm cho hợp tông gỗ.
  wood() {
    // Tiếng gốc là gõ vào khối gỗ to, còn quân cờ thì nhỏ: phát nhanh hơn cho tiếng cao và gọn, bỏ tiếng ù
    // dưới 200 Hz, tăng dải 2 kHz rồi nén đỉnh, để tiếng "cộc" nghe rõ cả trên loa điện thoại.
    const knock = (name, rate) => {
      const raw = speed(cut(load(name), 0.22), rate)
      return limit(filter(filter(filter(raw, 'highpass', 200), 'highpass', 200), 'peak', 2000, { q: 0.8, gainDb: 6 }), 8, 0.008)
    }
    // Chút tiếng trầm của mặt bàn gỗ cho ấm, khi nghe bằng tai nghe.
    const board = filter(cut(load('impactWood_light_002.ogg'), 0.15), 'highpass', 90)
    const place = mix({ sound: knock('impactWood_light_004.ogg', 1.4) }, { sound: board, gain: 0.2 })
    // Ăn quân: tiếng "cạch" của hai quân va nhau, rồi quân đáp xuống bàn.
    const clack = filter(cut(load('chips-collide-1.ogg'), 0.12), 'highpass', 900)
    return {
      move: place,
      capture: limit(
        mix(
          { sound: knock('impactWood_light_002.ogg', 1.7) },
          { sound: clack, gain: 0.6 },
          { sound: knock('impactWood_medium_000.ogg', 1.25), at: 0.02, gain: 0.7 },
          { sound: board, at: 0.02, gain: 0.2 },
        ),
        6,
        0.01,
      ),
      castle: mix({ sound: place }, { sound: knock('impactWood_light_000.ogg', 1.45), at: 0.15, gain: 0.85 }, { sound: board, at: 0.15, gain: 0.15 }),
      check: mix({ sound: marimba('E6', 0.7) }, { sound: marimba('E6', 0.6), at: 0.11, gain: 0.7 }),
      promote: arpeggio((n) => marimba(n, 0.7), ['G5', 'B5', 'D6', 'G6'], 0.055),
      end: mix(
        { sound: arpeggio((n) => marimba(n, 1.2), ['C5', 'E5', 'G5', 'C6'], 0.11, 1.1) },
        { sound: bell('C7', 1.2), at: 0.33, gain: 0.12 },
      ),
      draw: mix(
        { sound: arpeggio((n) => marimba(n, 1), ['E5', 'C5'], 0.17) },
        { sound: bell('E6', 0.8), gain: 0.25 },
        { sound: bell('C6', 0.9), at: 0.17, gain: 0.25 },
      ),
      lowTime: mix(...[0, 0.2, 0.4, 0.6].map((at, i) => ({ sound: woodblock(i % 2 ? 1050 : 1400), at, gain: 1 - i * 0.12 }))),
      start: arpeggio((n) => marimba(n, 0.9), ['C5', 'G5'], 0.12),
    }
  },

  // 8-bit: tiếng máy chơi game đời cũ (kiểu NES), vui nhộn.
  '8bit'() {
    const blip = (from, to, seconds = 0.06) => pulse({ from, to, seconds, duty: 0.25, decay: 0.035 })
    const beep = (name, seconds, opts = {}) => pulse({ from: note(name), seconds, duty: 0.5, ...opts })
    return {
      move: blip(1200, 800),
      capture: mix(
        { sound: chipNoise(0.12, 0.03, 18000), gain: 0.5 },
        { sound: pulse({ from: 330, to: 110, seconds: 0.11, duty: 0.5, decay: 0.05 }), gain: 0.8 },
      ),
      castle: mix({ sound: blip(990, 700) }, { sound: blip(1320, 930), at: 0.09 }),
      check: mix(...[0, 1, 2].map((i) => ({ sound: beep(i % 2 ? 'D6' : 'G6', 0.055), at: i * 0.07, gain: 0.8 }))),
      promote: arpeggio((n) => pulse({ from: note(n), seconds: 0.06, duty: 0.125, decay: 0.05 }), ['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'], 0.035),
      end: mix(
        ...['G5', 'C6', 'E6'].map((n, i) => ({ sound: beep(n, 0.09, { decay: 0.2 }), at: i * 0.1, gain: 0.7 })),
        { sound: beep('G6', 0.42, { decay: 0.35, vibrato: 6 }), at: 0.3, gain: 0.75 },
        { sound: triangle('C4', 0.3), gain: 0.6 },
        { sound: triangle('G4', 0.42), at: 0.3, gain: 0.6 },
      ),
      draw: mix({ sound: beep('E5', 0.12, { decay: 0.15 }), gain: 0.6 }, { sound: beep('C5', 0.24, { decay: 0.18 }), at: 0.16, gain: 0.6 }),
      lowTime: mix(...[0, 0.11, 0.4, 0.51].map((at) => ({ sound: beep('A6', 0.035), at, gain: 0.5 }))),
      start: mix({ sound: beep('B5', 0.07), gain: 0.6 }, { sound: beep('E6', 0.32, { decay: 0.12 }), at: 0.07, gain: 0.6 }),
    }
  },

  // Bong bóng: tiếng "bóp" tròn trịa, nhẹ nhàng, kiểu ứng dụng hiện đại.
  bubble() {
    const ding = (name, seconds = 0.6) => tone(note(name), [[1, 1, 0.22], [2.01, 0.25, 0.08], [3.02, 0.06, 0.04]], seconds, 0.002)
    const pop = filter(noise(0.008, 0.0015, 7), 'bandpass', 2500, { q: 1.2 })
    return {
      move: mix({ sound: bubble(520, 980) }, { sound: pop, gain: 0.15 }),
      capture: mix(
        { sound: bubble(330, 700, 0.04, 0.15) },
        { sound: pop, gain: 0.35 },
        { sound: bubble(760, 1300, 0.025), at: 0.035, gain: 0.7 },
      ),
      castle: mix({ sound: bubble(480, 900) }, { sound: bubble(640, 1150), at: 0.11, gain: 0.9 }),
      check: mix({ sound: ding('A6', 0.5) }, { sound: ding('E6', 0.5), at: 0.1, gain: 0.9 }),
      promote: mix(...[0, 1, 2, 3].map((i) => ({ sound: bubble(500 + i * 180, 950 + i * 300), at: i * 0.055, gain: 0.85 }))),
      end: mix(...['C6', 'E6', 'G6', 'C7'].map((n, i) => ({ sound: ding(n, 0.9), at: i * 0.1, gain: i === 3 ? 0.9 : 0.7 }))),
      draw: mix({ sound: ding('G6', 0.6), gain: 0.6 }, { sound: ding('C6', 0.7), at: 0.16, gain: 0.6 }),
      lowTime: mix(...[0, 0.2, 0.4, 0.6].map((at, i) => ({ sound: bubble(1500, 1900, 0.012, 0.05), at, gain: 1 - i * 0.1 }))),
      start: mix({ sound: bubble(450, 850) }, { sound: ding('E6', 0.6), at: 0.08, gain: 0.5 }),
    }
  },
}

const FILES = { move: 'move', capture: 'capture', castle: 'castle', check: 'check', promote: 'promote', end: 'end', draw: 'draw', lowTime: 'low-time', start: 'start' }

const wanted = process.argv.slice(2)
for (const [name, make] of Object.entries(SETS)) {
  if (wanted.length > 0 && !wanted.includes(name)) continue
  const dir = join(OUT, name)
  mkdirSync(dir, { recursive: true })
  for (const [event, sound] of Object.entries(make())) {
    writeMp3(finish(sound, LEVEL[event]), join(dir, `${FILES[event]}.mp3`))
  }
  console.log(`Đã tạo bộ ${name} trong ${dir}`)
}
