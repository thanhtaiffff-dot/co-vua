# Xưởng chụp chủ đề quân và bàn cờ

Code dựng ra mọi ảnh trong `src/themes`: quân 3D (ba dáng), quân 2D theo chất liệu, bàn cờ, bộ 8-bit. Quân 3D và bàn cờ do code này tự dựng bằng [three.js](https://threejs.org) rồi chụp trong Chromium chạy ngầm, nên không lấy hình của ai. Quân 2D lấy hình bộ cburnett (thư mục `cburnett/`, giấy phép GPLv2+) làm thành tấm chất liệu có gờ, mặt hơi phồng.

Web không cần thư mục này để chạy. Chỉ dùng khi muốn sửa hay thêm chủ đề.

## Cài

Cần Node.js, Python 3 có Pillow và NumPy (`pip install pillow numpy`). Trong thư mục này:

```
npm install
npx playwright install chromium
```

Máy đã có sẵn Chromium thì bỏ lệnh thứ hai, chỉ tới nó khi chạy: `CHROMIUM=/đường/dẫn/chromium node drive.mjs ...`.

## Chụp lại

Mỗi lệnh `gen*.py` viết ra một danh sách việc chụp (`jobs-<tên>.json`), rồi `drive.mjs` chụp lần lượt vào `out/`. Chụp hết mất khoảng một giờ.

| Lệnh | Ra gì |
| --- | --- |
| `python3 gen.py full all all 288 && node drive.mjs jobs-full.json` | Quân 3D dáng Bo tròn, `out/full/<chủ đề>/` |
| `python3 gen.py fullB all all 288 b && node drive.mjs jobs-fullB.json` | Quân 3D dáng Góc cạnh, `out/fullB/` |
| `python3 gen.py fullC all all 288 c && node drive.mjs jobs-fullC.json` | Quân 3D dáng Hiện đại, `out/fullC/` |
| `python3 genflat.py flat all all 320 && node drive.mjs jobs-flat.json && python3 flatcomp.py flat` | Quân 2D theo chất liệu, `out/flat-c/` |
| `python3 genboards.py && node drive.mjs jobs-boards.json` | Bàn cờ 1024px, `out/boards/` |
| `python3 pixel8.py out/pixel8` | Bộ 8-bit (vẽ tay từng điểm ảnh) |
| `python3 export.py ../../src/themes` | Gộp ảnh, nén WebP, ghi vào web (mất khoảng 5 phút) |

Có thể chụp riêng vài chủ đề, vài quân: `python3 gen.py thu steel,wood king,knight 288` rồi `node drive.mjs jobs-thu.json`.

## Code nằm ở đâu

| File | Vai trò |
| --- | --- |
| `themes.py` | Chất liệu của từng chủ đề: màu, độ bóng, độ trong, đèn, chỉnh riêng cho 2D (`flat...`) và cho từng dáng (`matB`, `matC`) |
| `materials.js` | Vân chất liệu vẽ bằng shader: vân gỗ, vân đá, vân mài của Thép xước... |
| `glass.js` | Thủy tinh, pha lê, bong bóng (khúc xạ, màu trong lòng) |
| `pieces.js`, `piecesB.js`, `piecesC.js` | Hình dáng quân 3D: Bo tròn, Góc cạnh, Hiện đại |
| `knight.js` | Đường viền đầu Mã, dựng khối bằng trường khoảng cách + marching cubes |
| `board.js` | Bàn cờ, mỗi chủ đề một hàm vẽ |
| `main.js`, `index.html` | Phòng chụp: đèn studio, máy ảnh, chụp trên nền trắng và nền đen để tách nền trong suốt thật |
| `drive.mjs` | Mở phòng chụp trong Chromium, chạy danh sách việc, ghi ảnh |
| `export.py` | Gộp mỗi bộ thành một tấm ảnh 6 x 2 ô, làm ảnh nhỏ cho bảng chọn, in màu chữ toạ độ của từng bàn |

Đổi cỡ ô trong `export.py` thì đổi theo `SHEET_2D`, `SHEET_3D`, `SHEET_8BIT` trong `src/theme.ts` (bài kiểm tra `src/theme.test.ts` báo lỗi nếu hai bên lệch nhau). Thêm chủ đề mới thì thêm vào `themes.py`, `board.js` (nếu có bàn), danh sách trong `export.py`, rồi `src/themeCatalog.ts`.
