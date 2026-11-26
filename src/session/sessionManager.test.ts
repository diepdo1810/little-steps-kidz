import { expect, it } from 'vitest'
import { decodeSettings, roundLimits } from '../services/settings'
import type { Settings } from '../shared/contracts'
import { decodeSession, finishRound, startSession, stopSession, tick, type Session } from './sessionManager'

const settings: Settings = {
  game: 'counting',
  theme: 'fruit',
  roundLimit: 5,
  audio: false,
  reducedMotion: true,
}

const active: Session = {
  version: 2,
  id: 'session-1',
  settings,
  startedAt: 1_000,
  lastSeenAt: 1_000,
  completedRounds: 0,
  status: 'active',
}

const legacySettings = {
  ...settings,
  level: 2,
  minutes: 5,
  roundLimit: 3,
  audio: true,
  reducedMotion: false,
}

it('starts a versioned session with rounds-only settings', () => {
  expect(startSession('session-1', settings, 1_000)).toEqual(active)
})

it('offers and accepts round choices from 5 through 10', () => {
  expect(roundLimits).toEqual([5, 6, 7, 8, 9, 10])
  for (const roundLimit of [5, 6, 7, 8, 9, 10]) {
    expect(startSession('session-1', { ...settings, roundLimit }, 1_000).settings.roundLimit).toBe(roundLimit)
  }
})

it('ends on the fifth completed round even with long gaps between rounds', () => {
  let session = startSession('session-1', settings, 1_000)
  for (let completed = 1; completed < 5; completed++) {
    session = finishRound(session, completed * 1_000_000)
    expect(session).toMatchObject({ completedRounds: completed, status: 'active' })
  }

  expect(finishRound(session, 5_000_000)).toMatchObject({
    completedRounds: 5, status: 'ended', reason: 'rounds',
  })
})

it('ended_is_idempotent', () => {
  const stopped = stopSession(active, 2_000)

  expect(stopped).toMatchObject({ completedRounds: 0, status: 'ended', reason: 'stopped' })
  expect(tick(stopped, 301_000)).toEqual(stopped)
  expect(finishRound(stopped, 3_000)).toEqual(stopped)
  expect(stopSession(stopped, 1_000)).toEqual(stopped)
  expect(decodeSession(JSON.stringify(stopped), 301_000)).toEqual(stopped)
})

it('reload retains the completed round count regardless of elapsed time', () => {
  const stored = JSON.stringify({ ...active, completedRounds: 1, lastSeenAt: 2_000 })

  expect(decodeSession(stored, 5_000_000)).toEqual({
    ...active,
    completedRounds: 1,
    lastSeenAt: 5_000_000,
  })
})

it('clock_rollback_ends_invalid', () => {
  const session = { ...active, lastSeenAt: 3_000, completedRounds: 1 }
  const expected = { ...session, status: 'ended', reason: 'invalid' }

  expect(tick(session, 2_999)).toEqual(expected)
  expect(finishRound(session, 2_999)).toEqual(expected)
  expect(decodeSession(JSON.stringify(session), 2_999)).toEqual(expected)
})

it('corrupt_json_is_rejected', () => {
  expect(decodeSession('{"status":', 2_000)).toBeNull()
  expect(decodeSession(null, 2_000)).toBeNull()
})

it.each([
  [{ ...legacySettings }, 5],
  [{ ...legacySettings, roundLimit: 6 }, 10],
])('migrates recognized legacy preferences to a round choice', (legacy, roundLimit) => {
  expect(decodeSettings(JSON.stringify(legacy))).toEqual({
    settings: { game: 'counting', theme: 'fruit', roundLimit, audio: true, reducedMotion: false },
    migrated: true,
  })
})

it.each([5, 10, 15, 20, 25, 30])('migrates saved five-field round limit %i', roundLimit => {
  const saved = { ...settings, roundLimit }
  expect(decodeSettings(JSON.stringify(saved))).toEqual({
    settings: { ...settings, roundLimit: roundLimit > 10 ? 10 : roundLimit },
    migrated: roundLimit > 10,
  })
})

it('normalizes old seven-field round counts and preserves preferences', () => {
  const old = { ...legacySettings, game: 'shadow' as const, theme: 'school' as const, roundLimit: 10 }
  expect(decodeSettings(JSON.stringify(old))).toEqual({
    settings: { game: 'shadow', theme: 'school', roundLimit: 10, audio: true, reducedMotion: false },
    migrated: true,
  })
})

it('accepts current settings and rejects corrupt or partially legacy settings', () => {
  expect(decodeSettings(JSON.stringify(settings))).toEqual({ settings, migrated: false })
  expect(decodeSettings('{"game":')).toBeNull()
  expect(decodeSettings(JSON.stringify({ ...legacySettings, level: 0 }))).toBeNull()
  expect(decodeSettings(JSON.stringify({ ...legacySettings, minutes: 6 }))).toBeNull()
  expect(decodeSettings(JSON.stringify({ ...legacySettings, theme: 'unknown' }))).toBeNull()
  expect(decodeSettings(JSON.stringify({ ...settings, minutes: 5 }))).toBeNull()
})

it('rejects legacy timed sessions even if their former deadline has not passed', () => {
  const { version: _version, ...unversioned } = active
  const legacy = { ...unversioned, settings: legacySettings, deadlineAt: 301_000 }

  expect(decodeSession(JSON.stringify(legacy), 2_000)).toBeNull()
})

it('invalid_settings_rejected', () => {
  const invalidSettings = [
    { game: 'unknown' },
    { theme: 'unknown' },
    { level: 2 },
    { minutes: 5 },
    { roundLimit: 0 },
    { roundLimit: 11 },
    { roundLimit: 35 },
    { roundLimit: 2.5 },
    { audio: 'false' },
    { reducedMotion: null },
  ]

  for (const overrides of invalidSettings) {
    const invalid = { ...settings, ...overrides }
    expect(() => startSession('session-1', invalid as Settings, 1_000)).toThrow(/settings/i)
    expect(decodeSession(JSON.stringify({ ...active, settings: invalid }), 2_000)).toBeNull()
  }
})

it('snapshots_settings_at_start', () => {
  const editable = { ...settings }
  const session = startSession('session-1', editable, 1_000)

  editable.roundLimit = 10
  editable.theme = 'school'

  expect(session.settings).toEqual(settings)
  expect(finishRound(session, 2_000)).toMatchObject({ status: 'active', completedRounds: 1 })
})

it('rejects_non_finite_timestamps', () => {
  expect(() => startSession('session-1', settings, Number.POSITIVE_INFINITY)).toThrow()
  expect(tick(active, Number.NaN)).toMatchObject({ status: 'ended', reason: 'invalid' })
  const stored = JSON.stringify(active).replace('"startedAt":1000', '"startedAt":1e309')
  expect(decodeSession(stored, 2_000)).toBeNull()
})

it.each([
  { version: undefined },
  { version: 3 },
  { deadlineAt: 301_000 },
  { lastSeenAt: 999 },
  { completedRounds: -1 },
  { completedRounds: 1.5 },
  { completedRounds: 5 },
  { status: 'active', reason: 'stopped' },
  { status: 'ended' },
  { status: 'ended', reason: 'unknown' },
  { status: 'ended', reason: 'rounds', completedRounds: 4 },
  { status: 'ended', reason: 'stopped', completedRounds: 5 },
  { status: 'ended', reason: 'time', lastSeenAt: 301_000 },
])('rejects inconsistent session overrides %j', (overrides) => {
  expect(decodeSession(JSON.stringify({ ...active, ...overrides }), 2_000)).toBeNull()
})
