// Mặt bàn cờ theo chất liệu, vẽ bằng shader (nhiễu, vân, ô Voronoi) rồi xuất ảnh vuông.
// Toạ độ p chạy 0..8 theo ô cờ, (0,0) là góc trên trái (ô a8, ô sáng).

const HEADER = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uSeed;
out vec4 outColor;

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
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
vec3 srgb(vec3 c) { return c; }
// Gờ vát quanh mỗi ô: trả về (độ cao 0..1, hướng sáng -1..1) để tô sáng cạnh trên trái, tối cạnh dưới phải.
vec2 bevel(vec2 lp, float w) {
  vec2 d = min(lp, 1.0 - lp);
  float e = min(d.x, d.y);
  float h = smoothstep(0.0, w, e);
  float lit = 0.0;
  if (e < w) {
    if (d.x < d.y) lit = lp.x < 0.5 ? 1.0 : -1.0;
    else lit = lp.y < 0.5 ? 1.0 : -1.0;
  }
  return vec2(h, lit * (1.0 - h));
}
`

const THEMES = {
  wood: /* glsl */ `
  vec3 board(vec2 p, vec2 sq, vec2 lp, bool dark, float s) {
    // Ô sáng gỗ thích (maple) thớ mịn, ô tối gỗ óc chó (walnut) thớ thẳng sẫm; thớ ô sáng chạy ngang, ô tối chạy dọc.
    vec2 q = dark ? vec2(lp.y, lp.x) : lp;
    vec2 off = hash22(sq + s) * 40.0;
    float freq = dark ? 17.0 : 24.0;
    float g = q.y * freq + off.y;
    g += fbm(vec3(q.x * 0.5 + off.x, q.y * 2.0, s)) * 1.6;
    g += snoise(vec3(q.x * 2.0 + off.x, q.y * 6.0, s + 4.0)) * 0.25;
    float ring = fract(g);
    float late = smoothstep(0.5, 0.85, ring) * (1.0 - smoothstep(0.88, 1.0, ring));
    float streak = snoise(vec3(q.x * 1.2 + off.x, q.y * 40.0, s + 1.0)) * 0.5 + 0.5;
    float pores = smoothstep(0.7, 0.95, snoise(vec3(q.x * 10.0 + off.x, q.y * 180.0, s + 9.0)) * 0.5 + 0.5);
    float tone = fbm(vec3(q * vec2(0.8, 0.3) + off, s + 2.0)) * 0.5 + 0.5;
    vec3 a = dark ? vec3(0.4, 0.25, 0.15) : vec3(0.9, 0.78, 0.6);
    vec3 b = dark ? vec3(0.27, 0.16, 0.09) : vec3(0.8, 0.65, 0.45);
    vec3 c = mix(a, b, late * (dark ? 0.75 : 0.5));
    c = mix(c, b * 0.9, streak * (dark ? 0.25 : 0.12) + pores * (dark ? 0.2 : 0.06));
    c *= 0.94 + 0.1 * tone;
    c *= 0.96 + 0.08 * hash12(sq + 11.0);
    vec2 e = min(lp, 1.0 - lp);
    float seam = 1.0 - smoothstep(0.0, 0.01, min(e.x, e.y));
    c *= 1.0 - seam * 0.3;
    return c;
  }`,
  steel: /* glsl */ `
  // Đinh tán vòm tròn, đèn từ góc trên trái; trả về (độ che 0..1, màu đinh).
  vec4 rivet(vec2 lp, bool dark) {
    vec2 rc = vec2(lp.x < 0.5 ? 0.082 : 0.918, lp.y < 0.5 ? 0.082 : 0.918);
    vec2 dv = lp - rc;
    float r = 0.024;
    float d = length(dv) / r;
    vec3 L = normalize(vec3(-1.0, -1.0, 1.3));
    float cover = 1.0 - smoothstep(0.9, 1.0, d);
    vec3 n = normalize(vec3(dv / r, sqrt(max(0.0, 1.0 - min(d * d, 1.0)))));
    float diff = max(dot(n, L), 0.0);
    float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 18.0);
    vec3 base = dark ? vec3(0.46, 0.48, 0.51) : vec3(0.7, 0.72, 0.74);
    vec3 col = base * (0.3 + 0.8 * diff) + spec * 0.55;
    col *= 0.75 + 0.25 * smoothstep(1.0, 0.75, d);
    return vec4(col, cover);
  }
  float rivetShadow(vec2 lp) {
    vec2 rc = vec2(lp.x < 0.5 ? 0.082 : 0.918, lp.y < 0.5 ? 0.082 : 0.918);
    float d = length(lp - rc - vec2(0.006, 0.007)) / 0.024;
    return 1.0 - smoothstep(0.8, 1.55, d);
  }
  vec3 board(vec2 p, vec2 sq, vec2 lp, bool dark, float s) {
    // Tấm thép xước (brushed) như bàn Metal: ô sáng vân ngang, ô tối vân dọc, ánh kim chạy chéo cả bàn,
    // vết xước dăm theo nhiều hướng, mỗi góc ô một đinh tán.
    vec2 q = dark ? vec2(lp.y, lp.x) : lp;
    vec2 off = hash22(sq + s) * 50.0;
    float st = snoise(vec3(q.x * 1.5 + off.x, q.y * 260.0, s)) * 0.55 + snoise(vec3(q.x * 6.0 + off.y, q.y * 700.0, s + 2.0)) * 0.3;
    vec3 base = dark ? vec3(0.4, 0.42, 0.45) : vec3(0.84, 0.86, 0.88);
    float sheen = 0.5 + 0.5 * sin((p.x - p.y) * 0.55 + 1.2);
    float plate = hash12(sq + 7.0) - 0.5;
    vec3 c = base * (0.86 + 0.16 * sheen + 0.05 * plate) + st * (dark ? 0.03 : 0.045);
    // Vết xước: nét mảnh dài ngắn khác nhau theo 6 hướng ngẫu nhiên, mọc thành từng đám.
    float scr = 0.0;
    for (int k = 0; k < 6; k++) {
      float fk = float(k);
      float a = hash12(sq * 3.1 + fk * 7.7 + s) * 3.14159;
      vec2 dd = vec2(cos(a), sin(a));
      vec2 rp = vec2(dot(lp, dd), dot(lp, vec2(-dd.y, dd.x)));
      float n = snoise(vec3(rp.x * 2.5, rp.y * 150.0, fk * 13.0 + s + dot(sq, vec2(1.3, 2.9))));
      float line = smoothstep(0.72, 0.93, n);
      float seg = smoothstep(0.15, 0.55, snoise(vec3(rp.x * 5.0, rp.y * 6.0, fk * 5.0 + s + sq.x * 2.0 + sq.y)));
      scr = max(scr, line * seg);
    }
    float clump = smoothstep(-0.3, 0.5, fbm(vec3(p * 1.3, s + 9.0)));
    scr *= 0.5 + 0.5 * clump;
    // Xước li ti dày đặc (vệt mờ) phủ khắp mặt.
    float a2 = hash12(sq + 17.0 + s) * 3.14159;
    vec2 d2 = vec2(cos(a2), sin(a2));
    float micro = smoothstep(0.55, 0.95, snoise(vec3(dot(lp, d2) * 3.0, dot(lp, vec2(-d2.y, d2.x)) * 420.0, s + 31.0)));
    c = mix(c, dark ? c * 1.25 + 0.02 : c * 0.93, micro * 0.35);
    c = mix(c, dark ? c * 1.6 + 0.05 : c * 0.8, scr);
    // Mép tấm: vát sáng trên trái, tối dưới phải, khe nối mảnh.
    vec2 bv = bevel(lp, 0.02);
    c += bv.y * 0.1;
    vec2 e = min(lp, 1.0 - lp);
    c *= 1.0 - (1.0 - smoothstep(0.0, 0.005, min(e.x, e.y))) * 0.45;
    c *= 1.0 - rivetShadow(lp) * 0.35;
    vec4 rv = rivet(lp, dark);
    c = mix(c, rv.rgb, rv.a);
    return c;
  }`,
  bronze: /* glsl */ `
  vec3 board(vec2 p, vec2 sq, vec2 lp, bool dark, float s) {
    vec2 q = dark ? vec2(lp.y, lp.x) : lp;
    vec2 off = hash22(sq + s) * 50.0;
    float st = snoise(vec3(q.x * 1.5 + off.x, q.y * 240.0, s)) * 0.55 + snoise(vec3(q.x * 6.0 + off.y, q.y * 650.0, s + 2.0)) * 0.3;
    vec3 base = dark ? vec3(0.42, 0.25, 0.13) : vec3(0.88, 0.72, 0.43);
    float sheen = 0.5 + 0.5 * sin((p.x - p.y) * 0.55 + 1.2);
    vec3 c = base * (0.88 + 0.16 * sheen) + st * (dark ? 0.03 : 0.04);
    // Lớp gỉ đồng rất nhẹ ở ô tối.
    if (dark) c = mix(c, vec3(0.3, 0.33, 0.25), smoothstep(0.35, 0.8, fbm(vec3(p * 1.4, s))) * 0.25);
    vec2 bv = bevel(lp, 0.02);
    c += bv.y * 0.07;
    return c;
  }`,
  'cast-iron': /* glsl */ `
  // Độ cao mặt gang đúc (hạt cát khuôn) tại điểm x.
  float grain(vec2 x, float s) {
    return snoise(vec3(x * 46.0, s)) * 0.5 + snoise(vec3(x * 105.0, s + 3.0)) * 0.32 + snoise(vec3(x * 14.0, s + 5.0)) * 0.18;
  }
  vec3 board(vec2 p, vec2 sq, vec2 lp, bool dark, float s) {
    // Tấm gang đúc như nắp máy: mặt sần hạt cát bắt sáng lấm tấm, ánh kim mờ; mép mỗi tấm được mài nhẵn, vát cạnh.
    vec3 base = dark ? vec3(0.2, 0.205, 0.215) : vec3(0.6, 0.61, 0.62);
    vec2 e2 = min(lp, 1.0 - lp);
    float e = min(e2.x, e2.y);
    float machined = 1.0 - smoothstep(0.045, 0.06, e);
    // Pháp tuyến của mặt sần (sai phân hữu hạn), đèn chính góc trên trái.
    float h0 = grain(p, s);
    float hx = grain(p + vec2(0.004, 0.0), s) - h0;
    float hy = grain(p + vec2(0.0, 0.004), s) - h0;
    vec3 n = normalize(vec3(-hx * 1.5, -hy * 1.5, 1.0));
    vec3 L = normalize(vec3(-1.0, -1.0, 1.4));
    float diff = max(dot(n, L), 0.0);
    float spec = pow(max(dot(normalize(L + vec3(0.0, 0.0, 1.0)), n), 0.0), 10.0);
    float mott = fbm(vec3(p * 0.7, s + 1.0)) * 0.5 + 0.5;
    vec3 sand = base * (0.7 + 0.4 * diff) * (0.9 + 0.16 * mott) + spec * base * 0.45;
    // Ánh kim mờ chạy chéo cả bàn.
    float sheen = 0.5 + 0.5 * sin((p.x - p.y) * 0.5 + 0.8);
    sand *= 0.9 + 0.16 * sheen;
    // Mép mài: nhẵn, sáng hơn, có vân dao phay chạy dọc mép; vát sáng trên trái, tối dưới phải.
    float mill = snoise(vec3((e2.x < e2.y ? lp.y : lp.x) * 300.0, 0.0, s + 7.0)) * 0.5 + 0.5;
    vec3 mach = base * (dark ? 1.45 : 1.22) * (0.94 + 0.08 * mill) * (0.92 + 0.14 * sheen);
    vec3 c = mix(sand, mach, machined);
    vec2 bv = bevel(lp, 0.045);
    c += bv.y * (dark ? 0.09 : 0.12);
    c *= 1.0 - (1.0 - smoothstep(0.0, 0.006, e)) * 0.5;
    // Bóng mờ ở chân mép mài (chỗ mặt sần thấp hơn).
    c *= 1.0 - smoothstep(0.06, 0.075, e) * (1.0 - smoothstep(0.075, 0.1, e)) * 0.12;
    return c;
  }`,
  crystal: /* glsl */ `
  vec3 board(vec2 p, vec2 sq, vec2 lp, bool dark, float s) {
    // Tấm pha lê: ô sáng mờ trắng như kính phun cát, ô tối trong và hơi xanh; cạnh vát sáng lấp lánh.
    vec3 base = dark ? vec3(0.47, 0.56, 0.66) : vec3(0.88, 0.91, 0.94);
    float frost = snoise(vec3(p * 60.0, s)) * 0.5 + 0.5;
    vec3 c = base * (dark ? 1.0 : 0.97 + 0.04 * frost);
    // Ánh phản chiếu cửa sổ chạy chéo qua cả bàn.
    float band = smoothstep(0.25, 0.0, abs(fract((p.x + p.y) * 0.09 + 0.15) - 0.5) - 0.2);
    c += band * (dark ? 0.08 : 0.04);
    float depth = dark ? (0.5 + 0.5 * fbm(vec3(p * 0.8, s))) : 0.0;
    c *= 1.0 - depth * 0.12;
    vec2 bv = bevel(lp, 0.05);
    c += bv.y * 0.16 + (1.0 - bv.x) * 0.05;
    return c;
  }`,
  'glass-marbles': /* glsl */ `
  vec3 board(vec2 p, vec2 sq, vec2 lp, bool dark, float s) {
    // Ô sáng thủy tinh sữa trắng, ô tối thủy tinh xanh lam dịu; cạnh vát.
    vec3 base = dark ? vec3(0.33, 0.45, 0.6) : vec3(0.91, 0.92, 0.93);
    float cloud = fbm(vec3(p * 1.3, s)) * 0.5 + 0.5;
    vec3 c = base * (0.93 + 0.1 * cloud);
    float band = smoothstep(0.25, 0.0, abs(fract((p.x + p.y) * 0.09 + 0.15) - 0.5) - 0.2);
    c += band * (dark ? 0.06 : 0.03);
    vec2 bv = bevel(lp, 0.05);
    c += bv.y * 0.12 + (1.0 - bv.x) * 0.04;
    return c;
  }`,
  'thick-glass': /* glsl */ `
  vec3 board(vec2 p, vec2 sq, vec2 lp, bool dark, float s) {
    // Gạch kính dày: mép tấm dày nên màu đậm hơn giữa tấm, thấy cả mép dưới của tấm qua lớp kính (đường sáng thứ hai),
    // vệt sáng hội tụ (caustics) gợn bên trong, bọt khí li ti; ô sáng kính mờ xanh ngọc, ô tối xanh chai.
    vec2 e2 = min(lp, 1.0 - lp);
    float e = min(e2.x, e2.y);
    vec3 mid = dark ? vec3(0.12, 0.42, 0.3) : vec3(0.78, 0.9, 0.86);
    vec3 deep = dark ? vec3(0.05, 0.24, 0.16) : vec3(0.5, 0.71, 0.63);
    float rim = 1.0 - smoothstep(0.0, 0.2, e);
    vec3 c = mix(mid, deep, rim * 0.85);
    // Mặt kính mờ (phun cát) ở ô sáng.
    if (!dark) c *= 0.97 + 0.05 * (snoise(vec3(p * 70.0, s)) * 0.5 + 0.5);
    float w1 = snoise(vec3(p * 1.3, s));
    float w2 = snoise(vec3(p * 1.3 + vec2(w1 * 0.8), s + 4.0));
    float caus = pow(1.0 - abs(w2), 7.0);
    c += caus * (dark ? 0.12 : 0.07) * (1.0 - rim * 0.7);
    // Mép dưới của tấm nhìn xuyên qua kính.
    float inner = 1.0 - smoothstep(0.0, 0.01, abs(e - 0.095));
    c += inner * (dark ? 0.1 : 0.07);
    float seeds = smoothstep(0.86, 0.93, snoise(vec3(p * 42.0, s + 5.0)) * 0.5 + 0.5);
    c += seeds * (dark ? 0.08 : 0.05);
    vec2 bv = bevel(lp, 0.04);
    c += bv.y * 0.2;
    float band = smoothstep(0.3, 0.0, abs(fract((p.x + p.y) * 0.07 + 0.2) - 0.5) - 0.18);
    c += band * (dark ? 0.05 : 0.035);
    c = mix(c, deep * 0.55, 1.0 - smoothstep(0.0, 0.006, e));
    return c;
  }`,
  'polished-stone': /* glsl */ `
  vec3 board(vec2 p, vec2 sq, vec2 lp, bool dark, float s) {
    // Cẩm thạch: ô sáng trắng Carrara vân xám mảnh, ô tối xanh lục Verde vân trắng; mỗi ô một phiến đá riêng.
    vec2 off = hash22(sq + s) * 30.0;
    float ang = hash12(sq + 4.0) * 3.14159;
    mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
    vec2 q = rot * (lp - 0.5) * vec2(0.45, 1.5) + off;
    vec2 w = vec2(fbm(vec3(q * 0.9, s)), fbm(vec3(q * 0.9 + 5.2, s + 1.0)));
    vec2 r = q + w * 0.9;
    float n = fbm(vec3(r * 1.1, s + 2.0));
    float vein = 1.0 - smoothstep(0.0, dark ? 0.022 : 0.03, abs(n));
    float halo = 1.0 - smoothstep(0.0, 0.14, abs(n));
    float n2 = fbm(vec3(r * 2.6 + 9.0, s + 3.0));
    float vein2 = 1.0 - smoothstep(0.0, 0.016, abs(n2));
    float cloud = fbm(vec3(q * 0.5, s + 6.0)) * 0.5 + 0.5;
    vec3 base = dark ? vec3(0.09, 0.24, 0.19) : vec3(0.94, 0.93, 0.91);
    vec3 cl = dark ? vec3(0.13, 0.3, 0.24) : vec3(0.85, 0.85, 0.84);
    vec3 vc = dark ? vec3(0.78, 0.84, 0.8) : vec3(0.5, 0.52, 0.55);
    vec3 c = mix(base, cl, cloud * 0.6);
    c = mix(c, mix(c, vc, 0.35), halo * 0.5);
    c = mix(c, vc, vein * 0.85);
    c = mix(c, vc, vein2 * 0.45);
    vec2 e = min(lp, 1.0 - lp);
    float seam = 1.0 - smoothstep(0.0, 0.008, min(e.x, e.y));
    c *= 1.0 - seam * 0.25;
    return c;
  }`,
  'polished-stone-gray': /* glsl */ `
  vec3 board(vec2 p, vec2 sq, vec2 lp, bool dark, float s) {
    // Cẩm thạch xám: ô sáng y như bàn Cẩm thạch, ô tối đá xám (kiểu Bardiglio) có vân sáng.
    vec2 off = hash22(sq + s) * 30.0;
    float ang = hash12(sq + 4.0) * 3.14159;
    mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
    vec2 q = rot * (lp - 0.5) * vec2(0.45, 1.5) + off;
    vec2 w = vec2(fbm(vec3(q * 0.9, s)), fbm(vec3(q * 0.9 + 5.2, s + 1.0)));
    vec2 r = q + w * 0.9;
    float n = fbm(vec3(r * 1.1, s + 2.0));
    float vein = 1.0 - smoothstep(0.0, dark ? 0.022 : 0.03, abs(n));
    float halo = 1.0 - smoothstep(0.0, 0.14, abs(n));
    float n2 = fbm(vec3(r * 2.6 + 9.0, s + 3.0));
    float vein2 = 1.0 - smoothstep(0.0, 0.016, abs(n2));
    float cloud = fbm(vec3(q * 0.5, s + 6.0)) * 0.5 + 0.5;
    vec3 base = dark ? vec3(0.4, 0.41, 0.43) : vec3(0.94, 0.93, 0.91);
    vec3 cl = dark ? vec3(0.47, 0.48, 0.5) : vec3(0.85, 0.85, 0.84);
    vec3 vc = dark ? vec3(0.82, 0.83, 0.84) : vec3(0.5, 0.52, 0.55);
    vec3 c = mix(base, cl, cloud * 0.6);
    c = mix(c, mix(c, vc, 0.35), halo * 0.5);
    c = mix(c, vc, vein * 0.85);
    c = mix(c, vc, vein2 * 0.45);
    vec2 e = min(lp, 1.0 - lp);
    float seam = 1.0 - smoothstep(0.0, 0.008, min(e.x, e.y));
    c *= 1.0 - seam * 0.25;
    return c;
  }`,
  pebbles: /* glsl */ `
  vec3 board(vec2 p, vec2 sq, vec2 lp, bool dark, float s) {
    // Mỗi ô là một tấm khảm sỏi nhỏ, mép ô thẳng; sỏi trong một ô gần cùng tông nên ô sáng tối tách bạch, đỡ rối mắt.
    vec2 g = lp * 9.0 + sq * 13.7;
    vec2 cell = floor(g);
    vec2 f = fract(g);
    float d1 = 9.0, d2 = 9.0;
    vec2 id = vec2(0.0);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j));
      vec2 r = o + 0.2 + 0.6 * hash22(cell + o + s) - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; id = cell + o; } else if (d < d2) d2 = d;
    }
    float edge = sqrt(d2) - sqrt(d1);
    float stone = smoothstep(0.03, 0.12, edge);
    float h = hash12(id + 3.0);
    vec3 col = dark ? mix(vec3(0.3, 0.3, 0.31), vec3(0.4, 0.39, 0.37), h) : mix(vec3(0.86, 0.83, 0.76), vec3(0.94, 0.92, 0.87), h);
    col *= 0.95 + 0.07 * (snoise(vec3(lp * 40.0 + sq * 9.0, h * 10.0)) * 0.5 + 0.5);
    float dome = smoothstep(0.0, 0.45, edge);
    col *= 0.9 + 0.13 * dome;
    vec3 mortar = dark ? vec3(0.24, 0.24, 0.24) : vec3(0.76, 0.74, 0.69);
    vec3 c = mix(mortar, col, stone);
    vec2 e = min(lp, 1.0 - lp);
    c = mix(c, vec3(0.5, 0.49, 0.46), 1.0 - smoothstep(0.0, 0.008, min(e.x, e.y)));
    return c;
  }`,
  'stone-table': /* glsl */ `
  vec3 board(vec2 p, vec2 sq, vec2 lp, bool dark, float s) {
    // Đá hoa cương mài: ô sáng xám nhạt đốm đen, ô tối xám than đốm trắng; mặt bàn liền một phiến, kẻ rãnh ô.
    vec3 q = vec3(p * 22.0, s);
    float n1 = snoise(q) * 0.6 + snoise(q * 2.3) * 0.4;
    float n2 = snoise(q * 1.7 + 11.0) * 0.6 + snoise(q * 3.1 + 5.0) * 0.4;
    float mott = fbm(vec3(p * 0.7, s)) * 0.5 + 0.5;
    vec3 base = dark ? vec3(0.34, 0.35, 0.36) : vec3(0.74, 0.73, 0.7);
    vec3 c = base * (0.92 + 0.12 * mott);
    c = mix(c, dark ? vec3(0.12) : vec3(0.22, 0.21, 0.2), smoothstep(dark ? 0.32 : 0.4, (dark ? 0.32 : 0.4) + 0.12, n1));
    c = mix(c, dark ? vec3(0.72, 0.71, 0.69) : vec3(0.95, 0.94, 0.92), smoothstep(dark ? 0.5 : 0.45, (dark ? 0.5 : 0.45) + 0.1, n2));
    vec2 e = min(lp, 1.0 - lp);
    float groove = 1.0 - smoothstep(0.0, 0.014, min(e.x, e.y));
    c *= 1.0 - groove * 0.3;
    return c;
  }`,
  bubble: /* glsl */ `
  vec3 board(vec2 p, vec2 sq, vec2 lp, bool dark, float s) {
    // Mặt nước: ô sáng xanh nhạt, ô tối xanh biển, ánh sóng (caustics) và vài bọt khí nhỏ.
    vec3 base = dark ? vec3(0.27, 0.55, 0.72) : vec3(0.78, 0.91, 0.95);
    float w1 = snoise(vec3(p * 1.6, s));
    float w2 = snoise(vec3(p * 1.6 + vec2(w1 * 0.6), s + 4.0));
    float caus = pow(1.0 - abs(w2), 6.0);
    vec3 c = base + caus * (dark ? 0.08 : 0.05);
    // Bọt khí.
    vec2 g = p * 3.0;
    vec2 cell = floor(g);
    vec2 r = fract(g) - 0.5 - (hash22(cell + s) - 0.5) * 0.6;
    float rad = 0.05 + 0.09 * hash12(cell + 2.0);
    float keep = step(0.62, hash12(cell + 5.0));
    float d = length(r);
    float ring = smoothstep(rad, rad - 0.015, d) - smoothstep(rad - 0.02, rad - 0.04, d);
    float glint = smoothstep(rad * 0.35, 0.0, length(r + vec2(rad * 0.35, rad * 0.35)));
    c += keep * (ring * 0.25 + glint * 0.35);
    return c;
  }`,
}

const VERT = /* glsl */ `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

