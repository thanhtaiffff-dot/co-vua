# Bàn cờ của Tài

Web chơi cờ vua với bạn bè. Dự án làm từng bước nhỏ: bước nào chạy được mới sang bước sau.

## Đang có gì

### Chơi online với bạn bè qua link

- Bấm **Chơi online** ở đầu trang, chọn thời gian và màu quân (**Trắng**, **Đen** hoặc **Ngẫu nhiên**), bấm **Tạo phòng**. Web đưa một link dạng `…/phong/x7k2m9ab` để gửi cho bạn bè (trên điện thoại có nút gửi thẳng qua Zalo, Messenger…). Trong lúc chờ, bàn cờ đã hiện sẵn và vẫn đổi được bộ tiếng ở đầu trang; chọn Ngẫu nhiên thì bạn bè vào phòng xong bàn cờ mới quay về đúng phía mình.
- Bạn bè mở link, thấy lời mời, bấm **Vào chơi** là ván bắt đầu. Không cần tài khoản: mỗi máy tự có một mã bí mật riêng để máy chủ nhận ra ai là ai.
- Chọn **Ngẫu nhiên** thì máy chủ bốc thăm lúc bạn bè vào phòng, không máy người chơi nào quyết được.
- **Máy chủ làm trọng tài**: giữ bàn cờ và đồng hồ, kiểm tra mọi nước đi, tự xử hết giờ. Thời gian nước đi nằm trên đường truyền được trả lại cho người đi, nên mạng chậm không làm mất giờ oan. Phần bù này lấy từ một **quỹ bù giờ** riêng mỗi ván như lichess: mỗi nước nạp thêm 0,3 giây (quỹ đầu 0,9 giây, tối đa 2,1 giây), nên ai khai gian "mạng chậm" cũng chỉ lời được tối đa 0,3 giây mỗi nước.
- **Đi trước nhiều nước** (premove) như chess.com: lúc đối thủ đang nghĩ, kéo sẵn một chuỗi nước (tối đa 12). Bàn cờ hiện quân mình ở chỗ mới, các ô của nước đi trước tô màu, nên kéo tiếp được từ chỗ mới. Đối thủ đi xong là nước đầu chuỗi tự đi ngay; nước nào thành không hợp lệ (quân bị ăn, đường bị chắn) thì huỷ cả phần còn lại. Chạm ô trống, hay bấm **Huỷ hết**, để huỷ. Đi trước mà phong cấp thì tự lên Hậu.
- **Xin đi lại** (bấm nhầm) như chess.com: đối thủ thấy lời xin, bấm **Cho đi lại** hay **Không cho**. Vừa đi xong mà xin thì lùi nước đó; đang tới lượt mình mà xin thì lùi cả nước đối thủ vừa đi. Đồng hồ và thời gian nghĩ quay về như trước các nước bị lùi. Mỗi lượt xin một lần; đối thủ đi tiếp thay vì trả lời là coi như không cho.
- Xin hòa, đầu hàng (bấm hai lần). Chưa ai đi quá một nước thì nút thành **Huỷ ván**, không tính thắng thua.
- **Đấu ván nữa**: hai bên cùng bấm thì vào ván mới, tự đổi màu cho nhau, tỉ số cộng dồn. Bên kia có nút **Từ chối**; bị từ chối thì không mời lại được nữa (khỏi làm phiền), trừ khi bên kia đổi ý mời lại.
- Rớt mạng, khoá màn hình, tải lại trang: tự nối lại, vào đúng ghế cũ. Đối thủ mất kết nối thì hiện chữ "mất kết nối" cạnh tên.
- Người thứ ba mở link khi phòng đã đủ hai người thì chỉ được xem. Mỗi phòng tối đa 8 người xem; người chơi thì lúc nào cũng vào được (mỗi người mở tối đa 4 tab hoặc máy cùng lúc, mở thêm thì tab cũ nhất tạm ngắt).
- **Chống phá ván**: máy chủ bỏ qua thư rác, thư quá dài, thư gửi quá dày (quá 20 thư liền một lúc rồi 5 thư mỗi giây), nên người có link không làm đơ được ván hay làm đồng hồ bị trừ oan.
- Tên tab báo "Tới lượt bạn" khi chuyển sang app khác.

