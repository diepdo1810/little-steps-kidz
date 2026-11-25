# Little Steps V1 — Verification

Ngày kiểm tra: 2026-11-25. Nhánh: `feature/little-steps-v1`.

## Web verification

| Lệnh | Kết quả gần nhất |
| --- | --- |
| `pnpm test` | 114 unit tests passed |
| `pnpm typecheck` | Passed |
| `pnpm build` | Passed; generated versioned service worker and local asset cache |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=<local-headless-shell> pnpm test:e2e` | 37 browser tests passed, including settings conflicts, safe-area changes, recovery, and Android Back during start/resume |
| `pnpm exec cap sync android` | Passed; copied the production web bundle and registered Preferences plugin |

The browser suite covers all three games, deadline handling, settings validation and cross-tab conflicts, interrupted session recovery, inset changes during adult setup and play, cross-tab writes, offline reload, text restrictions, and Android Back event routing including interrupted start and resume. It does not replace a physical device test. The independent whole-branch review found no remaining Critical, Important, or Minor code findings after fixes.

## Android build blocker

`./gradlew assembleDebug` could not start because the Gradle wrapper distribution is not cached and this execution environment cannot reach `services.gradle.org` (`java.net.SocketException: Network is unreachable`). No Android SDK, `adb`, `sdkmanager`, emulator, or `ANDROID_HOME`/`ANDROID_SDK_ROOT` was available during inspection. The debug APK therefore does not exist in this workspace; no APK path or checksum is reported.

The project uses Capacitor Android 8.6.2, Gradle wrapper 8.14.3, Android Gradle Plugin 8.13.0, JDK 21 in this environment, and compile/target SDK 36. Android source/config is present and `cap sync` passed, but Java/Gradle compilation is unverified until the wrapper and Android SDK are available.

The manifest classifies this educational mini-game app as `game`, so Android 16's large-screen orientation exception applies. The native orientation behavior still needs a device/emulator check.

## GitHub Actions APK build

`.github/workflows/android-apk.yml` runs on every branch push, pull requests targeting `main`, and manual dispatch. It runs unit tests, typecheck and browser tests, installs Android API 36 build tools, syncs the Capacitor project, builds `assembleDebug`, and uploads `app-debug.apk` as a 14-day Actions artifact. This environment has not executed the GitHub-hosted workflow yet; confirm the first remote run before treating the APK artifact as verified.

## Native and release checks still pending

- Install and cold launch on an Android emulator or physical device in airplane mode.
- Verify orientation transitions, system Back, touch/drag, WebView resume, background expiry, reload recovery, and data clearing on the target WebView.
- Confirm screenshot appearance and target sizes on the actual device. Adult review of the original illustrations remains a release check.
- Vietnamese recordings are not present; audio stays muted and audible playback is not tested.
- Store publishing, signing, and public release are out of scope.
