// Mô hình 3D bộ quân Staunton: quân tròn tiện bằng LatheGeometry (xoay một đường viền quanh trục),
// quân Mã là hình nghiêng ép dày có vát cạnh. Đơn vị: chiều cao Vua = 1.
import * as THREE from 'three'
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'
import { knightHead } from './knight.js'

const V2 = (x, y) => new THREE.Vector2(x, y)
const rad = (d) => (d * Math.PI) / 180

export class Profile {
  constructor() {
    this.pts = []
  }
  get last() {
    return this.pts[this.pts.length - 1]
  }
  move(r, y) {
    this.pts.push(V2(r, y))
    return this
  }
  line(r, y, n = 1) {
    const a = this.last.clone()
    for (let i = 1; i <= n; i++) this.pts.push(V2(a.x + ((r - a.x) * i) / n, a.y + ((y - a.y) * i) / n))
    return this
  }
  // Cung tròn tâm (cx, cy), bán kính rr, từ góc a0 tới a1 (độ; 0 = hướng ra ngoài, 90 = lên trên).
  arc(cx, cy, rr, a0, a1, n = 10) {
    for (let i = 0; i <= n; i++) {
      const a = rad(a0 + ((a1 - a0) * i) / n)
      const p = V2(cx + rr * Math.cos(a), cy + rr * Math.sin(a))
      if (i === 0 && this.pts.length && this.last.distanceTo(p) < 1e-6) continue
      this.pts.push(p)
    }
    return this
  }
  bez(c1r, c1y, c2r, c2y, r, y, n = 14) {
    const p0 = this.last.clone()
    for (let i = 1; i <= n; i++) {
      const t = i / n
      const u = 1 - t
      this.pts.push(
        V2(
          u * u * u * p0.x + 3 * u * u * t * c1r + 3 * u * t * t * c2r + t * t * t * r,
          u * u * u * p0.y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y,
        ),
      )
    }
    return this
  }
}

// Chân đế chung kiểu Staunton: đế phẳng, gờ tròn lớn, rãnh lõm, gờ nhỏ. Trả về điểm bắt đầu thân.
function foot(P, R, s = 1) {
  const h = 0.03 * s
  P.move(0, 0)
  P.line(R - 0.012, 0, 3)
  P.arc(R - 0.012, 0.012, 0.012, -90, 0, 6)
  P.line(R, h - 0.007)
  P.arc(R - 0.007, h - 0.007, 0.007, 0, 90, 5)
  const tr = 0.027 * s
  const tcx = R - 0.012 - tr * 0.75
  const tcy = h + tr * 0.92
  P.line(tcx + tr * Math.cos(rad(-62)), tcy + tr * Math.sin(rad(-62)))
  P.arc(tcx, tcy, tr, -62, 115, 14)
  const br = 0.011 * s
  const bx = R * 0.64
  const by = tcy + tr + 0.024 * s
  P.bez(tcx - tr * 0.6, tcy + tr * 1.25, bx + br * 1.3, by - br * 1.6, bx + br * 0.9, by - br * 0.6, 10)
  P.arc(bx, by, br, -40, 110, 8)
  return { r: bx - br * 0.4, y: by + br * 0.95 }
}

// Vòng cổ: một đĩa bo tròn, kèm một gờ nhỏ phía trên.
function collar(P, r0, y0, rd, th, r1) {
  P.bez(r0, y0 + th * 0.3, rd - th * 0.7, y0 + th * 0.1, rd - th * 0.45, y0 + th * 0.25, 6)
  P.arc(rd - th * 0.5, y0 + th * 0.75, th * 0.5, -85, 95, 10)
  const top = y0 + th * 1.25
  P.bez(rd - th * 0.9, top + th * 0.1, r1 + th * 0.6, top - th * 0.02, r1 + th * 0.35, top + th * 0.18, 5)
  P.arc(r1 + th * 0.05, top + th * 0.5, th * 0.34, -70, 100, 8)
  return { r: r1, y: top + th * 0.84 }
}

function lathe(P, segments = 128) {
  const g = new THREE.LatheGeometry(P.pts, segments)
  return g
}

