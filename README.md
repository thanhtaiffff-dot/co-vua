# Bàn cờ của Tài

Web chơi cờ vua với bạn bè. Dự án làm từng bước nhỏ: bước nào chạy được mới sang bước sau.

## Đang có gì (bước 1: hai người chơi chung một máy)

- Kéo thả hoặc bấm để đi quân, chấm gợi ý các ô đi được.
- Đủ luật cờ: nhập thành, bắt tốt qua đường, phong cấp (tự chọn Hậu, Xe, Tượng, Mã), chiếu, chiếu bí.
- Tự xử hòa: hết nước đi (pat), không đủ quân chiếu bí, lặp thế cờ 3 lần, luật 50 nước.
- Danh sách nước đi kiểu ký hiệu cờ (e4, Nf3, O-O…), quân đã ăn và chênh lệch điểm quân.
- Đi lại, ván mới (bấm hai lần để chắc chắn), lật bàn, tự xoay bàn theo lượt.
- Tải lại trang vẫn giữ ván đang chơi.
- Giao diện sáng/tối theo máy, dùng tốt trên điện thoại.

## Chạy trên máy của bạn

Cần cài [Node.js](https://nodejs.org) bản LTS, từ 24 trở lên (gói bàn cờ cần từ bản 24). Mở Terminal trong thư mục này rồi gõ:

| Lệnh | Làm gì |
| --- | --- |
| `npm install` | Tải các thư viện về (chỉ cần chạy lần đầu) |
| `npm run dev` | Mở web ở chế độ làm việc, sửa code là trang tự cập nhật |
| `npm test` | Chạy các bài kiểm tra luật cờ |
| `npm run lint` | Soát lỗi code thường gặp |
| `npm run build` | Đóng gói web để đưa lên mạng (ra thư mục `dist`) |
| `npm run build:single` | Gộp cả web vào một file HTML trong `dist-single`, bấm đúp là chơi |

## Code nằm ở đâu

| File | Vai trò |
| --- | --- |
| `src/game/rules.ts` | Luật cờ: đi được đâu, ai thắng, hòa kiểu gì, điểm quân |
| `src/game/rules.test.ts` | Bài kiểm tra tự động cho luật cờ |
| `src/components/Board.tsx` | Bàn cờ (bọc thư viện chessground) |
| `src/components/` | Các mảnh giao diện khác: thanh người chơi, chọn quân phong cấp, danh sách nước đi |
| `src/App.tsx` | Ghép mọi thứ lại, giữ trạng thái ván cờ |
| `src/index.css` | Màu sắc, bố cục, chế độ sáng/tối |
| `wrangler.jsonc` | Cài đặt để Cloudflare build và đưa web lên mạng |

## Web lên mạng thế nào

Web chạy trên Cloudflare Workers, gói miễn phí. Mỗi lần một Pull Request được Merge vào nhánh `main`, Cloudflare tự tải code về, chạy `npm run build` rồi đưa bản mới lên. Pull Request chưa Merge thì có link xem thử riêng, web chính không bị đụng tới.

## Lộ trình

1. **Bàn cờ chơi chung một máy** (xong).
2. Chơi online: tạo phòng, gửi link cho bạn, đồng hồ đếm giờ do máy chủ giữ.
3. Tài khoản, điểm Elo, tên miền riêng.
4. Máy phân tích Stockfish, cài như ứng dụng trên điện thoại, bàn cờ 3D.

Theme bàn cờ, bộ quân và âm thanh sẽ thêm xen giữa các bước.

## Giấy phép và ghi công

Code dự án phát hành theo **GPL-3.0-or-later** (xem file `LICENSE`), vì bàn cờ dùng chessground cũng theo GPL. Nghĩa là ai cũng được xem, sửa và dùng lại code, với điều kiện bản họ phát hành cũng phải công khai mã nguồn.

- [chess.js](https://github.com/jhlywa/chess.js): luật cờ, giấy phép BSD-2-Clause.
- [chessground](https://github.com/lichess-org/chessground): bàn cờ của lichess, giấy phép GPL-3.0-or-later.
- Bộ quân cburnett: Colin M.L. Burnett, giấy phép GPLv2+.
- Phông chữ Be Vietnam Pro và JetBrains Mono qua Google Fonts, giấy phép SIL Open Font License.
