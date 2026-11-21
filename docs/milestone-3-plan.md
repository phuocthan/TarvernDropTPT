# Kế hoạch triển khai Milestone 3

Ngày 21/11/2026. Bản sửa M2 đã được gửi review ở MR !2. M3 tiếp tục trên nhánh `main` của repo dev từ nền M2. Phạm vi bàn giao từng milestone được quản lý ở repo release và GitLab của client.

## Yêu cầu đã tìm lại

| Yêu cầu | Phạm vi triển khai M3 |
| --- | --- |
| Hai bonus Tavern và Drop | Vào từ lượt tự nhiên hoặc Bonus Buy, chạy intro đúng mode, tự quay free spins, hiển thị số lượt còn lại, win từng lượt và win tích lũy, chơi retrigger, rồi outro và trở về base game. |
| Key và năm rương | Khôi phục vị trí key từng ô, cập nhật rương theo progress, mở từng rương đủ điều kiện và hiện multiplier cùng tổng tiền mới. Chỉ ACK rương sau khi animation và tổng mới đã hiện. Open All là tùy chọn. |
| Khôi phục giữa feature | Reload/reconnect khôi phục đúng round, board đã phát hành, free spins, key, win tích lũy và tiến độ rương. Chỉ trình bày lại phần đang dang dở từ checkpoint an toàn. Turbo, Skip, retry và hai tab xác nhận cùng bước phải giữ nguyên kết quả. |
| Hiển thị tiền và quyết toán | Hiển thị KRW không thập phân. Tách win từng bước, tổng tích lũy, final payout và số dư đã xác nhận. Không cược lại trong feature. Cả paid round quyết toán một lần, cap 10.000× base bet gốc kể cả khi mua bonus. |
| Xử lý round bị gián đoạn | Client giữ khóa Spin và ẩn final amount khi kết quả thanh toán chưa rõ. Trường hợp server tự đóng sau 30 ngày bất hoạt, khi đã xác nhận settlement thì chỉ hiện Total Win, sau đó đóng summary để mở khóa. Team A sở hữu lịch đóng round và quyết toán. M3 kiểm chứng UI bằng fixture; xác minh live thuộc M4. |

Nguồn: [phạm vi chính thức của client](https://gitlab.com/game-studio9172445/slot-client/-/blob/6901efae2b20a8cd9704e35d6e5b8c410794e2a9/docs/GAME_SCOPE.md), [checklist asset và trạng thái M3](https://gitlab.com/game-studio9172445/slot-client/-/blob/6901efae2b20a8cd9704e35d6e5b8c410794e2a9/docs/than/M1_ASSET_STATE_CHECKLIST.md) và [quyết định API từ client](client-communication-log.md#latest-client-message--detailed-api-decisions-and-four-sequences).

## Nền hiện tại và phần cần xác minh

- Bản dev đã có intro/outro, free spins tự chạy, key, chest finale, Total Win, audio và mock API có checkpoint. Đã có spec cho resume, mở rương và ACK. Bước P0 sẽ chạy lại các spec và kiểm tra từng mode trên cùng fixture trước khi đánh giá mức hoàn thành M3.
- Mock dùng giá mua 125×/300× và cap 10.000×. Số lượt, luật retrigger và nhóm multiplier trong cấu hình hiện tại là dữ liệu synthetic. Natural trigger đang tắt ở mock thông thường, nên cần fixture chủ động để kiểm thử đường vào tự nhiên.
- Các điểm presentation cần đo lại gồm nhịp trước/sau khi reel rơi trong free spins, Continue intro, thời điểm đếm tiền theo marker rương, và thời điểm chuyển từ chest finale sang Total Win. Một số mô tả audit cũ có trước những thay đổi M2, nên cần kiểm tra lại trên code hiện tại. [Ghi chú đối chiếu](reference-v13-parity.md#remaining-gaps-and-next-steps)
- Mock hiện còn dùng số nguyên ở một số field tiền. Client yêu cầu chuỗi thập phân biểu diễn whole KRW trong hợp đồng cuối. Cần đối chiếu mapping, trạng thái settlement, timestamp xác nhận số dư và quy tắc round status với Team A. Danh sách 25 mức cược KRW đã được duyệt ở M2. RTP/weights, trigger/retrigger, điều kiện và subtotal rương, rounding và thứ tự cap còn chờ xác nhận cuối. [Yêu cầu và đề xuất API](backend-requirements-krw-resume-single-settlement.md)

## Trình tự triển khai

| Ưu tiên | Việc thực hiện | Tiêu chí qua |
| --- | --- | --- |
| P0 | Chốt baseline M2/M3 và thêm hoặc tái sử dụng fixture tái lập được cho Tavern và Drop. Chạy đường vào bằng mua và trigger tự nhiên, có/không retrigger, 0/1/nhiều rương và kết thúc do cap. | Mỗi case chạy lặp lại ra cùng board, counter, key, thứ tự mở và final payout. Thu lại mốc và ảnh hiện trạng trước khi sửa. |
| P1 | Hoàn thiện hai luồng intro → free spins → retrigger/outro. Căn HUD, counter, win từng lượt, nhịp rơi, Continue, lớp mascot/reel/table và chuyển audio trên desktop, portrait, landscape. | Không bỏ mốc hiển thị, không tự mở bet trong feature, số KRW dài không bị cắt. Spin/Autoplay của base game không xuất hiện sai lúc. |
| P2 | Hoàn thiện key → chest → multiplier → Total Win. Kiểm tra thứ tự clip, marker, âm thanh, amount, zoom và return về base. Tách timing/layout và tên clip vào profile Tavern; giữ checkpoint, overlay, audio lifecycle và formatter dùng chung trong `fw-pixi`. | Case 0 rương đi thẳng tới màn phù hợp. Case nhiều rương hiển thị từng giá trị đúng thứ tự. ACK chỉ đến sau khi bước đã hiện đủ. Tổng cuối theo kết quả server. |
| P3 | Kiểm chứng reload tại intro, giữa free spin, lúc mở rương, sau rương và trước/sau dismissal Total Win. Kiểm tra mất reply, hai tab, Turbo/Skip, settlement chưa rõ và auto-close bằng fixture. | Không trừ thêm, không trả trùng, không phát lại phần đã xong. Client chỉ mở Spin khi server cho phép. Ghi rõ hành vi mock và các điểm chờ A. |
| P4 | Chạy hồi quy 5×5 base và 3×3, smoke trên desktop/portrait/landscape, lưu ảnh/video và kết quả build. Chuẩn bị gói review M3, hướng dẫn chạy và danh sách giới hạn. | Gói dựng được từ checkout sạch. Có bộ bằng chứng cho hai bonus và resume, kèm danh sách các mục live để M4 xác minh. |

Không cần đợi duyệt M2 để bắt đầu fixture, presentation và recovery trên mock. Gửi bản M3 sang release hoặc GitLab theo yêu cầu riêng. Production adapter, xác minh wallet thật và acceptance trên thiết bị vật lý thuộc M4.