// Giữ pháp tuyến mượt của lathe (tốt hơn tính lại) nhưng hàn mép nối để CSG chạy được.
function solid(g) {
  g = g.index ? g.toNonIndexed() : g
  if (g.getAttribute('uv')) g.deleteAttribute('uv')
  g = mergeVertices(g, 1e-4)
  return g
}

const evaluator = new Evaluator()
evaluator.attributes = ['position', 'normal']
evaluator.useGroups = false

function csg(base, cutters, op = SUBTRACTION) {
  let a = new Brush(base)
  a.updateMatrixWorld()
  for (const c of cutters) {
    c.updateMatrixWorld()
    a = evaluator.evaluate(a, c, op)
  }
  return a.geometry
}

function brush(geometry, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] } = {}) {
  const g = geometry.index ? geometry : geometry
  const b = new Brush(solid(g))
  b.position.set(...pos)
  b.rotation.set(...rot)
  b.scale.set(...scale)
  return b
}

// ---------- Từng quân ----------
export function pawn() {
  const P = new Profile()
  const R = 0.19
  const s = foot(P, R, 0.82)
  P.bez(s.r - 0.004, s.y + 0.05, 0.072, 0.25, 0.066, 0.302, 14)
  const c = collar(P, 0.066, 0.302, 0.123, 0.03, 0.062)
  const hr = 0.105
  const hy = c.y + 0.004 + hr * Math.sin(rad(56))
  P.line(hr * Math.cos(rad(-56)), hy + hr * Math.sin(rad(-56)))
  P.arc(0, hy, hr, -56, 90, 22)
  return { geometry: lathe(P), height: hy + hr }
}

export function rook() {
  const P = new Profile()
  const R = 0.215
  const s = foot(P, R, 0.9)
  P.bez(s.r - 0.004, s.y + 0.08, 0.13, 0.3, 0.128, 0.372, 14)
  const c = collar(P, 0.128, 0.372, 0.158, 0.03, 0.13)
  const top = 0.6
  const tr = 0.168
  P.bez(c.r + 0.005, c.y + 0.03, tr - 0.01, c.y + 0.035, tr, c.y + 0.07, 10)
  P.line(tr, top - 0.008, 6)
  P.arc(tr - 0.008, top - 0.008, 0.008, 0, 90, 5)
  const ir = 0.122
  P.line(ir + 0.006, top)
  P.arc(ir + 0.006, top - 0.006, 0.006, 90, 180, 4)
  P.line(ir, top - 0.04)
  P.arc(ir - 0.01, top - 0.04, 0.01, 0, -90, 4)
  P.line(0, top - 0.05)
  let g = solid(lathe(P))
  const cutters = []
  const n = 6
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / n
    const box = new THREE.BoxGeometry(0.05, 0.1, 0.16)
    cutters.push(brush(box, { pos: [Math.sin(a) * tr, top, Math.cos(a) * tr], rot: [0, a, 0] }))
  }
  g = csg(g, cutters)
  return { geometry: g, height: top }
}

export function bishop() {
  const P = new Profile()
  const R = 0.205
  const s = foot(P, R, 0.9)
  P.bez(s.r - 0.004, s.y + 0.08, 0.08, 0.37, 0.068, 0.44, 16)
  const c = collar(P, 0.068, 0.44, 0.124, 0.03, 0.07)
  const m0 = c.y + 0.006
  P.bez(0.07, m0 + 0.002, 0.075, m0 + 0.006, 0.082, m0 + 0.012, 4)
  P.bez(0.124, m0 + 0.04, 0.134, m0 + 0.095, 0.126, m0 + 0.135, 12)
  P.bez(0.116, m0 + 0.18, 0.066, m0 + 0.228, 0.022, m0 + 0.242, 14)
  const fr = 0.029
  const fy = m0 + 0.242 + fr * 0.85
  P.arc(0, fy, fr, -60, 90, 12)
  let g = solid(lathe(P))
  // Rãnh xẻ chéo trên mũ Tượng, quay về phía người xem.
  const slit = new THREE.BoxGeometry(0.03, 0.22, 0.17)
  const mid = m0 + 0.118
  g = csg(g, [brush(slit, { pos: [0.02, mid + 0.012, 0.08], rot: [0, 0, rad(-44)] })])
  return { geometry: g, height: fy + fr }
}

