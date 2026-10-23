# Bàn cờ của Tài

Web chơi cờ vua với bạn bè. Dự án làm từng bước nhỏ: bước nào chạy được mới sang bước sau.

## Đang có gì

### Chơi online với bạn bè qua link

- Bấm **Chơi online** ở đầu trang, chọn thời gian và màu quân (**Trắng**, **Đen** hoặc **Ngẫu nhiên**), bấm **Tạo phòng**. Web đưa một link dạng `…/phong/x7k2m9ab` để gửi cho bạn bè (trên điện thoại có nút gửi thẳng qua Zalo, Messenger…). Trong lúc chờ, bàn cờ đã hiện sẵn và vẫn đổi được bộ tiếng ở đầu trang; chọn Ngẫu nhiên thì bạn bè vào phòng xong bàn cờ mới quay về đúng phía mình.
- Bạn bè mở link, thấy lời mời, bấm **Vào chơi** là ván bắt đầu. Không cần tài khoản: mỗi máy tự có một mã bí mật riêng để máy chủ nhận ra ai là ai.
- Chọn **Ngẫu nhiên** thì máy chủ bốc thăm lúc bạn bè vào phòng, không máy người chơi nào quyết được.
- **Máy chủ làm trọng tài**: giữ bàn cờ và đồng hồ, kiểm tra mọi nước đi, tự xử hết giờ. Thời gian nước đi nằm trên đường truyền được trả lại cho người đi (tối đa 1 giây mỗi nước, giống lichess), nên mạng chậm không làm mất giờ oan.
- **Đi trước** (premove) như chess.com và lichess: lúc đối thủ đang nghĩ, kéo sẵn nước tiếp theo; đối thủ đi xong là nước đó tự đi ngay. Nước đó thành không hợp lệ (quân bị ăn, đường bị chắn) thì tự huỷ. Chạm ô trống để huỷ. Đi trước mà phong cấp thì tự lên Hậu.
- Xin hòa, đầu hàng (bấm hai lần). Chưa ai đi quá một nước thì nút thành **Huỷ ván**, không tính thắng thua.
- **Đấu ván nữa**: hai bên cùng bấm thì vào ván mới, tự đổi màu cho nhau, tỉ số cộng dồn.
- Rớt mạng, khoá màn hình, tải lại trang: tự nối lại, vào đúng ghế cũ. Đối thủ mất kết nối thì hiện chữ "mất kết nối" cạnh tên.
- Người thứ ba mở link khi phòng đã đủ hai người thì chỉ được xem.
- Tên tab báo "Tới lượt bạn" khi chuyển sang app khác.

