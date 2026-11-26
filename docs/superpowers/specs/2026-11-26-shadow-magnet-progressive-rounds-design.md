# Little Steps — hút hình khi kéo qua bóng và lượt tăng giảm

**Trạng thái:** Người dùng duyệt triển khai ngày 2026-11-26. Bản này thay thế quy tắc ngẫu nhiên 1–5 và lựa chọn số lượt 5–30 trong thiết kế phiên trước.

## Mục tiêu

Giúp trẻ có thể ghép bóng khi điều khiển kéo chưa chính xác. Phiên học có số lượt vừa đủ và độ khó đi lên rồi đi xuống, không dùng đồng hồ hay điểm số.

## Hành vi đã thống nhất

- Phụ huynh chọn tổng số lượt nguyên từ **5 đến 10**; mặc định đề xuất là 5. Hết số lượt đã chọn thì phiên kết thúc. Không có giới hạn phút hoặc điểm.
- Số hình/đôi hình của lượt 1–10 lần lượt là **1, 2, 3, 4, 5, 5, 4, 3, 2, 1**. Phiên ngắn dùng phần đầu của chuỗi. Áp dụng cho cả ba trò: Đếm đồ vật, Nối hình giống nhau và Ghép hình với bóng.
- Trong Ghép hình với bóng, khi đang kéo, nếu hình đi vào vùng hút của bóng đúng thì hình tự hút vào và ghép ngay; không cần nhấc ngón tay. Nếu đi vào vùng của bóng sai, hình trở về ô ban đầu và thao tác kéo kết thúc để trẻ thử lại. Không trừ lượt hoặc điểm.
- Vùng hút mở rộng theo kích thước bóng, không dùng một khoảng cách pixel cố định. Việc kiểm tra theo đường kéo để tránh vuốt nhanh xuyên qua bóng mà không được nhận.
- Nếu một cú kéo lướt qua nhiều bóng, xử lý bóng đầu tiên trên đường kéo. Ví dụ: trẻ kéo hình Cà rốt từ trái sang phải, đi qua bóng Dưa chuột sai trước rồi mới đến bóng Cà rốt đúng; hình quay về chỗ cũ ngay tại bóng Dưa chuột. Trò chơi không tiếp tục xét bóng Cà rốt phía sau.
- Giữ nguyên giao diện ngang, hình lớn, thao tác chạm chọn dự phòng, hoạt động offline và bảo vệ phiên hiện có. Không thêm game, điểm, phần thưởng hay chữ hướng dẫn cho trẻ.

## Cách tiếp cận

- **Khoảng cách cố định:** dễ làm nhưng cảm giác hút sẽ khác nhau giữa màn hình nhỏ và lớn.
- **Vùng hút theo kích thước bóng, xét trong lúc kéo:** tự điều chỉnh theo bố cục và nhận cả khi ngón tay đi qua bóng. Đây là cách được đề xuất cho yêu cầu hiện tại.

## Tương thích

- Biên vùng hút ban đầu và thời gian hiệu ứng hút/trả hình; bắt đầu với vùng vừa phải theo kích thước bóng và kiểm tra lại với video thao tác của trẻ nếu được cung cấp.
- Cài đặt số lượt cũ 15–30 được chuẩn hóa về 10, giữ nguyên trò, chủ đề, âm thanh và giảm chuyển động.
- Phiên đang chạy có giới hạn cũ trên 10 không tiếp tục vì vượt mức mới; app dùng luồng kết thúc phiên an toàn để người lớn bắt đầu phiên mới.

## Xác minh

Kiểm tra chuỗi lượt ở phiên 5 và 10 lượt, tất cả ba trò dùng đúng số lượng theo lượt, không có timer. Với Ghép bóng, kiểm tra đi qua bóng đúng thì ghép ngay khi chưa nhấc tay; đi qua bóng sai thì hình trở về vị trí ban đầu; vuốt nhanh qua vùng bóng vẫn được nhận; bố cục nhỏ/lớn giữ vùng chạm tách bạch. Chạy unit, typecheck, build, browser E2E và build APK trên CI.

### Kết quả xác minh

- `pnpm test` đạt 181 kiểm thử trong 12 tệp. `pnpm typecheck`, `pnpm build` và `git diff --check` đều thành công.
- Môi trường cục bộ thiếu tệp thực thi `/usr/lib/chromium/chromium` mà `/usr/bin/chromium` gọi. Playwright sẽ chạy trên GitHub Actions sau khi đẩy nhánh. Workflow `Android APK` tải ảnh kiểm thử thao tác ghép bóng và bố cục ngang, rồi tạo APK debug khi các bước kiểm thử thành công.
