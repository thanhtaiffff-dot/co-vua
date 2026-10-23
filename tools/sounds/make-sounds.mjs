// Tạo các file âm thanh (MP3) cho bàn cờ, ghi vào src/sounds/<tên bộ>/.
// Các bộ Gỗ, Kim loại (Thép, Đồng, Gang) và Thủy tinh (Pha lê, Bi ve, Kính dày) là tiếng thu thật của Kenney
// (CC0, trong tools/sounds/kenney/). Các bộ Đá (Cẩm thạch, Sỏi, Bàn đá), Trống, Bass, 8-bit và Bong bóng do chính
// file này tự tạo bằng toán; riêng Bàn đá lót thêm tiếng chạm nền xi măng của Kenney. Muốn sửa tiếng thì sửa số ở
// đây rồi chạy lại.
// Mỗi bộ chỉ có tiếng của đúng chất liệu, nhạc cụ đó (không chen chuông hay nhạc cụ khác), riêng 8-bit là tiếng máy
// game.
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

function read(name) {
  const result = spawnSync('ffmpeg', ['-v', 'error', '-i', join(HERE, 'kenney', name), '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], {
    maxBuffer: 1 << 26,
  })
  if (result.status !== 0) throw new Error(`Không đọc được ${name}: ${result.stderr}`)
  // Chép ra vùng nhớ riêng để đọc thành số thực 4 byte cho thẳng hàng.
  return new Float32Array(new Uint8Array(result.stdout).buffer)
}

function load(name) {
  return trimStart(read(name))
}

