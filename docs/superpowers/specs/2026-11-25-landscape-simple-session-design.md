# Little Steps — ngang xuyên suốt, phiên học đơn giản

Approved in conversation 2026-11-25; supersedes conflicting difficulty, timer and layout requirements in the V1 spec. User explicitly approved implementation; continue without another approval gate.

## Intent and scope
Make all screens landscape and all three games spacious and easy to touch. Keep offline, quiet visual-first MVP; no new games, rewards or services.

## Approved behavior
- APK stays sensor-landscape from launch through home, preparation, play and end. Web shows the same icon-only rotate prompt on every portrait screen; stop remains available for an active session.
- Select game on home. Preparation shows game name, theme, rounds and Start only. Default 5 rounds; step 5, choices 5/10/15/20/25/30 (implementation choice: finite simple menu).
- Single random 1–5 mode. No level selector; counting generates 1–5 objects with three distinct numeric choices from 1–5. Matching generates 1–5 pairs per full round; shadow always uses silhouettes.
- No session time limit, no countdown, warning or deadline. Stop and completed rounds end a session. Preserve completed rounds through reload/background, explicit adult start and safe persistence/corruption handling.
- Separate adult settings view for optional audio/reduced motion/data clearing; never clutter preparation. Home settings opens this view, end/settings returns preparation for selected game.
- Spacious boards use available width/height; >=48px touch areas, >=16px gap between neighboring choices/tiles where supported. Compact controls occupy side gutter instead of taking a full height row. No scroll in learning or normal preparation at 568×320 and 800×360.
- Connect retains two sides and wide central drawing area. If five pairs cannot fit with spacing, split the sampled board into subsets; complete only after all sampled pairs, never silently reduce sampled count.

## Approaches
Chosen: simplify existing Vue/Capacitor flow, remove timer/levels from model, adapt existing Pointer Events boards. Rebuilding with a game engine adds scope; merely hiding old controls leaves unexpected expiry and cramped boards, so both are rejected.

## Compatibility and validation
Preserve recognized old theme/game/audio preferences via explicit settings migration, normalize old round count to a valid multiple of five; legacy timed active sessions end safely rather than resume under changed rules. Current session shape/version must reject old deadlines. Validate random endpoints 1 and 5, one-pair matches, five-pair layouts, reload/background without expiry, stop, storage errors, portrait and safe areas. Real Android device testing remains manual; CI produces debug APK.
