# Rà soát framework và cách triển khai một game mới

Project đã tái sử dụng được engine cho game dạng reel và payline. Một game tương thích với skin Basic có thể đổi lưới, symbol, payline, kiểu quay và ảnh từ JSON rồi build riêng. Tavern là một skin tùy biến có cảnh Spine, HUD và phần trình diễn bonus của riêng nó.

| Thành phần | Có thể dùng lại | Khi nào cần viết thêm |
| --- | --- | --- |
| Lưới và reel | `BoardView` nhận kích thước, symbol factory, mask và timing từ config. Chạy được Normal hoặc Drop. | Game có cơ chế hiển thị khác như cascade hoặc nhiều lưới cần phần trình diễn riêng. |
| Skin Basic | Dựng lưới, nút Spin, Balance, line win và symbol ảnh hoặc chữ. | Menu chọn cược, màn giới thiệu Free Spins, chest, Turbo hay Autoplay theo thiết kế game cần bổ sung vào skin. Basic dùng cược mặc định trong config. |
| Skin Tavern | Tái sử dụng session, renderer và tiện ích chung. | Art, Spine slots, mốc animation, HUD và chest của Tavern được thiết kế cho game này. Game có UI riêng cần skin riêng. |
| API | Có interface `GameTransport` và mock same-origin đủ để phát triển, thử lưới và demo. | Tích hợp backend thật cần adapter cho contract đã chốt. Client hiện gọi `/session` và `/command`, số tiền vẫn dùng quy ước demo hai chữ số thập phân. |
| Wallet và resume | Mock phát kết quả và cho retry cùng request trong một phiên còn sống. | Production cần lưu round/checkpoint bền vững, settlement từ backend và formatter theo currency/exponent. [Contract đang review](game-and-api-flow-krw.md) |

## Tạo và triển khai một game Basic

Từ thư mục gốc của repo, dùng Node theo phiên bản khai báo trong `package.json`.

```sh
npm ci
npm run game:new -- coral-slot "Coral Slot"
npm run game:build -- coral-slot
npm run game:start -- coral-slot
```

- **Config.** Sửa `src/games/coral-slot/game.config.json`. Đổi `reels`, `rows`, `initialBoard[reel][row]`, `symbols`, `lines`, bet và timing. Mỗi line có một chỉ số hàng cho mỗi reel. CLI kiểm tra config lúc build. Lệnh tạo game báo lỗi nếu config đã tồn tại.
- **Art.** Đặt file ở `public/games/coral-slot/`. Ví dụ `symbols[].image` nhận `games/coral-slot/pearl.webp`. Symbol thiếu field ảnh dùng glyph từ config. Các ảnh loader và symbol đã khai báo được kiểm tra lúc build để phát hiện file thiếu. [JSON schema](../src/framework/game-config.schema.json)
- **Địa chỉ.** Bản riêng mở game trực tiếp tại `/`. API demo dùng đường dẫn sinh sẵn `/api/coral-slot`. Các lệnh game dùng tên thư mục, ví dụ `reuse` là thư mục của demo 3×3.
- **Đóng gói.** Frontend nằm ở `.runtime/deploy/coral-slot/dist`. Bản build kèm config đã xác thực mà mock server đọc khi khởi động. Art Tavern chỉ đi kèm nếu chọn skin Tavern. Mỗi game build vào thư mục riêng.
- **Deploy cho demo.** Giữ source repo trên Node host và đặt build command `npm run game:build -- coral-slot`, start command `npm run game:start -- coral-slot`. Server nghe theo biến `PORT` của host và có thể kiểm tra hoạt động tại `/`. Đây là cấu hình cho demo Node đã thử local.

Nếu muốn game xuất hiện cùng Tavern trong bản chạy nhiều game, import config và thêm vào `src/games/catalog.ts`. Luồng deploy riêng đọc trực tiếp config theo tên thư mục. Với UI tùy biến, bước tích hợp tiếp theo là đăng ký renderer riêng trong app entry và chọn renderer đó khi build.

## Thử luồng triển khai

Đã tạo một game 5×3 từ CLI, chỉnh config, thêm ảnh symbol riêng, build và mở trên Chrome. Trình duyệt tải ảnh thành công, dựng đủ 5 cột × 3 hàng và thực hiện một spin qua API riêng. Route API Tavern và animation viewer trả 404 trên host của bản đó. Kích thước thư mục build trong lần thử là khoảng **0,65 MB** cho game Basic và **36 MB** cho catalog đầy đủ. Đây là số byte trên đĩa của bản build thử, nên phụ thuộc vào art và skin của từng game.

Bước ưu tiên khi chuẩn bị production là tách adapter backend và cấu hình tiền tệ khỏi mock. Sau đó mới nên chuẩn hóa thêm phần đăng ký skin tùy biến. Hai việc này quyết định một game mới có thể tích hợp backend và UI riêng mà ít phải sửa engine đến mức nào.