### Trong ván (cả chơi một máy lẫn online)

- Thanh người chơi hiện **tên đã nhập** (chơi một máy: ô "Tên người chơi" trước ván; online: tên lúc tạo phòng, vào phòng), **quân đã ăn được** của đối thủ (quân cùng loại xếp chồng) và số điểm quân hơn (+3…).
- Cột nước đi hiện **thời gian nghĩ** từng nước. Online thì máy chủ đo, đã trừ thời gian đường truyền.
- **Xem lại**: bấm một nước trong cột nước đi (điện thoại: dải nước đi ngay dưới bàn cờ) để xem thế cờ lúc đó; nút mũi tên, phím ← → (Home, End) để lùi, tiến. Bàn cờ có viền màu khi đang xem thế cờ cũ; có nước mới thì tự về ván đang chơi.
- Hết ván thì hiện **thẻ kết quả** (thay ô "1–0" trước đây): ai thắng và vì sao, số nước, ván dài bao lâu, nước nghĩ lâu nhất, nút **Xem lại từng nước** và **Phân tích trên lichess** (mở ván trên lichess.org để máy chấm từng nước).

### Chủ đề quân và bàn cờ

- Bấm nút bảng màu góc trên (**Chủ đề**) để chọn. Bảng chọn nằm ở đáy màn hình (máy tính thì ở góc phải), không che bàn cờ: chạm tới đâu thấy bàn cờ thật đổi tới đó. Trang chơi một máy và phòng chơi online dùng chung lựa chọn, máy nào nhớ lựa chọn của máy đó.
- **Quân và bàn chọn riêng**, phối tùy ý (ví dụ quân 8-bit trên bàn cẩm thạch). Có 14 bộ quân và 14 bàn, chia nhóm theo chất liệu như bộ tiếng:
  - **Cổ điển** (mặc định): quân cburnett trên bàn nâu, như trước giờ.
  - **Gỗ**; **Kim loại**: Thép, Thép xước (thép mài có vân), Đồng, Gang; **Thủy tinh**: Pha lê, Bi ve, Kính dày; **Đá**: Cẩm thạch, Sỏi, Bàn đá; **Vui nhộn**: 8-bit, Bong bóng.
  - Bàn có thêm **Cẩm thạch xám**. Thép xước dùng chung bàn với Thép.
- **2D hoặc 3D**: quân 2D giữ hình quân phẳng quen thuộc, làm bằng chất liệu của chủ đề. Quân 3D có ba dáng: **Bo tròn** (kiểu cổ điển), **Góc cạnh** (thân tám cạnh, mặt phẳng sắc), **Hiện đại** (thân mảnh, vành sắc). Quân 3D cao hơn ô cờ, nhô lên che bớt ô phía sau như bàn thật. Cổ điển và 8-bit chỉ có 2D.
- Quân đã ăn, bảng chọn quân phong cấp, huy hiệu màu quân ở phòng online luôn dùng hình 2D của bộ đang chọn cho dễ nhìn.
- Máy chỉ tải ảnh của bộ đang dùng (một tấm ảnh cho cả bộ quân), đổi bộ thì chờ tải xong ảnh mới mới vẽ lại.

### Hai người chơi chung một máy

