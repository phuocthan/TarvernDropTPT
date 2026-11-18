# FE-BE-Proposal

Tavern Drop · Bản đề xuất để Team A review.

## 1. Tổng hợp API

Prefix đề xuất là `/api/v1`. Sau login, FE dùng `sessionId` và `token` do BE cấp theo cơ chế xác thực A định nghĩa. Các endpoint và field là đề xuất để Team A chốt contract.

**Routing update:** POST dùng URL sạch (`/login`, `/spin`, `/buy-feature`) và mang `gameCode` trong JSON payload, ví dụ `{"gameCode":"tavern-drop","isFreespin":0,"betMinor":1000,"chanceMode":"normal"}`. Áp dụng cả các ACK/checkpoint; các ví dụ rút gọn bên dưới tập trung vào field gameplay. Game-info/status cũng dùng POST và mang `gameCode` trong body; không API v1 nào nhận query parameters. Local implementation và resource standard: [framework extension](fw-pixi-architecture.md).

| API | Mục đích | FE gửi | BE trả | FE xử lý |
| --- | --- | --- | --- | --- |
| `POST /login` | Mở phiên cho đúng tài khoản | **Mock:** gửi `userId` đã được server xác thực trước đó để vào đúng tài khoản test, hoặc chỉ gửi `gameCode` để BE chọn tài khoản demo ngẫu nhiên. **Server thật:** gửi `launchToken` do operator cấp | `sessionId`, `token`, và `userId` nếu BE trả kèm. Nên trả `userId` trong mock để dễ kiểm tra resume đúng tài khoản demo đã chọn | Dùng phiên vừa nhận để gọi `gameInfo`. Quyền truy cập tài khoản do BE xác thực. |
| `POST /game-info` · `gameInfo` | Lấy game settings và tiến độ hiện tại của user | `gameCode` và thông tin xác thực của phiên | `settings`, `lastReels`, `wallet`, `canStartPaidRound`, `playToken` khi được cược và `resume` nếu có | BE tìm tiến độ theo tài khoản đã xác thực và game. FE dùng response để vào normal game, resume spin/bonus/chest hoặc hiện Total Win của round tự đóng. |
| `POST /spin` · paid | Đặt cược và lấy kết quả normal spin | `isFreespin: 0`, `betMinor`, `chanceMode: normal / extra / super`. Header `Play-Token` do BE cấp | `chargedMinor`, `reels`, `winLines` gồm thắng đường thường và Scatter nếu có, `totalwin_amt`, bước hiện tại và `freegame` nếu trigger | Hiện base spin rồi vào bonus nếu BE trả `intro`. Retry giữ nguyên token và payload. |
| `POST /buy-feature` | Mua và vào bonus trực tiếp | `betMinor`, `featureMode: tavern / drop`. Header `Play-Token` do BE cấp | `chargedMinor`, `freegame.curStep: intro`, số lượt và bước trình diễn đầu | Tiếp tục bằng `/spin` với `isFreespin: 1`. Retry giữ nguyên token và payload. |
| `POST /spin` · freegame | Xác nhận bước vừa hoàn tất và lấy bước kế | `isFreespin: 1`, `curStep` vừa trình diễn, `stepId` do BE cấp. Có thể thêm `kind: shown_as_result` khi resume bằng kết quả tĩnh | `freegame` đã cập nhật, `stepId` mới và dữ liệu ở bước kế. Với rương chỉ trả multiplier và Total Win của rương đến lượt | BE trả `freespin` thì quay reels. BE trả `show-chest`, `open-chest` hoặc `free-end` thì hiển thị đúng màn. Xác nhận một rương sau khi animation và số mới đều đã hiện. |

### Một endpoint Spin cho lượt cược và bước freegame

**Hai dạng request tại `/spin`.** BE chỉ nhận cược mới khi `isFreespin: 0` đi với `betMinor` và `Play-Token`, trước khi có `stepId`. Request xác nhận bước gửi `curStep` và `stepId` do BE cấp. Request xác nhận không mang cược mới. `isFreespin: 1` dùng suốt feature, kể cả khi `remainSpin` đã bằng 0 và đang ở chest hoặc Total Win.

