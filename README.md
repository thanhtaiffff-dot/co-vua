# Bàn cờ của Tài

Web chơi cờ vua với bạn bè. Dự án làm từng bước nhỏ: bước nào chạy được mới sang bước sau.

## Đang có gì (bước 1: hai người chơi chung một máy)

- Kéo thả hoặc bấm để đi quân, chấm gợi ý các ô đi được.
- Đủ luật cờ: nhập thành, bắt tốt qua đường, phong cấp (tự chọn Hậu, Xe, Tượng, Mã), chiếu, chiếu bí.
- Tự xử hòa: hết nước đi (pat), không đủ quân chiếu bí, lặp thế cờ 3 lần, luật 50 nước.
- Đồng hồ đếm giờ: chọn từ 1 tới 30 phút mỗi bên, có loại được cộng giờ sau mỗi nước (3 | 2, 15 | 10…), hoặc không tính giờ. Đồng hồ chạy từ lúc Trắng đi nước đầu. Hết giờ là thua, trừ khi đối thủ không còn đủ quân để chiếu bí thì hòa.
- Âm thanh cho mọi việc: đi quân, ăn quân, nhập thành, chiếu, phong cấp, hết ván, hòa, ván mới, đồng hồ sắp hết giờ. Có 12 bộ tiếng, mỗi bộ chỉ có tiếng của đúng một chất liệu:
  - **Gỗ** (mặc định): quân gỗ trên bàn gỗ, chiếu gõ thêm "cộc cộc", thắng là tiếng vua đổ.
  - **Kim loại**: Thép, Đồng, Gang.
  - **Thủy tinh**: Pha lê, Bi ve, Kính dày.
  - **Đá**: Cẩm thạch, Sỏi, Bàn đá.
  - **Vui nhộn**: 8-bit (máy chơi game đời cũ), Bong bóng (tiếng bọt nước "bóp" tròn, êm).

  Bấm nút nốt nhạc góc trên để mở bảng chọn: chạm một bộ là nghe thử một đoạn ngắn (đi quân, ăn quân, chiếu, thắng) và dùng luôn bộ đó; hàng nút cuối bảng cho nghe riêng từng tiếng. Nút loa bên cạnh để tắt/bật. Máy nào nhớ lựa chọn của máy đó. iPhone gạt sang chế độ im lặng thì web cũng im.
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
| `npm run sounds` | Tạo lại các file âm thanh trong `src/sounds` (cần cài [ffmpeg](https://ffmpeg.org)) |

## Code nằm ở đâu

| File | Vai trò |
| --- | --- |
| `src/game/rules.ts` | Luật cờ: đi được đâu, ai thắng, hòa kiểu gì, điểm quân |
| `src/game/clock.ts` | Đồng hồ: các mức giờ, trừ giờ, cộng giờ sau mỗi nước, đi lại thì giờ quay về |
| `src/**/*.test.ts` | Bài kiểm tra tự động cho luật cờ, đồng hồ và âm thanh |
| `src/sound.ts` | Âm thanh: nước nào kêu tiếng gì, mở khoá tiếng ở lần chạm đầu, đổi bộ tiếng, tắt/bật tiếng, nghe thử |
| `src/soundCatalog.ts` | Tên, nhóm, lời tả của từng bộ tiếng và các đoạn nghe thử trong bảng chọn |
| `src/sounds/` | Các file âm thanh (MP3), mỗi bộ tiếng một thư mục |
| `tools/sounds/` | Code tạo ra file âm thanh, kèm các tiếng thu gốc của Kenney |
| `src/components/Board.tsx` | Bàn cờ (bọc thư viện chessground) |
| `src/components/` | Các mảnh giao diện khác: thanh người chơi kèm đồng hồ, chọn thời gian, chọn quân phong cấp, danh sách nước đi, bảng chọn bộ tiếng |
| `src/App.tsx` | Ghép mọi thứ lại, giữ trạng thái ván cờ |
| `src/index.css` | Màu sắc, bố cục, chế độ sáng/tối |
| `wrangler.jsonc` | Cài đặt để Cloudflare build và đưa web lên mạng |

## Web lên mạng thế nào

Web chạy trên Cloudflare Workers, gói miễn phí. Mỗi lần một Pull Request được Merge vào nhánh `main`, Cloudflare tự tải code về, chạy `npm run build` rồi đưa bản mới lên, mất khoảng 1–2 phút. Pull Request chưa Merge thì web chính không bị đụng tới. Muốn chơi thử trước khi Merge thì dùng bản một file (`npm run build:single`).

Cloudflare chỉ biết có lần Merge mới khi ứng dụng **Cloudflare Workers and Pages** trên GitHub được quyền đọc kho `co-vua`. Nếu Merge xong vài phút mà web vẫn như cũ:

1. Vào [github.com/settings/installations](https://github.com/settings/installations), bấm **Configure** cạnh Cloudflare Workers and Pages. Mục **Repository access** phải có `co-vua`; thiếu thì thêm vào rồi bấm **Save**.
2. Trên Cloudflare, vào Workers & Pages → `chess` → **Settings** → **Builds**. Nếu có dòng "This project is disconnected from your Git account" nghĩa là bước 1 chưa xong.
3. Sửa xong thì cần một lần Merge mới để Cloudflare dựng lại web.

## Lộ trình

1. **Bàn cờ chơi chung một máy** (xong).
2. Chơi online: tạo phòng, gửi link cho bạn, đồng hồ đếm giờ do máy chủ giữ.
3. Tài khoản, điểm Elo, tên miền riêng.
4. Máy phân tích Stockfish, cài như ứng dụng trên điện thoại, bàn cờ 3D.

Theme bàn cờ, bộ quân và thêm bộ âm thanh mới sẽ thêm xen giữa các bước.

## Giấy phép và ghi công

Code dự án phát hành theo **GPL-3.0-or-later** (xem file `LICENSE`), vì bàn cờ dùng chessground cũng theo GPL. Nghĩa là ai cũng được xem, sửa và dùng lại code, với điều kiện bản họ phát hành cũng phải công khai mã nguồn.

- [chess.js](https://github.com/jhlywa/chess.js): luật cờ, giấy phép BSD-2-Clause.
- [chessground](https://github.com/lichess-org/chessground): bàn cờ của lichess, giấy phép GPL-3.0-or-later.
- Bộ quân cburnett: Colin M.L. Burnett, giấy phép GPLv2+.
- Tiếng thu thật: [Kenney](https://kenney.nl), bộ Impact Sounds, Casino Audio và Interface Sounds, giấy phép CC0 (tặng cho mọi người, ai dùng cũng được). Dùng cho bộ Gỗ, các bộ Kim loại, Thủy tinh, và tiếng nền xi măng trong bộ Bàn đá. Tiếng đá gõ đá, bộ 8-bit và Bong bóng do code của dự án tự dựng.
- Phông chữ Be Vietnam Pro và JetBrains Mono qua Google Fonts, giấy phép SIL Open Font License.