export function queen() {
  const P = new Profile()
  const R = 0.228
  const s = foot(P, R, 0.97)
  P.bez(s.r - 0.004, s.y + 0.1, 0.085, 0.45, 0.076, 0.53, 16)
  const c = collar(P, 0.076, 0.53, 0.135, 0.032, 0.078)
  const k0 = c.y + 0.006
  const rim = 0.152
  const rimY = k0 + 0.17
  P.bez(0.082, k0 + 0.05, rim - 0.03, rimY - 0.06, rim, rimY - 0.006, 14)
  P.arc(rim - 0.008, rimY - 0.004, 0.008, -10, 90, 5)
  P.line(rim - 0.026, rimY + 0.004)
  P.bez(rim - 0.05, rimY - 0.004, 0.08, rimY + 0.004, 0.06, rimY + 0.035, 8)
  P.bez(0.045, rimY + 0.06, 0.03, rimY + 0.066, 0.022, rimY + 0.07, 6)
  const fr = 0.036
  const fy = rimY + 0.07 + fr * 0.8
  P.arc(0, fy, fr, -55, 90, 12)
  let g = solid(lathe(P))
  const cutters = []
  const n = 9
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    cutters.push(brush(new THREE.SphereGeometry(0.034, 24, 16), { pos: [Math.sin(a) * (rim + 0.004), rimY + 0.022, Math.cos(a) * (rim + 0.004)] }))
  }
  g = csg(g, cutters)
  return { geometry: g, height: fy + fr }
}

export function king() {
  const P = new Profile()
  const R = 0.236
  const s = foot(P, R, 1)
  P.bez(s.r - 0.004, s.y + 0.1, 0.09, 0.48, 0.08, 0.57, 16)
  const c = collar(P, 0.08, 0.57, 0.138, 0.032, 0.082)
  const k0 = c.y + 0.006
  const rim = 0.142
  const rimY = k0 + 0.155
  P.bez(0.086, k0 + 0.05, rim - 0.03, rimY - 0.06, rim, rimY - 0.006, 14)
  P.arc(rim - 0.008, rimY - 0.004, 0.008, -10, 90, 5)
  P.line(rim - 0.02, rimY + 0.004)
  P.bez(rim - 0.06, rimY + 0.012, 0.07, rimY + 0.05, 0.03, rimY + 0.062, 10)
  P.line(0.026, rimY + 0.066)
  P.line(0.026, rimY + 0.085, 2)
  P.line(0, rimY + 0.085)
  const g0 = lathe(P)
  const cy = rimY + 0.08
  const t = 0.042
  const vert = new RoundedBoxGeometry(t, 0.165, t, 3, 0.012)
  vert.translate(0, cy + 0.08, 0)
  const bar = new RoundedBoxGeometry(0.122, t, t, 3, 0.012)
  bar.translate(0, cy + 0.108, 0)
  const parts = [g0, vert, bar].map((x) => {
    x = x.index ? x.toNonIndexed() : x
    if (x.getAttribute('uv')) x.deleteAttribute('uv')
    return x
  })
  const g = mergeGeometries(parts)
  return { geometry: g, height: cy + 0.165 }
}

export function knight() {
  const P = new Profile()
  const R = 0.214
  const s = foot(P, R, 0.9)
  P.bez(s.r, s.y + 0.012, 0.15, s.y + 0.02, 0.148, s.y + 0.03, 6)
  P.arc(0.138, s.y + 0.03, 0.01, 0, 90, 5)
  P.line(0, s.y + 0.04)
  const base = lathe(P)
  const head = knightHead()
  const parts = [base, head].map((x) => {
    x = x.index ? x.toNonIndexed() : x
    if (x.getAttribute('uv')) x.deleteAttribute('uv')
    return x
  })
  return { geometry: mergeGeometries(parts), height: 0.78 }
}

export const PIECES = { pawn, knight, bishop, rook, queen, king }
