// Đầu ngựa nặn như gối: lấy hình nghiêng 2D, độ dày tròn dần ra mép (như gỗ tiện bo cạnh),
// thêm mắt, lỗ mũi, đường miệng, đường má và bờm khắc rãnh. Lưới tam giác dựng bằng marching cubes.
import * as THREE from 'three'
import { edgeTable, triTable } from 'three/addons/objects/MarchingCubes.js'

export const KNIGHT_PATH = [
  ['M', 25, 118],
  ['C', 17, 104, 13, 88, 16, 74],
  ['C', 19, 64, 28, 60, 34, 57],
  ['C', 38, 55, 39, 51, 35, 49.5],
  ['C', 28, 51.5, 18, 53, 11, 52],
  ['C', 6, 51, 3, 47, 3, 42],
  ['C', 3, 37, 6, 33, 11, 31],
  ['C', 20, 27, 31, 20, 39, 13],
  ['C', 41, 8, 44, 3, 48, 0],
  ['C', 52, 3, 56, 7, 58, 11],
  ['C', 67, 13, 75, 20, 80, 30],
  ['C', 86, 44, 88, 62, 86, 78],
  ['C', 85, 90, 82, 104, 80, 118],
  ['Z'],
]

export function samplePath(d, n = 48) {
  const pts = []
  let cur = null
  for (const c of d) {
    if (c[0] === 'M') {
      cur = [c[1], c[2]]
      pts.push(cur)
    } else if (c[0] === 'L') {
      cur = [c[1], c[2]]
      pts.push(cur)
    } else if (c[0] === 'C') {
      const [x0, y0] = cur
      const [, x1, y1, x2, y2, x3, y3] = c
      for (let i = 1; i <= n; i++) {
        const t = i / n
        const u = 1 - t
        pts.push([u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3])
      }
      cur = [x3, y3]
    }
  }
  return pts
}

const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

// Khoảng cách từ điểm tới đoạn thẳng (theo toạ độ SVG), dùng cho các rãnh khắc.
function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax
  const vy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)))
  const dx = px - ax - vx * t
  const dy = py - ay - vy * t
  return Math.hypot(dx, dy)
}
function polyDist(px, py, pts) {
  let d = Infinity
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, segDist(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]))
  return d
}

export function knightHead(opts = {}) {
  const sx = opts.sx ?? 0.0052 // đơn vị SVG → đơn vị quân
  const ox = opts.ox ?? 46
  const top = opts.top ?? 0.78
  const sy = opts.sy ?? 0.0062
  const poly = samplePath(opts.path ?? KNIGHT_PATH).map(([X, Y]) => [(X - ox) * sx, top - Y * sy])
  // Các nét chi tiết, theo toạ độ SVG.
  const toM = ([X, Y]) => [(X - ox) * sx, top - Y * sy]
  const eye = toM([33, 25])
  const nostril = toM([8.5, 39])
  const mouth = samplePath([['M', 3.5, 46.5], ['C', 7, 46, 11, 46.5, 15, 47.5]], 12).map(toM)
  const cheek = samplePath([['M', 36, 50], ['C', 44, 44, 48, 34, 47, 22], ['C', 46.5, 17, 47, 14, 49, 11]], 24).map(toM)
  const maneEdge = samplePath([['M', 56, 12], ['C', 66, 16, 74, 24, 78, 34], ['C', 82, 46, 83, 62, 81, 80], ['C', 80, 88, 79, 96, 79, 104]], 40).map(toM)

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const [x, y] of poly) {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  const cell = opts.cell ?? 0.0022
  const pad = cell * 3
  minX -= pad
  maxX += pad
  minY -= pad
  maxY += pad
  const nx = Math.ceil((maxX - minX) / cell) + 1
  const ny = Math.ceil((maxY - minY) / cell) + 1
  const T = opts.thick ?? 0.088

  // Khoảng cách có dấu tới viền 2D (âm là bên trong), và độ phồng của mặt ở mỗi điểm.
  const sd = new Float32Array(nx * ny)
  const surf = new Float32Array(nx * ny)
  for (let j = 0; j < ny; j++) {
    const y = minY + j * cell
    for (let i = 0; i < nx; i++) {
      const x = minX + i * cell
      let d = Infinity
      let inside = false
      for (let k = 0, l = poly.length - 1; k < poly.length; l = k++) {
        const [ax, ay] = poly[k]
        const [bx, by] = poly[l]
        d = Math.min(d, segDist(x, y, ax, ay, bx, by))
        if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside
      }
      const s = inside ? -d : d
      sd[j * nx + i] = s
      if (!inside) continue
      // Độ dày nửa thân theo chỗ: cổ dày, mõm mỏng hơn, tai mỏng.
      let t = T
      t *= 1 - 0.28 * smooth(-0.08, -0.2, x) * smooth(0.42, 0.55, y)
      t *= 1 - 0.55 * smooth(0.7, 0.78, y)
      t *= 1 + 0.3 * smooth(0.34, 0.14, y)
      const b = Math.min(t * 1.05, 0.075)
      const e = Math.min(1, d / b)
      let h = t * Math.sqrt(1 - (1 - e) * (1 - e))
      // Mặt hơi phồng giữa, không phẳng tuyệt đối.
      h += 0.012 * smooth(0, 0.1, d)
      // Chi tiết khắc, mờ dần ra sát mép.
      const fade = smooth(0.004, 0.03, d)
      let r = 0
      const de = Math.hypot(x - eye[0], y - eye[1])
      r += 0.011 * Math.exp(-((de / 0.016) ** 2)) // con mắt lồi
      r -= 0.007 * Math.exp(-(((de - 0.024) / 0.006) ** 2)) // hốc mắt
      const dn = Math.hypot(x - nostril[0], y - nostril[1])
      r -= 0.008 * Math.exp(-((dn / 0.011) ** 2))
      r -= 0.006 * Math.exp(-((polyDist(x, y, mouth) / 0.004) ** 2))
      r -= 0.007 * Math.exp(-((polyDist(x, y, cheek) / 0.006) ** 2))
      // Bờm: dải gồ phía sau cổ, có rãnh chéo.
      const dm = polyDist(x, y, maneEdge)
      const behind = x > 0.02 || y > 0.68
      if (behind) {
        const band = smooth(-0.002, 0.014, sdLine(x, y, maneEdge))
        r += 0.007 * band
        const u = y * 34 + x * 22
        r -= 0.0045 * band * Math.pow(0.5 + 0.5 * Math.cos(u * Math.PI * 2), 3)
      }
      r -= 0.003 * Math.exp(-((dm / 0.007) ** 2))
      surf[j * nx + i] = h + r * fade
    }
  }

  let zMax = 0
  for (const h of surf) zMax = Math.max(zMax, h)
  const nz = Math.ceil((2 * zMax + 2 * pad) / cell) + 1
  const minZ = -(nz - 1) * cell * 0.5
  // Trường 3D: âm bên trong khối, dương bên ngoài.
  const field = new Float32Array(nx * ny * nz)
  for (let k = 0; k < nz; k++) {
    const z = Math.abs(minZ + k * cell)
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const q = j * nx + i
        const s = sd[q]
        field[(k * ny + j) * nx + i] = s < 0 ? z - surf[q] : Math.hypot(s, z)
      }
    }
  }
  return marchingCubes(field, nx, ny, nz, cell, [minX, minY, minZ])

  // Bên nào của đường bờm (dương: phía trước bờm, âm: phía sau, sát mép lưng).
  function sdLine(x, y, line) {
    let best = Infinity
    let sign = 1
    for (let i = 0; i < line.length - 1; i++) {
      const [ax, ay] = line[i]
      const [bx, by] = line[i + 1]
      const dd = segDist(x, y, ax, ay, bx, by)
      if (dd < best) {
        best = dd
        const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax)
        sign = cross > 0 ? 1 : -1
      }
    }
    return best * sign
  }
}

