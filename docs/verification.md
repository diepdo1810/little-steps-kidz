# Little Steps 1.1 — Verification

Ngày kiểm tra 2026-11-25 trên nhánh `feature/little-steps-v1`.

## Web

| Lệnh | Kết quả |
| --- | --- |
| `pnpm test` | 130 unit tests passed in 10 files |
| `pnpm typecheck` | Passed |
| `pnpm build` | Passed. The production bundle includes the versioned service worker and local asset cache. |
| `pnpm exec playwright test --list` | 44 browser tests in 2 files |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium pnpm test:e2e` | Local Chromium launch blocked. The wrapper exits 127 because `/usr/lib/chromium/chromium` is absent. |
| `pnpm exec cap sync android` | Passed. Synced the production web bundle and Preferences plugin. |

The browser suite covers one- and five-item boards, matching across Connect subsets, safe-area reflow, full-screen layout at 568×320 and 800×360, portrait rotation, adult settings, and five rounds ending the default session. It also checks that a 15-minute background interval preserves progress and that reload, data clearing, Android Back, cross-tab writes, offline use, and quiet mode retain their expected behavior.

GitHub Actions run `45593096587` passed 42 of 43 browser tests. The drag test rejected a horizontal SVG preview because Playwright's visibility check required a positive bounding-box height. The test now checks the actual SVG stroke length and still verifies that the same session stays active and records one round after a 15-minute clock advance. Review of the run's 568×320 screenshots covered preparation and all three games. The next run will verify the test fix, the reordered Connect subset, and full target visibility at 400×320 with safe-area insets.

## Android and GitHub Actions

The Android activity requests `sensorLandscape` at launch. The package declares the `game` category and is version 1.1 (`versionCode 2`). This environment lacks Android SDK tools and a cached Gradle distribution. The local Capacitor sync verifies the web bundle, while Android compilation and APK delivery run in GitHub Actions.

The workflow at `.github/workflows/android-apk.yml` installs Android API 36 build tools and Chromium, runs the verification suite, and builds `assembleDebug`. It uploads the test results and landscape screenshots as `browser-checks-*` and the debug APK as `little-steps-debug-apk-*`. Both artifacts are retained for 14 days.

## Device checks

- Install the debug APK and cold launch in airplane mode.
- Rotate each way in landscape and verify orientation through Home, preparation, play, and end. Check real safe areas and the spacing of touch targets.
- Exercise drags, Android Back, background and foreground transitions, reload recovery, and data clearing on the target WebView.
- Review the illustrations. Vietnamese recordings are absent, so audio playback remains outside verification.
