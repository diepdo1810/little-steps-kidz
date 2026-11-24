# Little Steps V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build offline Android/web learning app with 3 landscape games and adult-controlled finite sessions.

**Architecture:** Vue game views consume pure TS engines and a shared asset catalog; the app shell owns session lifecycle and navigation. Capacitor wraps the same local web bundle for Android.

**Tech Stack:** Vue 3, TypeScript, Vite, pnpm, Capacitor Android, CSS, Pointer Events, SVG, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-24-little-steps-v1-design.md`

## Global Constraints
- Read spec fully; it is the authority. All 3 games landscape, no visible instructional text in child mode except counting numerals; accessible invisible labels allowed.
- No backend, login, ads, tracking, external API/CDN, scores, rewards, streaks, auto-level, or auto-restart. Assets and audio local, no emoji production assets.
- Minimum 48 CSS px touch target, no flashing, penalties or mandatory audio; always stop available. Session defaults 5 minutes and 3 rounds; options 5/10/15 minutes and 1–10 rounds, first limit ends session.
- Offline APK and cached web; retain absolute session deadline through reload/background. No identifying child data; settings/session local only.
- Use original/licensed assets; no publishing, pushing or merging remote without owner authorization. No claiming tests/build/device pass without evidence.

## Review Focus
1. Expiry during drag/feedback, background/resume/reload or clock rollback: no extra time or completion after expiry (tasks 2, 7).
2. Multi-touch, pointercancel, scrolling/resizing or duplicate events: no stuck drag or duplicate complete (tasks 3, 4, 5).
3. Invalid or undersized asset pool / identical permutation / wrong pair: no broken board or impossible exercise (tasks 1, 3, 4, 5).
4. Small landscape and 5–6 rows: never reduce target below 48px; disable unsuitable level clearly in adult settings (tasks 3, 7).
5. Offline reload, storage failure, audio failure: core tasks remain usable or stop safely, never silently reset time (tasks 2, 6, 7).

## Agent execution protocol
Main agent inspects repo, reads AGENTS.md, verifies tools/SDK, creates feature branch/worktree and records task ledger with commits, tests, blockers and decisions. If empty repo, scaffold; if existing project, preserve conventions and avoid replacing unrelated files. Do not implement on main/master. Use `using-git-worktrees`, `test-driven-development`, `requesting-code-review`, `verification-before-completion` where available. Use fresh implementer per task and a fresh reviewer (spec compliance + quality); scope agents to their listed files. Keep task briefs in files and explicit model selection according to task complexity, not model names hardcoded. If runtime supports native subagents, use them; otherwise implement inline with same gates and disclose fallback. No fake agent results.

Default execution: sequential SDD implementation tasks on one worktree. Independent read-only reviews/asset research may run concurrently via `dispatching-parallel-agents`. If controller explicitly chooses parallel implementation instead, freeze contracts after task 1, use a separate worktree and branch for each independent task (2–5), no shared files or package edits, merge locally in dependency order and run full tests after each integration. Never run multiple writers on a single worktree. Agent 6 and integration must wait for dependent contracts/commits. Main agent owns App shell and package/config changes. Workers do not spawn more workers. Each reviewer receives task brief, report, full commit diff and global constraints. Fix Critical/Important findings before proceeding; final independent review on whole branch. No user confirmation between ordinary tasks once plan is authorized, except destructive/security-sensitive/external operations or genuinely blocking requirements.

## File map / contracts
Paths relative to repo root. Main owns `package.json`, `pnpm-lock.yaml`, configs, `src/App.vue`, `src/main.ts`, `src/styles.css`. Tasks own paths below. Commands target scripts `pnpm test` (vitest run), `pnpm typecheck` (vue-tsc --noEmit), `pnpm build`, `pnpm test:e2e` (playwright test). Setup actual compatible pinned versions; don't guess latest versions. Use injected RNG and clock in pure logic for reproducible tests.

### Task 1: Foundation + shared assets (P0)
**Files:** configs, `src/shared/contracts.ts`, `src/assets/catalog.ts`, `src/assets/catalog.test.ts`, `public/assets/images/`, `public/assets/LICENSES.md`, `src/styles.css`, starter App/main, `tests/` setup. Main agent owns config; asset contributor may prepare files separately.
**Interfaces:**
```ts
export type GameId = 'counting' | 'shadow' | 'connect'
export type ThemeId = 'farm' | 'fruit' | 'sea' | 'vegetable' | 'school'
export type Level = 1 | 2 | 3 | 4 | 5
export interface Settings { game: GameId; theme: ThemeId; level: Level; minutes: 5|10|15; roundLimit: number; audio: boolean; reducedMotion: boolean }
export interface Asset { id: string; theme: ThemeId; image: string; labelVi: string }
export interface GameProps { settings: Settings; assets: readonly Asset[]; active: boolean; roundKey: string }
// Each game component accepts GameProps, emits 'complete' with no payload once and 'stop' with no payload.
export type Rng = () => number
```
Catalog exports `getAssets(theme: ThemeId): readonly Asset[]`, `shuffle<T>(items: readonly T[], rng: Rng): T[]`, `DEFAULT_SETTINGS: Settings` (connect/farm/1/5/3/audio false/reducedMotion true). Keep shuffle nonmutating; reject invalid RNG or pool clearly. 6 original/licensed recognizable images per spec theme, transparent SVG/PNG, license provenance; use SVG masking of same image for silhouette. No external URL or placeholder emoji. If asset generation unavailable, create simple original SVG art; ask adult to verify recognizability before release.
- [ ] Scaffold Vue/TS/Vite, Vitest, Playwright and Capacitor Android dependencies with scripts. Set global touch/style tokens, minimal app root. Pin versions via lockfile.
- [ ] Write failing tests `catalog_has_unique_ids_and_six_assets_per_theme`, `all_asset_paths_exist_and_are_local`, `shuffle_preserves_input_and_elements`, `default_settings_are_finite_and_quiet` (assert 6 per theme, unique IDs, files present, no URL, defaults exact above).
- [ ] Run `pnpm test`; confirm failures before catalog implementation.
- [ ] Implement contracts/catalog/assets/style. Verify all 30 images and licenses; visually inspect contact sheet for clarity and consistency.
- [ ] Run `pnpm test && pnpm typecheck && pnpm build`; commit `feat: establish offline app foundation and asset catalog`.

### Task 2: Session lifecycle and persistence (P0)
**Files:** `src/session/sessionManager.ts`, `src/session/sessionManager.test.ts`, `src/services/storage.ts`, `src/services/storage.test.ts`.
**Interfaces:**
```ts
export type EndReason = 'time'|'rounds'|'stopped'|'invalid'
export interface Session { id:string; settings:Settings; startedAt:number; deadlineAt:number; lastSeenAt:number; completedRounds:number; status:'active'|'ended'; reason?:EndReason }
export interface StorageAdapter { get(key:string):Promise<string|null>; set(key:string,value:string):Promise<void>; remove(key:string):Promise<void> }
export function startSession(id:string, settings:Settings, now:number):Session
export function tick(session:Session, now:number):Session
export function finishRound(session:Session, now:number):Session
export function stopSession(session:Session, now:number):Session
export function decodeSession(raw:string|null, now:number):Session|null
export function createStorage():StorageAdapter
```
Consume task 1 Settings. Use one key each `little-steps.settings.v1` and `little-steps.session.v1`. `tick` expires at `now >= deadlineAt`; if clock goes back before lastSeenAt end invalid; all transitions idempotent for ended sessions. `finishRound` checks time first; increments only active, ends at roundLimit. Persist start and transition before enabling next round; on active persistence failure stop safely. Snapshot settings; reload does not change deadline. App shell owns timers (task 7), native lifecycle subscriptions and serializes round events.
- [ ] Write failing unit tests `ends_at_exact_deadline` (start 1000, 5min -> 301000), `round_limit_three`, `expiry_wins_over_round`, `ended_is_idempotent`, `reload_retains_deadline`, `clock_rollback_ends_invalid`, `corrupt_json_is_rejected`, `storage_errors_propagate`, `invalid_settings_rejected`.
- [ ] Run `pnpm test`; verify failure for missing behavior.
- [ ] Implement pure transitions, runtime validation (allowed enum/ranges, finite timestamps, snapshot), storage adapters, reject invalid data. Corrupt/missing persisted active session cannot automatically start; adult explicit action required.
- [ ] Run `pnpm test && pnpm typecheck`; commit `feat: enforce finite offline learning sessions`.

### Task 3: Connect Matching Game (P0 — first game)
**Files:** `src/games/connect/engine.ts`, `engine.test.ts`, `ConnectGame.vue`, `connect.css`, `ConnectGame.test.ts` (component test if setup supports it).
**Interfaces:** `createBoard(pool: readonly Asset[], pairs: number, rng: Rng): {left:Asset[];right:Asset[]}`; `connectPair(matched: readonly string[], sourceId:string, targetId:string, board:Board): readonly string[]`; `maxPairsForHeight(usableHeight:number, poolSize:number):number` (minimum 48px per row plus 4px gap, clamp 0..6); component accepts GameProps. Board distinct IDs, both columns same set, avoid identical order for >=2 by rotate fallback. Level maps to 2..6. Reject unsupported count, invalid IDs or same side UI attempt. SVG lines derived from actual DOM anchor centers, stored connections by ID, resize recomputes endpoints. Pointer capture, release/cancel cleanup; tap both directions; ignore secondary pointers; hit target via elementFromPoint or rect not pointer-capture event target. Only correct distinct unmatched pair commits, no cross-board state; lock and emit once when complete. No instructional text, only accessible labels.
- [ ] Tests `board_has_unique_equal_sets`, `identical_shuffle_rotates`, `pool_too_small_rejected`, `wrong_pair_preserves_matches`, `duplicate_pair_no_change`, `unknown_pair_rejected`, `height_limits_rows` (104 usable permits 2, 100 permits 2, 99 permits 1 with 48+4 gap), plus component/E2E cases for tap, drag, cancellation, resize, inactive and duplicate events.
- [ ] Run `pnpm test`; confirm red.
- [ ] Implement engine/component. CSS two columns, central gap, responsive targets >=48px. Clear pending pointer and feedback on roundKey/active change; never allow matches after session inactive. No mandatory voice.
- [ ] Run `pnpm test && pnpm typecheck && pnpm build`; commit `feat: add landscape connect-the-pairs game`.

### Task 4: Shadow Matching Game (P1)
**Files:** `src/games/shadow/engine.ts`, `engine.test.ts`, `ShadowGame.vue`, `shadow.css`.
**Interfaces:** `createShadowBoard(pool:readonly Asset[], level:Level, rng:Rng): {sources:Asset[];targets:Asset[];useShadow:boolean}`; `matchShadow(matched:readonly string[], sourceId:string,targetId:string,board:ShadowBoard):readonly string[]`; GameProps component. Levels pairs [1,1,2,3,4], useShadow false only L1. Different layout from connect: two rows, snap to target; mask exact local image with neutral fill. Two input modes, pointer cancel, resize, active/roundKey guard, once-only complete, correct locks.
- [ ] Tests `levels_map_to_exact_pair_counts`, `same_asset_ids_in_sources_targets`, `reject_small_pool`, `wrong_target_preserves`, `correct_pair_locks`, `duplicate_match_no_change`. Add browser acceptance cases tap/drag, wrong drop, cancellation, silhouette source and expiration (task 7).
- [ ] Run `pnpm test` red.
- [ ] Implement engine/component; accessible labels, no visible instruction, no punishment.
- [ ] Run `pnpm test && pnpm typecheck && pnpm build`; commit `feat: add offline shadow matching game`.

### Task 5: Counting Game (P1)
**Files:** `src/games/counting/engine.ts`, `engine.test.ts`, `CountingGame.vue`, `counting.css`.
**Interfaces:** `createQuestion(pool:readonly Asset[], level:Level, rng:Rng):{asset:Asset; quantity:number; choices:number[]}`; `markCounted(indices:readonly number[], index:number, quantity:number):readonly number[]`; GameProps component. Levels exact spec [max=2,3,5,5,10; choices=2,2,2,3,3]. Shuffle unique options, exactly one correct and all within 1..max. Wrong keeps question; repeated object tap no additional count; correct locks immediately and emits once. Round reset keyed by roundKey, inactive ignores taps. 10 objects fit in two rows if needed, no overlapping or tiny touch targets.
- [ ] Tests `all_levels_generate_valid_unique_options` (iterate levels and deterministic RNG values), `answer_is_not_always_same_position`, `empty_pool_rejected`, `count_marks_only_once`, `invalid_index_ignored`. Add browser cases wrong then right, repeated tap, round end and layout.
- [ ] Run `pnpm test` red.
- [ ] Implement engine/component; only visible text numerals; render locally sourced images; expose optional count audio integration via task 6 service, no external dependency.
- [ ] Run `pnpm test && pnpm typecheck && pnpm build`; commit `feat: add counting game with configurable levels`.

### Task 6: Quiet feedback + local audio (P1)
**Files:** `src/services/audio.ts`, `audio.test.ts`, `src/components/Feedback.vue`, `public/assets/audio/vi/`, license manifest entries via controller.
**Interfaces:** `type AudioCue = 'counting'|'shadow'|'connect'|'correct'|'warning'|'end'|\`number-${number}\``; `playCue(cue:AudioCue, enabled:boolean):Promise<void>`; `stopAudio():void`. Audio local and optional. No autoplay before interaction; stop prior playback on new cue, stop on ended/unmount/background; catch play failures without blocking app. Use original recorded/licensed Vietnamese audio (instruction, count 1–10, gentle correct, warning and end); if not available, default muted, document missing files explicitly, no online TTS or fabricated files. Feedback Vue receives `visible:boolean,reducedMotion:boolean`; brief static check or subtle transition.
- [ ] Tests `muted_does_not_play`, `new_cue_stops_previous`, `failed_audio_does_not_throw`, `stop_clears_audio`, `cue_paths_are_local`.
- [ ] Run red `pnpm test`.
- [ ] Implement service and visual feedback, verify asset manifest. Controller wires service into games without crossing worktree boundaries.
- [ ] Run `pnpm test && pnpm typecheck`; commit `feat: add optional quiet Vietnamese feedback`.