**Ý nghĩa của `curStep`.** Trong request, đây là bước FE báo đã hiển thị xong. Trong response, đây là bước **BE cấp để FE thực hiện tiếp**. BE kiểm tra bước FE gửi dựa trên `stepId` đã phát và cập nhật tiến độ ở server. FE lấy `curStep` mới từ response thay vì tự tăng bước. Các rương dùng chung giá trị `open-chest`, mỗi rương có `stepId` riêng. Gửi lại cùng `stepId` phải trả lại cùng kết quả đã cấp cho lần xác nhận đó, hoặc báo tiến độ BE đã xác nhận, kể cả khi lần phản hồi trước bị mất.

**Tiền và retry.** KRW dùng `currencyExponent: 0`. Ví dụ `betMinor: 1000` là ₩1,000. BE cấp `Play-Token` khi được cược, dùng chung cho Spin hoặc Buy Feature theo lựa chọn của người chơi. Nếu mất response, FE retry cùng token và body để lấy đúng kết quả. Normal spin không trigger do BE hoàn tất.

## 2. Trạng thái freegame

Response của Buy Feature hoặc Spin trúng freegame báo mode và tiến độ bonus ngay từ đầu. `gameInfo` dùng cùng cấu trúc khi khôi phục. Spin thường trả `freegame: null`. Ví dụ khi vừa trúng Drop với 10 lượt:

```json
{
  "freegame": {
    "featureMode": "drop",
    "totalSpins": 10,
    "curSpin": 0,
    "remainSpin": 10,
    "totalWinMinor": 0,
    "curStep": "intro"
  }
}
```

`totalSpins` là tổng số lượt đã cấp, gồm retrigger. Mình đề xuất dùng tên này thay cho `totalGains` để tách rõ số lượt với tiền. `curSpin` là số lượt đã tính trong trạng thái BE đang trả. `remainSpin = totalSpins - curSpin`. `totalWinMinor` là Total Win đang trình diễn do BE cung cấp, tách với Balance. Các giá trị này phải cùng thuộc một mốc. Ví dụ khi BE trả kết quả lượt 5 để resume, cả số lượt, win và keys đều là trạng thái sau lượt 5. BE vẫn theo dõi riêng bước đã phát và bước FE đã xác nhận.

| `curStep` | FE hiển thị | Khi chuyển bước |
| --- | --- | --- |
| `intro` | Màn giới thiệu Tavern hoặc Drop và số lượt được cấp | Sau Continue và intro hoàn tất, FE xác nhận để lấy free spin đầu. Nếu chưa xem intro thì lần sau mở lại màn này. |
| `freespin` | Reel, win, keys, retrigger và số lượt còn lại | FE xác nhận mỗi bước. Khi resume gặp lượt đã phát, hiện kết quả tĩnh rồi lấy lượt kế. |
| `show-chest` | Total Win trước mở; hiển thị 5 rương nếu có rương đủ điều kiện | Đến mốc mở, FE xác nhận để BE phát kết quả rương đầu tiên. Nếu không có rương đủ điều kiện, BE chuyển thẳng sang `free-end`. |
| `open-chest` | Animation rương đến lượt và Total Win sau khi mở do BE trả | FE xác nhận sau khi cả animation và số tiền đã hiện xong. BE cấp rương kế hoặc `free-end`. |
| `free-end` | Màn Total Win cuối | FE xác nhận sau khi trình diễn hoàn tất. BE xử lý payout và trả quyền cược tiếp. |

Nếu sản phẩm cần nút **Open All**, đề xuất dùng `open-all` làm thao tác chạy nhanh, vẫn đi qua các bước `open-chest` theo thứ tự BE cấp. A cần xác nhận thao tác này được phép và mốc checkpoint tương ứng. Khi round tự đóng sau 30 ngày, `gameInfo` chỉ dẫn mở màn tổng kết cuối theo nhánh riêng.

