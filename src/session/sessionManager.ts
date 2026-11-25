import type { Settings } from '../shared/contracts'

export type EndReason = 'time' | 'rounds' | 'stopped' | 'invalid'

export interface Session {
  id: string
  settings: Settings
  startedAt: number
  deadlineAt: number
  lastSeenAt: number
  completedRounds: number
  status: 'active' | 'ended'
  reason?: EndReason
}

const millisecondsPerMinute = 60_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isSessionId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function isSettings(value: unknown): value is Settings {
  if (!isRecord(value)) return false
  const { game, theme, level, minutes, roundLimit, audio, reducedMotion } = value

  return (game === 'counting' || game === 'shadow' || game === 'connect') &&
    (theme === 'farm' || theme === 'fruit' || theme === 'sea' || theme === 'vegetable' || theme === 'school') &&
    (level === 1 || level === 2 || level === 3 || level === 4 || level === 5) &&
    (minutes === 5 || minutes === 10 || minutes === 15) &&
    typeof roundLimit === 'number' && Number.isInteger(roundLimit) && roundLimit >= 1 && roundLimit <= 10 &&
    typeof audio === 'boolean' && typeof reducedMotion === 'boolean'
}

function isSession(value: unknown): value is Session {
  if (!isRecord(value)) return false
  const { id, settings, startedAt, deadlineAt, lastSeenAt, completedRounds, status, reason } = value

  if (!isSessionId(id) || !isSettings(settings) ||
    !isFiniteNumber(startedAt) || !isFiniteNumber(deadlineAt) || !isFiniteNumber(lastSeenAt) ||
    typeof completedRounds !== 'number' || !Number.isInteger(completedRounds)) return false

  if (deadlineAt <= startedAt || deadlineAt !== startedAt + settings.minutes * millisecondsPerMinute ||
    lastSeenAt < startedAt || completedRounds < 0 || completedRounds > settings.roundLimit) return false

  const reachedRoundLimit = completedRounds === settings.roundLimit
  const reachedDeadline = lastSeenAt >= deadlineAt

  if (status === 'active') return reason === undefined && !reachedDeadline && !reachedRoundLimit
  if (status !== 'ended') return false

  switch (reason) {
    case 'time': return reachedDeadline && !reachedRoundLimit
    case 'rounds': return reachedRoundLimit && !reachedDeadline
    case 'stopped':
    case 'invalid': return !reachedDeadline && !reachedRoundLimit
    default: return false
  }
}

export function startSession(id: string, settings: Settings, now: number): Session {
  if (!isSessionId(id)) throw new TypeError('Invalid session ID')
  if (!isSettings(settings)) throw new TypeError('Invalid settings')

  const deadlineAt = now + settings.minutes * millisecondsPerMinute
  if (!Number.isFinite(now) || !Number.isFinite(deadlineAt) || deadlineAt <= now) {
    throw new RangeError('Invalid session timestamp')
  }

  return {
    id,
    settings: { ...settings },
    startedAt: now,
    deadlineAt,
    lastSeenAt: now,
    completedRounds: 0,
    status: 'active',
  }
}

export function tick(session: Session, now: number): Session {
  if (session.status === 'ended') return session
  if (!Number.isFinite(now) || now < session.lastSeenAt) {
    return { ...session, status: 'ended', reason: 'invalid' }
  }
  if (now >= session.deadlineAt) {
    return { ...session, lastSeenAt: now, status: 'ended', reason: 'time' }
  }
  return now === session.lastSeenAt ? session : { ...session, lastSeenAt: now }
}

export function finishRound(session: Session, now: number): Session {
  const current = tick(session, now)
  if (current.status === 'ended') return current

  const completedRounds = current.completedRounds + 1
  if (completedRounds >= current.settings.roundLimit) {
    return { ...current, completedRounds, status: 'ended', reason: 'rounds' }
  }
  return { ...current, completedRounds }
}

export function stopSession(session: Session, now: number): Session {
  const current = tick(session, now)
  return current.status === 'ended' ? current : { ...current, status: 'ended', reason: 'stopped' }
}

export function decodeSession(raw: string | null, now: number): Session | null {
  if (raw === null) return null

  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  return isSession(value) ? tick(value, now) : null
}