- Kéo thả hoặc bấm để đi quân, chấm gợi ý các ô đi được.
- Đủ luật cờ: nhập thành, bắt tốt qua đường, phong cấp (tự chọn Hậu, Xe, Tượng, Mã), chiếu, chiếu bí.
- Tự xử hòa: hết nước đi (pat), không đủ quân chiếu bí, lặp thế cờ 3 lần, luật 50 nước.
- Đồng hồ đếm giờ: chọn từ 1 tới 30 phút mỗi bên, có loại được cộng giờ sau mỗi nước (3 | 2, 15 | 10…), hoặc không tính giờ. Đồng hồ chạy từ lúc Trắng đi nước đầu. Hết giờ là thua, trừ khi đối thủ không còn đủ quân để chiếu bí thì hòa.
- Âm thanh cho mọi việc: đi quân, ăn quân, nhập thành, chiếu, phong cấp, hết ván, hòa, ván mới, đồng hồ sắp hết giờ. Có 16 bộ tiếng, mỗi bộ chỉ có tiếng của đúng một chất liệu hay một loại trống:
  - **Gỗ** (mặc định): quân gỗ trên bàn gỗ, chiếu gõ thêm "cộc cộc", thắng là tiếng vua đổ.
  - **Kim loại**: Thép, Đồng, Gang.
  - **Thủy tinh**: Pha lê, Bi ve, Kính dày.
  - **Đá**: Cẩm thạch, Sỏi, Bàn đá.
  - **Trống**: Trống tay (bongo, conga vỗ tay), Trống hội (trống con, trống cái đánh dùi).
  - **Bass**: Trống bass (trống cái của dàn trống), Bass 808 (bass điện tử nhạc remix). Tiếng rất trầm, đeo tai nghe mới nghe đủ.
  - **Vui nhộn**: 8-bit (máy chơi game đời cũ), Bong bóng (tiếng bọt nước "bóp" tròn, êm).

  Bấm nút nốt nhạc góc trên để mở bảng chọn: chạm một bộ là nghe thử một đoạn ngắn (đi quân, ăn quân, chiếu, thắng) và dùng luôn bộ đó; hàng nút cuối bảng cho nghe riêng từng tiếng. Dòng đầu bảng là **Theo chủ đề** (mặc định): tiếng tự đổi theo bộ quân đang dùng (quân Thép thì tiếng Thép, quân Cổ điển thì tiếng Gỗ). Chọn một bộ tiếng cụ thể là tiếng giữ nguyên bộ đó, đổi quân không đụng tới. Nút loa bên cạnh để tắt/bật. Máy nào nhớ lựa chọn của máy đó. iPhone gạt sang chế độ im lặng thì web cũng im.
- Danh sách nước đi kiểu ký hiệu cờ (e4, Nf3, O-O…), quân đã ăn và chênh lệch điểm quân.
- Đặt tên hai người chơi trước ván (nút giữa để đổi màu cho hai người); để trống thì gọi theo màu quân.
- Đi lại (đồng hồ, thời gian nghĩ cũng lùi theo), ván mới (bấm hai lần để chắc chắn), lật bàn, tự xoay bàn theo lượt.
- Tải lại trang vẫn giữ ván đang chơi.
- Giao diện sáng/tối theo máy, dùng tốt trên điện thoại.

## Chạy trên máy của bạn

