import type { Asset, Rng, Settings, ThemeId } from '../shared/contracts'

export const DEFAULT_SETTINGS: Settings = {
  game: 'connect',
  theme: 'farm',
  roundLimit: 5,
  audio: false,
  reducedMotion: true,
}

function createAssets(theme: ThemeId, labels: Record<string, string>): readonly Asset[] {
  return Object.entries(labels).map(([id, labelVi]) => ({
    id,
    theme,
    image: `/assets/images/${id}.svg`,
    labelVi,
  }))
}

const catalog: Record<ThemeId, readonly Asset[]> = {
  farm: createAssets('farm', {
    cow: 'Bò',
    pig: 'Lợn',
    rooster: 'Gà trống',
    goat: 'Dê',
    duck: 'Vịt',
    dog: 'Chó',
  }),
  fruit: createAssets('fruit', {
    watermelon: 'Dưa hấu',
    strawberry: 'Dâu tây',
    orange: 'Cam',
    banana: 'Chuối',
    apple: 'Táo',
    pear: 'Lê',
  }),
  sea: createAssets('sea', {
    starfish: 'Sao biển',
    crab: 'Cua',
    seashell: 'Vỏ sò',
    shrimp: 'Tôm',
    fish: 'Cá',
    octopus: 'Bạch tuộc',
  }),
  vegetable: createAssets('vegetable', {
    tomato: 'Cà chua',
    carrot: 'Cà rốt',
    potato: 'Khoai tây',
    cucumber: 'Dưa chuột',
    pumpkin: 'Bí đỏ',
    cabbage: 'Bắp cải',
  }),
  school: createAssets('school', {
    pencil: 'Bút chì',
    clock: 'Đồng hồ',
    paintbrush: 'Cọ',
    ruler: 'Thước',
    calculator: 'Máy tính',
    book: 'Sách',
  }),
}

export function getAssets(theme: ThemeId): readonly Asset[] {
  if (!Object.hasOwn(catalog, theme)) {
    throw new RangeError(`Unknown asset theme: ${theme}`)
  }
  return catalog[theme]
}

export const MAX_ROUND_ITEMS = 5

export function randomIndex(length: number, rng: Rng): number {
  const sample = rng()
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
    throw new RangeError('RNG must return a finite number in [0, 1)')
  }
  return Math.floor(sample * length)
}

export function sampleRoundSize(rng: Rng): number {
  return randomIndex(MAX_ROUND_ITEMS, rng) + 1
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new RangeError('Shuffle requires a non-empty array pool')
  }
  if (typeof rng !== 'function') {
    throw new TypeError('Shuffle requires an RNG function')
  }

  const result = [...items]
  for (let index = result.length - 1; index > 0; index--) {
    const otherIndex = randomIndex(index + 1, rng)
    const item = result[index]
    result[index] = result[otherIndex]
    result[otherIndex] = item
  }
  return result
}
