// Phòng chụp ảnh quân cờ: dựng quân, chiếu sáng kiểu studio, chụp hai lần trên nền trắng và nền đen
// để tách ra ảnh có độ trong suốt thật (bóng đổ, thủy tinh), rồi nén sáng (tone mapping) thành ảnh 8-bit.
import * as THREE from 'three'
import { PIECES } from './pieces.js'
import { PIECES_B } from './piecesB.js'
import { PIECES_C } from './piecesC.js'
import { makeMaterial } from './materials.js'
import { makeGlass } from './glass.js'
import './board.js'

const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(1)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.NoToneMapping

// ---------- Môi trường phản chiếu: phòng tối có các hộp đèn lớn ----------
function studio(opts = {}) {
  const env = new THREE.Scene()
  const wall = opts.wall ?? 0.05
  const room = new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(wall, wall, wall * 1.02), side: THREE.BackSide }))
  env.add(room)
  // Sàn hơi sáng hơn tường cho mặt dưới quân có ánh phản xạ nhẹ.
  const fl = opts.floor ?? 0.12
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(fl, fl * 0.96, fl * 0.92) }))
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -1.5
  env.add(floor)
  const panel = (w, h, pos, intensity, color = [1, 1, 1]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color[0] * intensity, color[1] * intensity, color[2] * intensity), side: THREE.DoubleSide }))
    m.position.set(pos[0], pos[1], opts.flat ? -pos[2] : pos[2])
    m.lookAt(0, opts.flat ? 0 : 0.5, 0)
    env.add(m)
    return m
  }
  const k = opts.key ?? 1
  panel(5, 7, [-6, 6, 5], 5.5 * k, [1, 0.97, 0.93]) // đèn chính trên trái phía trước
  panel(9, 9, [0, 9.5, 0], 2.2 * k * (opts.flat ? opts.ceil ?? 0.45 : 1)) // đèn trần
  panel(1.4, 9, [7, 3, -4], 4 * k, [0.93, 0.96, 1]) // đèn viền phải sau
  panel(1.4, 9, [-7, 3, -5], 2.6 * k, [0.93, 0.96, 1]) // đèn viền trái sau
  panel(8, 2.5, [2, 0.5, 8], 0.9 * k) // đèn bù phía trước thấp
  return env
}

const pmrem = new THREE.PMREMGenerator(renderer)
const envCache = new Map()
function envMap(key, opts) {
  if (!envCache.has(key)) envCache.set(key, pmrem.fromScene(studio(opts), 0.02).texture)
  return envCache.get(key)
}

// ---------- Bóng dưới chân quân ----------
function blobTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
  grad.addColorStop(0, 'rgba(0,0,0,1)')
  grad.addColorStop(0.55, 'rgba(0,0,0,0.75)')
  grad.addColorStop(0.8, 'rgba(0,0,0,0.25)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.NoColorSpace
  return t
}
const blob = blobTexture()

const geomCache = new Map()
function pieceGeometry(type, shape) {
  const key = (shape ?? 'a') + ':' + type
  if (!geomCache.has(key)) geomCache.set(key, (shape === 'b' ? PIECES_B : shape === 'c' ? PIECES_C : PIECES)[type]())
  return geomCache.get(key)
}

// Hướng vân mài cho ánh sáng kéo dài vuông góc với vân (anisotropy): quân tiện có vân vòng quanh thân,
// đầu Mã có vân nằm ngang, quân 2D có vân ngang theo trục x của tấm.
function brushTangents(geometry, mode, baseY = 0.15) {
  const pos = geometry.attributes.position
  const nor = geometry.attributes.normal
  const out = new Float32Array(pos.count * 4)
  const p = new THREE.Vector3(), n = new THREE.Vector3(), g = new THREE.Vector3(), t = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    n.fromBufferAttribute(nor, i).normalize()
    const r = Math.hypot(p.x, p.z)
    if (mode === 'flat') g.set(1, 0, 0)
    else if (mode === 'ring' || p.y < baseY) {
      if (r > 1e-5) g.set(-p.z / r, 0, p.x / r)
      else g.set(1, 0, 0)
    } else g.crossVectors(up, n)
    g.addScaledVector(n, -g.dot(n))
    if (g.lengthSq() < 1e-8) g.set(1, 0, 0).addScaledVector(n, -n.x)
    if (g.lengthSq() < 1e-8) g.set(0, 0, 1).addScaledVector(n, -n.z)
    g.normalize()
    t.crossVectors(n, g).normalize()
    out[i * 4] = t.x
    out[i * 4 + 1] = t.y
    out[i * 4 + 2] = t.z
    out[i * 4 + 3] = 1
  }
  geometry.setAttribute('tangent', new THREE.BufferAttribute(out, 4))
}
const BASE_Y = { a: 0.15, b: 0.09, c: 0.075 }

