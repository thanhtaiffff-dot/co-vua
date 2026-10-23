// Thủy tinh tự viết: phản chiếu đèn studio ở mặt ngoài (Fresnel), khúc xạ ánh đèn bên trong thân,
// phần còn lại cho nhìn xuyên xuống mặt bàn (thành độ trong suốt của ảnh). Có thêm kiểu thủy tinh đục (opal),
// lõi xoắn màu bên trong (bi ve) và lớp màng cầu vồng (bong bóng xà phòng).
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
  for (int i = 0; i < 4; i++) { s += a * snoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
  return s;
}
`

const vertexShader = /* glsl */ `
varying vec3 vWN;
varying vec3 vWP;
varying vec3 vObj;
void main() {
  vObj = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  vWN = normalize(transpose(inverse(mat3(modelMatrix))) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

const fragmentShader = /* glsl */ `
uniform sampler2D envMap;
uniform vec3 uView;
uniform float uIor;
uniform float uRough;
uniform float uRefrRough;
uniform float uTransmit;
uniform float uDensity;
uniform vec3 uTint;
uniform float uEdge;
uniform float uReflBoost;
uniform float uRefrBoost;
uniform float uMilk;
uniform vec3 uBody;
uniform float uIrid;
uniform float uFilm;
uniform float uSwirl;
uniform vec3 uSwirlA;
uniform vec3 uSwirlB;
uniform float uSwirlScale;
uniform float uSwirlTwist;
uniform float uSwirlRadius;
uniform float uFrost;
uniform float uIridRim;
uniform float uSwirlFlat;
uniform float uFacet;
uniform float uFacetScale;
varying vec3 vWN;
varying vec3 vWP;
varying vec3 vObj;
#include <common>
#include <cube_uv_reflection_fragment>
${NOISE}

vec3 env(vec3 d, float r) { return textureCubeUV(envMap, d, r).rgb; }

// Mặt cắt kiểu pha lê: mỗi ô Voronoi là một mặt phẳng nghiêng ngẫu nhiên.
vec3 facetTilt(vec2 p) {
  vec2 g = floor(p), f = fract(p);
  float best = 9.0;
  vec2 id = vec2(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 o = vec2(float(i), float(j));
    vec2 h = fract(sin(vec2(dot(g + o, vec2(127.1, 311.7)), dot(g + o, vec2(269.5, 183.3)))) * 43758.5453);
    vec2 r = o + h - f;
    float d = dot(r, r);
    if (d < best) { best = d; id = g + o; }
  }
  vec3 hv = fract(sin(vec3(dot(id, vec2(12.9898, 78.233)), dot(id, vec2(39.3468, 11.135)), dot(id, vec2(73.156, 52.235)))) * 43758.5453);
  return hv * 2.0 - 1.0;
}

// Màu màng mỏng (bong bóng xà phòng) theo góc nhìn: dải cầu vồng đổi dần khi nhìn xiên.
vec3 film(float cosT, float thick) {
  float d = thick * sqrt(max(0.0, 1.0 - (1.0 - cosT * cosT) / 1.78));
  vec3 phase = vec3(0.0, 0.33, 0.67);
  return 0.5 + 0.5 * cos(6.2831853 * (d * 2.2 + phase));
}

// Lõi xoắn màu bên trong (kiểu thủy tinh xoắn Venice): hai dải rộng xoắn quanh trục đứng của quân,
// mỗi dải một màu. Trả về độ đậm của dải, màu chọn theo dải nào.
float ribbon(vec3 p, out float side) {
  float rr = length(p.xz);
  float a = atan(p.z, p.x);
  float tw = p.y * uSwirlTwist;
  float c = cos(a - tw);
  side = step(0.0, c);
  float s = abs(c);
  float vane = smoothstep(0.62, 0.93, s);
  float core = 1.0 - smoothstep(uSwirlRadius * 0.6, uSwirlRadius, rr);
  return vane * core * uSwirlScale;
}

void main() {
  vec3 N = normalize(vWN);
  if (!gl_FrontFacing) N = -N;
  // Mặt kính đục (frosted): pháp tuyến rung nhẹ cho ánh khúc xạ nhoè.
  if (uFrost > 0.0) {
    vec3 n3 = vec3(snoise(vObj * 180.0), snoise(vObj * 180.0 + 17.0), snoise(vObj * 180.0 + 41.0));
    N = normalize(N + n3 * uFrost);
  }
  if (uFacet > 0.0) N = normalize(N + uFacet * facetTilt((uSwirlFlat > 0.5 ? vObj.xy : vObj.xz + vObj.y) * uFacetScale));
  vec3 V = normalize(uView);
  float NdV = clamp(dot(N, V), 0.0, 1.0);
  float f0 = pow((uIor - 1.0) / (uIor + 1.0), 2.0);
  float F = f0 + (1.0 - f0) * pow(1.0 - NdV, 5.0);
  vec3 R = reflect(-V, N);
  vec3 refl = env(R, uRough) * uReflBoost;
  if (uIrid > 0.0) refl *= mix(vec3(1.0), film(NdV, uFilm) * 1.6, uIrid);

  // Tia khúc xạ: đi vào thân rồi ló ra phía sau, uốn thêm một lần nữa.
  vec3 T1 = refract(-V, N, 1.0 / uIor);
  vec3 Nb = normalize(reflect(N, V));
  vec3 T2 = refract(T1, -Nb, uIor);
  if (dot(T2, T2) < 0.01) T2 = reflect(T1, -Nb);
  vec3 refr = env(normalize(T2), uRefrRough) * uRefrBoost;

  // Độ dày ước lượng: sát viền dày hơn (ánh sáng đi xiên qua nhiều thủy tinh hơn).
  float thick = uDensity * (0.45 + 1.4 * pow(1.0 - NdV, 1.6));
  vec3 absorb = pow(max(uTint, vec3(1e-4)), vec3(thick));
  // Phần nhìn xuyên xuống bàn: nhiều ở giữa, sát viền thì thấy ánh đèn khúc xạ và phản xạ trong.
  float edge = smoothstep(0.0, 1.0, pow(1.0 - NdV, 1.3) * uEdge);
  float kB = uTransmit * (1.0 - edge) * (1.0 - uMilk);

  vec3 color = F * refl;
  vec3 through = (1.0 - F) * absorb;
  color += through * (1.0 - kB) * refr;
  // Thủy tinh đục: ánh sáng tán xạ trong thân, có màu thân.
  if (uMilk > 0.0) {
    vec3 irr = env(N, 1.0);
    color += (1.0 - F) * uMilk * uBody * (irr * 0.9 + 0.12);
  }
  float alphaT = dot(through * kB, vec3(1.0 / 3.0));
  // Viền cầu vồng của màng xà phòng: rõ nhất ở chỗ nhìn xiên (sát mép quân).
  if (uIridRim > 0.0) color += film(NdV, uFilm) * pow(1.0 - NdV, 2.2) * uIridRim;
  // Lõi xoắn màu bên trong: lấy mẫu vài điểm dọc tia khúc xạ, dải gần mặt che dải phía sau.
  if (uSwirl > 0.0) {
    float acc = 0.0;
    vec3 col = vec3(0.0);
    for (int i = 0; i < 12; i++) {
      vec3 p = vWP + T1 * (0.006 + 0.013 * float(i));
      if (uSwirlFlat > 0.5) p = vec3(p.x, -p.z, p.y);
      float side;
      float r = clamp(ribbon(p, side), 0.0, 1.0);
      float w = r * (1.0 - acc);
      // Dải phía sau tối hơn một chút vì ánh sáng đi qua nhiều thủy tinh hơn.
      col += w * mix(uSwirlA, uSwirlB, side) * (1.0 - 0.04 * float(i));
      acc += w;
    }
    vec3 irr = env(N, 1.0) * 0.75 + 0.18;
    vec3 rib = acc > 0.0 ? col / acc : vec3(0.0);
    float k = acc * uSwirl;
    color = mix(color, rib * irr * (1.0 - F) + F * refl, k);
    alphaT *= 1.0 - k;
  }
  gl_FragColor = vec4(color, 1.0 - alphaT);
}
`

function cubeUVSize(height) {
  const maxMip = Math.log2(height) - 2
  return { texelHeight: 1 / height, texelWidth: 1 / (3 * Math.max(Math.pow(2, maxMip), 7 * 16)), maxMip }
}

export function makeGlass(spec, envTexture, viewDir) {
  const size = cubeUVSize(envTexture.image.height)
  const c = (v, d) => new THREE.Color(v ?? d)
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    defines: {
      ENVMAP_TYPE_CUBE_UV: '',
      CUBEUV_TEXEL_WIDTH: size.texelWidth,
      CUBEUV_TEXEL_HEIGHT: size.texelHeight,
      CUBEUV_MAX_MIP: size.maxMip.toFixed(1),
    },
    uniforms: {
      envMap: { value: envTexture },
      uView: { value: viewDir.clone() },
      uIor: { value: spec.ior ?? 1.5 },
      uRough: { value: spec.roughness ?? 0.03 },
      uRefrRough: { value: spec.refrRoughness ?? 0.08 },
      uTransmit: { value: spec.transmit ?? 0.8 },
      uDensity: { value: spec.density ?? 1 },
      uTint: { value: c(spec.tint, '#ffffff') },
      uEdge: { value: spec.edge ?? 1.2 },
      uReflBoost: { value: spec.reflBoost ?? 1 },
      uRefrBoost: { value: spec.refrBoost ?? 1 },
      uMilk: { value: spec.milk ?? 0 },
      uBody: { value: c(spec.body, '#ffffff') },
      uIrid: { value: spec.irid ?? 0 },
      uFilm: { value: spec.film ?? 1.2 },
      uSwirl: { value: spec.swirl ?? 0 },
      uSwirlA: { value: c(spec.swirlA, '#2f7fd0') },
      uSwirlB: { value: c(spec.swirlB, '#f0b44c') },
      uSwirlScale: { value: spec.swirlScale ?? 1 },
      uSwirlTwist: { value: spec.swirlTwist ?? 12 },
      uSwirlRadius: { value: spec.swirlRadius ?? 0.06 },
      uFrost: { value: spec.frost ?? 0 },
      uIridRim: { value: spec.iridRim ?? 0 },
      uSwirlFlat: { value: spec.swirlFlat ?? 0 },
      uFacet: { value: spec.facet ?? 0 },
      uFacetScale: { value: spec.facetScale ?? 14 },
    },
    transparent: true,
    depthWrite: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  })
}
