// Bộ quân dáng "Hiện đại thon gọn": thân mảnh eo thắt, đế hai tầng mỏng, vành đĩa sắc cạnh, Tượng nhọn có vết cắt chéo,
// Hậu đội vương miện gai nhọn, Vua có thánh giá đầu nhọn, Mã là khối điêu khắc trơn láng bo tròn mép.
// Đơn vị như các bộ khác: chiều cao Vua gần bằng 1.
import * as THREE from 'three'
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'
import { Profile } from './pieces.js'
import { samplePath, marchingCubes } from './knight.js'

const rad = (d) => (d * Math.PI) / 180
const SEG = 144

// Pháp tuyến "gấp nếp": mượt trên mặt cong, gãy sắc ở cạnh có góc lớn hơn ngưỡng (vành đĩa, mép đế, vết cắt).
function creased(g, angle = 30) {
  g = g.index ? g.toNonIndexed() : g
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k)
  const pos = g.attributes.position
  const n = pos.count / 3
  const fn = new Float32Array(n * 3)
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3()
  const key = (i) => `${Math.round(pos.getX(i) * 1e5)},${Math.round(pos.getY(i) * 1e5)},${Math.round(pos.getZ(i) * 1e5)}`
  const map = new Map()
  for (let f = 0; f < n; f++) {
    a.fromBufferAttribute(pos, f * 3)
    b.fromBufferAttribute(pos, f * 3 + 1)
    c.fromBufferAttribute(pos, f * 3 + 2)
    e1.subVectors(c, b)
    e2.subVectors(a, b)
    e1.cross(e2) // độ dài = 2 × diện tích: mặt lớn góp nhiều hơn
    fn[f * 3] = e1.x
    fn[f * 3 + 1] = e1.y
    fn[f * 3 + 2] = e1.z
    for (let v = 0; v < 3; v++) {
      const k = key(f * 3 + v)
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(f)
    }
  }
  const cosT = Math.cos(rad(angle))
  const out = new Float32Array(n * 9)
  const me = new THREE.Vector3(), other = new THREE.Vector3(), sum = new THREE.Vector3()
  for (let f = 0; f < n; f++) {
    me.set(fn[f * 3], fn[f * 3 + 1], fn[f * 3 + 2])
    const ml = me.length() || 1
    for (let v = 0; v < 3; v++) {
      sum.set(0, 0, 0)
      for (const o of map.get(key(f * 3 + v))) {
        other.set(fn[o * 3], fn[o * 3 + 1], fn[o * 3 + 2])
        const ol = other.length() || 1
        if (me.dot(other) / (ml * ol) >= cosT) sum.add(other)
      }
      if (sum.lengthSq() < 1e-20) sum.copy(me)
      sum.normalize()
      out.set([sum.x, sum.y, sum.z], (f * 3 + v) * 3)
    }
  }
  g.setAttribute('normal', new THREE.BufferAttribute(out, 3))
  return g
}

function lathe(P) {
  let g = new THREE.LatheGeometry(P.pts, SEG)
  g = g.toNonIndexed()
  g.deleteAttribute('uv')
  g.deleteAttribute('normal')
  return mergeVertices(g, 1e-6)
}

const evaluator = new Evaluator()
evaluator.attributes = ['position']
evaluator.useGroups = false
function cut(geometry, cutters) {
  if (!geometry.attributes.normal) geometry.computeVertexNormals()
  let a = new Brush(geometry)
  a.updateMatrixWorld()
  for (const c of cutters) {
    c.updateMatrixWorld()
    a = evaluator.evaluate(a, c, SUBTRACTION)
  }
  return a.geometry
}
function brush(geometry, pos, rot = [0, 0, 0]) {
  let g = geometry.toNonIndexed()
  g.deleteAttribute('uv')
  g.deleteAttribute('normal')
  g = mergeVertices(g, 1e-6)
  g.computeVertexNormals()
  const b = new Brush(g)
  b.position.set(...pos)
  b.rotation.set(...rot)
  return b
}
const merge = (parts) =>
  mergeGeometries(
    parts.map((x) => {
      x = x.index ? x.toNonIndexed() : x
      for (const k of Object.keys(x.attributes)) if (k !== 'position') x.deleteAttribute(k)
      return x
    }),
  )

