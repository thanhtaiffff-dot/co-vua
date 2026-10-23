# Tiếng thu gốc của Kenney

Các file ở đây là tiếng thu thật của [Kenney](https://kenney.nl), giấy phép
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/): ai cũng được dùng, sửa, kể cả để kiếm tiền,
không bắt buộc ghi công (dự án vẫn ghi công cho đàng hoàng).

| File | Bộ tiếng gốc | Dùng cho |
| --- | --- | --- |
| `impactWood_light_000.ogg` … `impactWood_light_004.ogg`, `impactWood_medium_002.ogg` (gõ khối gỗ rỗng) | [Impact Sounds](https://kenney.nl/assets/impact-sounds) | Gỗ |
| `die-throw-1.ogg` … `die-throw-4.ogg` (xúc xắc rơi xuống bàn, nảy vài lần) | [Casino Audio](https://kenney.nl/assets/casino-audio) | Gỗ |
| `impactMetal_medium_000.ogg` … `impactMetal_medium_004.ogg` (gõ kim loại) | [Impact Sounds](https://kenney.nl/assets/impact-sounds) | Thép, Đồng |
| `impactMetal_heavy_000.ogg`, `_002`, `_004` (kim loại nặng), `impactTin_medium_000.ogg` … `_004` (hộp thiếc) | [Impact Sounds](https://kenney.nl/assets/impact-sounds) | Gang |
| `impactGlass_light_001.ogg` … `_003`, `impactGlass_medium_000.ogg`, `_002`, `_004`, `impactGlass_heavy_002.ogg` (gõ thủy tinh) | [Impact Sounds](https://kenney.nl/assets/impact-sounds) | Pha lê, Bi ve, Kính dày |
| `glass_003.wav` (tiếng "tách" thủy tinh) | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | Bi ve |
| `footstep_concrete_000.ogg` … `_004` (bước chân trên nền xi măng) | [Impact Sounds](https://kenney.nl/assets/impact-sounds) | Bàn đá |

`tools/sounds/make-sounds.mjs` cắt, hạ cao độ, lọc và ghép các bản thu này thành tiếng quân cờ cho từng bộ, rồi ghi ra
`src/sounds/<tên bộ>/`. Ví dụ bộ Gỗ cắt riêng từng cú chạm mặt bàn trong các bản thu xúc xắc, đặt chồng lên tiếng gõ
gỗ rỗng (để nguyên cao độ gốc) cho giống quân cờ đặt xuống bàn.