### Task 7: App shell, adult controls, offline integration (P0/P1)
**Files:** `src/App.vue`, `src/views/HomeView.vue`, `ParentSettings.vue`, `SessionEnd.vue`, `src/session/useSession.ts`, `src/services/settings.ts`, `src/components/GameLayout.vue`, `src/styles.css`, service worker/config, `tests/learning.spec.ts`. Main agent owns shared integration.
**Interfaces:** consume all game components and manager APIs. GameLayout renders back/stop, optional replay icon, no visible labels. App shell manages roundKey and one round lock; after completion persists count, checks deadline and active before creating new round. Cancel pending UI/audio callbacks on end. On start/resume/visibilitychange/periodic tick verify clock first. Store session snapshot; never allow auto restart. Adult settings text Vietnamese, validates exact allowed values and catalog/height, persistence and clear. End screen only visual + optional audio, adult can explicitly return to settings. Web offline cache local app assets and audio with versioned cache, test production build rather than dev server. Android landscape handled native task 8; web portrait shows rotate icon, stop remains accessible. Settings errors shown to adults, not child.
- [ ] Write browser tests (mock clock/storage where appropriate): `connect_two_pairs_tap_and_drag`, `connect_wrong_pair_cancel_resize`, `connect_small_height_disables_six_pairs`, `shadow_snap_and_wrong_drop`, `count_wrong_then_correct`, `three_rounds_ends_no_restart`, `expiry_during_drag_or_feedback`, `reload_and_background_do_not_extend`, `stop_always_available`, `settings_persist_and_clear`, `no_visible_child_text_except_numbers`, `no_external_requests`, `offline_after_initial_cache`, `storage_failure_stops_safely`, `quiet_mode_no_audio`, `no_overlap_targets_568x320_and_800x360`.
- [ ] Run `pnpm test:e2e` red; fix test harness if needed, distinguish harness failure from feature failure.
- [ ] Wire app shell, settings and games, audio lifecycle, session tick (<=250ms while active), deadline guards on every input/complete, serialized persistence. Implement offline worker cache, use a versioned migration/update strategy. No remote endpoints.
- [ ] Run `pnpm test && pnpm typecheck && pnpm build && pnpm test:e2e`; capture screenshots for each landscape game and adult view, inspect target sizes and clutter. Commit `feat: integrate three games and offline session controls`.

