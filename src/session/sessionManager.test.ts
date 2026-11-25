import { expect, it } from 'vitest'
import type { Settings } from '../shared/contracts'
import {
  decodeSession,
  finishRound,
  startSession,
  stopSession,
  tick,
  type Session,
} from './sessionManager'

const settings: Settings = {
  game: 'counting',
  theme: 'fruit',
  level: 2,
  minutes: 5,
  roundLimit: 3,
  audio: false,
  reducedMotion: true,
}

const active: Session = {
  id: 'session-1',
  settings,
  startedAt: 1_000,
  deadlineAt: 301_000,
  lastSeenAt: 1_000,
  completedRounds: 0,
  status: 'active',
}

it('ends_at_exact_deadline', () => {
  const session = startSession('session-1', settings, 1_000)

  expect(session).toEqual(active)
  expect(tick(session, 300_999)).toMatchObject({ status: 'active', lastSeenAt: 300_999 })
  expect(tick(session, 301_000)).toMatchObject({ status: 'ended', reason: 'time' })
})

it('round_limit_three', () => {
  const first = finishRound(active, 2_000)
  const second = finishRound(first, 3_000)
  const third = finishRound(second, 4_000)

  expect(first).toMatchObject({ completedRounds: 1, status: 'active' })
  expect(second).toMatchObject({ completedRounds: 2, status: 'active' })
  expect(third).toMatchObject({ completedRounds: 3, status: 'ended', reason: 'rounds' })
  expect(active.completedRounds).toBe(0)
})

it('expiry_wins_over_round', () => {
  const session = { ...active, completedRounds: 2 }

  expect(finishRound(session, 301_000)).toMatchObject({
    completedRounds: 2,
    status: 'ended',
    reason: 'time',
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

it('reload_retains_deadline', () => {
  const stored = JSON.stringify({ ...active, completedRounds: 1, lastSeenAt: 2_000 })

  expect(decodeSession(stored, 200_000)).toEqual({
    ...active,
    completedRounds: 1,
    lastSeenAt: 200_000,
  })
  expect(decodeSession(stored, 301_000)).toMatchObject({
    startedAt: 1_000,
    deadlineAt: 301_000,
    completedRounds: 1,
    status: 'ended',
    reason: 'time',
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

it('invalid_settings_rejected', () => {
  const invalidSettings = [
    { game: 'unknown' },
    { theme: 'unknown' },
    { level: 0 },
    { minutes: 6 },
    { roundLimit: 0 },
    { roundLimit: 11 },
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

  editable.minutes = 10
  editable.roundLimit = 1
  editable.theme = 'school'

  expect(session.settings).toEqual(settings)
  expect(finishRound(session, 2_000)).toMatchObject({ status: 'active', deadlineAt: 301_000 })
})

it('rejects_non_finite_timestamps', () => {
  expect(() => startSession('session-1', settings, Number.POSITIVE_INFINITY)).toThrow()
  expect(tick(active, Number.NaN)).toMatchObject({ status: 'ended', reason: 'invalid' })
  const stored = JSON.stringify(active).replace('"deadlineAt":301000', '"deadlineAt":1e309')
  expect(decodeSession(stored, 2_000)).toBeNull()
})

it.each([
  { deadlineAt: 601_000 },
  { lastSeenAt: 999 },
  { lastSeenAt: 301_000 },
  { completedRounds: -1 },
  { completedRounds: 1.5 },
  { completedRounds: 3 },
  { status: 'active', reason: 'stopped' },
  { status: 'ended' },
  { status: 'ended', reason: 'unknown' },
  { status: 'ended', reason: 'rounds', completedRounds: 2 },
  { status: 'ended', reason: 'time', lastSeenAt: 300_999 },
])('rejects_inconsistent_session $deadlineAt $lastSeenAt $completedRounds $status $reason', (overrides) => {
  expect(decodeSession(JSON.stringify({ ...active, ...overrides }), 2_000)).toBeNull()
})
