# Tavern Drop v13 · Đối chiếu game gốc và bản local

Ngày quan sát 15/11/2026. Nguồn là bản chơi thử tiền ảo của Paperclip Gaming và màn **Menu → Info** trong game. Help hiển thị tiếng Anh và phiên bản `v1.0.0`. Môi trường quan sát là trình duyệt desktop với hai kích thước cửa sổ. [Mở game gốc](https://paperclipgaming.com/ko/games/tavern-drop)

**Phạm vi lần này.** Đọc hết Help và Paytable, chơi base với tốc độ thường và Turbo, kiểm tra bảng giá ở hai mức bet, thử cả hai Chance và chơi hết cả hai bonus mua bằng tiền ảo. Các điều kiện chưa thấy trong Help hoặc chưa tái hiện nằm cuối tài liệu. Giá và bảng trả thưởng bên dưới ghi nhận bản tham chiếu, cần đối chiếu với math/API của client trước khi dùng làm cấu hình giao hàng.

## 1. Luồng vào game và HUD

| Màn              | Game gốc đã thấy                                                                                                                                                                                                 | Bản local và phần cần đối chiếu                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Loading và intro | Logo studio, sau đó logo Tavern Drop trên nền quán trọ, ba thẻ minh họa Drop Bonus, hệ số rương, Max Win. Bấm **Press to Continue**. Khi vào bàn, logo chuyển sang trái, thẻ mờ đi rồi hiện reel, mascot và HUD. | Local mở thẳng vào bố cục HUD, dùng lớp loading nhỏ trong khung reel. Cần làm intro và chuyển cảnh riêng.       |
| Base idle        | Nền quán trọ ấm, logo bên trái, khung reel gỗ có viền chạm và đèn, 5 cột tím ngăn bằng vạch dọc. Mascot lớn ở phải, nằm trước cảnh. Rương xuất hiện ở bonus.                                                     | Local dùng ảnh nền hầm rượu, logo trên giữa và khung CSS. Mascot nhỏ hơn và 5 rương đang xuất hiện cả lúc base. |
| HUD              | Một thanh tối sát mép dưới, nút mở feature bên trái, menu, Balance/Win, Bet có mũi tên, nút Spin tròn lớn, Autoplay và biểu tượng tia sét. Sau một lượt có thưởng, ô Win nằm cạnh Balance.                       | Local chia điều khiển và thắng thành các dải riêng, có chance ở footer và nút mua bonus trong thanh controls.   |
| Menu và Info     | Menu nổi cạnh HUD, có **Info**, **Share** và hai thanh âm lượng riêng cho hiệu ứng và nhạc. Info phủ bàn chơi, nền mờ, nút X cố định và nội dung cuộn.                                                           | Local dùng modal và Sound On/Off. Paytable hiển thị dạng danh sách chữ.                                         |
| Autoplay         | Bảng nổi trên nút, có vô hạn, **10, 25, 50, 100, 250, 500, 1000**. Khi bảng mở, nút chính hiển thị biểu tượng Play.                                                                                              | Local có 10, 25, 50 trong modal. Chưa đối chiếu điều kiện tự dừng của bản gốc.                                  |

## 2. Kiểu reel và cách hiện thắng

- **Bắt đầu lượt.** Khi bấm Spin, các symbol đang có rơi xuống và bị che khi đi qua đáy khung. Các ô trống xuất hiện dần. Nhìn thấy rõ hàng dưới rời bàn trước ở các lần quan sát.
- **Bàn mới.** Các symbol kết quả rơi từ trên vào theo nhịp lệch, lấp vị trí từ dưới lên. Có khung hình một cột đã lấp phía dưới trong khi cột kế bên còn trống. Các cột được ngăn bằng đường dọc xuyên suốt. Cần clip từng frame để chốt khoảng cách thời gian giữa cột/hàng, độ rơi, độ nảy và nhịp tăng tốc khi chờ Bonus.
- **Turbo.** Nút tia sét có viền xanh khi bật. Lượt Turbo quan sát vẫn có lúc bàn trống một phần khi symbol rơi. Chưa đo thời gian theo frame.
- **Lượt thua.** Một lượt base ở bet $1.00 về bàn đầy, không hiện tiền thắng, số dư từ $10,000.00 còn $9,999.00.
- **Lượt thắng.** Trong bonus thấy ô thắng sáng, các symbol ngoài vùng đang trình bày tối hơn, Wild/symbol thắng có hoạt ảnh, số tiền xanh hiển thị ngay trên vùng thắng. Trên HUD, `TOTAL WIN` tăng theo các lượt. Cần ghi thêm clip để xác nhận trình tự chạy từng line khi có nhiều line.
- **Bản local.** Framework có `Drop` và `Normal Spin`. Tavern Drop dùng `Drop` mặc định, có thể đổi trong **Game menu → Reel style**. Nhịp rơi hiện tại là cài đặt ban đầu. Local dùng viền/đường vàng và đếm ở dải dưới bàn, chưa tái hiện cách dim, số thắng tại ô hay animation từng symbol.

## 3. Game Rules và Paytable trong Help

Help xác nhận **5 reel × 5 hàng**, thắng theo line **từ trái sang phải**, từ 3 symbol cùng loại trở lên theo đường hợp lệ. Luật thắng cơ bản áp dụng trong bonus trừ các điều kiện được nêu riêng. Wild thay mọi symbol ngoại trừ Bonus. RTP lý thuyết hiển thị **96.00%** cho mọi mode và Max Win **10,000× bet**.

### Quan sát bổ sung khi chơi Drop Bonus

- Ở bản demo gốc, mua Drop bằng số dư demo. Khi hiện **Resume Active Game**, chọn **Resume** để tiếp tục kết quả đã ghi. Hai Scatter đã dừng được giữ sáng trong khi các reel sau tiếp tục thả. Sau màn mở đầu, board trống trước lượt free spin đầu tiên.
- Lượt gốc quan sát trực tiếp không mở rương và đi thẳng tới **Total Win 15.20** sau khi reelhouse rời bàn. Màn Total Win tự trở lại base. Video khách cung cấp ghi trường hợp có rương, gồm camera zoom, mở rương, chuyển hệ số vào tiền thắng, lần lượt các mức thắng đạt được và Total Win.
- Đồng bộ clip hiện tại theo tên xuất từ Spine. Reelhouse dùng `4_finalwin` khi bắt đầu reveal, các track `*_chest_open`, `*_chest_open_idle`, `*_chest_finalwin`, rồi `2_bonus_exit`. Camera chuyển bằng scale quanh hàng rương. Màn kết quả dùng `total_win_start`, `total_win_idle` và `total_win_end`.
- Menu gốc có **Info**, **Share** và hai thanh SFX/nhạc riêng. Bản demo local hiển thị thẻ thắng gần nhất trong phiên và sao chép nội dung thẻ qua clipboard.

| Symbol                                |    3 |    4 |   5 |
| ------------------------------------- | ---: | ---: | --: |
| 10, J, Q, K, A — từng symbol cùng mức | 0.1× | 0.3× |  1× |
| Cốc bia                               |   1× |   2× |  4× |
| Bình thuốc                            |   2× |   4× |  8× |
| Đùi thịt                              |   3× |   5× | 10× |
| Mâm đồ ăn                             |   5× |  10× | 20× |
| Wild                                  |    — |    — | 20× |
| Bonus                                 |    — |    — |   — |

Các số là hệ số của bet. Wild chỉ có dòng trả thưởng riêng cho 5 Wild. Bonus được mô tả như symbol kích hoạt feature và có thể rơi ở mọi reel. Help không nêu cách chọn tổ hợp khi Wild có nhiều khả năng thay thế cùng một line.

### 15 paylines chép từ sơ đồ Help

Mỗi chuỗi có 5 chữ số, ứng với 5 reel từ trái sang phải. Hàng **1 là trên cùng**, hàng **5 là dưới cùng**. Thứ tự theo cách Help sắp sơ đồ khi đọc từ trái sang phải, trên xuống dưới.

| Số dòng | Chuỗi hàng theo thứ tự                      |
| ------- | ------------------------------------------- |
| 1–5     | `11111`, `22222`, `33333`, `44444`, `55555` |
| 6–10    | `12121`, `23232`, `34343`, `45454`, `21212` |
| 11–15   | `32323`, `43434`, `54545`, `12345`, `54321` |

Local đang dùng một số đường khác và bảng trả thưởng giả lập. Khi ánh xạ dữ liệu, `barrel` là hình đùi thịt, `coin` là bình thuốc và `crown` là mâm đồ ăn trong skin hiện tại.

## 4. Feature Buy và Chance

Nút Paperclip xanh ở trái HUD mở chung bốn thẻ trên nền mờ. Hai Chance có nút **ACTIVATE** màu vàng, hai Bonus có nút **BUY** màu xanh. Balance và Bet nằm bên dưới, có thể đổi bet ngay tại màn này. Cả bốn lựa chọn đều mở thẻ xác nhận lớn với artwork, mô tả, giá và nút Confirm.

| Tùy chọn     | Bet $1.00 | Bet $1.20 | Thông tin đã xác nhận                                                                                   |
| ------------ | --------: | --------: | ------------------------------------------------------------------------------------------------------- |
| Extra Chance |     $3.00 |     $3.60 | Help ghi chi phí 3× bet, tăng cơ hội vào free spins.                                                    |
| Super Chance |     $6.00 |     $7.20 | Help ghi chi phí 6× bet, tăng cơ hội vào free spins. Khi có bonus ở chế độ này, bonus đó là Drop Bonus. |
| Tavern Bonus |   $125.00 |   $150.00 | Giá mua 125× tại hai mức đã thử. Màn xác nhận hiện 10 free spins.                                       |
| Drop Bonus   |   $300.00 |   $360.00 | Giá mua 300× tại hai mức đã thử. Màn xác nhận hiện 10 free spins và hệ số rương được mở tối thiểu 5×.   |

Local đang tách hai màn, dùng giá Chance 2×/5× và Bonus Buy 50×/100×. Khi mua trên bản gốc vẫn có một lượt rơi symbol ở cảnh base trước khi vào intro bonus. Tavern Buy hiện 3 Bonus symbol, Drop Buy hiện 4 Bonus symbol. Trình tự local hiện đi từ kết quả mock trực tiếp sang modal.

**Trạng thái Chance đã thử.** Confirm đưa người chơi về bàn chính, đổi nhãn Bet thành tên chế độ và nút Paperclip thành **Disable**. Số dư chưa bị trừ khi bật. Một lượt Super Chance thua ở bet gốc $1.00 trừ đúng $6.00 và vẫn giữ chế độ cho lượt kế tiếp. Với Extra Chance, tăng bet từ $1.00 lên $1.20 đổi chi phí trên HUD từ $3.00 thành $3.60. Disable tắt chế độ và trả HUD về nhãn Bet ở mức đang chọn.

## 5. Tavern Bonus và Drop Bonus

| Hạng mục     | Gốc                                                                                                                                                                                                                                   | Local hiện tại                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Kích hoạt    | Help ghi 3 Bonus symbol vào Tavern, 4 vào Drop. Màn intro của cả hai hiện **10 Free Spins**.                                                                                                                                          | Tavern 8, Drop 10. Cần chốt case chính xác 5 Bonus symbol với client.                      |
| Retrigger    | Help ghi 3 Bonus symbol trong feature cộng **5 free spins**. Drop dùng luật của Tavern và thêm mức hệ số tối thiểu.                                                                                                                   | Mock cộng 3, có giới hạn 40.                                                               |
| Intro và nền | Tên bonus lớn, hiệu ứng sáng vàng, bảng chìa khóa ở Tavern, cụm rương 100× ở Drop. Bấm Continue rồi chuyển từ quán trọ sang hầm màu xanh.                                                                                             | Modal chữ ngắn, đổi màu overlay trên cùng nền.                                             |
| Nhịp chơi    | Free spins chạy tự động sau intro. HUD giữ Balance và Bet, hiện `TOTAL WIN`, bộ đếm `FREE SPINS`, nút skip và tia sét.                                                                                                                | Free spins tự chạy sau Continue, kể cả lượt retrigger. Nút Skip rút ngắn phần trình bày lượt hiện tại.                                            |
| Tiến độ      | Năm rương nằm sát dưới 5 reel. Có chìa khóa nhạt ở các ô, các ô đã thắng có nền/viền vàng và chìa sáng. Dấu tiến độ thấy được cả lúc symbol đang rơi, rồi symbol mới che lên trên. Đủ 5 vị trí khác nhau trên reel thì rương đó sáng. | Dùng các chấm dưới rương, có hiệu ứng hạt, chưa có lớp chìa khóa trên 25 ô theo reel/hàng. |
| Hệ số        | Help liệt kê **2, 3, 4, 5, 10, 25, 50, 100×**. Rương Drop đã mở có tối thiểu 5×. Nhiều rương nhân dồn.                                                                                                                                | Tavern Bonus dùng 2, 3, 5×. Drop Bonus dùng 5, 10, 25, 50, 100×. Đây là các mức của mock.                          |
| Kết thúc     | Hết free spins, scene làm mờ, hiện bảng tổng trước hệ số và 5 rương. Rương đã mở lộ hệ số, rồi màn **Total Win** với mascot và nút Continue.                                                                                          | Modal hiển thị số và các thẻ hệ số, thiếu nhịp mở rương riêng và màn Total Win bằng art.   |

**Mẫu đã hoàn tất — Tavern Bonus.** Bet $1.00. Mua $125.00, số dư giảm từ $9,999.00 xuống $9,874.00. Tổng free spins trước hệ số $10.70. Rương reel 2 mở **×2**. Màn Total Win ra **$21.40**. Sau Continue, trở về nền base, ô Win hiện $21.40 và Balance $9,895.40.

**Mẫu đã hoàn tất — Drop Bonus.** Bet $1.00. Sau phí mua $300.00, số dư hiển thị $9,595.40. Lượt kích hoạt có thắng $1.40 và bốn Bonus symbol. Màn Total Win trong feature hiện **$90.00**. Sau Continue, ô Win ngoài base hiện **$91.40**, bằng $1.40 + $90.00, và số dư là $9,686.80. Mẫu này xác nhận cách tách số tiền trên hai màn. Các hệ số từng rương ở lượt này chưa được ghi lại.

## 6. Việc ưu tiên để bản local gần game gốc

1. Chốt sơ đồ line và paytable với client/math. Dùng fixture để kiểm thử năm line ngang, hai đường chéo, các line zíc-zắc, Wild và một lượt có nhiều line.
2. Dựng lại scene base và bonus theo khung art gốc, đặt lại logo, mascot và HUD. Base giấu rương. Bonus thêm chìa khóa trong từng ô và HUD free spins.
3. Giữ hai kiểu reel trong framework. Quay clip game gốc ở tốc độ thường và Turbo để đo nhịp rơi, dừng, chờ scatter và cắt animation khi skip trước khi tinh chỉnh bản Drop.
4. Dùng một bảng bốn lựa chọn cho Chance và Buy. Làm giới thiệu bonus, free spins tự chạy, rương sáng theo tiến độ, màn reveal rồi đến Total Win. Client lấy kết quả và số tiền từ API.
5. Bổ sung màn Info cuộn, âm lượng FX/music riêng và kiểm tra bố cục dọc/ngang trên thiết bị thật.

## 7. Mục để bổ sung sau

| Cần bổ sung                                                                                 | Ghi chú / bằng chứng                                                                              |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Clip rơi từng frame, khác biệt Normal/Turbo, cách skip ở base và bonus                      |                                                                                                   |
| Mua bonus khi đang bật Extra/Super Chance, và chế độ có giữ sau refresh hay không           | Nút mở bảng chuyển thành Disable khi Chance đang bật.                                             |
| Điều kiện nhập bonus tự nhiên trong Super Chance, case 5 Bonus và retrigger trong từng mode |                                                                                                   |
| Ngưỡng Big/Mega/Epic/Max Win, thời điểm áp cap và xử lý trigger-spin win                    |                                                                                                   |
| Thứ tự mở nhiều rương, hiển thị tích nhiều hệ số và case không mở rương                     |                                                                                                   |
| Mất mạng và resume ở các thời điểm khác nhau                                                | Help hướng dẫn tải lại để hoàn tất lượt chưa xong. Chưa kiểm tra một lần mất mạng có kiểm soát.   |
| iOS Safari, Android Chrome, portrait/landscape và âm thanh trên thiết bị thật               |                                                                                                   |
| Tài liệu math và event contract từ client                                                   | Cần xác nhận phân bố multiplier, tần suất bonus, giới hạn retrigger và dữ liệu để replay/recover. |

## 8. Quan sát thêm về hiệu ứng · 15/11/2026

Lượt kiểm tra này gồm một spin base ($1.60 thắng), một Drop Bonus mua bằng tiền demo (Total Win $44.50, HUD sau Continue $44.80 gồm $0.30 từ lượt kích hoạt) và một Tavern Bonus mua bằng tiền demo (Total Win $8.90). Đây là các mẫu bổ sung cho mục 5.

| Pha                          | Quan sát trên game gốc                                                                                                                                                                                                                                               | Asset đối chiếu và triển khai local                                                                                                                                                                                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spin và Drop                 | Symbol cũ rời khung theo nhịp lệch, có khoảng trống nhìn xuyên tới nền tím. Symbol mới rơi xuống từng vị trí. Scatter đã dừng vẫn sáng trong lúc cột cuối còn trống ở mẫu Drop Buy.                                                                                  | 4 skeleton symbol có clip hậu tố `_spin`, `_static`, `_win`. `h1`, `bonus` và `wild` có clip `_land` riêng. Local dùng Spine lúc rời bàn ở Drop, clip land khi chạm ô nếu có, nảy nhẹ với các symbol còn lại. Normal Spin dùng biến dạng nhẹ trên dải symbol đang cuộn. |
| Scatter và Wild              | Scatter sáng vàng trên bàn. Khi kích hoạt bonus, chân dung nháy mắt và phóng ra khỏi khung, các symbol khác tối xuống. Wild có điểm sáng ở tư thế chờ, và thay đổi sang hình W vàng khi tham gia một line thắng đã thấy trong lượt kiểm tra trước.                   | `bonus_land`, `bonus_win`, `wild_land`, `wild_win`. Local gọi scatter win khi có entry hoặc retrigger, và gọi wild win khi Wild nằm trong line do demo server trả về. Nhịp dim và anticipation của cột cuối cần so frame riêng.                                         |
| Base → free game             | Bấm Continue ở màn bonus. Nền quán trọ và hầm chồng lên nhau qua ánh vàng, khung reel cũ và HUD lùi đi. Sau đó có một nhịp chỉ thấy khung tím trống trên nền hầm. Key hiện theo cột từ trái sang phải, trước khi bàn được lấp lại. Mascot vẫn ở bên phải xuyên suốt. | `td_backgrounds.skel` có `0_base_enter`, `0_bonus_enter`, `0_base_idle`, `0_bonus_idle`. `td_reelhouse.skel` có `2_base_exit`, `2_bonus_enter`, `2_bonus_exit`. Local dùng atlas gốc với crossfade, ánh vàng, khung vào lại và key xuất hiện lệch nhịp bằng CSS.        |
| Key và rương trong free game | Key chưa thu có màu trầm. Khi ô được tính thắng, ô và key phát sáng. Key được giữ qua các lượt, thấy rõ khi bàn đang trống. Rương đủ key sáng lên ngay dưới reel tương ứng, vẫn ở trạng thái đóng cho tới cuối vòng.                                                 | `td_reelhouse.skel` có 25 clip `activate` theo reel/hàng và clip `chest_activate` riêng cho 5 rương. Local cập nhật key/rương từ trạng thái server, thêm nhịp vào, xung sáng khi thu key và khi mở khóa.                                                                |
| Chest Win / Reveal           | Hết bonus, nền và board mờ đi, bảng tiền và hàng rương riêng xuất hiện. Đã thấy rương thứ hai mở nắp, có vàng và sáng viền trước khi qua màn Total Win. Ở một vòng trước rương thứ hai đã hiện ×2. Không đọc được hệ số của vòng Drop mới từ khung hình này.         | `td_reelhouse.skel` có `chest_open`, `chest_open_idle`, `chest_finalwin` theo reel. Local mở nắp và hiện các hệ số do server trả theo nhịp ngắn, sau đó hiện số Total Win. Chưa đối chiếu chính xác thứ tự ở trường hợp có nhiều rương mở đồng thời.                    |

## 9. Đối chiếu tỷ lệ và trạng thái symbol

Ở bản gốc, Wild gần bằng chiều rộng một ô. Scatter có khung rộng khoảng một ô và phần chân dung cao hơn ô. Các chữ và số chừa khoảng trống lớn hơn. Bản local trước khi sửa hiển thị Wild và Scatter khoảng 60–65% chiều rộng ô ở tư thế chờ. Khi rơi, hiệu ứng glow và shadow làm bounds của Spine lớn hơn phần hình chính. Cách lấy bounds để ép vừa ô khiến một số symbol, nhất là Wild, Scatter và món súp, nhỏ lại rõ rệt.

Local hiện dùng scale và điểm gốc thống nhất giữa bốn skeleton. Wild và Scatter có thể vươn qua đường chia reel, với phần ngoài khung bàn được che khi rơi. Các trạng thái dùng clip như sau.

| Trạng thái | Cách phát |
| --- | --- |
| `spin` | Drop giữ hình rõ của pose `*_static` trong lúc rơi ra/rơi vào. Normal Spin dùng pose motion blur `*_spin` trong lúc cuộn. |
| `land` | Phát `*_land` một lần khi tiếp đất nếu asset có clip. Món súp, Wild và Scatter có clip riêng. Các symbol khác dùng nhịp nảy của reel. |
| `win` | Phát một lần trên symbol thắng hoặc Scatter kích hoạt tính năng. Nếu còn clip land thì để clip đó kết thúc trước. Các symbol ngoài kết quả thắng tối đi trong lúc trình bày. |
| `idle` | Dùng `*_static` sau khi dừng. Các clip có thời lượng phát lặp, gồm Wild, Scatter và món súp. |

Tỷ lệ được so bằng các khung hình desktop. Chưa đo sai số vị trí và timing theo từng frame. [Demo gốc](https://paperclipgaming.com/ko/games/tavern-drop)

Trong lượt thắng quan sát lại, đường đỏ cam hiện từ chai bên trái và chạy qua đủ năm reel. Chỉ các ô trả thưởng sáng lên, số tiền của line hiện màu xanh ngay trên bàn. Skeleton `td_reelhouse` có các clip `payline_0` đến `payline_14`. Bản local vẽ đường từ cấu hình payline của demo và dùng hình đầu mút từ atlas gốc vì các đường chéo và zigzag trong cấu hình local có thể khác đường trong clip Spine. Khi có nhiều line, mỗi line được trình bày riêng.

Spine Player tự canh khung xem theo clip. Đo ngay trên atlas ở cùng một scale tại ngưỡng alpha 50%, phần blur của Q cao khoảng 104 px trong khi pose rõ cao khoảng 91 px. Giữ pose rõ trong Drop loại bỏ cú nhảy do đổi từ attachment blur sang pose rõ khi tiếp đất. Các clip land và win vẫn có thay đổi kích thước do keyframe của asset.

## 10. Đối chiếu clip Spine và font

Đã kiểm kê **141 clip** trong tám skeleton, với tên và thời lượng đọc trực tiếp từ các tệp `.skel`. Trình tự dưới đây đối chiếu các cảnh có thể chạy trong demo gốc và các đoạn gọi animation của trình duyệt. [Demo gốc](https://paperclipgaming.com/ko/games/tavern-drop)

| Skeleton | Số clip | Tích hợp trong Tavern |
| --- | ---: | --- |
| `td_backgrounds` | 8 | `0_base_enter/idle`, `0_bonus_enter/idle`, zoom vào/ra, shake khi retrigger, pose portrait `4_mobile`. |
| `td_reelhouse` | 81 | Splash và vào game theo hướng màn hình, idle, chuyển base/bonus, spin/skip/shake, 25 clip key, 25 clip rương, 15 clip payline, `4_finalwin` trước khi mở rương và pose `41_fade_extras` lúc ra Total Win. |
| `td_screens` | 14 | `bonus_*` cho Tavern, `super_*` cho Drop, `addfs` cho retrigger, sáu clip thắng và chuỗi `total_win_start/idle/end`. |
| `td_character` | 2 | `idle` và `win` cho mascot trên desktop và mobile. |
| `td_symbols_low` | 15 | Năm nhóm chữ/số, mỗi nhóm có `spin`, `static` và `win`. |
| `td_symbols_high` | 13 | Bốn nhóm món đồ có `spin`, `static` và `win`. Món Feast có thêm `land`. |
| `td_symbols_wild` | 4 | `wild_spin/static/land/win`. |
| `td_symbols_bonus` | 4 | `bonus_spin/static/land/win`. Đợi Scatter diễn xong trước intro. |

Mười lăm đường thắng trong config Tavern dùng đúng các chuỗi hàng ở mục 3. `payline_0` đến `payline_14` chạy trên đúng đường, với số tiền bitmap xanh và đổi đỏ từ 20× bet. HUD, shop và Help dùng các weight Outfit 300–800. Số tiền của màn thắng và Total Win dùng bitmap vàng gắn vào slot `slot_win`. Khi bonus có số lượt khác 10, slot intro hiển thị số thực từ server.

Ngưỡng trình diễn Small/Nice/Big/Super/Mega/Epic lần lượt là 5×, 10×, 20×, 50×, 75× và 100×. Small và Nice cùng dùng clip `smallwin`. Khi mock server trả kết quả chạm cap, Tavern dùng clip `maxwin`. Giá mua, multiplier và cap vẫn theo config của bản demo.

HTML và Pixi giữ số tiền, nút, tọa độ tương tác và fallback tĩnh. Spine cung cấp phần hình chuyển động. Khi chạy bằng reduced motion hoặc thiếu tài nguyên Spine, game vẫn hiển thị kết quả và cho tiếp tục.

### Clip chưa được gọi trong gameplay

Đã đối chiếu SHA-256 của cả tám skeleton với demo v13. Cả tám tệp khớp bản gốc.

| Clip | Runtime Tavern hiện tại | Demo gốc v13 |
| --- | --- | --- |
| `td_reelhouse / 3_push` | Có trong Animator Viewer. Gameplay chưa có điểm gọi. Scatter đáp xuống phát `3_shake` theo config. | Sự kiện tiếp đất của từng Scatter gọi `3_shake` cho nền và khung reel. Chưa thấy điểm gọi `3_push`. |
| `l1_spin`–`l5_spin`, `h1_spin`–`h4_spin`, `wild_spin`, `bonus_spin` | Đã nối cho Normal. Tavern đang mặc định Drop và ẩn menu đổi kiểu reel, nên 11 pose 0 giây này chưa chạy trong luồng Drop. | Gọi pose `*_spin` khi symbol mới bước vào `revealing` và đang rơi xuống. Sau đó dùng `land` cho Feast, Wild và Scatter, hoặc `static` cho symbol còn lại. |

`h2_land`, `h3_land` và `h4_land` xuất hiện trong bảng ánh xạ của demo gốc. Cả hai bản dùng cùng tệp `td_symbols_high.skel`, và danh sách clip trong tệp chỉ có `h1_land`. Demo gốc chọn `land` cho Feast, Wild và Scatter trong luồng reveal đã kiểm tra. [Demo gốc](https://paperclipgaming.com/ko/games/tavern-drop)

### Căn vị trí payline, chuyển Free Spins và mascot

- Đối chiếu v13, bàn symbol neo vào `reelhouse/slot_symbols`, với bước 574 đơn vị theo cột và 564 theo hàng. Tavern dùng hai tỷ lệ riêng để đưa payline về tâm ô của Pixi.
- V13 đưa symbol của lượt kích hoạt ra khỏi reel trong cảnh vào bonus. Tavern giữ board trống từ sau khi Scatter diễn xong đến khi bàn mới của lượt Free Spin đầu được thả vào.
- Mascot dùng `background/slot_character` ở landscape và `reelhouse/slot_character` ở portrait. Thứ tự lớp là reel, mascot, rồi bàn tiền cảnh. Camera nền landscape được chỉnh theo chiều cao mép khăn để giữ hàng symbol cuối nhìn thấy. [Demo gốc](https://paperclipgaming.com/ko/games/tavern-drop)