export const BOARD_THEMES = Object.keys(THEMES)

window.renderBoard = function renderBoard({ theme, size = 1024, seed = 1.0 }) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false })
  const frag = `${HEADER}
${THEMES[theme]}
void main() {
  // Lấy mẫu 3x3 trong mỗi điểm ảnh cho mịn (khử răng cưa vân nhỏ).
  vec3 acc = vec3(0.0);
  for (int j = 0; j < 3; j++) for (int i = 0; i < 3; i++) {
    vec2 px = gl_FragCoord.xy + (vec2(float(i), float(j)) - 1.0) / 3.0;
    vec2 uv = vec2(px.x, uRes.y - px.y) / uRes;
    vec2 p = uv * 8.0;
    vec2 sq = floor(p);
    vec2 lp = fract(p);
    bool dark = mod(sq.x + sq.y, 2.0) > 0.5;
    acc += board(p, sq, lp, dark, uSeed);
  }
  outColor = vec4(clamp(acc / 9.0, 0.0, 1.0), 1.0);
}`
  const sh = (type, src) => {
    const s = gl.createShader(type)
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s))
    return s
  }
  const prog = gl.createProgram()
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT))
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, frag))
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog))
  gl.useProgram(prog)
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'aPos')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  gl.uniform2f(gl.getUniformLocation(prog, 'uRes'), size, size)
  gl.uniform1f(gl.getUniformLocation(prog, 'uSeed'), seed)
  gl.viewport(0, 0, size, size)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
  return canvas.toDataURL('image/png')
}