// Đế hai tầng: đĩa mỏng vát mép, rồi một bậc nhỏ hơn. Trả về điểm bắt đầu thân.
function foot(P, R) {
  P.move(0, 0)
  P.line(R, 0, 2)
  P.line(R, 0.018)
  P.line(R - 0.013, 0.03)
  P.line(R * 0.76, 0.033, 2)
  P.line(R * 0.75, 0.05)
  P.line(R * 0.6, 0.055)
  return { r: R * 0.6, y: 0.055 }
}
// Thân eo thắt: thu nhỏ dần lên tới eo rồi loe nhẹ ra vành cổ.
function stem(P, s, rMin, yTop, rTop) {
  const h = yTop - s.y
  P.bez(s.r - 0.025, s.y + 0.006, rMin + 0.006, s.y + h * 0.32, rMin, s.y + h * 0.6, 12)
  P.bez(rMin, s.y + h * 0.8, rTop - 0.008, yTop - h * 0.06, rTop, yTop, 8)
}
// Vành cổ: đĩa mỏng sắc cạnh. Trả về điểm phía trên vành.
function collar(P, y, rc, rn) {
  P.line(rc, y + 0.007)
  P.line(rc, y + 0.019)
  P.line(rn, y + 0.03)
  return { r: rn, y: y + 0.03 }
}

export function pawn() {
  const P = new Profile()
  const s = foot(P, 0.15)
  stem(P, s, 0.046, 0.245, 0.06)
  const c = collar(P, 0.245, 0.1, 0.048)
  P.line(0.038, c.y + 0.014)
  const r = 0.082
  const cy = c.y + 0.014 + Math.sqrt(r * r - 0.038 * 0.038)
  P.arc(0, cy, r, (Math.atan2(-(cy - c.y - 0.014), 0.038) * 180) / Math.PI, 90, 26)
  return { geometry: creased(lathe(P)), height: cy + r }
}

export function rook() {
  const P = new Profile()
  const s = foot(P, 0.17)
  P.bez(s.r - 0.03, s.y + 0.01, 0.088, 0.18, 0.09, 0.3, 12)
  P.bez(0.085, 0.39, 0.12, 0.44, 0.134, 0.458, 8)
  P.line(0.156, 0.468)
  P.line(0.156, 0.479)
  P.line(0.14, 0.486)
  P.line(0.14, 0.6, 4)
  P.line(0.104, 0.6)
  P.line(0.104, 0.566)
  P.line(0, 0.566)
  let g = lathe(P)
  const cutters = []
  for (let i = 0; i < 4; i++) {
    const a = rad(45 + i * 90)
    cutters.push(brush(new THREE.BoxGeometry(0.052, 0.08, 0.12), [Math.sin(a) * 0.13, 0.6, Math.cos(a) * 0.13], [0, a, 0]))
  }
  return { geometry: creased(cut(g, cutters)), height: 0.6 }
}

export function bishop() {
  const P = new Profile()
  const s = foot(P, 0.165)
  stem(P, s, 0.05, 0.4, 0.064)
  const c = collar(P, 0.4, 0.104, 0.05)
  P.bez(0.09, c.y + 0.012, 0.114, 0.52, 0.106, 0.6, 12)
  P.bez(0.098, 0.67, 0.05, 0.745, 0.008, 0.792, 14)
  P.line(0, 0.8)
  let g = lathe(P)
  // Vết cắt chéo gọn qua nửa trước mũ Tượng.
  g = cut(g, [brush(new THREE.BoxGeometry(0.024, 0.28, 0.2), [0.012, 0.625, 0.1], [0, 0, rad(-40)])])
  return { geometry: creased(g), height: 0.8 }
}