Cần cài [Node.js](https://nodejs.org) bản LTS, từ 24 trở lên (gói bàn cờ cần từ bản 24). Mở Terminal trong thư mục này rồi gõ:

| Lệnh | Làm gì |
| --- | --- |
| `npm install` | Tải các thư viện về (chỉ cần chạy lần đầu) |
| `npm run dev` | Mở web ở chế độ làm việc, sửa code là trang tự cập nhật |
| `npm run dev:server` | Chạy máy chủ phòng chơi online trên máy (mở thêm một Terminal, để chạy song song với `npm run dev`) |
| `npm test` | Chạy các bài kiểm tra luật cờ, đồng hồ, âm thanh, chủ đề, phòng chơi online |
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
| `src/game/clock.ts` | Đồng hồ: các mức giờ, trừ giờ, cộng giờ sau mỗi nước, thời gian nghĩ từng nước, đi lại thì giờ quay về |
| `src/useReview.ts` | Xem lại thế cờ cũ: bấm nước trong cột nước đi, nút mũi tên, phím ← → |
| `src/names.ts` | Tên hai người chơi chung một máy |
| `src/**/*.test.ts` | Bài kiểm tra tự động cho luật cờ, đồng hồ, âm thanh, chủ đề và phòng chơi online |
| `src/online/room.ts` | Luật của phòng chơi online: ai ngồi ghế nào, bốc màu, nhận nước đi, đồng hồ trên máy chủ, xin đi lại, hòa, đầu hàng, tái đấu |
| `src/online/premove.ts` | Đi trước nhiều nước: bàn cờ hiện quân ở chỗ mới, đổi nước đi trước thành nước đi thật |
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
| `src/theme.ts` | Chủ đề đang dùng: lưu lựa chọn, viết CSS tô ảnh quân và bàn, cách vẽ quân 3D nhô lên |
| `src/themeCatalog.ts` | Tên, nhóm của từng bộ quân và bàn, bộ tiếng đi kèm, màu chữ toạ độ |
| `src/themes/` | Ảnh quân (mỗi bộ, mỗi kiểu một tấm ảnh gộp) và ảnh bàn cờ (WebP) |
| `tools/themes/` | Xưởng dựng và chụp ảnh quân 3D, quân 2D, bàn cờ (three.js), có hướng dẫn riêng trong đó |
| `src/components/Board.tsx` | Bàn cờ (bọc thư viện chessground) |
| `src/components/` | Các mảnh giao diện khác: thanh người chơi kèm đồng hồ và quân đã ăn, chọn thời gian, tên người chơi, chọn quân phong cấp, cột và dải nước đi, thẻ kết quả, bảng chọn chủ đề, bảng chọn bộ tiếng |
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
2. **Chơi online**: tạo phòng, gửi link cho bạn, chọn màu, đồng hồ do máy chủ giữ, đi trước nhiều nước, xin đi lại, xin hòa, đầu hàng, đấu ván nữa, xem lại nước cũ (xong). Còn: chat giữa hai người chơi, xử thắng khi đối thủ bỏ đi quá lâu.
3. Tài khoản, điểm Elo, tên miền riêng.
4. Máy phân tích Stockfish, cài như ứng dụng trên điện thoại.

Chủ đề quân và bàn cờ (2D, 3D) đã có; thêm chủ đề, bộ âm thanh mới sẽ thêm xen giữa các bước.

## Giấy phép và ghi công

Code dự án phát hành theo **GPL-3.0-or-later** (xem file `LICENSE`), vì bàn cờ dùng chessground cũng theo GPL. Nghĩa là ai cũng được xem, sửa và dùng lại code, với điều kiện bản họ phát hành cũng phải công khai mã nguồn.

- [chess.js](https://github.com/jhlywa/chess.js): luật cờ, giấy phép BSD-2-Clause.
- [chessground](https://github.com/lichess-org/chessground): bàn cờ của lichess, giấy phép GPL-3.0-or-later.
- Bộ quân cburnett: Colin M.L. Burnett, giấy phép GPLv2+. Quân 2D theo chất liệu dựng từ hình bộ này nên cũng theo giấy phép đó.
- Quân 3D và bàn cờ của các chủ đề do code của dự án tự dựng (`tools/themes`, dùng [three.js](https://threejs.org), giấy phép MIT, chỉ chạy lúc dựng ảnh, không nằm trong web).
- Tiếng thu thật: [Kenney](https://kenney.nl), bộ Impact Sounds, Casino Audio và Interface Sounds, giấy phép CC0 (tặng cho mọi người, ai dùng cũng được). Dùng cho bộ Gỗ, các bộ Kim loại, Thủy tinh, và tiếng nền xi măng trong bộ Bàn đá. Tiếng đá gõ đá, các bộ Trống, Bass, 8-bit và Bong bóng do code của dự án tự dựng.
- Phông chữ Be Vietnam Pro và JetBrains Mono qua Google Fonts, giấy phép SIL Open Font License.
