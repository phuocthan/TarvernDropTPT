# Tavern Drop QA · Bàn giao cho Claude

## Mục tiêu

Mở rộng bộ QA hành vi trên **một bản Tavern Drop chạy local**. Playwright tự thao tác và kiểm tra kết quả theo quy tắc của game. Symbol có thể khác giữa các lượt spin và thời điểm chụp ảnh có thể lệch vài frame, vì vậy dùng ảnh hoặc trace để minh họa lỗi đã tái hiện. Bộ test đã viết chạy trực tiếp bằng Node.js và Playwright, không gọi AI. Dùng `dogfood` khi cần agent tự tìm lỗi mới qua UI.

## Bắt đầu

1. Đọc `AGENTS.md`, [kế hoạch QA](game-comparison-test-plan.md) và [mô tả mock API](backend-localhost-v1.md). Nếu một test liên quan tới quyết định mới của client về resume hoặc thanh toán, đối chiếu thêm [handoff API](handoff-2026-11-19.md) và [nhật ký trao đổi](client-communication-log.md). Ghi rõ nếu mock hiện tại và hợp đồng dự kiến xử lý khác nhau.
2. Dùng Node.js 22.18+ và chạy từ gốc repo. Lệnh QA mặc định tự khởi động Vite trên `4194` và mock API trên `4195`, dùng wallet synthetic riêng cho lượt chạy. Chrome cài sẵn ở đường dẫn mặc định trên Windows được nhận tự động. Dùng `CHROMIUM_PATH` nếu Chrome nằm ở vị trí khác, hoặc cài Chromium bằng `npx playwright install chromium`.
3. Chạy toàn bộ suite để xác lập kết quả trước khi thêm test. Trên máy Windows của lượt xác minh, suite có **11 ca Playwright đều đạt**. `npm test` có **50 ca đạt**. Thời gian chạy browser gần 6 phút với Chrome headless trên máy đó.

```powershell
npm ci
npm test
npm run qa:behavior
npm run qa:behavior -- --grep 'Scatters play win'
```

Khi dùng `PLAYWRIGHT_BASE_URL`, cung cấp URL Vite dev local đang chạy cùng mock API. Một số test kiểm tra animation thông qua module nguồn nên bản preview build không phù hợp với các ca đó.

## Dùng lại phần đã có

| Vị trí | Nội dung |
| --- | --- |
| [`playwright.qa.config.ts`](../playwright.qa.config.ts) | Suite QA với tag `@qa-behavior`, một lần retry, ảnh khi lỗi và trace ở lần chạy lại. |
| [`tests/browser/game.spec.ts`](../tests/browser/game.spec.ts) | Scatter Land/Win, retrigger, native chest reveal, Total Win, dọn text sau bonus và bố cục mobile. |
| [`tests/browser/startup-feature.spec.ts`](../tests/browser/startup-feature.spec.ts) | Khôi phục intro và free spin đã được phát hành cho Tavern và Drop. |
| [`tests/browser/proposal.spec.ts`](../tests/browser/proposal.spec.ts) | Mock v1, reload ở intro, gửi xác nhận cho các chest và chỉ unlock Spin sau khi xác nhận Total Win. |
| [`tests/proposal-transport.test.ts`](../tests/proposal-transport.test.ts) và [`tests/proposal-backend.test.ts`](../tests/proposal-backend.test.ts) | Test transport, progress, retry, replay và settlement. Dùng các ca hiện có để dựng dữ liệu và kiểm tra phiên bản contract đang mock. |
| [`src/framework/testing/behavior-reporter.ts`](../src/framework/testing/behavior-reporter.ts) | Reporter dùng chung của `fw-pixi`. Kịch bản và dữ liệu riêng của Tavern ở test game. |
| [`scripts/publish-qa-to-trello.mjs`](../scripts/publish-qa-to-trello.mjs) | Xem trước hoặc gửi card có bằng chứng lên cột `To-do` của board Tarvern. |

Gắn tag `@qa-behavior` khi thêm test vào suite. Thêm annotation `qa-expected` mô tả kết quả người chơi mong đợi để đi thẳng vào báo cáo. Ưu tiên `expect` tự chờ, trạng thái UI, sự kiện Spine hoặc phản hồi mock. Dựng kịch bản bằng seed/fixture ổn định, cùng `ProposalBackend` hoặc transport fixture hiện có. Với animation ngắn, đăng ký bộ quan sát trước thao tác và lưu lại sự kiện để test không phải bắt đúng một frame.