function toneNeutral(r, g, b) {
  const start = 0.8 - 0.04
  const desat = 0.15
  const x = Math.min(r, g, b)
  const off = x < 0.08 ? x - 6.25 * x * x : 0.04
  r -= off
  g -= off
  b -= off
  const peak = Math.max(r, g, b)
  if (peak < start) return [r, g, b]
  const d = 1 - start
  const np = 1 - (d * d) / (peak + d - start)
  r *= np / peak
  g *= np / peak
  b *= np / peak
  const t = 1 - 1 / (desat * (peak - np) + 1)
  return [r + (np - r) * t, g + (np - g) * t, b + (np - b) * t]
}
const enc = (v) => {
  v = Math.min(1, Math.max(0, v))
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
}

window.renderSprite = async function renderSprite(opts) {
  const {
    piece,
    material,
    size = 512,
    elevation = 26,
    azimuth = 0,
    frame = 1.12, // bề rộng khung hình theo đơn vị quân (Vua cao 1)
    aspect = 1, // chiều cao ảnh / chiều rộng (quân cao được nhô lên ô trên)
    baseline = 0.055, // khoảng trống dưới chân, tính theo bề rộng khung hình
    exposure = 1,
    shadow = 0.32,
    contact = 0.5,
    env = {},
  } = opts
  const { geometry } = pieceGeometry(piece, opts.shape)
  const scene = new THREE.Scene()
  const envTex = envMap(JSON.stringify(env), env)
  scene.environment = envTex
  scene.environmentIntensity = opts.envIntensity ?? 1
  const e = (elevation * Math.PI) / 180
  const a = (azimuth * Math.PI) / 180
  const camDir = new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e))
  const baseY = BASE_Y[opts.shape ?? 'a']
  if (material.anisotropy && !geometry.attributes.tangent) brushTangents(geometry, piece === 'knight' ? 'knight' : 'ring', baseY)
  const mat = material.glass ? makeGlass(material, envTex, camDir) : makeMaterial({ baseY, ...material }, piece)
  const mesh = new THREE.Mesh(geometry, mat)
  mesh.renderOrder = 2
  mesh.castShadow = true
  mesh.receiveShadow = true
  const turn = (opts.shape === 'b'
    ? { knight: 0.4, bishop: 0.22, king: 0.32, queen: 0.14, rook: 0.18, pawn: 0.14 }
    : opts.shape === 'c'
      ? { knight: 0.4, bishop: 0.2, king: 0.3, queen: 0.2, rook: 0, pawn: 0 }
      : { knight: 0.4, bishop: 0.18, king: 0.3, queen: 0.12, rook: 0.26, pawn: 0 })[piece] ?? 0
  mesh.rotation.y = turn + (opts.turn ?? 0)
  if (opts.mirror) mesh.scale.x = -1
  scene.add(mesh)

  const sun = new THREE.DirectionalLight(0xfff4e8, opts.sun ?? 1.1)
  sun.position.set(opts.sunPos?.[0] ?? -1.6, opts.sunPos?.[1] ?? 5, opts.sunPos?.[2] ?? -0.6)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -1
  sun.shadow.camera.right = 1
  sun.shadow.camera.top = 1
  sun.shadow.camera.bottom = -1
  sun.shadow.radius = 6
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.004
  scene.add(sun)

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.ShadowMaterial({ opacity: shadow }))
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)
  const footR = 0.25
  const ao = new THREE.Mesh(
    new THREE.PlaneGeometry(footR * 2.5, footR * 2.5),
    new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: blob, transparent: true, opacity: contact, depthWrite: false }),
  )
  ao.rotation.x = -Math.PI / 2
  ao.position.y = 0.0006
  ao.renderOrder = 1
  scene.add(ao)

  const cam = new THREE.OrthographicCamera(-frame / 2, frame / 2, 1, 0, 0.1, 50)
  cam.position.copy(camDir).multiplyScalar(10)
  cam.lookAt(0, 0, 0)
  const bottom = -0.25 * Math.sin(e) - baseline * frame
  cam.top = bottom + frame * aspect
  cam.bottom = bottom
  cam.updateProjectionMatrix()

  const W = size
  const H = Math.round(size * aspect)
  renderer.setSize(W, H)
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType, samples: 4, colorSpace: THREE.LinearSRGBColorSpace })
  const shots = []
  for (const bg of [0, 1]) {
    renderer.setRenderTarget(rt)
    renderer.setClearColor(new THREE.Color(bg, bg, bg), 1)
    renderer.clear()
    renderer.render(scene, cam)
    const buf = new Float32Array(W * H * 4)
    renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf)
    shots.push(buf)
  }
  renderer.setRenderTarget(null)
  rt.dispose()
  mat.dispose()

  const [c0, c1] = shots
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(W, H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = ((H - 1 - y) * W + x) * 4 // ảnh đọc từ dưới lên
      const o = (y * W + x) * 4
      const tr = Math.min(1, Math.max(0, c1[i] - c0[i]))
      const tg = Math.min(1, Math.max(0, c1[i + 1] - c0[i + 1]))
      const tb = Math.min(1, Math.max(0, c1[i + 2] - c0[i + 2]))
      const alpha = 1 - (tr + tg + tb) / 3
      if (alpha < 0.002) {
        img.data[o + 3] = 0
        continue
      }
      const k = exposure / alpha
      const [r, g, b] = toneNeutral(c0[i] * k, c0[i + 1] * k, c0[i + 2] * k)
      img.data[o] = Math.round(enc(r) * 255)
      img.data[o + 1] = Math.round(enc(g) * 255)
      img.data[o + 2] = Math.round(enc(b) * 255)
      img.data[o + 3] = Math.round(Math.min(1, alpha) * 255)
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL('image/png')
}

