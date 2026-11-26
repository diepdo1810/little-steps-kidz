# Shadow Magnet and Progressive Rounds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Main agent owns integration, shared interfaces, final verification, and GitHub push. Complete tasks in order; reviewers stay read-only.

**Goal:** Replace random 1–5 task sizes with the approved 5–10 turn sequence and make Shadow Matching catch or return pieces as they pass target zones.

**Architecture:** A pure turn-size function derives each task size from the persisted completed-round count. `useSession` passes that size through `GameProps` to all three games. Shadow drag handling checks the dragged artwork's path against size-relative target zones, then locks a correct match or returns a wrong piece immediately.

**Tech Stack:** Vue 3, TypeScript, Vitest, Vue Test Utils, Playwright, Capacitor Android.

**Spec:** `docs/superpowers/specs/2026-11-26-shadow-magnet-progressive-rounds-design.md`

## Global Constraints

- Session length is an integer from 5 through 10 turns; default remains 5.
- Turn sizes are exactly `1, 2, 3, 4, 5, 5, 4, 3, 2, 1`; shorter sessions use a prefix.
- Counting shows the turn-size number of objects; Connect and Shadow show that number of pairs.
- Shadow correct match locks during drag, before pointer release; wrong shadow returns source and ends drag.
- If one fast drag crosses more than one shadow zone, process first zone along path. Example: carrot passes wrong cucumber shadow before correct carrot shadow; carrot returns at cucumber and does not reach carrot shadow.
- Keep landscape, offline assets, visual-first child screens, existing session guards, and adult-only controls. Add no dependencies, timer, score, reward, game, or child-facing text.
- Migrate saved parent round limits 15–30 to 10. Reject active session snapshots whose saved limit exceeds 10 and show existing safe session-recovery flow.

## Review Focus

- Turn boundary and session restoration: turns 1, 5, 6, and 10 retain the exact sequence and do not advance on reload/background.
- Invalid turn numbers and invalid saved round limits reject safely; legacy settings preserve game, theme, audio, and motion preferences.
- A fast pointer move that starts before a target and ends past it still detects the first crossed target.
- Wrong target crossed before correct target returns the piece immediately; later target on same path cannot match it.
- Pointer cancel, resize, round change, and inactive game cannot trigger stale matches or leave pointer capture active.

---

### Task 1: Define turn progression and migrate round settings

**Files:**
- Create: `src/session/roundProgression.ts`
- Create: `src/session/roundProgression.test.ts`
- Modify: `src/shared/contracts.ts`
- Modify: `src/services/settings.ts`
- Modify: `src/session/sessionManager.test.ts`

**Interfaces:**
- Produces: `roundSizeForTurn(turn: number): number`; `turn` is one-based and valid from 1 through 10. Returns `turn` for 1–5 and `11 - turn` for 6–10. Throws `RangeError` outside that range or for non-integers.
- Produces: `roundLimits` equal to `[5, 6, 7, 8, 9, 10]`.

- [ ] **Step 1: Write failing tests for all ten turn sizes and invalid inputs**

Test `roundSizeForTurn(1..10)` against `[1, 2, 3, 4, 5, 5, 4, 3, 2, 1]`. Assert calls with `0`, `11`, `1.5`, `NaN`, and `Infinity` throw `RangeError`.

- [ ] **Step 2: Run progression tests and verify they fail**

Run: `pnpm test -- src/session/roundProgression.test.ts`
Expected: FAIL because `roundProgression.ts` does not exist.

- [ ] **Step 3: Add `roundSizeForTurn` with explicit one-based bounds**

Create `src/session/roundProgression.ts`. Keep the sequence in one pure function; do not derive it from randomness or wall-clock time.

- [ ] **Step 4: Run progression tests and verify they pass**

Run: `pnpm test -- src/session/roundProgression.test.ts`
Expected: PASS for all ten values and invalid inputs.

- [ ] **Step 5: Write failing round setting and migration tests**

In `sessionManager.test.ts`, expect `roundLimits` to equal `[5, 6, 7, 8, 9, 10]`. Test saved five-field settings with old values 15 and 30 migrate to 10, values 5 and 10 stay unchanged, and recognized seven-field settings continue preserving theme/game/audio/reduced-motion while normalizing old turn count.

- [ ] **Step 6: Run round setting and migration tests to verify they fail**

Run: `pnpm test -- src/session/sessionManager.test.ts`
Expected: FAIL for the old round choices and unmigrated five-field settings.

- [ ] **Step 7: Update round limits and implement saved-settings migration**

Update `roundLimits` to `[5, 6, 7, 8, 9, 10]`. Update `decodeSettings` to recognize historical five-field limits `[5, 10, 15, 20, 25, 30]` and normalize values above 10 to 10. Keep existing seven-field migration for the older settings format. Keep invalid theme/game/booleans rejected.