// Lấy riêng một cú chạm trong bản thu có nhiều cú (như xúc xắc nảy trên bàn): tìm chỗ bắt đầu quanh giây `at`,
// lấy `seconds` giây, vuốt nhẹ hai đầu cho khỏi lụp bụp.
function hit(name, at, seconds) {
  const x = read(name)
  const from = Math.max(0, Math.round((at - 0.02) * SR))
  const to = Math.min(x.length, Math.round((at + 0.03) * SR))
  let peak = 0
  for (let i = from; i < to; i++) peak = Math.max(peak, Math.abs(x[i]))
  let onset = from
  while (onset < to && Math.abs(x[onset]) < peak * 0.25) onset++
  const start = Math.max(0, onset - Math.round(0.0015 * SR))
  const out = x.slice(start, start + Math.round(seconds * SR))
  const fadeIn = Math.round(0.0008 * SR)
  for (let i = 0; i < fadeIn; i++) out[i] *= i / fadeIn
  return fadeOut(out, Math.min(0.03, seconds / 3))
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

// Tiếng gõ thật rất ngắn, đỉnh nhọn lúc chạm, nên chạm trần trước khi đủ to. Nén riêng cái đỉnh đó vừa đủ để đạt
// mức to `targetDb`, nhưng không quá 6 dB cho tiếng còn tự nhiên (thiếu thì chịu nhỏ hơn chút).
function softenPeak(x, targetDb) {
  let peak = 0
  for (const v of x) peak = Math.max(peak, Math.abs(v))
  const over = targetDb - loudness(x) + 20 * Math.log10(peak) + 1
  return over > 0.2 ? limit(x, Math.min(over, 6), 0.006) : x
}

// Trọng số A: tai người nghe tiếng trầm nhỏ hơn thực tế (tiếng 60 Hz phải to hơn chừng 25 dB mới nghe bằng tiếng
// 1 kHz). Gồm bốn khâu lọc cao bậc 1 (20,6 Hz hai lần, 107,7 Hz, 737,9 Hz) và hai khâu lọc thấp (12,2 kHz hai lần).
function stage(x, f, high) {
  const c = Math.tan((Math.PI * f) / SR)
  const a = (1 - c) / (1 + c)
  const out = new Float32Array(x.length)
  let x1 = 0
  let y1 = 0
  for (let i = 0; i < x.length; i++) {
    const y = high ? (x[i] - x1) / (1 + c) + a * y1 : (c * (x[i] + x1)) / (1 + c) + a * y1
    x1 = x[i]
    y1 = y
    out[i] = y
  }
  return out
}
const aRaw = (x) => stage(stage(stage(stage(stage(stage(x, 20.6, true), 20.6, true), 107.7, true), 737.9, true), 12194, false), 12194, false)
// Chuẩn để tiếng 1 kHz đi qua không đổi.
const A_NORM = (() => {
  const probe = new Float32Array(SR)
  for (let i = 0; i < SR; i++) probe[i] = Math.sin((2 * Math.PI * 1000 * i) / SR)
  return 1 / Math.sqrt(((aRaw(probe).slice(SR / 2).reduce((s, v) => s + v * v, 0) / (SR / 2)) * 2))
})()
const aDb = (x) => windowDb(aRaw(x).map((v) => v * A_NORM))

// Cân độ to cho bộ nhiều tiếng trầm (trống, bass). `finish` bỏ qua tiếng dưới 300 Hz nên bass sẽ ù quá hoặc chiếm hết
// trần; ở đây đo theo trọng số A, đặt cao hơn mức chung 0,8 dB (các bộ khác đo kiểu này cũng nằm quanh đó). Đỉnh vượt
// trần thì nén nhả chậm (50 ms) cho tiếng bass khỏi rè; còn vượt nữa thì hạ cả tiếng.
function level(x, targetDb) {
  const peakDb = (y) => 20 * Math.log10(y.reduce((m, v) => Math.max(m, Math.abs(v)), 1e-9))
  const gain = (y, db) => y.map((v) => v * 10 ** (db / 20))
  const want = targetDb + 0.8
  let y = gain(x, want - aDb(x))
  const over = peakDb(y) + 1
  if (over > 0.2) y = limit(y, Math.min(over + 0.3, 4), 0.05)
  y = gain(y, Math.min(want - aDb(y), -1 - peakDb(y)))
  let end = y.length
  while (end > 0 && Math.abs(y[end - 1]) < 1e-4) end--
  return fadeOut(y.slice(0, end), 0.01)
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

// Bong bóng: tiếng "bóp" có cao độ vút lên, như bọt nước vỡ. Bọt to thì vút lên chậm hơn (`glide` lớn hơn).
function bubble(from, to, decay = 0.03, seconds = 0.12, glide = 0.025) {
  const x = samples(seconds)
  let phase = 0
  for (let i = 0; i < x.length; i++) {
    const t = i / SR
    const f = from + (to - from) * (1 - Math.exp(-t / glide))
    phase += (2 * Math.PI * f) / SR
    const edge = Math.min(1, i / (0.001 * SR))
    x[i] = Math.sin(phase) * Math.exp(-t / decay) * edge
  }
  return x
}

function arpeggio(make, names, step, last = 1) {
  return mix(...names.map((name, i) => ({ sound: make(name), at: i * step, gain: i === names.length - 1 ? last : 0.85 })))
}

// Một cú chạm đá, dựng theo cách vật rắn rung thật: viên đá có nhiều tần số riêng (từ `low` trở lên, càng cao càng
// dày), cú chạm cứng và rất nhanh (`contact` giây) làm chúng cùng rung. Tần số càng cao tắt càng nhanh: thời gian
// tắt = 1 / (π × tần số × `damp`); `damp` lớn thì tiếng khô, nhỏ thì ngân. `grit`: tiếng sạn lúc mặt đá nhám cọ nhau.
// Mỗi `seed` cho một viên đá hơi khác, chạy lại vẫn ra đúng tiếng cũ.
function stoneHit({ low, high = 7500, damp = 0.004, tilt = 0.7, contact = 0.0004, grit = 0.15, seed = 1, seconds = 0.15 }) {
  const rand = random(seed)
  const n = Math.max(3, Math.round(contact * SR))
  const exc = new Float32Array(n)
  for (let i = 0; i < n; i++) exc[i] = Math.sin((Math.PI * (i + 0.5)) / n) * (0.85 + 0.3 * rand())
  const x = samples(seconds)
  for (let f = low * (0.97 + 0.06 * rand()); f < high; f *= 1.16 + 0.32 * rand()) {
    const amp = (low / f) ** tilt * (0.35 + 0.65 * rand())
    const decay = 1 / (Math.PI * f * damp)
    // Bộ cộng hưởng hai cực: rung ở tần số f, tắt dần sau `decay` giây.
    const r = Math.exp(-1 / (decay * SR))
    const w = (2 * Math.PI * f) / SR
    const a1 = -2 * r * Math.cos(w)
    const a2 = r * r
    let y1 = 0
    let y2 = 0
    const end = Math.min(x.length, Math.round(decay * 7 * SR) + n)
    for (let i = 0; i < end; i++) {
      const y = (i < n ? exc[i] : 0) - a1 * y1 - a2 * y2
      y2 = y1
      y1 = y
      x[i] += amp * y * Math.sin(w)
    }
  }
  if (grit) {
    const g = samples(0.006)
    for (let i = 0; i < g.length; i++) g[i] = (rand() * 2 - 1) * Math.exp(-i / SR / 0.0012)
    const hp = filter(g, 'highpass', 2500)
    for (let i = 0; i < hp.length; i++) x[i] += grit * hp[i]
  }
  return fadeOut(filter(x, 'highpass', 80), 0.01)
}

// Mặt trống tròn rung ở nhiều tần số riêng, tỉ lệ với nghiệm j(m, n) của hàm Bessel (m: số đường kính đứng yên).
const ZEROS = [
  [0, 2.4048], [1, 3.8317], [2, 5.1356], [0, 5.5201], [3, 6.3802], [1, 7.0156], [4, 7.5883], [2, 8.4172], [0, 8.6537],
  [5, 8.7715], [3, 9.761], [6, 9.9361], [1, 10.1735], [4, 11.0647], [7, 11.0864], [2, 11.6198], [0, 11.7915], [8, 12.2251],
  [5, 12.3386], [3, 13.0152], [9, 13.3543], [1, 13.3237], [6, 13.5893], [0, 14.9309],
]

// Hàm Bessel J_m(x), tính bằng tích phân: (1/π) ∫ cos(mτ − x sin τ) dτ, τ từ 0 tới π.
function bessel(m, x) {
  const n = 256
  let sum = 0
  for (let k = 0; k <= n; k++) {
    const t = (Math.PI * k) / n
    sum += (k === 0 || k === n ? 0.5 : 1) * Math.cos(m * t - x * Math.sin(t))
  }
  return sum / n
}

// Một cú gõ lên mặt trống.
// `f`: tần số trầm nhất của mặt trống (Hz). `at`: chỗ gõ, 0 là giữa mặt, 1 là sát vành. Gõ giữa thì trầm, đục;
// gõ gần vành thì nhiều tiếng cao, ngân. `contact`: tay hay dùi chạm mặt da bao lâu (giây): chạm lâu (tay mềm, ấn)
// thì tiếng ấm, chạm nhanh (dùi, đập dứt khoát) thì sáng. `ring`: mode (1,1) tắt sau bao lâu; mode cao tắt nhanh
// hơn; mode (0,1) đẩy không khí mạnh nên tắt nhanh. `glide`: gõ mạnh thì mặt da căng thêm, cao lên rồi trùng
// xuống. `slap`: tiếng "bốp" của da tay hay đầu dùi đập vào mặt da. `body`: tiếng thùng trống cộng hưởng
// [tần số, độ to, thời gian tắt]. `velocity`: gõ mạnh nhẹ (1 là vừa).
function skin({ f, at = 0.6, contact = 0.001, ring = 0.25, glide = 0.04, glideTime = 0.05, slap = 0, slapTone = 2500, body = null, velocity = 1, seed = 1, seconds = 0.6, top = 7000 }) {
  const rand = random(seed)
  const x = samples(seconds)
  const hard = contact / (0.7 + 0.3 * velocity)
  const f11 = f * (3.8317 / 2.4048)
  for (const [m, j] of ZEROS) {
    const freq = f * (j / 2.4048) * (0.994 + 0.012 * rand())
    if (freq > top) continue
    // Dấu của mode tại chỗ gõ và ở chỗ tai nghe khác nhau, nên các mode không cùng dồn lên một đỉnh lúc vừa gõ.
    const ear = j < 4 ? 1 : rand() < 0.5 ? -1 : 1
    let amp = bessel(m, j * at) * ear * (m === 0 ? 1 : m === 1 ? 0.85 : 0.7)
    amp /= 1 + (2 * freq * hard) ** 2
    if (Math.abs(amp) < 1e-4) continue
    const tau = m === 0 && j < 3 ? ring * 0.4 : ring * Math.min(1.2, (f11 / freq) ** 0.75)
    const n = Math.min(x.length, Math.round(tau * 7 * SR))
    const g = glide * velocity
    let phase = 0
    for (let i = 0; i < n; i++) {
      const t = i / SR
      phase += (2 * Math.PI * freq * (1 + g * Math.exp(-t / glideTime))) / SR
      x[i] += amp * Math.sin(phase) * Math.exp(-t / tau)
    }
  }
  if (body) {
    const [bf, gain, decay] = body
    for (let i = 0; i < x.length; i++) x[i] += gain * Math.sin((2 * Math.PI * bf * i) / SR) * Math.exp(-i / SR / decay)
  }
  // Lực gõ tăng dần trong lúc chạm, nên tiếng không bật lên tức thì.
  const rise = Math.max(2, Math.round((hard / 2) * SR))
  for (let i = 0; i < rise; i++) x[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / rise)
  if (slap) {
    const s = samples(0.03)
    for (let i = 0; i < s.length; i++) s[i] = (rand() * 2 - 1) * Math.exp(-i / SR / 0.004)
    const crack = filter(filter(s, 'highpass', slapTone * 0.5), 'peak', slapTone, { q: 1.2, gainDb: 6 })
    let peak = 0
    for (const v of x) peak = Math.max(peak, Math.abs(v))
    for (let i = 0; i < crack.length; i++) x[i] += slap * peak * crack[i]
  }
  for (let i = 0; i < x.length; i++) x[i] *= velocity
  return fadeOut(filter(x, 'highpass', 40), 0.02)
}

// Biến đổi Fourier nhanh (tại chỗ), dùng để "đặt" tiếng trống vào một căn phòng.
function fft(re, im, inverse = false) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len / 2; k++) {
        const a = i + k
        const b = a + len / 2
        const br = re[b] * cr - im[b] * ci
        const bi = re[b] * ci + im[b] * cr
        re[b] = re[a] - br
        im[b] = im[a] - bi
        re[a] += br
        im[a] += bi
        const t = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = t
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) re[i] /= n
}

// Phòng nhỏ: tiếng dội sớm từ tường gần cộng một đuôi vang ngắn, tiếng cao tắt nhanh hơn tiếng trầm. Cho tiếng
// trống tròn, có không gian, không khô như máy. `tail`: thời gian vang tắt hẳn (giây); `wet`: độ to phần vang.
function room(x, { wet = 0.22, tail = 0.35, seed = 7 } = {}) {
  const rand = random(seed)
  const irLen = Math.round(tail * SR)
  const ir = new Float32Array(irLen)
  for (const [ms, g] of [[6.1, 0.5], [9.7, 0.38], [13.3, 0.3], [17.9, 0.24], [23.5, 0.18]]) ir[Math.round((ms * SR) / 1000)] += g * (rand() < 0.5 ? -1 : 1)
  const tau = tail / 6.9
  const late = new Float32Array(irLen)
  for (let i = Math.round(0.012 * SR); i < irLen; i++) late[i] = (rand() * 2 - 1) * Math.exp(-i / SR / tau) * 0.35
  const dark = filter(filter(late, 'lowpass', 4500), 'lowpass', 3000)
  for (let i = 0; i < irLen; i++) ir[i] += dark[i]
  // Chuẩn hoá năng lượng của phần vang, để `wet` chính là độ to của tiếng vang so với tiếng gõ.
  let energy = 0
  for (const v of ir) energy += v * v
  for (let i = 0; i < irLen; i++) ir[i] /= Math.sqrt(energy)
  let n = 1
  while (n < x.length + irLen) n <<= 1
  const ar = new Float64Array(n)
  const ai = new Float64Array(n)
  const br = new Float64Array(n)
  const bi = new Float64Array(n)
  const src = filter(x, 'highpass', 120)
  for (let i = 0; i < x.length; i++) ar[i] = src[i]
  for (let i = 0; i < irLen; i++) br[i] = ir[i]
  fft(ar, ai)
  fft(br, bi)
  for (let i = 0; i < n; i++) {
    const r = ar[i] * br[i] - ai[i] * bi[i]
    ai[i] = ar[i] * bi[i] + ai[i] * br[i]
    ar[i] = r
  }
  fft(ar, ai, true)
  const out = new Float32Array(x.length + irLen)
  for (let i = 0; i < out.length; i++) out[i] = (i < x.length ? x[i] : 0) + wet * ar[i]
  let end = out.length
  while (end > x.length && Math.abs(out[end - 1]) < 1e-5) end--
  return fadeOut(out.slice(0, end), 0.05)
}