### Hai người chơi chung một máy

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
| `npm run dev:server` | Chạy máy chủ phòng chơi online trên máy (mở thêm một Terminal, để chạy song song với `npm run dev`) |
| `npm test` | Chạy các bài kiểm tra luật cờ, đồng hồ, âm thanh, phòng chơi online |
| `npm run test:server` | Kiểm tra máy chủ phòng chạy thật (cần `npm run dev:server` đang chạy) |
| `npm run lint` | Soát lỗi code thường gặp |
| `npm run build` | Đóng gói web để đưa lên mạng (ra thư mục `dist`) |
| `npm run build:single` | Gộp cả web vào một file HTML trong `dist-single`, bấm đúp là chơi (phần online thì đánh với "bạn bè ảo") |
| `npm run build:demo` | Như trên nhưng mở sẵn trang chơi online, ra thư mục `dist-demo` (dùng làm bản chơi thử) |
| `npm run sounds` | Tạo lại các file âm thanh trong `src/sounds` (cần cài [ffmpeg](https://ffmpeg.org)) |

## Code nằm ở đâu

| File | Vai trò |
| --- | --- |
| `src/game/rules.ts` | Luật cờ: đi được đâu, ai thắng, hòa kiểu gì, điểm quân |
| `src/game/clock.ts` | Đồng hồ: các mức giờ, trừ giờ, cộng giờ sau mỗi nước, đi lại thì giờ quay về |
| `src/**/*.test.ts` | Bài kiểm tra tự động cho luật cờ, đồng hồ, âm thanh và phòng chơi online |
| `src/online/room.ts` | Luật của phòng chơi online: ai ngồi ghế nào, bốc màu, nhận nước đi, đồng hồ trên máy chủ, hòa, đầu hàng, tái đấu |
| `src/online/protocol.ts` | Các loại thư qua lại giữa máy người chơi và máy chủ |
| `src/online/OnlinePages.tsx`, `OnlineGame.tsx` | Trang tạo phòng, chờ bạn bè, lời mời, và ván cờ online |
| `src/online/connection.ts` | Đường dây WebSocket tới máy chủ: tự nối lại, đo độ trễ mạng |
| `src/online/demo.ts` | Máy chủ giả và bạn bè ảo cho bản chơi thử một file |
| `worker/` | Máy chủ trên Cloudflare: `index.ts` nhận yêu cầu tạo phòng, `room-server.ts` là "trọng tài" của mỗi phòng (Durable Object) |
| `tools/online/check-server.mjs` | Kiểm tra máy chủ chạy thật bằng hai người chơi giả |
| `src/sound.ts` | Âm thanh: nước nào kêu tiếng gì, mở khoá tiếng ở lần chạm đầu, đổi bộ tiếng, tắt/bật tiếng, nghe thử |
| `src/soundCatalog.ts` | Tên, nhóm, lời tả của từng bộ tiếng và các đoạn nghe thử trong bảng chọn |
| `src/sounds/` | Các file âm thanh (MP3), mỗi bộ tiếng một thư mục |
| `tools/sounds/` | Code tạo ra file âm thanh, kèm các tiếng thu gốc của Kenney |
| `src/components/Board.tsx` | Bàn cờ (bọc thư viện chessground) |
| `src/components/` | Các mảnh giao diện khác: thanh người chơi kèm đồng hồ, chọn thời gian, chọn quân phong cấp, danh sách nước đi, bảng chọn bộ tiếng |
| `src/Root.tsx`, `src/router.ts` | Chọn trang theo địa chỉ: `/` chơi một máy, `/online` tạo phòng, `/phong/<mã>` phòng chơi |
| `src/App.tsx` | Trang chơi chung một máy, giữ trạng thái ván cờ |
| `src/index.css` | Màu sắc, bố cục, chế độ sáng/tối |
| `wrangler.jsonc` | Cài đặt để Cloudflare build và đưa web lên mạng, khai báo máy chủ phòng chơi |

## Web lên mạng thế nào

Web chạy trên Cloudflare Workers, gói miễn phí. Gồm hai phần: các file của trang web (Cloudflare gửi thẳng cho trình duyệt), và một máy chủ nhỏ trong thư mục `worker/` chỉ chạy cho các địa chỉ `/api/...` của phần chơi online. Mỗi phòng chơi là một **Durable Object**: một "trọng tài" riêng trên Cloudflare, cả hai người chơi cùng nối tới, giữ bàn cờ và đồng hồ, lưu lại được kể cả khi máy chủ khởi động lại. Gói miễn phí cho dùng Durable Object loại lưu bằng SQLite, đủ cho hội bạn chơi. Phòng bỏ không 30 ngày thì tự xoá.

Mỗi lần một Pull Request được Merge vào nhánh `main`, Cloudflare tự tải code về, chạy `npm run build` rồi đưa bản mới lên, mất khoảng 1–2 phút. Pull Request chưa Merge thì web chính không bị đụng tới. Muốn chơi thử trước khi Merge thì dùng bản một file (`npm run build:single`).

Cloudflare chỉ biết có lần Merge mới khi ứng dụng **Cloudflare Workers and Pages** trên GitHub được quyền đọc kho `co-vua`. Nếu Merge xong vài phút mà web vẫn như cũ:

1. Vào [github.com/settings/installations](https://github.com/settings/installations), bấm **Configure** cạnh Cloudflare Workers and Pages. Mục **Repository access** phải có `co-vua`; thiếu thì thêm vào rồi bấm **Save**.
2. Trên Cloudflare, vào Workers & Pages → `chess` → **Settings** → **Builds**. Nếu có dòng "This project is disconnected from your Git account" nghĩa là bước 1 chưa xong.
3. Sửa xong thì cần một lần Merge mới để Cloudflare dựng lại web.

## Lộ trình

1. **Bàn cờ chơi chung một máy** (xong).
2. **Chơi online**: tạo phòng, gửi link cho bạn, chọn màu, đồng hồ do máy chủ giữ, đi trước, xin hòa, đầu hàng, đấu ván nữa (xong đợt đầu). Còn: xử thắng khi đối thủ bỏ đi quá lâu, xem lại ván, chat nhanh.
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
