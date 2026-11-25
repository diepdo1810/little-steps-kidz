# Little Steps

Ứng dụng học tập offline-first cho trẻ, gồm ba trò chơi đếm, ghép bóng và nối hình giống nhau. Ứng dụng không có tài khoản, backend, quảng cáo, theo dõi hay nội dung tải từ bên ngoài. Audio tiếng Việt đang tắt vì repo chưa có bản thu được cấp phép.

## Chạy web

Yêu cầu Node.js `^22.22.2 || ^24.15.0 || >=26.0.0` và pnpm `11.25.0`.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Để build và kiểm tra offline web:

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
```

Service worker cache các file cùng origin trong production build. Kết nối internet không cần cho các trò sau khi app đã tải/cài đặt đầy đủ.

## Build Android debug APK

Yêu cầu JDK 21, Android SDK Platform 36 và Android SDK Build Tools tương thích. Không cần signing key cho debug APK. Cài SDK, chấp nhận licenses, đặt `ANDROID_HOME` hoặc `ANDROID_SDK_ROOT`, sau đó chạy:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm exec cap sync android
cd android
./gradlew assembleDebug
```

APK đầu ra: `android/app/build/outputs/apk/debug/app-debug.apk`. Cài lên thiết bị đã kết nối bằng `adb install -r app/build/outputs/apk/debug/app-debug.apk`. App ID tạm thời cho bản local là `com.littlesteps.learning`; đổi trước khi phát hành công khai.

Android đổi sang landscape khi có màn hình trò chơi và trả về hướng cảm biến mặc định ở màn hình người lớn. Nút Back trong phiên dừng phiên hiện tại; ở màn hình người lớn nó quay lại trang trước. App không tự tạo phiên mới. Không cần quyền mạng hoặc quyền runtime cho MVP.

## CI build APK

GitHub Actions workflow `.github/workflows/android-apk.yml` chạy khi có push, pull request vào `main`, hoặc chạy thủ công. Workflow chạy unit/E2E tests, typecheck, sync Capacitor và build APK debug. Sau khi thành công, tải APK ở mục **Actions → workflow run → Artifacts**; artifact được giữ trong 14 ngày. Không cần signing secret vì đây là APK debug, chưa dùng để phát hành lên cửa hàng.

Xem trạng thái kiểm thử và blocker của môi trường build hiện tại tại [docs/verification.md](docs/verification.md).