export function queen() {
  const P = new Profile()
  const s = foot(P, 0.178)
  stem(P, s, 0.054, 0.48, 0.068)
  const c = collar(P, 0.48, 0.114, 0.054)
  P.bez(0.058, c.y + 0.05, 0.108, 0.66, 0.138, 0.716, 12)
  P.line(0.146, 0.726)
  P.line(0.122, 0.733)
  P.bez(0.1, 0.738, 0.06, 0.765, 0.03, 0.79, 8)
  P.line(0.02, 0.8)
  const r = 0.034
  const cy = 0.8 + Math.sqrt(r * r - 0.02 * 0.02)
  P.arc(0, cy, r, (Math.atan2(-(cy - 0.8), 0.02) * 180) / Math.PI, 90, 16)
  const body = lathe(P)
  // Tám gai nhọn dựng quanh vành, hơi ngả ra ngoài.
  const spikes = []
  for (let i = 0; i < 8; i++) {
    const a = rad(22.5 + i * 45)
    const h = 0.104
    const cone = new THREE.ConeGeometry(0.025, h, 32, 1)
    cone.translate(0, h / 2, 0)
    cone.rotateX(rad(12))
    cone.rotateY(a)
    cone.translate(Math.sin(a) * 0.126, 0.712, Math.cos(a) * 0.126)
    spikes.push(cone)
  }
  return { geometry: creased(merge([body, ...spikes])), height: cy + r }
}

export function king() {
  const P = new Profile()
  const s = foot(P, 0.185)
  stem(P, s, 0.057, 0.52, 0.072)
  const c = collar(P, 0.52, 0.12, 0.057)
  P.bez(0.064, c.y + 0.05, 0.114, 0.7, 0.134, 0.758, 12)
  P.line(0.134, 0.774)
  P.line(0.06, 0.79)
  P.line(0.034, 0.798)
  P.line(0, 0.798)
  const body = lathe(P)
  // Thánh giá đầu nhọn: hình chữ thập bốn đầu vát nhọn, ép dày.
  const w = 0.021, hb = 0.018
  const cx = 0.905
  const pts = [
    [-w, 0.79], [w, 0.79], [w, cx - hb], [0.062, cx - hb], [0.082, cx], [0.062, cx + hb], [w, cx + hb],
    [w, 0.948], [0, 0.976], [-w, 0.948], [-w, cx + hb], [-0.062, cx + hb], [-0.082, cx], [-0.062, cx - hb], [-w, cx - hb],
  ].map(([x, y]) => new THREE.Vector2(x, y))
  const d = 0.034, bv = 0.006
  const cross = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: d - 2 * bv, bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelSegments: 2, curveSegments: 1 })
  cross.translate(0, 0, -(d - 2 * bv) / 2)
  return { geometry: creased(merge([body, cross])), height: 0.976 }
}

// Hình nghiêng ngựa giản lược (toạ độ kiểu SVG, y hướng xuống): cổ cong vồng, mõm gọn, một tai nhọn.
const KNIGHT_C = [
  ['M', 34, 120],
  ['C', 26, 104, 22, 90, 26, 76],
  ['C', 29, 67, 35, 62, 37, 57],
  ['C', 31, 56, 20, 57, 11, 55],
  ['C', 5, 54, 2, 50, 3, 45],
  ['C', 4, 40, 8, 37, 12, 35],
  ['C', 22, 29, 31, 20, 38, 12],
  ['C', 40, 8, 41, 4, 42, 0],
  ['C', 46, 3, 49, 7, 51, 11],
  ['C', 66, 13, 80, 28, 84, 50],
  ['C', 87, 70, 86, 98, 80, 120],
]
// Mép sau cổ: chỗ mọc bờm dạng vây mỏng.
const CREST = [['M', 51, 11], ['C', 66, 13, 80, 28, 84, 50], ['C', 87, 70, 86, 98, 80, 120]]

