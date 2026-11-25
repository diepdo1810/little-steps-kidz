# Landscape Simple Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task.

**Goal:** Deliver approved landscape-only, random 1–5, rounds-only Little Steps.
**Architecture:** Retain Vue shell/pure engines and native wrapper, change shared settings/session contract and then UI. Keep persistence locking and offline behavior.
**Tech Stack:** Vue/TS, Capacitor, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-11-25-landscape-simple-session-design.md

## Global Constraints
- Only random 1–5, all games; no level or session duration. Default 5 rounds; choices 5/10/15/20/25/30.
- All screens landscape; no visible child text except counting answers; stop accessible.
- >=48px touch targets, >=16px gaps, no overlapping/scrolling game boards at 568×320 and 800×360. Split a connect board if needed without adding rounds or discarding pairs.
- Offline assets only; no feature expansion. Preserve safe storage and explicit adult start. Old timed sessions cannot resume.
- User approved implementation, prior GitHub push and APK CI; no merge or publish.

## Review Focus
- Legacy settings/session data: normalize known settings, end legacy timed sessions safely.
- Random 1 or 5 pairs: solvable, no identical shuffle at >=2, no duplicate completion.
- Tiny landscape/safe insets: spacing and touch sizes; all sampled connect pairs completed across subsets.
- Background/reload >15 minutes: no time expiry, completed rounds remain unchanged.
- Start/stop/save races and portrait: no interaction while unavailable; stop remains accessible.

### Task 1: Rounds-only session and random engines
**Files:** src/shared/contracts.ts, src/assets/catalog.ts and test, src/session/*, src/services/settings.ts, src/games/* engines/components/tests (logic only). Do not edit CSS, App.vue or adult views.
**Interfaces:** Settings contains game/theme/roundLimit/audio/reducedMotion only (remove Level if no longer used); Session has explicit schema version and no deadlineAt. Existing manager APIs retained. settings.ts exposes roundLimits, gameNames, themeNames, localCues, boardInset and unavailableReason; temporary legacy exports may remain only until Task 2 removes their callers. Engines create counting question and shadow boards in fixed random1–5 mode; injectable RNG. Connect createBoard allows 1–5; component samples once per round. Keep task2 integration points documented.
- [ ] Add/change unit tests proving default5, allowed multiples, no expiry after long time, corruption/legacy validation, one/five random bounds, distinct answers and pair sets. Run red.
- [ ] Implement models, migration and all game random logic while preserving persistence protections. Keep UI temporarily compatible if necessary; report expected compile dependency on Task2.
- [ ] Run unit tests and commit.

### Task 2: Landscape and spacious interface integration
**Files:** src/App.vue, src/views/*, src/styles.css, src/components/GameLayout.vue, src/games/* CSS and ConnectGame.vue paging logic, src/services/settings.ts if needed, src/session/useSession.ts native orientation glue, android/app/src/main/*, tests/*.spec.ts, README.md, docs/verification.md.
**Interfaces:** consumes Task1 settings/session/engine contracts. Add separate adult preferences screen; preparation only theme/rounds/Start with chosen game name. Use full-height learning board plus side gutter controls; ensure five pairs fit or page connect subsets preserving same sampled board and completedRounds.
- [ ] Update browser expectations and add no-duration, random endpoints, five rounds, global portrait, compact setup, distinct preferences, spacious 1/5 layouts and sub-board completion cases; run affected tests red.
- [ ] Implement UI/CSS/native landscape from launch and remove obsolete orientation unlock. Preserve Stop and no visible child text.
- [ ] Run pnpm test, pnpm typecheck, pnpm build, pnpm test:e2e; capture landscape setup/connect/shadow/counting screenshots and visually inspect them.
- [ ] Sync Capacitor; update verification with actual results, commit.

### Task 3: Independent review, integrate and APK
**Files:** documentation/workflow only if failure warrants changes.
- [ ] Independently review complete change, fix important findings and recheck affected tests.
- [ ] Push reviewed code to existing feature branch using authenticated GitHub tools; do not merge main.
- [ ] Wait for CI APK artifact and report exact run/commit/result. Device testing pending if unavailable.
