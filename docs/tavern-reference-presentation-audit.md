# Đối chiếu UI và luồng hiệu ứng Tavern Drop v13

## Căn cứ kiểm tra

- Bản tham chiếu là JS và CSS frontend công khai của Tavern Drop v13. Đã đọc `index-Btp6donA.js` và `index-JDgoUbSF.css` lưu trong `.runtime/reference-tavern-v13/`. Đối chiếu với timeline của `td_screens.skel` và `td_reelhouse.skel`. Hai bundle chỉ dùng để khảo sát cục bộ. [Trang công khai của game tham chiếu](https://paperclipgaming.com/ko/games/tavern-drop)
- Bản dự án là checkout phát triển gồm các thay đổi hiệu ứng đang có trong workspace. Tọa độ dưới đây đo trên build local `4001` bằng Chrome. Các mốc của bản tham chiếu đọc từ code và keyframe. Trong lần kiểm tra này, hai bên chưa được đo bằng cùng một phiên chơi live.
- Để kiểm tra lại trong bundle, tìm `desktop-panel-wrap`, `panel-container-portrait` và `resize(){this.continueSprite` cho layout. Tìm `playBonusEnter`, `playChestFinalWins`, `playBonusExit`, `bigWinAnimation` và `playShockwave` cho flow. Bundle là mã đã build và nén.

## Cách định vị UI

| Khu vực | Bản tham chiếu | Bản hiện tại |
| --- | --- | --- |
| Phân loại viewport | Dùng kích thước renderer với mốc rộng `661` và cao `449` để chọn desktop, landscape hẹp hoặc portrait. | CSS dùng aspect ratio `4/5`, chiều rộng `670/671 px`, và mốc landscape thấp `490 px`. Canvas Spine có thêm điều kiện aspect ratio riêng. Hai bên có thể chọn layout khác nhau ở màn hình trung gian. |
| Cảnh, reel và mascot | Cảnh Pixi đặt gốc ở giữa viewport. Nền dùng cover theo kích thước thiết kế. Reelhouse và màn Spine dùng quy tắc fit riêng. Portrait kích hoạt `0_mobile` trên reelhouse, `4_mobile` trên nền và một mascot portrait. | CSS đặt `.machine`, reel host và HUD. `effects.ts` đọc kích thước frame DOM để đặt Spine reelhouse, còn `ResizeObserver` đồng bộ khi viewport hoặc frame đổi. Có `0_mobile` và `4_mobile`. Kiểm tra cùng một anchor giữa base/bonus và giữa các viewport quan trọng hơn việc dùng cùng con số scale. |
| HUD desktop | DOM flex ngang. Giá trị tiền và nhóm bet nằm trong thanh chính. Mũi tên bet xếp dọc và các nút phụ có cột riêng. Kích thước dựa vào `em`. | DOM grid ngoài, flex trong thanh và đơn vị responsive `--hud-unit`. Thanh nằm sát đáy cảnh. Spin và các nút phụ có offset theo giao diện Tavern. |
| HUD portrait | Wrapper portrait tách hàng control và hàng số tiền. Nhóm control chính có ba cột, hàng số tiền có biến thể base/bonus. | Grid CSS đặt Menu / Auto / Spin / Turbo / Buy trên hàng trên và balance, bet, win ở dưới. Feature dùng cấu hình grid riêng cho counter và tổng win. Cụm điều khiển đo được nằm trong viewport. Mép dưới bet chạm mép viewport ở 390×844, nên cần kiểm tra safe area và chữ KRW dài. |
| Bet Menu và Autoplay | Hai panel HTML có offset `em` riêng cho desktop/portrait, gắn tương đối với cụm điều khiển. Buy có wrapper cuộn và thanh giá ở dưới. | Dùng popover với CSS anchor từ Spin, Auto hoặc Menu, kèm fallback và quy tắc portrait. Buy có grid cuộn độc lập. Các hướng neo tương tự, còn kích thước và vị trí thực tế cần đo cùng viewport để kết luận độ lệch. |
| Continue và Total Win | Continue là sprite Pixi. Hàm `resize` đặt tâm X và lấy 96% chiều cao viewport cho Y. Popup win dùng fit theo stage. | Continue là nút DOM có thể điều khiển từ bàn phím. Màn Spine fit theo bounds clip trong host DOM, có profile portrait, landscape và khoảng để lượng tiền dài. |

Tọa độ Chrome local theo thứ tự `x, y, width, height`, đơn vị CSS px, sau khi vào base game.

| Thành phần | 1280×720 | 390×844 |
| --- | --- | --- |
| Reel host | 379.3, 78.4, 521.4, 507.4 | 20.2, 235.6, 349.5, 340.1 |
| HUD | 175.6, 592.6, 828, 106 | 7.8, 721.8, 374.4, 122.2 |
| Buy | 175.6, 592.8, 97.5, 97.5 | 260.2, 723.6, 79.2, 79.2 |
| Spin | 848.1, 584.6, 102, 102 | 142.3, 721.8, 82.9, 82.9 |
| Bet control | 684.9, 612.9, 102, 51.1 | 139, 818.7, 82, 25.3 |
| Bet Menu mở | 370, 491.5, 540, 88.1 | 15.6, 638.3, 358.8, 80.7 |

Nguồn dự án: [layout Tavern](../src/games/tavern/theme.css), [anchor và fit Spine](../src/games/tavern/effects.ts), [cấu hình game](../src/games/tavern/game.config.json).

## Luồng game, hiệu ứng và clip Spine

| Mốc | Bản tham chiếu | Bản hiện tại và chênh lệch |
| --- | --- | --- |
| Landing → base | Zoom nền ra, `1_game_enter` hoặc `1_game_enter_mobile`, sau đó `1_idle`. | Có cùng họ clip. HUD và mascot còn đi qua các mốc reveal của profile Tavern. |
| Spin, Skip, paylines | `3_spin_start`, `3_skip` và `payline_0…14`. | Có cùng họ clip. Payline có Spine riêng trong lớp của board, ánh xạ theo hình học hàng và cột, nên track số khác dùng được. Sau lượt no-win, local đặt 500 ms từ lúc reel dừng tới lần spin tự động tiếp theo. Đây là yêu cầu của dự án. |
| Scatter và anticipation | Các symbol đủ điều kiện ở phase win được highlight, các symbol khác tối. Anticipation còn zoom container nhẹ theo thời gian và đưa scale về sau khi dừng. | Đợi landing (`waitForLandings`) trước `focusWins`. Có giữ reel và tint bằng RGB, foreground Scatter và clip `3_shake`. Chưa thấy policy camera tương ứng với anticipation zoom của bundle. |
| Base → Tavern/Drop intro | `2_base_exit`, sau khoảng 300 ms bắt đầu zoom nền vào và chạy `bonus_intro`/`super_intro`. Continue gọi shockwave, `1_zoom_out`, nền bonus và `bonus_outro`/`super_outro` cùng lúc. Khoảng 300 ms sau đó bắt đầu `2_bonus_enter`. | Có các clip intro/outro, khung rương và `2_bonus_enter`. Hiện zoom vào bắt đầu cùng `2_base_exit` và app đợi clip thoát base xong trước intro. Khi Continue, app chạy `emphasize`, đợi outro xong rồi mới chuyển vào bonus. Chưa gọi shockwave ở Continue của intro. Đây là điểm lệch rõ nhất trong flow. |
| Retrigger và chest activation | `addfs` đi cùng shake và cue retrigger. Từng rương dùng track clip `*_chest_activate` rồi `*_chest_idle`. | Có `addfs`, shake, cue và các clip activate/idle tương ứng. Số lượt cộng do response cấp, giao diện dùng số đó khi render. |
| Chest finale | `4_finalwin` và zoom theo tỷ lệ portrait/desktop. Đếm pre-chest, mở các rương đủ điều kiện, rồi trình bày multiplier. Sự kiện `update_final_win_<reel>` là mốc cập nhật số. | Có `4_finalwin`, native open/open-idle và clip multiplier của từng rương. Nhánh v1 show số trước khi mở và chờ 2 giây, sau đó mở/tăng tiền theo từng checkpoint. Nhánh này hiện đếm song song với clip multiplier thay vì đợi marker Spine. Nên dùng marker để đồng bộ hình và số, vẫn lấy số cuối của từng bước từ server và giữ quy tắc resume. |
| Big → Max | Chọn clip theo tier cuối, phát một lần. Sự kiện Spine báo Big/Super/Mega/Epic/Max và gọi shockwave lẫn cue đúng tier. | Code hiện tại dùng một clip và event/cue theo tier, có tween số tiền và xử lý Skip. Shockwave tham chiếu áp lên một Pixi stage, local áp qua các canvas Pixi đang tham gia. Sự kiện khớp ở code, mức méo xuyên các lớp DOM/canvas cần xem khi chơi. Ngưỡng chạy celebration trước Total Win của bundle là Mega trở lên, còn local gọi từ Big hoặc cap. Đây là policy riêng cần chốt nếu thay. |
| Vào Total Win | Bắt đầu `2_bonus_exit` và zoom nền, chờ khoảng 350 ms rồi `total_win_start` → `total_win_idle`. | Có cả ba clip. `prepareTotalWin()` đợi clip thoát bonus xong rồi mới mở Total Win, nên điểm chồng chuyển động khác bundle. |
| Continue Total Win → base | Continue fade 250 ms, shockwave, `total_win_end` và `1_zoom_out` gần như đồng thời. Nền base vào khoảng 200 ms, reel base vào khoảng 500 ms. | Có các mốc tương ứng và cue Total Win Outro. ACK hiện chạy song song với chuyển cảnh. Số dư chỉ dùng giá trị xác nhận từ mock server. Giữ ranh giới hiển thị và xác nhận khi chỉnh timing. |

Nguồn dự án: [trình tự trình bày](../src/games/tavern/app.ts), [mapping clip và hiệu ứng](../src/games/tavern/effects.ts), [paylines](../src/games/tavern/payline.ts), [mask và reel motion](../src/framework/presentation/board.ts).

Mốc đọc từ asset Spine: `2_base_exit` và `2_bonus_exit` đều dài khoảng 667 ms. `2_bonus_enter` dài 2,1 giây và có `key_spawn` ở 367 ms, `chest_spawn` ở 1.067 ms. Với rương đầu tiên, `update_final_win_0` nằm ở 767 ms trong `31_reel_0_chest_finalwin`. `total_win_end` dài 1,5 giây. Thời lượng asset là căn cứ để kiểm tra độ chồng giữa các clip, còn các mốc 200/350/500 ms trong bảng đến từ orchestration của bundle.

Kiểm tra local: Playwright chạy ca `v1 Epic Win announces each tier once and Total Win returns to base on one click` và đạt. Ca này kiểm tra một clip Epic, cue/shockwave theo tier, số đếm tăng, thứ tự outro và một lần xác nhận số dư khi bấm Continue liên tiếp. Báo cáo cục bộ ở `.runtime/qa-behavior/2026-11-20-QdfjMh/`.

## Hiệu ứng ngoài Spine

Rà riêng các lần dùng filter, tween, tint và backdrop trong bundle v13. Hai filter nhận diện được trong luồng game là `ShockwaveFilter` và `BlurFilter`. Shake khi Scatter đáp, flash khi Skip và phần nhún artwork ở `total_win_end` dùng clip Spine. Chúng có thể chạy cùng hiệu ứng Pixi hoặc DOM tại một mốc chuyển cảnh.

| Hiệu ứng | Bản tham chiếu | Bản hiện tại |
| --- | --- | --- |
| Shockwave | Một filter trên Pixi stage, tâm theo viewport của renderer, biên độ 20, bước sóng 450, tốc độ 500, thời lượng 500 ms. Gọi lúc Continue ở intro, Continue ở Total Win và khi Spine phát mốc tier win. Bản filter có cả chương trình WebGL và WebGPU. | Cùng họ sóng và thông số. Có mốc tier và Continue Total Win, thiếu Continue intro. Runtime có nhiều canvas, áp sóng riêng lên từng stage WebGL đã mount. DOM và canvas snapshot 2D không chịu sóng. Vùng clip và biên giao nhau có thể khác với một lần lọc toàn cảnh. |
| Blur/dim của màn Spine | Hai hình đen alpha 0,75 được gắn vào slot `fade` của screens và reelhouse. `BlurFilter` có strength 4 và gắn vào chính hình đó. Spine điều khiển alpha theo slot. Khi capture Total Win, source tạm ẩn dim và Continue. | Screens bỏ attachment `fade` và dùng CSS nền dialog. Big Win dùng blur 2 px, Total Win 3 px, nền dialog mặc định 5 px. Trong feature, alpha của slot fade điều khiển tint RGB trên các lớp board, foreground chest được loại khỏi tint. Kết quả tối và vùng bắt blur khác do cách ghép lớp. |
| Dim các symbol trong win và anticipation | Từng Spine symbol dùng tint `#7A8C90` cho trạng thái tối và `#FFFFFF` cho trạng thái sáng. | `BoardView` dùng `winDimmerOpacity: 0.5` để tính `#808080`, màu xám trung tính. Win/anticipation vẫn dùng RGB tint và giữ opacity của symbol. Foreground Scatter được nâng lớp. Đây là khác biệt màu, độc lập với dim của chest finale. |
| Camera anticipation | Tween container từ 1 lên 1,05 trong tối đa 4 giây. Khi anticipation dừng, chờ 100 ms rồi đưa scale về 1 trong 300 ms. | Có tint, nâng Scatter và cue, nhưng callback anticipation hiện chỉ bật/tắt audio. Chưa có tween camera cùng các mốc đó. Shake khi Scatter đáp đã dùng clip `3_shake`. |
| Camera và số tiền ở chest finale | Zoom 500 ms, target 1,4 desktop và 1,125 portrait, với offset Y tùy viewport. Giá trị pre-chest đếm từ 0. Khi marker `update_final_win_<reel>` chạy thì xóa multiplier và đếm tiền trong khoảng 200 ms. Khi rời cảnh, zoom trở lại trong 500 ms. | Web Animations scale host lên 1,24 với origin Y 79% trong 500 ms cho cả hai layout. Nhánh v1 show thẳng pre-chest, giữ hai giây theo yêu cầu, rồi dùng 420 ms để tăng tiền theo từng checkpoint. Clip multiplier và tween tiền chưa đồng bộ bằng marker. Camera zoom được cancel trong `prepareTotalWin()`. |
| Continue và màn chuyển | Sprite Continue đi từ dưới viewport lên khoảng 96% chiều cao, fade vào theo tween. Khi chấp nhận, nó fade ra trong 250 ms trong các chuyển cảnh bonus. | Là nút DOM. Intro có scale/bounce 420 ms và app chờ motion hoàn tất. Total Win dùng fade 250 ms kèm scale nhỏ và chạy outro ngay. Canvas/DOM còn có veil local 840 ms với blur 4 px để reveal cảnh sau. Đây là hiệu ứng chuyển DOM bổ sung. |
| Count-up và pop ở win tiers | Tween số đếm chạy cùng clip. Callback đổi tier phát cue, gọi shockwave và cập nhật text. | Cùng nhịp count-up cấu hình theo clip, có thêm pulse scale tiền 260 ms ở mỗi tier và gom các marker vượt qua trong một frame khi Skip. Kiểm tra logic đã đạt trên Chrome. Kiểu pulse và ghép canvas vẫn khác. |
| CSS ở menu | Buy dùng backdrop blur 8 px, confirm là overlay blur 3 px trên lớp Buy, Rules/Info dùng blur 20 px. | Shop, shop-confirm và dialog rules hiện dùng chung backdrop CSS 5 px. Chuyển sang confirm thay nội dung trong cùng một dialog. Vì vậy độ mờ và vùng nền còn thấy khác. |

Chrome local xác nhận Buy, popup xác nhận mua và màn Drop intro cùng nhận backdrop blur 5 px. Khi bấm Continue ở Drop intro, Web Animations chạy 420 ms với các mức scale `1 → 1,14 → 0,92 → 1,18`. Các nhận xét về composition dựa vào code và lớp render. Chưa có phép so pixel hai bản chạy cùng lượt.

Nguồn dự án: [filter và vòng đời](../src/framework/presentation/shockwave.ts), [tween/veil dùng chung](../src/framework/presentation/scene.ts), [layout và CSS của Tavern](../src/games/tavern/theme.css), [compositing và camera](../src/games/tavern/effects.ts).

## Ranh giới `fw-pixi`

- **Trong framework** nên giữ công cụ fit/anchor, vòng đời renderer, board và mask, theo dõi clip/event, filter có thể tháo bỏ, đếm tiền, điều khiển Continue và lifecycle âm thanh. Kiểm tra phần dùng chung với cả cấu hình 3×3.
- **Trong Tavern Drop** giữ profile desktop/portrait, kích thước thiết kế và anchor, tên clip/slot, mapping paylines, tier, thông số shockwave, cue và thứ tự trình bày của từng cảnh. Nhóm ngưỡng, nhịp chờ và cách camera chuyển cảnh nên nằm trong profile Tavern khi chúng cần điều chỉnh.
- **Trong transport/controller** giữ kết quả trả về, checkpoint đã phát hành/đã hiển thị, resume và confirmed balance. Event Spine điều khiển lúc vẽ số tiền và hiệu ứng. Resume và ACK tiếp tục theo hợp đồng dữ liệu của dự án.

Ưu tiên M2 là xác minh HUD ở desktop, portrait và landscape ngắn, kèm bet dài, Skip và các tier win. Ưu tiên M3 cho các lệch về Continue ở intro, marker tăng tiền của chest và mức chồng giữa outro bonus với Total Win. Dùng Bonus Debug để dựng fixture ngắn, kiểm tra sự kiện và clip trước khi đối chiếu khung hình.