## 3. Format reels và winLines

### ID symbol

`reels` chứa **ID của symbol** tại từng ô. ID `1` là Wild. ID cao nhất trong danh mục symbol của game là Scatter, kể cả ở lượt không xuất hiện Scatter. `gameInfo.settings.configId` xác định đúng bảng symbol và bảng đường thắng mà BE/FE dùng. Giữ nguyên config đó trong suốt round để kết quả resume vẫn giải mã đúng.

| ID Tavern đề xuất | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Symbol | Wild | Feast | Roast | Potion | Ale | A | K | Q | J | 10 | Scatter |

### Vị trí ô trên reels

`reels` là một mảng có đúng `cols × rows` phần tử, đọc từ trái sang phải rồi xuống hàng. Vị trí ô trên API bắt đầu từ **1**. Với `row` và `col` cũng bắt đầu từ 1, công thức là `pos = (row - 1) * cols + col`. FE lấy ID của symbol ở ô `pos` bằng `reels[pos - 1]`.

| Lưới (cột × hàng) | Độ dài `reels` | Vị trí theo từng hàng |
| --- | ---: | --- |
| 3×3 | 9 | 1–3 · 4–6 · 7–9 |
| 5×3 | 15 | 1–5 · 6–10 · 11–15 |
| 5×5 | 25 | 1–5 · 6–10 · 11–15 · 16–20 · 21–25 |

Ví dụ hàng đầu trên bảng 5×5 có `reels` bắt đầu bằng `[6,1,6,7,8,...]` thì **ô 2** chứa Wild, vì `reels[1] = 1`. Các dấu `...` chỉ rút gọn ví dụ, payload thật có đủ 25 số.

### ID đường thắng và ô cần highlight

Mỗi object trong `winLines` gồm `type`, `lineId`, `winSym` và `win_amt`. `win_amt` là tiền thưởng của entry, theo đơn vị tiền nhỏ nhất.

| `type` | Loại thắng | `lineId` | `winSym` |
| --- | --- | ---: | --- |
| `"N"` | Thắng theo payline | ID payline từ 1, cố định theo config | Vị trí các ô thắng theo thứ tự trên đường, đếm từ 1. |
| `"S"` | Thắng từ Scatter | `-1` | Vị trí các ô Scatter tham gia nhận thưởng, đếm từ 1. |

Một ô có thể xuất hiện trong nhiều entry. Khi không có khoản thắng nào, trả `"winLines":[]`. `totalwin_amt` là tổng thắng của spin, đã gồm mọi khoản thưởng trong `winLines`. Nếu Scatter chỉ kích hoạt bonus mà không trả tiền, FE đọc thông tin trigger từ trạng thái freegame.

Trong config Tavern 5×5, đường ngang trên cùng là line 1 và đường chéo từ góc trên trái là line 14.

| `lineId` | Đường đi đầy đủ | `winSym` nếu ba ô đầu thắng |
| ---: | --- | --- |
| 1 | `[1,2,3,4,5]` | `[1,2,3]` |
| 14 | `[1,7,13,19,25]` | `[1,7,13]` |
| 15 | `[21,17,13,9,5]` | `[21,17,13]` |

```json
{
  "winLines": [
    {"type": "N", "lineId": 1, "winSym": [1, 2, 3], "win_amt": 200},
    {"type": "N", "lineId": 14, "winSym": [1, 7, 13], "win_amt": 300},
    {"type": "S", "lineId": -1, "winSym": [4, 11, 20], "win_amt": 1000}
  ],
  "totalwin_amt": 1500
}
```

Mock dùng `board[reel][row]` và `wins[].line` từ 0. Khi chuyển sang đề xuất API, adapter duyệt row ngoài, reel trong, đổi vị trí thắng bằng `row * cols + reel + 1` và đổi line ID của payline thường bằng `wins[].line + 1`. [Fixture mock hiện có](backend-mock-examples-client-review.md)
