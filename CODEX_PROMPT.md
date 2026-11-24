# Lệnh giao việc cho Codex

Đóng vai senior Vue/TypeScript + Capacitor engineer và agent orchestrator. Triển khai Little Steps V1 trong repo hiện tại dựa trên:
- `docs/superpowers/specs/2026-11-24-little-steps-v1-design.md`
- `docs/superpowers/plans/2026-11-24-little-steps-v1.md`

Đọc AGENTS.md (nếu có), spec và plan trước. Tôi đã chọn cả 3 game landscape, Visual First: không chữ trên màn hình trẻ ngoại trừ đáp án số, không quảng cáo/điểm/nhạc nền, offline, giới hạn phiên. Ưu tiên game nối hình giống bài tập giấy. Không mở rộng phạm vi.

Dùng Superpowers nếu có: `using-git-worktrees`, `test-driven-development`, `subagent-driven-development`, `requesting-code-review`, `verification-before-completion`. Bạn được phép tạo native subagent để thực hiện từng task và review; hãy dùng khi công cụ hỗ trợ. Main agent chốt contract, giữ ledger và tích hợp. Mỗi worker nhận brief riêng, ownership file, test, commit/report; reviewer độc lập kiểm tra spec compliance và code quality. Mặc định tuần tự SDD; chỉ song song các việc độc lập/read-only hoặc tách worktree riêng với contract đóng băng và file ownership không giao nhau. Nếu không có subagent, thực hiện inline và nói rõ. Không để worker tạo thêm worker. Không giả lập kết quả agent.

Nếu repo rỗng hãy scaffold; nếu đã có code, tái sử dụng. Tạo feature branch/worktree, không ghi main/master. Áp dụng red/green TDD từng task, lưu progress ledger, không hỏi lại các yêu cầu đã có. Chỉ dừng hỏi khi thật sự bị chặn hoặc cần thao tác phá hủy/bảo mật/remote. Không push, merge remote, publish, tạo cloud hoặc chi phí bên ngoài nếu tôi chưa yêu cầu.

Kết thúc: chạy test/typecheck/build/e2e; build debug APK nếu SDK có sẵn; kiểm tra offline, landscape, touch, session background/reload/expiry. Báo cáo commit, file, test output, APK path đã xác minh, screenshot và blocker. Không tuyên bố đã kiểm thử thiết bị thật nếu chưa có thiết bị. Nếu thiếu audio/SDK, ghi rõ phần chưa hoàn tất, vẫn bàn giao phần chạy được. Hãy bắt đầu bằng việc đọc spec, plan và kiểm tra repo, sau đó thực thi các task theo thứ tự.