- [ ] **Step 8: Run settings and session manager tests**

Run: `pnpm test -- src/session/sessionManager.test.ts src/session/roundProgression.test.ts`
Expected: PASS for progression, setting migration, session limits, and safe rejection of stale active snapshots.

- [ ] **Step 9: Commit progression and setting migration**

```bash
git add src/session/roundProgression.ts src/session/roundProgression.test.ts src/shared/contracts.ts src/services/settings.ts src/session/sessionManager.test.ts
git commit -m "feat: define progressive lesson rounds"
```

### Task 2: Pass deterministic task size to all games

**Files:**
- Modify: `src/shared/contracts.ts`
- Modify: `src/session/useSession.ts`
- Modify: `src/App.vue`
- Modify: `src/games/counting/engine.ts`
- Modify: `src/games/counting/engine.test.ts`
- Modify: `src/games/counting/CountingGame.vue`
- Modify: `src/games/counting/CountingGame.test.ts`
- Modify: `src/games/connect/ConnectGame.vue`
- Modify: `src/games/connect/ConnectGame.test.ts`
- Modify: `src/games/shadow/engine.ts`
- Modify: `src/games/shadow/engine.test.ts`
- Modify: `src/games/shadow/ShadowGame.vue`
- Modify: `src/games/shadow/ShadowGame.test.ts`

**Interfaces:**
- Consumes: `roundSizeForTurn(turn: number): number` from Task 1.
- Produces: `GameProps.roundSize: number`, populated from `roundSizeForTurn(session.completedRounds + 1)` while a session is active.
- Produces: `createQuestion(pool: readonly Asset[], quantity: number, rng: Rng): CountingQuestion` and `createShadowBoard(pool: readonly Asset[], pairs: number, rng: Rng): ShadowBoard`.
- `useSession` returns `roundSize` as 1 when no session is active. During an active session it uses the current `completedRounds + 1` turn.

- [ ] **Step 1: Write failing engine tests for explicit sizes 1 and 5**

Assert counting question has `quantity` items and three distinct choices in 1–5 for requested sizes 1 and 5. Assert Shadow source and target arrays have requested 1 or 5 pairs. Keep asset selection and arrangement randomized.

- [ ] **Step 2: Run engine tests and verify they fail**

Run: `pnpm test -- src/games/counting/engine.test.ts src/games/shadow/engine.test.ts`
Expected: FAIL because engines still sample quantity internally.

- [ ] **Step 3: Make counting and shadow engines accept explicit size**

Change signatures to the Interfaces above. Reject size outside integer 1–5 with `RangeError`. Remove calls to `sampleRoundSize` from those engines.

- [ ] **Step 4: Run engine tests and verify they pass**

Run: `pnpm test -- src/games/counting/engine.test.ts src/games/shadow/engine.test.ts`
Expected: PASS for sizes 1 and 5, invalid sizes, distinct choices, and full-board pair counts.

- [ ] **Step 5: Pass the active session turn size through the app**

Add `roundSize` to `GameProps`. In `useSession`, expose current size from `session.completedRounds + 1`; pass it through `App.vue`. On each game’s `roundKey` change, call its engine with `props.roundSize`. Keep round-size changes synchronized with the persisted completed-round index.

- [ ] **Step 6: Update game component tests for deterministic task size**

Set `roundSize: 1` and `roundSize: 5` in component tests. Verify Counting renders the exact object count, Connect renders the exact pair count across subsets, and Shadow renders the exact pair count. Verify reload/activation does not redraw the current task size.

- [ ] **Step 7: Run all unit tests and typecheck**

Run: `pnpm test`
Expected: all unit tests PASS.

Run: `pnpm typecheck`
Expected: exit code 0.

- [ ] **Step 8: Commit deterministic game sizing**

```bash
git add src/shared/contracts.ts src/session/useSession.ts src/App.vue src/games/counting src/games/connect/ConnectGame.vue src/games/connect/ConnectGame.test.ts src/games/shadow
git commit -m "feat: use progressive size across games"
```

### Task 3: Catch correct Shadow matches during drag and return wrong pieces

**Files:**
- Create: `src/games/shadow/dragGeometry.ts`
- Create: `src/games/shadow/dragGeometry.test.ts`
- Modify: `src/games/shadow/ShadowGame.vue`
- Modify: `src/games/shadow/ShadowGame.test.ts`
- Modify: `src/games/shadow/shadow.css` only if needed for a clear return/snap state.

**Interfaces:**
- Consumes: `GameProps.roundSize` and Shadow board from Task 2.
- Produces: `Point { x: number; y: number }`, `TargetRect { id: string; left: number; top: number; right: number; bottom: number }`, and `firstTargetOnDragPath(startCenter: Point, endCenter: Point, artworkSize: { width: number; height: number }, targets: readonly TargetRect[]): string | undefined`.

