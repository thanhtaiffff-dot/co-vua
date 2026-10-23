// Bộ quân dáng "Góc cạnh": thân tiện tám cạnh, đường viền gãy gọn thay cho đường cong, mặt phẳng sắc cạnh
// (mỗi mặt bắt đèn một kiểu nên kim loại, pha lê trông cứng cáp hơn). Quân Mã là tấm cắt vát cạnh.
// Đơn vị như bộ tròn: chiều cao Vua = 1.
import * as THREE from 'three'
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'
import { KNIGHT_PATH, samplePath } from './knight.js'

const SIDES = 8
const V2 = (x, y) => new THREE.Vector2(x, y)
const rad = (d) => (d * Math.PI) / 180

function lathe(pts) {
  let g = new THREE.LatheGeometry(pts.map(([r, y]) => V2(r, y)), SIDES)
  g = g.toNonIndexed()
  g.deleteAttribute('uv')
  return mergeVertices(g, 1e-5)
}
// Nửa quả cầu mài giác (đường tròn thô) tâm (0, cy), từ góc a0 lên tới đỉnh.
function ball(cy, r, a0 = -60, n = 4) {
  const out = []
  for (let i = 0; i <= n; i++) {
    const a = rad(a0 + ((90 - a0) * i) / n)
    out.push([r * Math.cos(a), cy + r * Math.sin(a)])
  }
  out[out.length - 1][0] = 0
  return out
}
// Chân đế bậc thang: tấm đế vát mép, một bậc nhỏ rồi vào thân.
function foot(R, s = 1) {
  return [
    [0, 0],
    [R, 0],
    [R, 0.03 * s],
    [R - 0.02 * s, 0.05 * s],
    [R * 0.8, 0.054 * s],
    [R * 0.8, 0.072 * s],
    [R * 0.69, 0.09 * s],
  ]
}
function collar(r, y, rn) {
  return [
    [r, y],
    [r, y + 0.022],
    [rn, y + 0.04],
  ]
}

const evaluator = new Evaluator()
evaluator.attributes = ['position', 'normal']
evaluator.useGroups = false
function cut(geometry, cutters) {
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
  g = mergeVertices(g, 1e-5)
  const b = new Brush(g)
  b.position.set(...pos)
  b.rotation.set(...rot)
  return b
}
// Mặt phẳng sắc cạnh: mỗi tam giác giữ pháp tuyến của chính nó.
function facets(g) {
  g = g.index ? g.toNonIndexed() : g
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k)
  g.computeVertexNormals()
  return g
}
const merge = (parts) => facets(mergeGeometries(parts.map((x) => {
  x = x.index ? x.toNonIndexed() : x
  for (const k of Object.keys(x.attributes)) if (k !== 'position') x.deleteAttribute(k)
  return x
})))

export function pawn() {
  const pts = [...foot(0.19, 0.9), [0.085, 0.235], ...collar(0.126, 0.25, 0.07), ...ball(0.378, 0.098, -50, 5)]
  return { geometry: facets(lathe(pts)), height: 0.476 }
}

export function rook() {
  const top = 0.6
  const pts = [...foot(0.215, 0.95), [0.132, 0.35], ...collar(0.162, 0.362, 0.142), [0.174, 0.45], [0.174, top], [0.122, top], [0.122, top - 0.045], [0, top - 0.045]]
  let g = lathe(pts)
  // Bốn khe răng cưa trên đỉnh, nằm giữa các mặt xen kẽ.
  const cutters = []
  for (let i = 0; i < 4; i++) {
    const a = rad(22.5 + i * 90)
    cutters.push(brush(new THREE.BoxGeometry(0.07, 0.1, 0.16), [Math.sin(a) * 0.17, top, Math.cos(a) * 0.17], [0, a, 0]))
  }
  return { geometry: facets(cut(g, cutters)), height: top }
}

export function bishop() {
  const pts = [...foot(0.205, 0.95), [0.074, 0.43], ...collar(0.122, 0.44, 0.072), [0.1, 0.5], [0.13, 0.565], [0.124, 0.64], [0.09, 0.7], [0.036, 0.738], ...ball(0.765, 0.032, -55, 3)]
  let g = lathe(pts)
  const slit = new THREE.BoxGeometry(0.032, 0.24, 0.18)
  g = cut(g, [brush(slit, [0.02, 0.6, 0.085], [0, 0, rad(-44)])])
  return { geometry: facets(g), height: 0.797 }
}

export function queen() {
  const rimY = 0.73
  // Vành vương miện đứng thẳng một đoạn rồi mới khoét, cho tám mũi nhọn gọn.
  const pts = [...foot(0.228, 1), [0.082, 0.52], ...collar(0.136, 0.532, 0.08), [0.094, 0.6], [0.162, 0.695], [0.166, rimY], [0.134, rimY], [0.128, 0.7], [0.07, 0.69], [0.05, 0.73], ...ball(0.785, 0.04, -50, 4)]
  let g = lathe(pts)
  // Tám mũi nhọn: khoét chữ V nhỏ giữa mỗi mặt của vành, chừa các góc cạnh thành mũi.
  const cutters = []
  for (let i = 0; i < SIDES; i++) {
    const a = rad(22.5 + i * 45)
    cutters.push(brush(new THREE.BoxGeometry(0.05, 0.05, 0.12), [Math.sin(a) * 0.15, rimY + 0.006, Math.cos(a) * 0.15], [0, a, rad(45)]))
  }
  return { geometry: facets(cut(g, cutters)), height: 0.828 }
}

export function king() {
  const top = 0.792
  const pts = [...foot(0.236, 1.03), [0.088, 0.56], ...collar(0.142, 0.572, 0.086), [0.1, 0.63], [0.152, 0.73], [0.152, 0.748], [0.06, 0.772], [0.042, top], [0, top]]
  const body = lathe(pts)
  const t = 0.046
  const vert = new THREE.BoxGeometry(t, 0.172, t)
  vert.translate(0, top + 0.08, 0)
  const bar = new THREE.BoxGeometry(0.13, t, t)
  bar.translate(0, top + 0.112, 0)
  return { geometry: merge([body, vert, bar]), height: top + 0.166 }
}

export function knight() {
  const base = lathe([...foot(0.214, 0.95), [0, 0.0855]])
  // Hình nghiêng con ngựa lấy ít điểm cho ra các cạnh gãy, ép dày rồi vát mép một nấc.
  const sx = 0.0052, ox = 46, topY = 0.78, sy = 0.0062
  const poly = samplePath(KNIGHT_PATH, 3).map(([X, Y]) => V2((X - ox) * sx, topY - Y * sy))
  const shape = new THREE.Shape(poly)
  const T = 0.15
  const bev = 0.022
  const head = new THREE.ExtrudeGeometry(shape, { depth: T - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: 0.016, bevelSegments: 1, curveSegments: 1 })
  head.translate(0, 0, -(T - 2 * bev) / 2)
  // Hốc mắt hình thoi hai bên.
  const eye = [(33 - ox) * sx, topY - 25 * sy]
  let h = mergeVertices(head.toNonIndexed().deleteAttribute('uv'), 1e-6)
  const cutters = [1, -1].map((side) => brush(new THREE.BoxGeometry(0.026, 0.026, 0.04), [eye[0], eye[1], side * (T / 2 + 0.004)], [0, 0, rad(45)]))
  h = cut(h, cutters)
  return { geometry: merge([base, h]), height: 0.78 }
}

export const PIECES_B = { pawn, knight, bishop, rook, queen, king }
