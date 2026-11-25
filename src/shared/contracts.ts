const gameIds = ['counting', 'shadow', 'connect'] as const
const themeIds = ['farm', 'fruit', 'sea', 'vegetable', 'school'] as const

export type GameId = typeof gameIds[number]
export type ThemeId = typeof themeIds[number]
export const roundLimits = [5, 10, 15, 20, 25, 30] as const

export interface Settings {
  game: GameId
  theme: ThemeId
  roundLimit: number
  audio: boolean
  reducedMotion: boolean
}

export function hasSettingsPreferences(value: unknown): value is Record<string, unknown> & Omit<Settings, 'roundLimit'> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const { game, theme, audio, reducedMotion } = value as Record<string, unknown>
  return gameIds.some(id => id === game) && themeIds.some(id => id === theme) &&
    typeof audio === 'boolean' && typeof reducedMotion === 'boolean'
}

export function isSettings(value: unknown): value is Settings {
  return hasSettingsPreferences(value) && Object.keys(value).length === 5 &&
    roundLimits.some(limit => limit === value.roundLimit)
}

export interface Asset {
  id: string
  theme: ThemeId
  image: string
  labelVi: string
}

export interface GameProps {
  settings: Settings
  assets: readonly Asset[]
  active: boolean
  roundKey: string
}

export type Rng = () => number
