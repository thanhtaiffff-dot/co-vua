"""Ghép nét viền, nét chi tiết và bóng đổ cho quân 2D: python3 flatcomp.py <tên> [chủ đề,...] → out/<tên>-c/<chủ đề>/"""
import sys, os, glob
import numpy as np
from themes import THEMES
from PIL import Image, ImageFilter
name = sys.argv[1]
only = sys.argv[2].split(',') if len(sys.argv) > 2 else None
INK = {'dark': 0.9, 'light': 0.85, 'shadow': 0.32}

def lin(a): return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
def srgb(a): a = np.clip(a, 0, 1); return np.where(a <= 0.0031308, a * 12.92, 1.055 * a ** (1 / 2.4) - 0.055)

for f in sorted(glob.glob(f'out/{name}/*/*.png')):
    if f.endswith('.ink.png'): continue
    theme = f.split('/')[-2]
    if only and theme not in only: continue
    color = os.path.basename(f)[0]
    M = np.asarray(Image.open(f).convert('RGBA')).astype(np.float64) / 255
    I = np.asarray(Image.open(f[:-4] + '.ink.png').convert('RGBA')).astype(np.float64) / 255
    rgb, a = lin(M[..., :3]), M[..., 3:4]
    ia, ir, ig = I[..., 3:4], I[..., 0:1], I[..., 1:2]
    ink = {**INK, **THEMES.get(theme, {}).get('flatInk', {}).get(color, {})}
    dark = ia * np.clip(1 - ir - ig, 0, 1)
    light = ia * ig
    # Phủ tối cả thân (kiểu thủy tinh đen sẫm) khi chủ đề yêu cầu.
    if ink.get('body'): dark = np.maximum(dark, ia * np.clip(ir - ig, 0, 1) * ink['body'] / INK['dark'])
    inside = a[..., 0] > 0.5
    avg = rgb[inside].mean(0) if inside.any() else np.array([0.5, 0.5, 0.5])
    # Nét tối: gần đen, ngả nhẹ theo màu chất liệu cho hợp tông.
    dcol = avg * 0.12 + 0.012
    kd = np.clip(ink['dark'] * dark, 0, 1)
    # Màu đã nhân alpha để ghép đúng ở viền mờ.
    pm = rgb * a
    pm = pm * (1 - kd) + dcol * kd
    na = a + (1 - a) * kd
    if color == 'b':
        lcol = np.clip(avg * 0.35 + 0.62, 0, 1)
        kl = ink['light'] * light
        pm = pm * (1 - kl) + lcol * kl * na
    out_rgb = np.where(na > 1e-4, pm / np.maximum(na, 1e-4), 0)
    H, W = na.shape[:2]
    # Bóng đổ mềm lệch xuống dưới bên phải (đèn ở góc trên trái).
    sh = Image.fromarray((na[..., 0] * 255).astype(np.uint8))
    sh = sh.transform(sh.size, Image.AFFINE, (1, 0, -W * 0.012, 0, 1, -H * 0.02)).filter(ImageFilter.GaussianBlur(W * 0.014))
    sa = np.asarray(sh).astype(np.float64)[..., None] / 255 * ink['shadow']
    fa = na + sa * (1 - na)
    frgb = np.where(fa > 1e-4, out_rgb * na / np.maximum(fa, 1e-4), 0)
    res = np.concatenate([srgb(frgb), fa], axis=2)
    dst = f'out/{name}-c/{theme}/{os.path.basename(f)}'
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    Image.fromarray((np.clip(res, 0, 1) * 255 + 0.5).astype(np.uint8)).save(dst)
print('done')
