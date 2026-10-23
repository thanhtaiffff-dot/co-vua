// Chất liệu quân cờ: dựa trên MeshPhysicalMaterial của three.js, thêm vân vẽ bằng nhiễu 3D theo toạ độ của quân
// (vân gỗ quanh trục tiện, vân đá cẩm thạch, đốm đá hoa cương, mặt gang sần...), nên vân liền mạch trên mọi mặt.
import * as THREE from 'three'

const NOISE = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
float fbm(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * snoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
  return s;
}
vec3 perturbN(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection) {
  vec3 vSigmaX = normalize(dFdx(surf_pos.xyz));
  vec3 vSigmaY = normalize(dFdy(surf_pos.xyz));
  vec3 vN = surf_norm;
  vec3 R1 = cross(vSigmaY, vN);
  vec3 R2 = cross(vN, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDirection;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}
`

// Mỗi kiểu vân trả về: màu (albedo), độ nhám, độ cao gồ ghề (cho bump).
const PATTERNS = {
  plain: /* glsl */ `
    void pattern(vec3 p, inout vec3 col, inout float rough, out float h) { h = 0.0; }`,
  wood: /* glsl */ `
    uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uColC; uniform float uRings; uniform float uWarp; uniform float uSeed; uniform float uPores;
    void pattern(vec3 p, inout vec3 col, inout float rough, out float h) {
      vec3 q = p + vec3(uSeed, uSeed * 0.37, uSeed * 0.71);
      // Trục vòng gỗ gần song song trục quân nhưng lệch ra ngoài và nghiêng: vân hình chữ V như gỗ tiện thật.
      vec3 a = normalize(vec3(0.08, 1.0, 0.05));
      vec3 o = vec3(0.42, 0.0, -0.27);
      vec3 d = (q - o) - a * dot(q - o, a);
      float r = length(d);
      r += fbm(q * vec3(2.2, 0.6, 2.2)) * uWarp;
      float ring = fract(r * uRings);
      // Gỗ sớm (sáng) chuyển dần sang gỗ muộn (sẫm) rồi cắt gọn: vân sắc một bên.
      float late = smoothstep(0.55, 0.92, ring) * (1.0 - smoothstep(0.95, 1.0, ring));
      float streak = snoise(q * vec3(70.0, 3.0, 70.0)) * 0.5 + 0.5;
      float pores = smoothstep(0.62, 0.9, snoise(q * vec3(160.0, 9.0, 160.0)) * 0.5 + 0.5);
      vec3 c = mix(uColA, uColB, late);
      c = mix(c, uColC, streak * 0.22 + pores * uPores);
      c *= 0.94 + 0.06 * snoise(q * vec3(9.0, 1.5, 9.0));
      col = c;
      h = late * 0.6 + pores * 0.4;
    }`,
  marble: /* glsl */ `
    uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uColC; uniform float uScale; uniform float uVein; uniform float uSeed;
    void pattern(vec3 p, inout vec3 col, inout float rough, out float h) {
      vec3 q = p * uScale + vec3(uSeed, uSeed * 1.3, -uSeed);
      float t = fbm(q * 1.1);
      float v1 = abs(sin((q.x * 1.3 + q.y * 0.7 + t * 3.2) * 3.0));
      float v2 = abs(sin((q.z * 1.1 - q.y * 1.4 + fbm(q * 2.1 + 4.0) * 2.6) * 5.0));
      float vein = pow(1.0 - v1, uVein) * 0.85 + pow(1.0 - v2, uVein * 1.6) * 0.45;
      float cloud = fbm(q * 3.0) * 0.5 + 0.5;
      vec3 c = mix(uColA, uColC, cloud * 0.35);
      c = mix(c, uColB, clamp(vein, 0.0, 1.0));
      col = c;
      h = 0.0;
    }`,
  granite: /* glsl */ `
    uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uColC; uniform float uScale; uniform float uDark; uniform float uLight; uniform float uSeed;
    void pattern(vec3 p, inout vec3 col, inout float rough, out float h) {
      vec3 q = p * uScale + vec3(uSeed);
      float n1 = snoise(q * 1.0) * 0.6 + snoise(q * 2.3) * 0.4;
      float n2 = snoise(q * 1.7 + 11.0) * 0.6 + snoise(q * 3.1 + 5.0) * 0.4;
      float mott = fbm(q * 0.12) * 0.5 + 0.5;
      vec3 c = uColA * (0.9 + 0.2 * mott);
      c = mix(c, uColB, smoothstep(uDark, uDark + 0.12, n1));
      c = mix(c, uColC, smoothstep(uLight, uLight + 0.1, n2));
      col = c;
      rough = rough * (0.85 + 0.3 * smoothstep(uLight, uLight + 0.1, n2));
      h = smoothstep(uDark, uDark + 0.12, n1) * 0.3;
    }`,
  pebble: /* glsl */ `
    uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uColC; uniform float uScale; uniform float uSeed;
    void pattern(vec3 p, inout vec3 col, inout float rough, out float h) {
      vec3 q = p * uScale + vec3(uSeed);
      float m = fbm(q * 0.8) * 0.5 + 0.5;
      float band = smoothstep(0.42, 0.6, fbm(vec3(q.x * 0.3, q.y * 1.6, q.z * 0.3) + 3.0) * 0.5 + 0.5);
      float speck = smoothstep(0.55, 0.85, snoise(q * 9.0) * 0.5 + 0.5);
      vec3 c = mix(uColA, uColB, m * 0.8);
      c = mix(c, uColC, band * 0.45);
      c *= 1.0 - speck * 0.18;
      col = c;
      h = snoise(q * 6.0) * 0.5 + snoise(q * 18.0) * 0.25;
    }`,
  castiron: /* glsl */ `
    uniform vec3 uColA; uniform vec3 uColB; uniform float uScale; uniform float uSeed;
    void pattern(vec3 p, inout vec3 col, inout float rough, out float h) {
      vec3 q = p * uScale + vec3(uSeed);
      float n = snoise(q * 1.0) * 0.5 + snoise(q * 2.7) * 0.3 + snoise(q * 7.1) * 0.2;
      float big = fbm(q * 0.08) * 0.5 + 0.5;
      col = mix(uColA, uColB, clamp(big * 0.7 + n * 0.25, 0.0, 1.0));
      rough = clamp(rough + n * 0.12, 0.05, 1.0);
      h = n;
    }`,
  brushed: /* glsl */ `
    uniform float uMode; uniform float uBaseY; uniform float uLines; uniform float uRoughVar; uniform float uScratch; uniform float uScratchLift; uniform float uFreq; uniform float uSeed;
    void pattern(vec3 p, inout vec3 col, inout float rough, out float h) {
      // Kim loại mài xước: nét mảnh chạy một chiều (vòng quanh thân với quân tiện, nằm ngang với đầu Mã và quân 2D),
      // đậm nhạt thành từng dải, thêm vết xước dăm ngắn theo vài hướng ngẫu nhiên.
      bool ring = uMode < 0.5 || (uMode > 1.5 && p.y < uBaseY);
      vec2 a = ring ? vec2(length(p.xz), p.y) : vec2(p.y, 0.0);
      vec2 al = vec2(p.x, p.z);
      float f = uFreq;
      float n1 = snoise(vec3(a * f + al * 6.0, uSeed));
      float n2 = snoise(vec3(a * f * 0.37 + al * 2.5, uSeed + 7.0));
      float n3 = snoise(vec3(a * f * 0.11 + al, uSeed + 13.0));
      float lines = n1 * 0.45 + n2 * 0.35 + n3 * 0.2;
      float scr = 0.0;
      for (int k = 0; k < 5; k++) {
        float fk = float(k);
        vec3 d = normalize(vec3(sin(fk * 2.39 + uSeed), cos(fk * 1.71 + uSeed * 0.3) * 0.8, sin(fk * 3.07 + 1.3)));
        vec3 e = normalize(cross(d, vec3(0.31, 0.87, 0.38)));
        float n = snoise(vec3(dot(p, d) * 48.0, dot(p, e) * 2.2, fk * 11.0 + uSeed));
        float seg = smoothstep(0.1, 0.55, snoise(vec3(dot(p, e) * 7.0, dot(p, d) * 3.0, fk * 5.0 + uSeed + 2.0)));
        scr = max(scr, smoothstep(0.8, 0.96, n) * seg);
      }
      col *= 1.0 + lines * uLines;
      col = mix(col, col * (1.0 + uScratchLift) + max(uScratchLift, 0.0) * 0.04, scr * uScratch);
      rough = clamp(rough + lines * uRoughVar + scr * uScratch * 0.12, 0.04, 1.0);
      h = lines;
    }`,
  swirl: /* glsl */ `
    uniform vec3 uColA; uniform vec3 uColB; uniform float uScale; uniform float uSeed; uniform float uAmount;
    void pattern(vec3 p, inout vec3 col, inout float rough, out float h) {
      vec3 q = p * uScale + vec3(uSeed);
      float a = atan(q.z, q.x);
      float s = sin(a * 3.0 + q.y * 9.0 + fbm(q * 1.5) * 2.5);
      float ribbon = smoothstep(0.75, 0.95, s);
      col = mix(uColA, uColB, ribbon * uAmount);
      h = 0.0;
    }`,
}

export function makeMaterial(spec, piece) {
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(spec.color ?? '#ffffff'),
    roughness: spec.roughness ?? 0.4,
    metalness: spec.metalness ?? 0,
    clearcoat: spec.clearcoat ?? 0,
    clearcoatRoughness: spec.clearcoatRoughness ?? 0.08,
    specularIntensity: spec.specularIntensity ?? 1,
    transmission: spec.transmission ?? 0,
    ior: spec.ior ?? 1.5,
    thickness: spec.thickness ?? 0,
    attenuationColor: new THREE.Color(spec.attenuationColor ?? '#ffffff'),
    attenuationDistance: spec.attenuationDistance ?? Infinity,
    iridescence: spec.iridescence ?? 0,
    iridescenceIOR: spec.iridescenceIOR ?? 1.3,
    sheen: spec.sheen ?? 0,
    sheenColor: new THREE.Color(spec.sheenColor ?? '#ffffff'),
    sheenRoughness: spec.sheenRoughness ?? 0.5,
    anisotropy: spec.anisotropy ?? 0,
    anisotropyRotation: spec.anisotropyRotation ?? 0,
    envMapIntensity: spec.envMapIntensity ?? 1,
    side: spec.side ?? THREE.FrontSide,
  })
  const pattern = spec.pattern ?? 'plain'
  const uniforms = {}
  for (const [k, v] of Object.entries(spec.uniforms ?? {})) {
    uniforms[k] = { value: Array.isArray(v) ? new THREE.Vector3(...v) : typeof v === 'string' ? new THREE.Color(v) : v }
  }
  if (pattern === 'brushed') {
    // Hướng vân theo loại quân: 0 = quanh thân, 1 = nằm ngang (quân 2D), 2 = Mã (đế quanh thân, đầu nằm ngang).
    const def = { uMode: piece === 'flat' ? 1 : piece === 'knight' ? 2 : 0, uBaseY: spec.baseY ?? 0.15, uLines: 0.15, uRoughVar: 0.1, uScratch: 0.6, uScratchLift: 0.3, uFreq: 160, uSeed: 1 }
    for (const [k, v] of Object.entries(def)) if (!(k in uniforms)) uniforms[k] = { value: v }
  }
  const bump = spec.bump ?? 0
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vObj;\n${NOISE}\n${PATTERNS[pattern]}\nfloat gH;`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        { vec3 c = diffuseColor.rgb; float rr = roughness; pattern(vObj, c, rr, gH); diffuseColor.rgb = c; }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        { vec3 c = vec3(0.0); float rr = roughnessFactor; float hh; pattern(vObj, c, rr, hh); roughnessFactor = rr; }`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        ${bump ? `normal = perturbN(-vViewPosition, normal, vec2(dFdx(gH), dFdy(gH)) * ${bump.toFixed(4)}, faceDirection);` : ''}`,
      )
  }
  m.customProgramCacheKey = () => pattern + ':' + bump + ':' + JSON.stringify(spec.uniforms ?? {})
  return m
}