export function marchingCubes(field, nx, ny, nz, cell, origin) {
  const at = (i, j, k) => field[(k * ny + j) * nx + i]
  const pos = []
  const nor = []
  const corner = [
    [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
    [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
  ]
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7],
  ]
  const v = new Float32Array(8)
  const vert = new Array(12)
  const grad = (x, y, z) => {
    // Pháp tuyến = gradient của trường, lấy mẫu ba chiều tuyến tính.
    const s = (fx, fy, fz) => {
      fx = Math.min(nx - 1.001, Math.max(0, fx))
      fy = Math.min(ny - 1.001, Math.max(0, fy))
      fz = Math.min(nz - 1.001, Math.max(0, fz))
      const i = Math.floor(fx), j = Math.floor(fy), k = Math.floor(fz)
      const a = fx - i, b = fy - j, c = fz - k
      const f = (di, dj, dk) => at(i + di, j + dj, k + dk)
      return (
        f(0, 0, 0) * (1 - a) * (1 - b) * (1 - c) + f(1, 0, 0) * a * (1 - b) * (1 - c) + f(0, 1, 0) * (1 - a) * b * (1 - c) + f(1, 1, 0) * a * b * (1 - c) +
        f(0, 0, 1) * (1 - a) * (1 - b) * c + f(1, 0, 1) * a * (1 - b) * c + f(0, 1, 1) * (1 - a) * b * c + f(1, 1, 1) * a * b * c
      )
    }
    const h = 0.75
    const gx = s(x + h, y, z) - s(x - h, y, z)
    const gy = s(x, y + h, z) - s(x, y - h, z)
    const gz = s(x, y, z + h) - s(x, y, z - h)
    const l = Math.hypot(gx, gy, gz) || 1
    return [gx / l, gy / l, gz / l]
  }
  for (let k = 0; k < nz - 1; k++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        let idx = 0
        for (let c = 0; c < 8; c++) {
          v[c] = at(i + corner[c][0], j + corner[c][1], k + corner[c][2])
          if (v[c] < 0) idx |= 1 << c
        }
        const e = edgeTable[idx]
        if (e === 0) continue
        for (let n = 0; n < 12; n++) {
          if (!(e & (1 << n))) continue
          const [a, b] = edges[n]
          const t = v[a] / (v[a] - v[b])
          vert[n] = [
            i + corner[a][0] + (corner[b][0] - corner[a][0]) * t,
            j + corner[a][1] + (corner[b][1] - corner[a][1]) * t,
            k + corner[a][2] + (corner[b][2] - corner[a][2]) * t,
          ]
        }
        const base = idx * 16
        for (let n = 0; triTable[base + n] !== -1; n += 3) {
          // Thứ tự đỉnh đảo lại để mặt quay ra ngoài.
          for (const m of [0, 2, 1]) {
            const p = vert[triTable[base + n + m]]
            pos.push(origin[0] + p[0] * cell, origin[1] + p[1] * cell, origin[2] + p[2] * cell)
            const g = grad(p[0], p[1], p[2])
            nor.push(g[0], g[1], g[2])
          }
        }
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  return g
}