// ---------- Quân 2D: hình quân phẳng quen thuộc (bộ cburnett) làm thành tấm chất liệu có gờ bo tròn ----------
// Khoảng cách từ mỗi điểm trong hình tới mép hình (thuật toán Felzenszwalb, tính theo pixel).
function edt1d(f, n, d, v, z) {
  let k = 0
  v[0] = 0
  z[0] = -Infinity
  z[1] = Infinity
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    while (s <= z[k]) {
      k--
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    }
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = Infinity
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]
  }
}
function distanceInside(inside, N) {
  const g = new Float64Array(N * N)
  for (let i = 0; i < N * N; i++) g[i] = inside[i] ? 1e20 : 0
  const f = new Float64Array(N), d = new Float64Array(N), v = new Int32Array(N), z = new Float64Array(N + 1)
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) f[y] = g[y * N + x]
    edt1d(f, N, d, v, z)
    for (let y = 0; y < N; y++) g[y * N + x] = d[y]
  }
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) f[x] = g[y * N + x]
    edt1d(f, N, d, v, z)
    for (let x = 0; x < N; x++) g[y * N + x] = Math.sqrt(d[x])
  }
  return g
}
function blur(a, N, r) {
  const t = new Float32Array(N * N), o = new Float32Array(N * N)
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let s = 0, c = 0
      for (let k = -r; k <= r; k++) {
        const xx = x + k
        if (xx >= 0 && xx < N) { s += a[y * N + xx]; c++ }
      }
      t[y * N + x] = s / c
    }
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let s = 0, c = 0
      for (let k = -r; k <= r; k++) {
        const yy = y + k
        if (yy >= 0 && yy < N) { s += t[yy * N + x]; c++ }
      }
      o[y * N + x] = s / c
    }
  return o
}
// Tô lại màu hình SVG để tách lớp: thân quân = đỏ, nét tối = đen, nét sáng (chi tiết của quân Đen) = xanh lá.
function maskSVG(svg, color) {
  let s = svg.replace('width="45" height="45"', 'width="45" height="45" viewBox="0 0 45 45"')
  if (color === 'w') s = s.replaceAll('fill="#fff"', 'fill="#f00"')
  else s = s.replace('<svg ', '<svg fill="#f00" ').replaceAll('fill="#000"', 'fill="#f00"').replaceAll('#ececec', '#0f0')
  return s
}
async function raster(svg, N) {
  const img = new Image()
  img.src = 'data:image/svg+xml;base64,' + btoa(svg.replace('width="45" height="45"', `width="${N}" height="${N}"`))
  await img.decode()
  const c = document.createElement('canvas')
  c.width = c.height = N
  const g = c.getContext('2d')
  g.drawImage(img, 0, 0, N, N)
  return { data: g.getImageData(0, 0, N, N).data, url: c.toDataURL('image/png') }
}