// Chuỗi cú gõ: [tiếng, lúc (giây), độ to, tốc độ phát].
const seq = (...steps) => mix(...steps.map(([sound, at = 0, gain = 1, rate = 1]) => ({ sound: rate === 1 ? sound : speed(sound, rate), at, gain })))

// Hồi trống: những cú gõ dồn liên tiếp, mau dần hay đều, to dần hay nhỏ dần. `make(k, velocity)` tạo cú thứ k.
function roll(make, { count, from, to = from, start = 0.6, end = 1, at = 0, jitter = 0.003, seed = 1 }) {
  const rand = random(seed)
  const steps = []
  let t = at
  for (let k = 0; k < count; k++) {
    const u = count === 1 ? 1 : k / (count - 1)
    const v = start + (end - start) * u
    steps.push([make(k, v * (0.92 + 0.16 * rand())), t + jitter * (rand() * 2 - 1), 1])
    t += 1 / (from + (to - from) * u)
  }
  return seq(...steps)
}

// Tiếng sắp hết giờ: bốn tiếng "tích tắc" xen nhau, nhỏ dần.
const ticks = (a, b) => seq(...[0, 0.18, 0.36, 0.54].map((at, i) => [i % 2 ? b : a, at, 1 - i * 0.1]))

// Ép mềm tiếng (như ampli hay máy nén): đỉnh tròn lại, có thêm bậc cao nên loa nhỏ nghe rõ hơn.
function squash(x, drive) {
  let peak = 0
  for (const v of x) peak = Math.max(peak, Math.abs(v))
  const norm = Math.tanh(drive)
  return x.map((v) => (Math.tanh((drive * v) / peak) / norm) * peak)
}

// Trống 808 (máy trống điện tử Roland TR-808, gốc của tiếng bass trong nhạc remix, hip hop): một dao động hình sin
// trùng giọng thật nhanh từ `from` lần xuống nốt `note` ("bùm"), rồi ngân. `to`: trượt sang nốt khác (kiểu 808 slide).
// `drive`: ép tiếng cho căng; càng ép càng nhiều bậc cao 3f, 5f, 7f..., nhờ đó loa điện thoại (không phát được tiếng
// quá trầm) vẫn nghe ra bass, vì tai tự suy ra nốt trầm từ các bậc cao đó.
function tr808({ note, to = note, slideAt = 0, slideTime = 0.15, from = 2.4, drop = 0.025, decay = 0.16, hold = 0, drive = 3.5, click = 0.2, seed = 1 }) {
  const rand = random(seed)
  const x = samples(hold + decay * 6 + 0.04)
  let phase = 0
  for (let i = 0; i < x.length; i++) {
    const t = i / SR
    const u = Math.min(1, Math.max(0, (t - slideAt) / slideTime))
    const base = note * (to / note) ** (u * u * (3 - 2 * u))
    phase += (2 * Math.PI * base * (1 + (from - 1) * Math.exp(-t / drop))) / SR
    const env = Math.min(1, t / 0.0015) * (t < hold ? 1 : Math.exp(-(t - hold) / decay))
    x[i] = env * Math.sin(phase)
  }
  const norm = Math.tanh(drive)
  for (let i = 0; i < x.length; i++) x[i] = Math.tanh(drive * x[i]) / norm
  // Tiếng "tách" rất ngắn lúc bắt đầu, như máy 808 thật.
  const tick = samples(0.004)
  for (let i = 0; i < tick.length; i++) tick[i] = (rand() * 2 - 1) * Math.exp(-i / SR / 0.0008)
  const knock = filter(filter(tick, 'highpass', 1200), 'lowpass', 6000)
  for (let i = 0; i < knock.length; i++) x[i] += click * knock[i]
  return fadeOut(filter(filter(filter(x, 'lowpass', 2800), 'lowpass', 3200), 'highpass', 28), 0.02)
}

// Tần số các nốt dùng cho bass (Hz).
const HZ = { D2: 73.42, F2: 87.31, A2: 110, D3: 146.83, G4: 392, A4: 440 }

// Lấy một tiếng thu, đổi tốc độ (dưới 1: trầm và ngân lâu hơn), cắt còn `seconds` giây, bỏ phần ù dưới `hz`.
const take = (name, seconds, rate = 1, hz = 120) => filter(cut(rate === 1 ? load(name) : speed(load(name), rate), seconds), 'highpass', hz)

// Tên file tiếng thu của Kenney (tools/sounds/kenney/).
const metal = (i) => `impactMetal_medium_00${i}.ogg`
const heavyMetal = (i) => `impactMetal_heavy_00${i}.ogg`
const tin = (i) => `impactTin_medium_00${i}.ogg`
const glass = (i) => `impactGlass_light_00${i}.ogg`
const glassRing = (i) => `impactGlass_medium_00${i}.ogg`
// Tiếng thủy tinh bỏ phần ù dưới 150 Hz.
const pane = (name, seconds, rate) => take(name, seconds, rate, 150)

// Tiếng gõ thật có đỉnh nhọn lúc chạm: nén bớt cho mọi tiếng của bộ đạt đủ mức to (xem softenPeak).
const soften = (sounds) => Object.fromEntries(Object.entries(sounds).map(([event, sound]) => [event, softenPeak(sound, LEVEL[event])]))

// ---------- Các bộ tiếng ----------

// Mức to cho từng loại tiếng (dB): ăn quân to hơn đi thường một chút; tiếng báo (chiếu, hết ván...) nổi hơn tiếng đi quân
// cỡ 4–5 dB như trên lichess, đủ chú ý mà không giật mình. Chiếu và phong cấp chỉ là phần "điểm thêm":
// lúc chơi, web phát chúng chồng lên tiếng đi quân hoặc ăn quân.
const LEVEL = { move: -20, capture: -18, castle: -20, check: -19, promote: -19.5, end: -19, draw: -20, lowTime: -19, start: -21 }

