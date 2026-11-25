import { getAssets } from '../assets/catalog'
import { maxPairsForHeight } from '../games/connect/engine'
import type { GameId, Level, Settings, ThemeId } from '../shared/contracts'

export const gameNames: Record<GameId, string> = {
  connect: 'Nối hình giống nhau',
  shadow: 'Ghép hình với bóng',
  counting: 'Đếm đồ vật',
}
export const themeNames: Record<ThemeId, string> = {
  farm: 'Động vật nuôi', fruit: 'Trái cây', sea: 'Sinh vật biển',
  vegetable: 'Rau củ', school: 'Đồ dùng học tập',
}
export const levels: readonly Level[] = [1, 2, 3, 4, 5]
export const minutes = [5, 10, 15] as const
export const roundLimits = Array.from({ length: 10 }, (_, i) => i + 1)

// GameLayout spends 48px on controls, 8px on its gap, and 8px on each edge.
// Safe-area space beyond those minimum edge paddings is measured at runtime.
export const boardInset = 72

export function unavailableReason(settings: Settings, boardHeight: number): string {
  const count = getAssets(settings.theme).length
  const { game, level } = settings
  const pairs = game === 'connect' ? level + 1 : Math.max(1, level - 1)
  if (count < (game === 'counting' ? 1 : pairs)) {
    return 'Chủ đề này chưa có đủ hình cho mức đã chọn.'
  }
  if (game === 'connect' && pairs > maxPairsForHeight(boardHeight, count)) {
    return 'Chiều cao màn hình chưa đủ cho mức này. Hãy chọn mức thấp hơn hoặc dùng màn hình lớn hơn.'
  }
  return ''
}

export function levelLabel(game: GameId, level: Level): string {
  if (game === 'counting') return `Mức ${level} · Đếm đến ${[2, 3, 5, 5, 10][level - 1]}`
  const pairs = game === 'connect' ? level + 1 : Math.max(1, level - 1)
  return `Mức ${level} · ${pairs} cặp${game === 'shadow' && level === 1 ? ' hình màu' : ''}`
}

// Vite enumerates real local recordings for this build. Missing cues stay silent.
declare const __LOCAL_AUDIO_CUES__: string[]
export const localCues = new Set(__LOCAL_AUDIO_CUES__)
