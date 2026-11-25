import { getAssets, MAX_ROUND_ITEMS } from '../assets/catalog'
import { hasSettingsPreferences, isSettings } from '../shared/contracts'
import type { GameId, Settings, ThemeId } from '../shared/contracts'

export const gameNames: Record<GameId, string> = {
  connect: 'Nối hình giống nhau',
  shadow: 'Ghép hình với bóng',
  counting: 'Đếm đồ vật',
}
export const themeNames: Record<ThemeId, string> = {
  farm: 'Động vật nuôi', fruit: 'Trái cây', sea: 'Sinh vật biển',
  vegetable: 'Rau củ', school: 'Đồ dùng học tập',
}
export { roundLimits } from '../shared/contracts'

export function unavailableReason(settings: Settings): string {
  const required = settings.game === 'counting' ? 1 : MAX_ROUND_ITEMS
  if (getAssets(settings.theme).length < required) {
    return 'Chủ đề này chưa có đủ hình để chơi.'
  }
  return ''
}

export function decodeSettings(raw: string): { settings: Settings; migrated: boolean } | null {
  let value: unknown
  try { value = JSON.parse(raw) } catch { return null }
  if (isSettings(value)) return { settings: value, migrated: false }
  if (!hasSettingsPreferences(value) || Object.keys(value).length !== 7) return null

  const { game, theme, level, minutes, roundLimit, audio, reducedMotion } = value
  if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 5 ||
    (minutes !== 5 && minutes !== 10 && minutes !== 15) ||
    typeof roundLimit !== 'number' || !Number.isInteger(roundLimit) || roundLimit < 1 || roundLimit > 10) return null

  return {
    settings: { game, theme, roundLimit: roundLimit <= 5 ? 5 : 10, audio, reducedMotion },
    migrated: true,
  }
}

// Vite enumerates real local recordings for this build. Missing cues stay silent.
declare const __LOCAL_AUDIO_CUES__: string[]
export const localCues = new Set(__LOCAL_AUDIO_CUES__)