// Trống tay: cặp bongo và một trống conga, vỗ bằng tay. Tiếng "bốc bốp" tròn, ấm, gọn.
// `thick`: bản dày: trống to hơn nên trầm hơn, vỗ gần giữa mặt hơn, ngân lâu hơn, thùng trống cộng hưởng mạnh hơn.
function handDrum(thick) {
  // Bongo nhỏ (cao) và bongo lớn; conga trầm hơn, có thùng gỗ dài cộng hưởng.
  const macho = (o = {}) =>
    skin({ ...(thick ? { f: 355, at: 0.76, ring: 0.19, body: [175, 0.2, 0.04] } : { f: 400, at: 0.82, ring: 0.16 }), contact: 0.0011, glide: 0.035, top: 6500, seconds: 0.45, ...o })
  const hembra = (o = {}) =>
    skin({ ...(thick ? { f: 250, at: 0.72, ring: 0.24, body: [128, 0.28, 0.05] } : { f: 285, at: 0.8, ring: 0.2 }), contact: 0.0012, glide: 0.035, top: 6000, seconds: 0.5, ...o })
  const conga = (o = {}) =>
    skin({ ...(thick ? { f: 140, at: 0.72, ring: 0.34, body: [84, 0.45, 0.08] } : { f: 158, at: 0.78, ring: 0.3, body: [92, 0.25, 0.06] }), contact: 0.0013, glide: 0.03, top: 5000, seconds: 0.8, ...o })
  // Vỗ bốp (slap): tay khum đập sát vành, chạm rất nhanh, tiếng giòn, tắt nhanh.
  const slap = (drum, o = {}) => drum({ at: 0.9, contact: 0.0005, ring: 0.09, slap: 0.35, slapTone: 3200, ...o })
  // Vỗ trầm (bass): cả bàn tay ấn giữa mặt trống.
  const bass = (o = {}) => conga({ at: 0.12, contact: 0.004, ring: 0.22, glide: 0.06, body: thick ? [84, 0.8, 0.1] : [92, 0.5, 0.08], ...o })
  // Đầu ngón tay gõ khẽ, tay kia chặn mặt da: "tíc" rất ngắn.
  const tip = (drum, o = {}) => drum({ at: 0.85, contact: 0.0009, ring: 0.035, velocity: 0.6, ...o })
  return {
    move: hembra({ seed: 1 }),
    capture: seq([slap(conga, { seed: 2, body: thick ? [84, 0.2, 0.05] : [92, 0.08, 0.04] }), 0, 1], [bass({ seed: 3 }), 0.012, thick ? 0.35 : 0.2]),
    castle: seq([macho({ seed: 4 }), 0, 0.9], [hembra({ seed: 5 }), 0.13, 1]),
    check: seq([slap(macho, { seed: 6 }), 0.09, 1], [slap(macho, { seed: 7, velocity: 0.9 }), 0.16, 0.85]),
    promote: seq([conga({ seed: 8 }), 0.08, 0.8], [hembra({ seed: 9 }), 0.17, 0.85], [macho({ seed: 10 }), 0.26, 1]),
    // Thắng: dồn nhanh từ bongo cao xuống conga, kết bằng cú vỗ trầm và một tiếng conga ngân.
    end: room(
      seq(
        ...[macho, macho, hembra, hembra, conga, conga].map((drum, k) => [drum({ seed: 20 + k, velocity: 0.75 + 0.05 * k }), k * 0.065, 1]),
        [bass({ seed: 30, velocity: 1.1 }), 0.42, 1],
        [conga({ seed: 31, ring: 0.42 }), 0.425, 0.8],
      ),
      { wet: 0.22 },
    ),
    draw: seq([hembra({ seed: 40, velocity: 0.85 }), 0, 1], [hembra({ seed: 41, velocity: 0.85 }), 0.26, 1]),
    lowTime: ticks(tip(macho, { seed: 50 }), tip(hembra, { seed: 51 })),
    // Ván mới: một câu vỗ ngắn "tum ta-ka tum".
    start: room(
      seq(
        [bass({ seed: 60, velocity: 0.8 }), 0, 1],
        [tip(macho, { seed: 61, velocity: 0.8 }), 0.15, 1],
        [tip(hembra, { seed: 62, velocity: 0.8 }), 0.21, 1],
        [slap(conga, { seed: 63, velocity: 0.8 }), 0.3, 0.8],
        [hembra({ seed: 64 }), 0.42, 1],
      ),
      { wet: 0.22 },
    ),
  }
}

// Trống hội: trống cái lớn và trống con đánh bằng dùi gỗ, như trống ngày hội, trống trường. Tiếng "tùng" trầm, chắc.
// `thick`: bản dày: trống to hơn, gõ gần giữa mặt hơn, thùng trống cộng hưởng mạnh và lâu hơn.
function festivalDrum(thick) {
  // Trống con: mặt nhỏ, căng, đi quân không bị ù. Trống cái: mặt rộng, ngân dài.
  const tune = thick ? 0.85 : 1
  const small = (o = {}) =>
    skin({ ...(thick ? { f: 150, at: 0.4, ring: 0.22, body: [96, 0.6, 0.08] } : { f: 178, at: 0.55, ring: 0.17, body: [120, 0.15, 0.05] }), contact: 0.0009, glide: 0.05, slap: 0.1, slapTone: 1800, top: 5000, seconds: 0.55, ...o })
  const big = (o = {}) =>
    skin({ ...(thick ? { f: 64, at: 0.38, ring: 0.5, body: [50, 0.65, 0.24] } : { f: 74, at: 0.45, ring: 0.42, body: [58, 0.35, 0.18] }), contact: 0.0012, glide: 0.07, glideTime: 0.08, slap: 0.08, slapTone: 1500, top: 3500, seconds: 1.3, ...o })
  // Dùi chặn mặt trống ngay sau khi gõ: "tục" ngắn.
  const damp = (o = {}) => small({ ring: 0.045, velocity: 0.65, ...o })
  return {
    move: small({ seed: 1, velocity: 0.85 }),
    capture: seq([small({ seed: 2, velocity: 1.15, at: 0.6 }), 0, 1], [big({ seed: 3, velocity: 0.7, ring: 0.3, seconds: 0.8 }), 0.01, 0.6]),
    castle: seq([small({ seed: 4, velocity: 0.85 }), 0, 1], [small({ seed: 5, velocity: 0.85, f: 160 * tune }), 0.14, 0.9]),
    // Chiếu: hai tiếng "tùng tùng" dứt khoát.
    check: seq([small({ seed: 6, velocity: 1.15 }), 0.09, 1], [small({ seed: 7, velocity: 1.1 }), 0.19, 0.95]),
    promote: seq([big({ seed: 8, velocity: 0.75, ring: 0.3, seconds: 0.8 }), 0.08, 0.85], [small({ seed: 9, velocity: 1, f: 200 * tune }), 0.2, 1]),
    // Thắng: trống con dồn mau dần rồi trống cái nổ một tiếng "tùng" lớn, ngân.
    end: room(
      seq(
        [roll((k, v) => small({ seed: 20 + k, velocity: v }), { count: 7, from: 9, to: 16, start: 0.55, end: 0.95, seed: 3 }), 0, 1],
        [big({ seed: 40, velocity: 1.25 }), 0.5, 1],
        [small({ seed: 41, velocity: 1.1 }), 0.505, 0.5],
      ),
      { wet: 0.25, tail: 0.5 },
    ),
    draw: seq([small({ seed: 50, velocity: 0.8 }), 0, 1], [small({ seed: 51, velocity: 0.8 }), 0.26, 1]),
    lowTime: ticks(damp({ seed: 60 }), damp({ seed: 61, f: 165 * tune })),
    // Ván mới: trống cái điểm hai tiếng rồi trống con vào nhịp.
    start: room(
      seq(
        [big({ seed: 70, velocity: 0.8, ring: 0.4, seconds: 1 }), 0, 1],
        [small({ seed: 71, velocity: 0.7 }), 0.2, 0.9],
        [small({ seed: 72, velocity: 0.8 }), 0.3, 0.9],
        [big({ seed: 73, velocity: 0.9, ring: 0.45, seconds: 1 }), 0.42, 1],
      ),
      { wet: 0.25, tail: 0.45 },
    ),
  }
}