window.renderFlat = async function renderFlat(opts) {
  const { svg, color, material, size = 320, exposure = 1, env = {} } = opts
  const N = opts.grid ?? 512
  const masked = maskSVG(svg, color)
  const { data } = await raster(masked, N)
  const unit = N / 45 // pixel trên một đơn vị hình SVG
  const inside = new Uint8Array(N * N)
  const detail = new Float32Array(N * N)
  for (let i = 0; i < N * N; i++) {
    const a = data[i * 4 + 3] / 255
    inside[i] = a > 0.5 ? 1 : 0
    const r = data[i * 4] / 255, g = data[i * 4 + 1] / 255
    detail[i] = color === 'w' ? a * Math.max(0, 1 - r - g) : a * g
  }
  const dist = distanceInside(inside, N)
  // Chỉ khắc các nét bên trong; nét viền ngoài đã là mép tấm.
  if (color === 'w') for (let i = 0; i < N * N; i++) detail[i] *= Math.min(1, Math.max(0, (dist[i] / unit - 1.3) / 0.8))
  const groove = blur(detail, N, Math.max(1, Math.round(unit * 0.35)))
  const bw = (opts.bevel ?? 1.6) * unit
  const H0 = (opts.height ?? 0.022)
  const G = (opts.groove ?? 0.006)
  const D = opts.dome ?? 0.055
  const DL = opts.domeL ?? 7
  const h = new Float32Array(N * N)
  for (let i = 0; i < N * N; i++) {
    if (!inside[i]) continue
    const t = Math.min(1, dist[i] / bw)
    // Mặt quân hơi phồng như cái gối để ánh phản chiếu chạy dần trên mặt (kim loại, thủy tinh mới ra chất).
    const dome = D * Math.sqrt(Math.min(1, dist[i] / (DL * unit)))
    h[i] = H0 * Math.sqrt(1 - (1 - t) * (1 - t)) + dome
  }
  // Kiểu mài giác (pha lê): mặt phồng được cắt thành các mặt tam giác phẳng, mỗi mặt bắt đèn một kiểu nên lấp lánh.
  if (opts.lowpoly) {
    const cs = opts.lowpoly * unit
    const at = (x, y) => {
      const xx = Math.min(N - 1, Math.max(0, Math.round(x))), yy = Math.min(N - 1, Math.max(0, Math.round(y)))
      return h[yy * N + xx]
    }
    const src = h.slice()
    const hc = (cx, cy) => {
      const xx = Math.min(N - 1, Math.max(0, Math.round(cx * cs))), yy = Math.min(N - 1, Math.max(0, Math.round(cy * cs)))
      return src[yy * N + xx]
    }
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const i = y * N + x
        if (!inside[i]) continue
        const gx = x / cs, gy = y / cs
        const cx = Math.floor(gx), cy = Math.floor(gy)
        const u = gx - cx, v = gy - cy
        const a = hc(cx, cy), b = hc(cx + 1, cy), c = hc(cx, cy + 1), d = hc(cx + 1, cy + 1)
        let z
        if ((cx + cy) & 1) z = u + v < 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v)
        else z = u > v ? a + (b - a) * u + (d - b) * v : a + (d - c) * u + (c - a) * v
        h[i] = z
      }
    void at
  }
  for (let i = 0; i < N * N; i++) if (inside[i]) h[i] -= G * groove[i]
  // Lưới tam giác phủ phần trong hình, mỗi đỉnh nhô lên theo độ cao.
  const pos = new Float32Array(N * N * 3)
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = y * N + x
      pos[i * 3] = (x + 0.5) / N - 0.5
      pos[i * 3 + 1] = 0.5 - (y + 0.5) / N
      pos[i * 3 + 2] = h[i]
    }
  const idx = []
  for (let y = 0; y < N - 1; y++)
    for (let x = 0; x < N - 1; x++) {
      const a = y * N + x, b = a + 1, c = a + N, d = c + 1
      if (inside[a] && inside[b] && inside[c]) idx.push(a, c, b)
      if (inside[b] && inside[c] && inside[d]) idx.push(b, c, d)
    }
  let geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geometry.setIndex(idx)
  // Mài giác thì mỗi tam giác giữ pháp tuyến riêng (mặt phẳng sắc cạnh), còn lại làm mượt.
  if (opts.lowpoly) geometry = geometry.toNonIndexed()
  geometry.computeVertexNormals()
  if (material.anisotropy) brushTangents(geometry, 'flat')
  // Lệch toạ độ vân chất liệu để vân không đối xứng qua giữa quân.
  const off = opts.offset ?? [0.13, 0.21, 0.0]
  geometry.translate(off[0], off[1], off[2])

  const scene = new THREE.Scene()
  const envOpts = { ...env, flat: true, ceil: opts.ceil ?? 0.3 }
  const envTex = envMap(JSON.stringify(envOpts), envOpts)
  scene.environment = envTex
  const camDir = new THREE.Vector3(0, 1, 0)
  const spec = { ...material }
  if (spec.glass) spec.swirlFlat = 1
  const mat = spec.glass ? makeGlass(spec, envTex, camDir) : makeMaterial(spec, 'flat')
  const mesh = new THREE.Mesh(geometry, mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(-off[0], 0, off[1])
  scene.add(mesh)
  const sun = new THREE.DirectionalLight(0xfff4e8, opts.sun ?? 0.9)
  sun.position.set(-1.6, 5, -1.2)
  scene.add(sun)

  const cam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 50)
  cam.position.set(0, 10, 0)
  cam.up.set(0, 0, -1)
  cam.lookAt(0, 0, 0)
  cam.updateProjectionMatrix()
  const W = size, H = size
  renderer.setSize(W, H)
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType, samples: 4, colorSpace: THREE.LinearSRGBColorSpace })
  const shots = []
  for (const bg of [0, 1]) {
    renderer.setRenderTarget(rt)
    renderer.setClearColor(new THREE.Color(bg, bg, bg), 1)
    renderer.clear()
    renderer.render(scene, cam)
    const buf = new Float32Array(W * H * 4)
    renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf)
    shots.push(buf)
  }
  renderer.setRenderTarget(null)
  rt.dispose()
  mat.dispose()
  geometry.dispose()
  const [c0, c1] = shots
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(W, H)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = ((H - 1 - y) * W + x) * 4
      const o = (y * W + x) * 4
      const tr = Math.min(1, Math.max(0, c1[i] - c0[i]))
      const tg = Math.min(1, Math.max(0, c1[i + 1] - c0[i + 1]))
      const tb = Math.min(1, Math.max(0, c1[i + 2] - c0[i + 2]))
      const alpha = 1 - (tr + tg + tb) / 3
      if (alpha < 0.002) { img.data[o + 3] = 0; continue }
      const k = exposure / alpha
      const [r, g, b] = toneNeutral(c0[i] * k, c0[i + 1] * k, c0[i + 2] * k)
      img.data[o] = Math.round(enc(r) * 255)
      img.data[o + 1] = Math.round(enc(g) * 255)
      img.data[o + 2] = Math.round(enc(b) * 255)
      img.data[o + 3] = Math.round(Math.min(1, alpha) * 255)
    }
  ctx.putImageData(img, 0, 0)
  // Thêm ảnh lớp nét (cùng cỡ) để ghép nét viền và nét chi tiết ở bước sau.
  const ink = await raster(masked, W)
  return [canvas.toDataURL('image/png'), ink.url]
}

window.ready = true
