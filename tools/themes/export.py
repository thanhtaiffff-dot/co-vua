"""Xuất ảnh chủ đề cho web: python3 export.py ../../src/themes

Mỗi bộ quân, mỗi kiểu (2D, 3D ba dáng) gộp thành một tấm ảnh 6 cột x 2 hàng (Tốt, Mã, Tượng, Xe, Hậu, Vua;
hàng trên quân trắng, hàng dưới quân đen), giữa các ô chừa khe trong suốt cho khỏi lem sang nhau.
Kèm ảnh nhỏ (con Mã trắng) cho bảng chọn, ảnh bàn cờ và ảnh bàn nhỏ. In ra màu chữ toạ độ của mỗi bàn
(chép vào BOARD_GROUPS trong src/themeCatalog.ts nếu bàn đổi màu).
"""
import os, subprocess, sys
import numpy as np
from PIL import Image

OUT = sys.argv[1]
P = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king']
SETS = ['wood', 'steel', 'steel-brushed', 'bronze', 'cast-iron', 'crystal', 'glass-marbles', 'thick-glass',
        'polished-stone', 'pebbles', 'stone-table', 'bubble']
BOARDS = ['wood', 'steel', 'bronze', 'cast-iron', 'crystal', 'glass-marbles', 'thick-glass', 'polished-stone',
          'polished-stone-gray', 'pebbles', 'stone-table', 'bubble']
# Kiểu quân: thư mục ảnh chụp, cỡ một ô, khe giữa các ô. Cỡ ô phải khớp SHEET_2D, SHEET_3D, SHEET_8BIT trong src/theme.ts.
VARIANTS = {
    '2d': ('out/flat-c', 160, 160, 4),
    '3d-round': ('out/full', 192, 253, 4),
    '3d-faceted': ('out/fullB', 192, 253, 4),
    '3d-modern': ('out/fullC', 192, 253, 4),
}
ICON = 64  # ảnh nhỏ trong bảng chọn: hiện cỡ 32px, vẽ gấp đôi cho màn hình nét


def webp(im, path, q=82, lossless=False):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, 'WEBP', quality=q, method=6, lossless=lossless, exact=False)


def png(im, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, 'PNG', optimize=True)


def sheet(cells, w, h, gap):
    im = Image.new('RGBA', (6 * w + 5 * gap, 2 * h + gap), (0, 0, 0, 0))
    for r, c in enumerate('wb'):
        for i, p in enumerate(P):
            im.paste(cells[c + p], (i * (w + gap), r * (h + gap)))
    return im


def icon(src, size=ICON, resample=Image.LANCZOS):
    """Cắt sát hình quân rồi đặt giữa một ô vuông."""
    a = np.array(src)[..., 3]
    ys, xs = np.where(a > 8)
    box = src.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    scale = (size - 4) / max(box.size)
    box = box.resize((max(1, round(box.width * scale)), max(1, round(box.height * scale))), resample)
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    im.paste(box, ((size - box.width) // 2, size - 2 - box.height))
    return im


def coord_colors(im):
    """Màu chữ toạ độ: trên ô tối viết màu ô sáng, trên ô sáng viết màu ô tối (lấy màu trung bình, bỏ viền ô),
    rồi đẩy dần về trắng/đen tới khi đủ rõ (độ tương phản từ 3,6 trở lên)."""
    a = np.asarray(im.convert('RGB')).astype(float)
    n = a.shape[0] // 8
    light, dark = [], []
    for r in range(8):
        for f in range(8):
            sq = a[r * n + n // 5:(r + 1) * n - n // 5, f * n + n // 5:(f + 1) * n - n // 5].reshape(-1, 3)
            (light if (r + f) % 2 == 0 else dark).append(sq.mean(0))
    light, dark = np.mean(light, 0), np.mean(dark, 0)

    def lum(c):
        c = np.asarray(c, float) / 255
        c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

    def contrast(x, y):
        hi, lo = sorted((lum(x), lum(y)), reverse=True)
        return (hi + 0.05) / (lo + 0.05)

    def ink(text, bg, toward):
        for k in range(101):
            c = text + (toward - text) * k / 100
            if contrast(c, bg) >= 3.6:
                return c
        return c

    hexc = lambda c: '#%02x%02x%02x' % tuple(int(round(x)) for x in np.clip(c, 0, 255))
    return hexc(ink(light, dark, 255)), hexc(ink(dark, light, 0))


sizes = {}
for tid in SETS:
    for var, (src, w, h, gap) in VARIANTS.items():
        cells = {c + p: Image.open(f'{src}/{tid}/{c}-{p}.png').convert('RGBA').resize((w, h), Image.LANCZOS)
                 for c in 'wb' for p in P}
        path = f'{OUT}/pieces/{tid}/{var}.webp'
        webp(sheet(cells, w, h, gap), path, q=84)
        big = Image.open(f'{src}/{tid}/w-knight.png').convert('RGBA')
        webp(icon(big), f'{OUT}/pieces/{tid}/{var}-icon.webp', q=86)
        sizes[path] = os.path.getsize(path)

# 8-bit: vẽ điểm ảnh 32px, phóng to bằng cách nhân điểm ảnh (không làm mờ).
cells = {c + p: Image.open(f'out/pixel8/{c}-{p}.png').convert('RGBA').resize((32, 32), Image.NEAREST) for c in 'wb' for p in P}
png(sheet(cells, 32, 32, 2), f'{OUT}/pieces/8bit/2d.png')
png(cells['wknight'].resize((ICON, ICON), Image.NEAREST), f'{OUT}/pieces/8bit/2d-icon.png')

# Cổ điển: bộ cburnett có sẵn trong chessground, chỉ cần ảnh nhỏ cho bảng chọn (vẽ từ file SVG bằng Chromium).
subprocess.run(['node', 'svg2png.mjs', 'cburnett/w-knight.svg', 'out/classic-knight.png', '256'], check=True)
png(icon(Image.open('out/classic-knight.png').convert('RGBA')), f'{OUT}/pieces/classic/2d-icon.png')

colors = {}
for bid in BOARDS:
    im = Image.open(f'out/boards/{bid}.png').convert('RGB')
    webp(im, f'{OUT}/boards/{bid}.webp', q=80)
    webp(im.resize((ICON, ICON), Image.LANCZOS), f'{OUT}/boards/{bid}-icon.webp', q=86)
    colors[bid] = coord_colors(im)
    sizes[f'{OUT}/boards/{bid}.webp'] = os.path.getsize(f'{OUT}/boards/{bid}.webp')
im = Image.open('out/pixel8/board.png').convert('RGB').resize((256, 256), Image.NEAREST)
png(im, f'{OUT}/boards/8bit.png')
png(im.resize((ICON, ICON), Image.NEAREST), f'{OUT}/boards/8bit-icon.png')
colors['8bit'] = coord_colors(im)
# Bàn Cổ điển: hai màu nâu của chessground.
brown = Image.new('RGB', (8, 8))
for r in range(8):
    for f in range(8):
        brown.putpixel((f, r), (0xf0, 0xd9, 0xb5) if (r + f) % 2 == 0 else (0xb5, 0x88, 0x63))
png(brown.resize((ICON, ICON), Image.NEAREST), f'{OUT}/boards/classic-icon.png')

for bid, (light, dark) in colors.items():
    print(f"{bid}: light: '{light}', dark: '{dark}'")
print('tổng dung lượng ảnh quân và bàn:', sum(sizes.values()) // 1024, 'KB')
