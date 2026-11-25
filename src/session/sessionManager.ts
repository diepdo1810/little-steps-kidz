import { isSettings } from '../shared/contracts'
import type { Settings } from '../shared/contracts'

export { isSettings }
export type EndReason = 'rounds' | 'stopped' | 'invalid'

const sessionVersion = 2

export interface Session {
  version: typeof sessionVersion
  id: string
  settings: Settings
  startedAt: number
  lastSeenAt: number
  completedRounds: number
  status: 'active' | 'ended'
  reason?: EndReason
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isSessionId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isSession(value: unknown): value is Session {
  if (!isRecord(value) || value.version !== sessionVersion || Object.hasOwn(value, 'deadlineAt')) return false
  const { id, settings, startedAt, lastSeenAt, completedRounds, status, reason } = value

  if (!isSessionId(id) || !isSettings(settings) ||
    !isFiniteNumber(startedAt) || !isFiniteNumber(lastSeenAt) ||
    typeof completedRounds !== 'number' || !Number.isInteger(completedRounds)) return false

  if (lastSeenAt < startedAt || completedRounds < 0 || completedRounds > settings.roundLimit) return false

  const reachedRoundLimit = completedRounds === settings.roundLimit
  if (status === 'active') return reason === undefined && !reachedRoundLimit
  if (status !== 'ended') return false

  switch (reason) {
    case 'rounds': return reachedRoundLimit
    case 'stopped':
    case 'invalid': return !reachedRoundLimit
    default: return false
  }
}

export function startSession(id: string, settings: Settings, now: number): Session {
  if (!isSessionId(id)) throw new TypeError('Invalid session ID')
  if (!isSettings(settings)) throw new TypeError('Invalid settings')
  if (!Number.isFinite(now)) throw new RangeError('Invalid session timestamp')

  return {
    version: sessionVersion,
    id,
    settings: { ...settings },
    startedAt: now,
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