// Trống bass: trống cái của dàn trống, đạp bằng dùi bông. Tiếng "thùm" sâu, tự nhiên.
function bassDrum() {
  const k = (o = {}) =>
    squash(skin({ f: 60, at: 0.25, contact: 0.0018, ring: 0.15, glide: 0.1, glideTime: 0.025, body: [50, 0.45, 0.13], slap: 0.22, slapTone: 2800, top: 3500, seconds: 0.9, ...o }), 1.6)
  // Dùi đạp giữ lì trên mặt trống: "bụp" ngắn.
  const muted = (o = {}) => k({ ring: 0.035, body: [50, 0.2, 0.03], velocity: 0.7, slap: 0.35, ...o })
  return {
    move: k({ seed: 1, velocity: 0.85 }),
    capture: k({ seed: 2, velocity: 1.2, slap: 0.3, contact: 0.0013 }),
    castle: seq([k({ seed: 3, velocity: 0.8 }), 0, 1], [k({ seed: 4, velocity: 0.85 }), 0.14, 1]),
    // Chiếu: hai cú đạp kép dứt khoát.
    check: seq([k({ seed: 5, velocity: 1.15, slap: 0.3 }), 0.09, 1], [k({ seed: 6, velocity: 1.1, slap: 0.3 }), 0.18, 1]),
    promote: seq([k({ seed: 7, velocity: 0.7 }), 0.08, 1], [k({ seed: 8, velocity: 0.85 }), 0.17, 1], [k({ seed: 9, velocity: 1.15, slap: 0.3 }), 0.26, 1]),
    // Thắng: đạp kép dồn mau dần rồi một cú thật mạnh, ngân.
    end: room(
      seq(
        [roll((i, v) => k({ seed: 20 + i, velocity: v }), { count: 8, from: 10, to: 18, start: 0.5, end: 0.95, seed: 4 }), 0, 1],
        [k({ seed: 40, velocity: 1.3, ring: 0.3, body: [50, 0.6, 0.28], seconds: 1.4, slap: 0.3 }), 0.58, 1],
      ),
      { wet: 0.25, tail: 0.5 },
    ),
    draw: seq([k({ seed: 50, velocity: 0.75 }), 0, 1], [k({ seed: 51, velocity: 0.75 }), 0.26, 1]),
    lowTime: ticks(muted({ seed: 60 }), muted({ seed: 61 })),
    start: room(
      seq([k({ seed: 70, velocity: 0.95 }), 0, 1], [k({ seed: 71, velocity: 0.7 }), 0.3, 1], [k({ seed: 72, velocity: 0.75 }), 0.45, 1], [k({ seed: 73, velocity: 1.05 }), 0.6, 1]),
      { wet: 0.22, tail: 0.45 },
    ),
  }
}

// Bass 808: tiếng bass điện tử của nhạc remix, "bùm" sâu và căng, có trượt nốt.
function bass808() {
  const b = tr808
  return {
    move: b({ note: HZ.D2, from: 2.8, drive: 4.2, seed: 1 }),
    capture: b({ note: HZ.D2, from: 3, decay: 0.26, drive: 4.5, click: 0.3, seed: 2 }),
    castle: seq([b({ note: HZ.D2, decay: 0.12, seed: 3 }), 0, 1], [b({ note: HZ.A2, decay: 0.16, seed: 4 }), 0.14, 0.9]),
    // Chiếu: hai tiếng cao hơn một quãng tám, dứt khoát.
    check: seq([b({ note: HZ.D3, decay: 0.09, drive: 4, seed: 5 }), 0.09, 1], [b({ note: HZ.D3, decay: 0.12, drive: 4, seed: 6 }), 0.18, 1]),
    // Phong cấp: nốt trượt từ thấp vọt lên cao.
    promote: b({ note: HZ.D2, to: HZ.D3, slideAt: 0.11, slideTime: 0.16, decay: 0.3, hold: 0.18, seed: 7 }),
    // Thắng: hai nốt ngắn rồi một tiếng "bùm" dài trượt từ cao xuống trầm.
    end: room(
      seq(
        [b({ note: HZ.D2, decay: 0.09, seed: 8 }), 0, 0.9],
        [b({ note: HZ.F2, decay: 0.09, seed: 9 }), 0.13, 0.9],
        [b({ note: HZ.A2, to: HZ.D2, slideAt: 0.1, slideTime: 0.4, decay: 0.38, hold: 0.2, drive: 4.5, click: 0.25, seed: 10 }), 0.3, 1],
      ),
      { wet: 0.18, tail: 0.5 },
    ),
    draw: seq([b({ note: HZ.D2, decay: 0.12, seed: 11 }), 0, 0.85], [b({ note: HZ.D2, decay: 0.12, seed: 12 }), 0.26, 0.85]),
    lowTime: ticks(b({ note: HZ.A4, from: 1.5, decay: 0.03, drive: 2, seed: 13 }), b({ note: HZ.G4, from: 1.5, decay: 0.03, drive: 2, seed: 14 })),
    start: room(
      seq([b({ note: HZ.D2, decay: 0.12, seed: 15 }), 0, 1], [b({ note: HZ.D2, decay: 0.07, seed: 16 }), 0.2, 0.85], [b({ note: HZ.F2, decay: 0.09, seed: 17 }), 0.32, 0.9], [b({ note: HZ.A2, decay: 0.25, seed: 18 }), 0.46, 1]),
      { wet: 0.18 },
    ),
  }
}