const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}
function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)))
  return Math.hypot(px - ax - vx * t, py - ay - vy * t)
}
function lineDist(x, y, pts) {
  let d = Infinity
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, segDist(x, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]))
  return d
}

// Đầu ngựa điêu khắc: dày tròn như tượng, mép bo rộng, mõm mỏng dần, bờm là một lưỡi vây mỏng dọc gáy.
function sculptHead() {
  const sx = 0.0043, sy = 0.0061, ox = 46, top = 0.8
  const toM = ([X, Y]) => [(X - ox) * sx, top - Y * sy]
  const poly = samplePath(KNIGHT_C, 24).map(toM)
  const crest = samplePath(CREST, 24).map(toM)
  const eye = toM([30, 23])
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const [x, y] of poly) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  const cell = 0.002
  const pad = cell * 3
  minX -= pad; maxX += pad; minY -= pad; maxY += pad
  const nx = Math.ceil((maxX - minX) / cell) + 1
  const ny = Math.ceil((maxY - minY) / cell) + 1
  const sd = new Float32Array(nx * ny)
  const surf = new Float32Array(nx * ny)
  for (let j = 0; j < ny; j++) {
    const y = minY + j * cell
    for (let i = 0; i < nx; i++) {
      const x = minX + i * cell
      let d = Infinity, inside = false
      for (let k = 0, l = poly.length - 1; k < poly.length; l = k++) {
        const [ax, ay] = poly[k], [bx, by] = poly[l]
        d = Math.min(d, segDist(x, y, ax, ay, bx, by))
        if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside
      }
      sd[j * nx + i] = inside ? -d : d
      if (!inside) continue
      // Nửa bề dày: cổ dày, mõm và tai mỏng.
      let t = 0.058
      t *= 1 - 0.32 * smooth(-0.06, -0.17, x) * smooth(0.45, 0.6, y)
      t *= 1 - 0.45 * smooth(0.7, 0.79, y)
      t *= 1 + 0.12 * smooth(0.45, 0.2, y)
      const dc = lineDist(x, y, crest)
      const fade = smooth(0.14, 0.32, y)
      const W = 0.026 * fade
      const dd = Math.min(d, dc - W)
      const b = Math.min(t * 1.2, 0.05)
      let h = dd > 0 ? t * Math.sqrt(1 - (1 - Math.min(1, dd / b)) ** 2) + 0.006 * smooth(0, 0.08, dd) : 0
      if (dc < W + 0.012) h = Math.max(h, 0.0085 * fade * Math.sqrt(Math.min(1, d / 0.004)))
      const de = Math.hypot(x - eye[0], y - eye[1])
      h -= 0.01 * Math.exp(-((de / 0.012) ** 2)) * smooth(0.004, 0.02, d)
      surf[j * nx + i] = Math.max(0, h)
    }
  }
  let zMax = 0
  for (const h of surf) zMax = Math.max(zMax, h)
  const nz = Math.ceil((2 * zMax + 2 * pad) / cell) + 1
  const minZ = -(nz - 1) * cell * 0.5
  const field = new Float32Array(nx * ny * nz)
  for (let k = 0; k < nz; k++) {
    const z = Math.abs(minZ + k * cell)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const q = j * nx + i
        const sv = sd[q]
        field[(k * ny + j) * nx + i] = sv < 0 ? z - surf[q] : Math.hypot(sv, z)
      }
  }
  return marchingCubes(field, nx, ny, nz, cell, [minX, minY, minZ])
}

export function knight() {
  const P = new Profile()
  const s = foot(P, 0.172)
  P.line(s.r, 0.07)
  P.line(0, 0.07)
  const base = creased(lathe(P))
  // Đầu giữ pháp tuyến mượt tính từ trường khoảng cách (mặt cong liền như tượng đúc).
  const head = sculptHead()
  return { geometry: mergeGeometries([base, head]), height: 0.8 }
}

export const PIECES_C = { pawn, knight, bishop, rook, queen, king }