### Task 8: Android APK + final QA (P1)
**Files:** `capacitor.config.ts`, `android/`, `README.md`, `docs/verification.md`.
**Interfaces:** Android app ID `com.littlesteps.learning` (temporary local ID, change before any public release), appName `Little Steps`, webDir `dist`; configure landscape in manifest, handle safe areas and system back (stop or navigate safely, not new session). No unnecessary permissions. Web and native storage adapters use same schema, not necessarily same device data.
- [ ] Verify SDK/JDK/Gradle compatibility against installed Capacitor version; add Android platform if missing. Run `pnpm build`, `pnpm exec cap sync android`, `cd android && ./gradlew assembleDebug` (or documented platform equivalent). Keep signing secrets out of repo. No store publish.
- [ ] Run automated suite again from clean working tree. Review diff, dependency/permission/network scan and licenses; independent whole-branch review. Fix critical/important issues and rerun affected/full tests.
- [ ] Test physical Android or emulator if available: install APK, cold launch airplane mode, all 3 games touch/drag/tap, screen rotate/resize, back, audio toggle, expired during background or drag, reload, clear data, 5-minute session with fake clock in automation and real short validation when possible. Record device/emulator distinction and evidence; physical test if unavailable explicitly pending. Adult review of actual illustrations and suitability is separate.
- [ ] Record APK path/hash, test commands and actual results, screenshots, known limitations/missing audio and exact install/build instructions. Standard debug APK path `android/app/build/outputs/apk/debug/app-debug.apk`, verify existence before claiming. Commit `chore: verify and package Android MVP`.

## Definition of done
All tests actually pass, three landscape games work with finite sessions, no visible text in child mode except numbers, no online dependencies in gameplay, no ads/analytics, correct assets/licenses, and build output verified. APK build or real-device validation unavailable -> report partial with explicit blocker, not complete. No auto-merge/push/publish; present local branch/commit, results, artifacts, and next steps. Do not expand scope without owner approval.