const SETS = {
  // Gỗ: mọi tiếng đều là tiếng gõ thu thật, để đúng cao độ gốc, không pha đàn hay chuông. Mỗi cú gõ gồm cú chạm
  // mặt bàn (gọn, nghe rõ cả trên loa điện thoại) và tiếng thân gỗ rỗng vang nhẹ bên dưới cho ấm.
  wood() {
    const clean = (x) => filter(x, 'highpass', 60)
    // Cú chạm mặt bàn: lấy từ bản thu xúc xắc rơi xuống bàn, mỗi cú khác nhau chút ít.
    const tap = {
      bright: clean(hit('die-throw-1.ogg', 0.156, 0.11)),
      a: clean(hit('die-throw-2.ogg', 0.078, 0.13)),
      b: clean(hit('die-throw-2.ogg', 0.216, 0.12)),
      c: clean(hit('die-throw-2.ogg', 0.347, 0.06)),
      d: clean(hit('die-throw-3.ogg', 0.075, 0.14)),
      e: clean(hit('die-throw-4.ogg', 0.123, 0.12)),
    }
    // Thân gỗ: tiếng gõ khối gỗ rỗng, "bụp" trầm và tròn.
    const body = (name, seconds = 0.22) => clean(cut(load(name), seconds))
    const knock = (sound, under) => mix({ sound }, { sound: under, gain: 0.4 })
    const place = knock(tap.e, body('impactWood_light_004.ogg'))
    const place2 = knock(tap.b, body('impactWood_light_001.ogg'))
    const clack = knock(tap.bright, body('impactWood_light_000.ogg'))
    const land = knock(tap.a, body('impactWood_light_002.ogg'))
    const tick = knock(tap.c, body('impactWood_light_000.ogg'))
    const tock = knock(tap.d, body('impactWood_light_003.ogg'))
    // Đặt mạnh tay: hai cú chạm chồng khít nhau (một cú phát chậm lại cho nặng) trên tiếng gỗ trầm hơn.
    const hard = knock(mix({ sound: tap.bright }, { sound: speed(tap.e, 0.9), gain: 0.8 }), body('impactWood_medium_002.ogg', 0.3))
    const sounds = {
      move: place,
      // Hai quân va nhau rồi quân ăn đáp xuống bàn.
      capture: seq([clack, 0, 1], [land, 0.025, 0.85]),
      castle: seq([place, 0, 1], [place2, 0.14, 0.85]),
      // Web phát tiếng báo chiếu ngay sau tiếng quân: gõ thêm hai tiếng "cộc cộc".
      check: seq([clack, 0.09, 1], [clack, 0.16, 0.8, 1.04]),
      // Hai tiếng gõ, thấp rồi cao.
      promote: seq([place, 0.08, 0.9, 0.86], [clack, 0.2, 1, 1.18]),
      // Vua đổ xuống bàn rồi nảy vài lần, mỗi lần thấp và nhanh hơn.
      end: seq([hard, 0, 1], [clack, 0.15, 0.42], [place2, 0.258, 0.27], [tick, 0.336, 0.17], [tock, 0.392, 0.11], [tick, 0.432, 0.07]),
      // Hai tiếng gõ nhẹ, đều nhau.
      draw: seq([place, 0, 0.85, 0.94], [place2, 0.26, 0.85, 0.94]),
      // "Tốc tốc" như đồng hồ gỗ.
      lowTime: seq(...[0, 0.18, 0.36, 0.54].map((at, i) => [i % 2 ? tock : tick, at, 1 - i * 0.1, i % 2 ? 1 : 1.12])),
      // Tiếng xếp quân lên bàn.
      start: seq([land, 0, 0.6, 1.05], [tick, 0.065, 0.45, 1.1], [tock, 0.15, 0.75, 0.98], [place2, 0.2, 0.5, 1.04], [clack, 0.29, 0.4, 1.12], [place, 0.36, 0.85]),
    }
    return soften(sounds)
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

  // Bong bóng: tiếng "bóp" tròn trịa, nhẹ nhàng, kiểu ứng dụng hiện đại. Mọi tiếng đều là bọt nước, không chuông.
  bubble() {
    const pop = filter(noise(0.008, 0.0015, 7), 'bandpass', 2500, { q: 1.2 })
    // Bọt to: trầm hơn, vút lên chậm hơn, tắt lâu hơn, kèm tiếng tách lúc vỡ.
    const big = (from, to, decay = 0.06, seconds = 0.26) => mix({ sound: bubble(from, to, decay, seconds, 0.04) }, { sound: pop, gain: 0.2 })
    return {
      move: mix({ sound: bubble(520, 980) }, { sound: pop, gain: 0.15 }),
      capture: mix(
        { sound: bubble(330, 700, 0.04, 0.15) },
        { sound: pop, gain: 0.35 },
        { sound: bubble(760, 1300, 0.025), at: 0.035, gain: 0.7 },
      ),
      castle: mix({ sound: bubble(480, 900) }, { sound: bubble(640, 1150), at: 0.11, gain: 0.9 }),
      // Chiếu: hai bọt nhỏ "bíp bíp" cao dần, nổi lên ngay sau tiếng quân.
      check: seq([bubble(820, 1500, 0.022, 0.09), 0.07, 1], [bubble(980, 1800, 0.022, 0.09), 0.15, 0.95]),
      promote: mix(...[0, 1, 2, 3].map((i) => ({ sound: bubble(500 + i * 180, 950 + i * 300), at: i * 0.055, gain: 0.85 }))),
      // Hết ván: ba bọt thấp dần rồi một bọt to "bọp" khép lại.
      end: seq([bubble(950, 1700, 0.022, 0.09), 0, 0.75], [bubble(780, 1400, 0.025, 0.1), 0.11, 0.8], [bubble(620, 1150, 0.03, 0.12), 0.22, 0.85], [big(420, 820), 0.36, 1]),
      // Hòa: hai bọt vừa, giống hệt nhau.
      draw: seq([bubble(560, 1020, 0.03, 0.12), 0, 1], [bubble(560, 1020, 0.03, 0.12), 0.24, 1]),
      lowTime: mix(...[0, 0.2, 0.4, 0.6].map((at, i) => ({ sound: bubble(1500, 1900, 0.012, 0.05), at, gain: 1 - i * 0.1 }))),
      // Ván mới: ba bọt nổi lên, bọt sau cao hơn bọt trước.
      start: seq([bubble(460, 860), 0, 0.85], [bubble(560, 1040), 0.09, 0.9], [bubble(700, 1300, 0.025, 0.1), 0.18, 1]),
    }
  },

  // ----- Kim loại: tiếng gõ kim loại thu thật, cách gõ giống bộ Gỗ (đặt quân, va nhau, vua đổ nảy...) -----

  // Thép: quân thép đặt lên mặt thép. Tiếng "cạch" gọn, sáng, tắt nhanh.
  steel() {
    const place = take(metal(4), 0.16)
    const place2 = take(metal(2), 0.16)
    const clack = take(metal(1), 0.18)
    const land = take(metal(0), 0.22)
    const tick = take(metal(2), 0.06, 1.1)
    const tock = take(metal(4), 0.07, 0.96)
    const hard = mix({ sound: take(metal(3), 0.3) }, { sound: take(metal(0), 0.3, 0.9), gain: 0.7 })
    return soften({
      move: place,
      capture: seq([clack, 0, 1], [land, 0.025, 0.85]),
      castle: seq([place, 0, 1], [place2, 0.14, 0.85]),
      check: seq([clack, 0.09, 1], [clack, 0.16, 0.8, 1.04]),
      promote: seq([place, 0.08, 0.9, 0.86], [clack, 0.2, 1, 1.18]),
      end: seq([hard, 0, 1], [clack, 0.15, 0.42], [place2, 0.258, 0.27], [tick, 0.336, 0.17], [tock, 0.392, 0.11], [tick, 0.432, 0.07]),
      draw: seq([place, 0, 0.85, 0.94], [place2, 0.26, 0.85, 0.94]),
      lowTime: seq(...[0, 0.18, 0.36, 0.54].map((at, i) => [i % 2 ? tock : tick, at, 1 - i * 0.1, i % 2 ? 1 : 1.12])),
      start: seq([land, 0, 0.6, 1.05], [tick, 0.065, 0.45, 1.1], [tock, 0.15, 0.75, 0.98], [place2, 0.2, 0.5, 1.04], [clack, 0.29, 0.4, 1.12], [place, 0.36, 0.85]),
    })
  },

  // Đồng: quân đồng nặng, tiếng trầm và ngân ấm hơn thép (phát chậm lại). Hết ván: vua đổ rồi xoay tròn trên bàn
  // như đồng xu, lách cách mau dần rồi lặng hẳn.
  bronze() {
    const R = 0.8
    const place = take(metal(0), 0.34, R)
    const place2 = take(metal(3), 0.34, R)
    const clack = take(metal(1), 0.3, R * 1.06)
    const land = take(metal(3), 0.4, R * 0.94)
    const tick = take(metal(2), 0.09, R * 1.15)
    const tock = take(metal(4), 0.1, R)
    // Một cú chạm rất ngắn lúc vua xoay: lấy phần đầu tiếng gõ, tắt nhanh.
    const rattle = (name, rate) => fadeOut(filter(speed(load(name), rate).slice(0, Math.round(0.05 * SR)), 'highpass', 120), 0.035)
    const spin = []
    let when = 0.13
    let gap = 0.12
    for (let k = 0; k < 14; k++) {
      spin.push([rattle(metal([1, 2, 4][k % 3]), R * (1 + k * 0.012)), when, 0.5 * 0.9 ** k])
      when += gap
      gap *= 0.82
    }
    return soften({
      move: place,
      capture: seq([clack, 0, 1], [land, 0.03, 0.8]),
      castle: seq([place, 0, 1], [place2, 0.15, 0.85]),
      check: seq([clack, 0.09, 1], [clack, 0.17, 0.75, 1.05]),
      promote: seq([place, 0.08, 0.9, 0.88], [clack, 0.21, 1, 1.15]),
      end: seq([mix({ sound: land }, { sound: take(metal(0), 0.4, R * 0.85), gain: 0.6 }), 0, 1], ...spin),
      draw: seq([place, 0, 0.85, 0.96], [place2, 0.28, 0.85, 0.96]),
      lowTime: seq(...[0, 0.2, 0.4, 0.6].map((at, i) => [i % 2 ? tock : tick, at, 1 - i * 0.1])),
      start: seq([land, 0, 0.55], [tick, 0.07, 0.45], [tock, 0.16, 0.7], [place2, 0.22, 0.5, 1.03], [clack, 0.31, 0.4, 1.08], [place, 0.39, 0.85]),
    })
  },

  // Gang: quân gang đúc đặc, rất nặng. Tiếng "cộc" đục, trầm, gần như không ngân: tiếng kim loại nặng lót tiếng lon thiếc.
  'cast-iron'() {
    const R = 0.86
    const heavy = (h, t, rate = R) => mix({ sound: take(heavyMetal(h), 0.16, rate) }, { sound: take(tin(t), 0.14, rate * 0.95), gain: 0.55 })
    const place = heavy(4, 1)
    const place2 = heavy(2, 4)
    const clack = heavy(0, 2, R * 1.05)
    const land = heavy(2, 3, R * 0.95)
    const tick = take(heavyMetal(0), 0.06, R * 1.1)
    const tock = take(tin(1), 0.07, R)
    const hard = mix({ sound: heavy(0, 3, R * 0.9) }, { sound: heavy(4, 0, R * 0.82), gain: 0.7 })
    return soften({
      move: place,
      capture: seq([clack, 0, 1], [land, 0.025, 0.85]),
      castle: seq([place, 0, 1], [place2, 0.14, 0.85]),
      check: seq([clack, 0.09, 1], [clack, 0.16, 0.8, 1.04]),
      promote: seq([place, 0.08, 0.9, 0.88], [clack, 0.2, 1, 1.15]),
      // Vua gang đổ "cộp", bập bênh lại một lần rồi nằm im.
      end: seq([hard, 0, 1], [place2, 0.17, 0.4], [tock, 0.29, 0.18]),
      draw: seq([place, 0, 0.85, 0.95], [place2, 0.26, 0.85, 0.95]),
      lowTime: seq(...[0, 0.18, 0.36, 0.54].map((at, i) => [i % 2 ? tock : tick, at, 1 - i * 0.1])),
      start: seq([land, 0, 0.6], [tick, 0.07, 0.45], [tock, 0.15, 0.7], [place2, 0.21, 0.5, 1.03], [clack, 0.3, 0.4, 1.06], [place, 0.37, 0.85]),
    })
  },

  // ----- Thủy tinh: tiếng gõ thủy tinh thu thật -----

  // Pha lê: quân pha lê đặt lên mặt kính. Tiếng "ting" trong, ngân nhẹ rồi tắt.
  crystal() {
    const R = 0.92
    const place = pane(glass(2), 0.24, R)
    const place2 = pane(glass(3), 0.24, R)
    const clack = pane(glass(1), 0.26, R)
    const land = pane(glassRing(2), 0.34, R)
    const tick = pane(glass(1), 0.07, R * 1.08)
    const tock = pane(glass(3), 0.08, R * 0.95)
    const hard = mix({ sound: pane(glassRing(0), 0.4, R) }, { sound: pane(glass(1), 0.3, R * 0.9), gain: 0.6 })
    return soften({
      move: place,
      capture: seq([clack, 0, 1], [land, 0.025, 0.8]),
      castle: seq([place, 0, 1], [place2, 0.14, 0.85]),
      check: seq([clack, 0.09, 1], [clack, 0.16, 0.8, 1.04]),
      promote: seq([place, 0.08, 0.9, 0.88], [clack, 0.2, 1, 1.15]),
      end: seq([hard, 0, 1], [clack, 0.15, 0.4], [place2, 0.258, 0.26], [tick, 0.336, 0.16], [tock, 0.392, 0.1], [tick, 0.432, 0.06]),
      draw: seq([place, 0, 0.85, 0.95], [place2, 0.26, 0.85, 0.95]),
      lowTime: seq(...[0, 0.18, 0.36, 0.54].map((at, i) => [i % 2 ? tock : tick, at, 1 - i * 0.1, i % 2 ? 1 : 1.08])),
      start: seq([land, 0, 0.55], [tick, 0.065, 0.45, 1.06], [tock, 0.15, 0.7], [place2, 0.2, 0.5, 1.03], [clack, 0.29, 0.4, 1.08], [place, 0.36, 0.85]),
    })
  },

  // Bi ve: quân là viên bi thủy tinh. Tiếng "tách" khô và ngắn, có cú nảy nhỏ. Hết ván: viên bi rơi, nảy mau dần
  // tới khi nằm yên. Ván mới: rải một nắm bi lên bàn.
  'glass-marbles'() {
    // Chỉ lấy phần chạm, bỏ phần ngân, như hai viên bi va nhau.
    const click = (name, rate = 1, seconds = 0.045) => {
      const x = filter(speed(load(name), rate), 'highpass', 300)
      return fadeOut(filter(x.slice(0, Math.round(seconds * SR)), 'lowpass', 7000), seconds * 0.7)
    }
    const a = click(glass(2), 0.95)
    const b = click(glass(3), 0.95)
    const c = click(glass(1), 1)
    const d = click('glass_003.wav', 0.8, 0.04)
    // Đặt bi xuống: chạm rồi nảy lên một chút xíu.
    const drop = (main, small, gap = 0.032) => seq([main, 0, 1], [small, gap, 0.28, 1.05])
    const place = drop(a, b)
    const place2 = drop(b, a, 0.028)
    // Hai viên bi va nhau "cách": hai cú chạm sát nhau.
    const clash = seq([c, 0, 1], [d, 0.004, 0.6])
    // Viên bi rơi nảy: mỗi lần nảy nhỏ hơn và sát hơn lần trước.
    const bounce = (count, first, ratio, gain) => {
      const steps = []
      let when = 0
      let gap = first
      for (let k = 0; k < count; k++) {
        steps.push([k % 2 ? b : a, when, gain * 0.72 ** k, 1 + k * 0.01])
        when += gap
        gap *= ratio
      }
      return seq(...steps)
    }
    const rand = random(41)
    const handful = []
    for (let k = 0; k < 13; k++) handful.push([[a, b, c, d][k % 4], 0.03 * k + 0.06 * rand() * (k / 12), 0.35 + 0.45 * rand(), 0.9 + 0.2 * rand()])
    return soften({
      move: place,
      capture: seq([clash, 0, 1], [place, 0.05, 0.75]),
      castle: seq([place, 0, 1], [place2, 0.14, 0.85]),
      check: seq([c, 0.09, 1], [d, 0.155, 0.85]),
      promote: seq([a, 0.08, 0.9, 0.85], [c, 0.19, 1, 1.18]),
      end: seq([clash, 0, 1], [bounce(10, 0.17, 0.75, 0.9), 0.07, 1]),
      draw: seq([place, 0, 0.85], [place2, 0.26, 0.85]),
      lowTime: seq(...[0, 0.18, 0.36, 0.54].map((at, i) => [i % 2 ? b : c, at, 1 - i * 0.1, i % 2 ? 0.92 : 1.05])),
      start: seq(...handful, [place, 0.48, 0.8]),
    })
  },

  // Kính dày: quân và bàn bằng kính dày. Tiếng "cộp" trầm, tròn, ít ngân: nền là tiếng kính dày, bên trên một chút
  // tiếng kính mỏng phát chậm lại và bỏ bớt phần cao.
  'thick-glass'() {
    const R = 0.8
    const thick = (light, rate = R, top = 0.55) =>
      mix({ sound: pane('impactGlass_heavy_002.ogg', 0.15, (rate / R) * 0.95) }, { sound: filter(pane(glass(light), 0.13, rate), 'lowpass', 1800), gain: top })
    const place = thick(2)
    const place2 = thick(3)
    const clack = thick(1, R * 1.05, 0.7)
    const land = thick(2, R * 0.92, 0.4)
    const tick = filter(pane(glass(1), 0.05, R * 1.1), 'lowpass', 3000)
    const tock = filter(pane(glass(3), 0.06, R), 'lowpass', 3000)
    const hard = mix({ sound: thick(1, R * 0.88, 0.5) }, { sound: pane(glassRing(4), 0.22, R), gain: 0.35 })
    return soften({
      move: place,
      capture: seq([clack, 0, 1], [land, 0.025, 0.85]),
      castle: seq([place, 0, 1], [place2, 0.14, 0.85]),
      check: seq([clack, 0.09, 1], [clack, 0.16, 0.8, 1.04]),
      promote: seq([place, 0.08, 0.9, 0.88], [clack, 0.2, 1, 1.15]),
      end: seq([hard, 0, 1], [place2, 0.16, 0.42], [tock, 0.27, 0.22], [tick, 0.335, 0.1]),
      draw: seq([place, 0, 0.85, 0.95], [place2, 0.26, 0.85, 0.95]),
      lowTime: seq(...[0, 0.18, 0.36, 0.54].map((at, i) => [i % 2 ? tock : tick, at, 1 - i * 0.1])),
      start: seq([land, 0, 0.6], [tick, 0.07, 0.45], [tock, 0.15, 0.7], [place2, 0.21, 0.5, 1.03], [clack, 0.3, 0.4, 1.06], [place, 0.37, 0.85]),
    })
  },

  // ----- Đá: không có bản thu đá gõ đá dùng được, nên tiếng chạm dựng bằng stoneHit() -----

  // Cẩm thạch: quân đá mài nhẵn đặt lên bàn đá. Tiếng "cách" sắc, hơi ngân như sứ.
  'polished-stone'() {
    const piece = (seed, pitch = 1, ring = 1) =>
      mix(
        { sound: stoneHit({ seed, low: 1350 * pitch, damp: 0.0079 / ring, tilt: 0.6, seconds: 0.16 }) },
        // Mặt bàn đá rung theo, trầm hơn và tắt nhanh hơn.
        { sound: stoneHit({ seed: seed + 500, low: 420 * pitch, high: 2500, damp: 0.058, tilt: 0.9, grit: 0, seconds: 0.1 }), gain: 0.5 },
      )
    const place = piece(1)
    const place2 = piece(2, 0.97)
    const clack = piece(3, 1.08, 1.2)
    const land = piece(4, 0.94)
    const tick = piece(5, 1.12, 0.6)
    const tock = piece(6, 0.92, 0.6)
    const hard = mix({ sound: piece(7, 0.9, 1.3) }, { sound: piece(8, 0.84, 1.1), gain: 0.7 })
    return soften({
      move: place,
      capture: seq([clack, 0, 1], [land, 0.025, 0.85]),
      castle: seq([place, 0, 1], [place2, 0.14, 0.85]),
      check: seq([clack, 0.09, 1], [piece(9, 1.1, 1.2), 0.16, 0.8]),
      promote: seq([piece(10, 0.88), 0.08, 0.9], [piece(11, 1.18), 0.2, 1]),
      end: seq([hard, 0, 1], [clack, 0.15, 0.42], [place2, 0.258, 0.27], [tick, 0.336, 0.17], [tock, 0.392, 0.11], [tick, 0.432, 0.07]),
      draw: seq([piece(12, 0.95), 0, 0.85], [piece(13, 0.95), 0.26, 0.85]),
      lowTime: seq(...[0, 0.18, 0.36, 0.54].map((at, i) => [i % 2 ? tock : tick, at, 1 - i * 0.1])),
      start: seq([land, 0, 0.6], [tick, 0.065, 0.45], [tock, 0.15, 0.75], [place2, 0.2, 0.5], [clack, 0.29, 0.4], [place, 0.36, 0.85]),
    })
  },

  // Sỏi: quân là những viên sỏi nhỏ. Tiếng "lách cách" khô và nhanh, mỗi lần đặt nảy lách cách vài cái.
  // Hết ván: một nắm sỏi đổ xuống bàn, lách cách thưa dần.
  pebbles() {
    const pebble = (seed, pitch = 1) => stoneHit({ seed, low: 1500 * pitch, damp: 0.0163, tilt: 0.5, contact: 0.0003, grit: 0.25, seconds: 0.06 })
    // Đặt viên sỏi xuống: chạm rồi nảy hai cái rất sát (đá cứng nên nảy nhanh).
    const drop = (seed, pitch = 1) => seq(...[0, 0.013, 0.024].map((at, k) => [pebble(seed * 10 + k, pitch * (1 + k * 0.03)), at, [1, 0.35, 0.15][k]]))
    const place = drop(1)
    const place2 = drop(2, 0.95)
    const clack = drop(3, 1.08)
    const tick = pebble(40, 1.1)
    const tock = pebble(41, 0.9)
    const rand = random(77)
    const pour = []
    let when = 0
    for (let k = 0; k < 18; k++) {
      pour.push([pebble(100 + k, 0.85 + 0.35 * rand()), when, (0.4 + 0.6 * rand()) * 0.93 ** k])
      when += 0.012 + 0.045 * rand() * (1 + k / 6)
    }
    return soften({
      move: place,
      capture: seq([clack, 0, 1], [drop(4, 0.92), 0.03, 0.8]),
      castle: seq([place, 0, 1], [place2, 0.14, 0.85]),
      check: seq([pebble(50, 1.05), 0.09, 1], [pebble(51, 1.12), 0.15, 0.85]),
      promote: seq([drop(5, 0.85), 0.08, 0.9], [drop(6, 1.2), 0.2, 1]),
      end: seq([clack, 0, 1], ...pour.map(([sound, at, gain]) => [sound, 0.06 + at, gain])),
      draw: seq([drop(7), 0, 0.85], [drop(8), 0.26, 0.85]),
      lowTime: seq(...[0, 0.18, 0.36, 0.54].map((at, i) => [i % 2 ? tock : tick, at, 1 - i * 0.1])),
      start: seq([drop(9, 0.95), 0, 0.6], [drop(10, 1.05), 0.07, 0.45], [drop(11), 0.15, 0.7], [drop(12, 0.97), 0.21, 0.5], [drop(13, 1.08), 0.3, 0.4], [place, 0.37, 0.85]),
    })
  },

  // Bàn đá: quân đá nặng đặt lên bàn đá ngoài công viên. Tiếng "cộc" đục, chắc, trầm; lót thêm tiếng chạm nền xi
  // măng thu thật cho có sức nặng.
  'stone-table'() {
    const ground = (i) => filter(cut(load(`footstep_concrete_00${i}.ogg`), 0.09), 'highpass', 90)
    const block = (seed, pitch = 1, i = 2) =>
      mix(
        { sound: stoneHit({ seed, low: 640 * pitch, high: 6000, damp: 0.025, tilt: 0.8, contact: 0.0008, grit: 0.25, seconds: 0.1 }) },
        { sound: ground(i), gain: 0.55 },
      )
    const place = block(1, 1, 2)
    const place2 = block(2, 0.95, 1)
    const clack = block(3, 1.08, 3)
    const land = block(4, 0.93, 4)
    const tick = block(5, 1.12, 0)
    const tock = block(6, 0.9, 1)
    const hard = mix({ sound: block(7, 0.88, 2) }, { sound: block(8, 0.8, 4), gain: 0.75 })
    return soften({
      move: place,
      capture: seq([clack, 0, 1], [land, 0.025, 0.85]),
      castle: seq([place, 0, 1], [place2, 0.14, 0.85]),
      check: seq([clack, 0.09, 1], [block(9, 1.1, 0), 0.16, 0.8]),
      promote: seq([block(10, 0.86), 0.08, 0.9], [block(11, 1.16, 3), 0.2, 1]),
      // Vua đá đổ "cộc", bập bênh lại một lần rồi nằm im.
      end: seq([hard, 0, 1], [place2, 0.17, 0.4], [tock, 0.29, 0.18]),
      draw: seq([block(12, 0.95), 0, 0.85], [block(13, 0.95, 1), 0.26, 0.85]),
      lowTime: seq(...[0, 0.18, 0.36, 0.54].map((at, i) => [i % 2 ? tock : tick, at, 1 - i * 0.1])),
      start: seq([land, 0, 0.6], [tick, 0.07, 0.45], [tock, 0.15, 0.7], [place2, 0.21, 0.5], [clack, 0.3, 0.4], [place, 0.37, 0.85]),
    })
  },

  // Trống tay, Trống hội dùng bản dày.
  'hand-drum': () => handDrum(true),
  'festival-drum': () => festivalDrum(true),
  'bass-drum': bassDrum,
  'bass-808': bass808,
}

// Bộ nhiều tiếng trầm: cân bằng `level` (đo theo trọng số A) thay cho `finish`.
const LOW_SETS = new Set(['hand-drum', 'festival-drum', 'bass-drum', 'bass-808'])

const FILES = { move: 'move', capture: 'capture', castle: 'castle', check: 'check', promote: 'promote', end: 'end', draw: 'draw', lowTime: 'low-time', start: 'start' }

const wanted = process.argv.slice(2)
for (const [name, make] of Object.entries(SETS)) {
  if (wanted.length > 0 && !wanted.includes(name)) continue
  const dir = join(OUT, name)
  mkdirSync(dir, { recursive: true })
  for (const [event, sound] of Object.entries(make())) {
    writeMp3(LOW_SETS.has(name) ? level(sound, LEVEL[event]) : finish(sound, LEVEL[event]), join(dir, `${FILES[event]}.mp3`))
  }
  console.log(`Đã tạo bộ ${name} trong ${dir}`)
}