- [ ] **Step 1: Write failing geometry tests**

Cover a path crossing one zone, a path crossing wrong then correct zones, no hit, a tangent/equal-edge hit, and a target reached by the final pointer-up segment. Assert result is earliest target along path; equal-time ties use target DOM order.

- [ ] **Step 2: Run geometry tests and verify they fail**

Run: `pnpm test -- src/games/shadow/dragGeometry.test.ts`
Expected: FAIL because helper does not exist.

- [ ] **Step 3: Implement scaled hit zones and first-crossed-target selection**

Expand each target rectangle by half the dragged artwork dimensions plus a margin equal to 35% of the target’s shorter side. Intersect the artwork-center segment with expanded rectangles. Return the target with smallest path fraction; use DOM order only for exact ties.

- [ ] **Step 4: Run geometry tests and verify they pass**

Run: `pnpm test -- src/games/shadow/dragGeometry.test.ts`
Expected: PASS for crossings, no-hit paths, and ordering.

- [ ] **Step 5: Write failing Shadow interaction tests**

Assert a correct crossing fills the target and emits completion before `pointerup`. Assert wrong crossing restores source, leaves target/source unlocked, clears drag preview and pointer capture, and allows a fresh retry. Assert a single fast move crossing wrong then correct returns at wrong first and never matches later target.

- [ ] **Step 6: Run Shadow interaction tests to verify they fail**

Run: `pnpm test -- src/games/shadow/ShadowGame.test.ts`
Expected: FAIL because matching still waits for pointer release and accepts only exact target rectangles.

- [ ] **Step 7: Apply path results during pointer movement**

Track previous artwork-center position in `Gesture`. After movement exceeds current 6px drag threshold, evaluate each segment against unmatched targets. A correct ID commits once, clears drag, and releases pointer capture without waiting for `pointerup`. A wrong ID clears drag, releases capture, and restores source immediately. Process the final segment on `pointerup` so sparse event delivery cannot skip a target. Preserve stationary tap and keyboard fallback. Clear `gesture` before releasing capture so `lostpointercapture` cannot process the same result twice.

- [ ] **Step 8: Run Shadow tests and all unit tests**

Run: `pnpm test -- src/games/shadow`
Expected: PASS for engine, geometry, and component tests.

Run: `pnpm test`
Expected: all unit tests PASS.

- [ ] **Step 9: Commit Shadow drag behavior**

```bash
git add src/games/shadow
git commit -m "feat: magnet shadow matches during drag"
```

### Task 4: Verify learning flow in browser and Android CI

**Files:**
- Modify: `tests/learning.spec.ts`
- Modify: `README.md` if it describes random task sizes or old 5–30 round options.
- Modify: `docs/superpowers/specs/2026-11-26-shadow-magnet-progressive-rounds-design.md` only for final decisions/evidence.

**Interfaces:**
- Consumes: completed tasks and current `roundSize`.
- Produces: browser-level proof of turn progression and live Shadow catch/return.

- [ ] **Step 1: Add browser tests for preparation and session sequences**

Assert selector offers every integer 5–10. Assert a 5-round session uses sizes 1 through 5 and ends after round 5. Assert a 10-round session uses exactly `[1, 2, 3, 4, 5, 5, 4, 3, 2, 1]` and ends after round 10. Reuse visible game interactions; do not mock session completion.

- [ ] **Step 2: Add browser tests for Shadow pass-through behavior**

Using real Playwright mouse movement, assert correct shadow match appears before mouse release. Assert passing through wrong shadow returns source before release, then allow a retry. Include a one-step fast move that crosses a target.

- [ ] **Step 3: Run browser tests locally when Chromium exists**

Run: `pnpm test:e2e`
Expected: all browser tests PASS. If local Chromium is unavailable, record that limitation and rely on GitHub Actions browser run.

- [ ] **Step 4: Update product documentation and review scope**

Remove obsolete random 1–5 wording and 5–30 round options from README. Preserve offline, no-timer, and child-facing text constraints. Record any test-environment limit in the spec evidence section.

- [ ] **Step 5: Run full local verification**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: all unit tests pass, typecheck exits 0, production build succeeds.

- [ ] **Step 6: Commit browser tests and documentation**

```bash
git add tests/learning.spec.ts README.md docs/superpowers/specs/2026-11-26-shadow-magnet-progressive-rounds-design.md
git commit -m "test: verify progressive rounds and shadow drag"
```

- [ ] **Step 7: Push feature branch and verify CI artifacts**

Push only `feature/little-steps-v1`; do not merge PR. Verify unit tests, typecheck, browser tests, and Android debug APK build on the final commit. Inspect browser artifacts for correct magnet behavior and board spacing.