## Thứ tự triển khai tiếp

| Ưu tiên | Kịch bản | Điều kiện đạt |
| --- | --- | --- |
| 1 | **Reload giữa các lần mở chest.** Dùng một bonus có ít nhất hai chest mở được. Xác nhận chest thứ nhất, giữ chest thứ hai ở trạng thái đã phát hành và đang hoặc chưa được trình bày, rồi reload. | Resume đúng chest chưa xác nhận. Chest đã xác nhận không mở lại. Số tiền tích lũy đã hiển thị được khôi phục, mức mới cập nhật sau reveal. Xác nhận cuối vẫn chỉ đóng một paid round. |
| 2 | **Mất phản hồi khi xác nhận kết thúc.** Dùng mock để server xử lý xác nhận rồi cắt phản hồi trước khi đến FE. Thử retry hoặc reload từ tài khoản test đó. | Giữ nguyên kết quả và paid round. Số dư xác nhận khớp với ledger của fixture, xác nhận lặp không tạo thêm tiền hoặc debit, và Spin chỉ sẵn sàng khi trạng thái được xác nhận. Nếu mock normal hiện settle sớm, ghi rõ chênh lệch contract và ưu tiên ca bonus đã thể hiện được luồng pending. |
| 3 | **HUD lúc bắt đầu spin mới và lúc chạy turbo/autoplay.** Fixture trả một lượt có win, tiếp theo là no-win. Thử trên desktop và portrait tại các điểm có rủi ro. | Win cũ biến mất khi bắt đầu lượt mới. Spin và các điều khiển cần thiết nằm trong viewport. Nếu kiểm tra delay no-win, đo từ lúc reel cuối dừng tới lệnh spin tiếp theo, với mốc khoảng 500 ms và dung sai phù hợp với môi trường test. |

Bắt đầu với ưu tiên 1. Khi phát hiện sai lệch, xác định đó là bug game, fixture sai, test lỗi thời hay lỗi môi trường. Giữ test tái hiện được cùng bằng chứng, ghi riêng phần cần sửa ở game hoặc mock contract. Ví dụ đã gặp ở suite cũ là assert tên CSS cho Total Win trong khi bản hiện tại phát clip Spine `total_win_end`.

## Bằng chứng và gửi Trello

Mỗi lượt chạy ghi `.runtime/qa-behavior/<run-id>/run.json` và `html/index.html`. Reporter ghi `failed` khi cùng assertion thất bại ở lượt đầu và retry. Lỗi chập chờn, lỗi chạy test không đủ căn cứ và những trường hợp cần đọc trace được ghi `review`; những ca chưa chạy là `notObserved`. Khi bàn giao, ghi lệnh chạy, kết quả, tên test, lý do phân loại và đường dẫn bằng chứng trong lượt chạy của mình.

```powershell
npm run qa:trello -- --report '.runtime/qa-behavior/<run-id>/run.json'
```

Đây là lệnh xem trước. Sau khi có chỉ định đăng, dùng `--publish` và giá trị `TRELLO_API_KEY`, `TRELLO_API_TOKEN` đã thiết lập trên máy chạy. Giữ dữ liệu mock, ảnh, trace và thông tin đăng nhập ngoài Git. Thử đăng hoặc dry run bằng report phù hợp với phạm vi công việc và giữ nguyên lịch sử repo phát triển. Repo release và GitLab client dùng quy trình xuất bản trong `AGENTS.md`.

## Prompt để đưa cho Claude

> Đọc `AGENTS.md` và `docs/qa-claude-handoff.md` trong repo `phuocthan/TarvernDropTPT`. Chạy suite QA hiện tại để có kết quả ban đầu. Triển khai ưu tiên 1 bằng Playwright TypeScript và mock đã có. Kiểm tra trên một bản Tavern Drop local. Dùng trạng thái và sự kiện để assert, dùng ảnh hoặc trace làm bằng chứng. Xác minh lại ca mới và các ca liên quan, rồi báo đã test gì, lỗi nào tái hiện, và file báo cáo nằm ở đâu. Làm việc trên repo phát triển. Mọi thao tác đăng Trello, release hoặc GitLab cần chỉ định riêng.
