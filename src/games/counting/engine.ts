import { shuffle } from '../../assets/catalog'
import type { Asset, Level, Rng } from '../../shared/contracts'

export interface CountingQuestion {
  asset: Asset
  quantity: number
  choices: number[]
}

const levels = {
  1: { max: 2, choiceCount: 2 },
  2: { max: 3, choiceCount: 2 },
  3: { max: 5, choiceCount: 2 },
  4: { max: 5, choiceCount: 3 },
  5: { max: 10, choiceCount: 3 },
} satisfies Record<Level, { max: number; choiceCount: number }>

function randomIndex(length: number, rng: Rng): number {
  const sample = rng()
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
    throw new RangeError('RNG must return a finite number in [0, 1)')
  }
  return Math.floor(sample * length)
}

export function createQuestion(pool: readonly Asset[], level: Level, rng: Rng): CountingQuestion {
  if (pool.length === 0) throw new RangeError('Counting requires at least one asset')

  const { max, choiceCount } = levels[level]
  const asset = pool[randomIndex(pool.length, rng)]
  const quantity = randomIndex(max, rng) + 1
  const alternatives = Array.from({ length: max }, (_, index) => index + 1)
    .filter((choice) => choice !== quantity)
  const distractors = shuffle(alternatives, rng).slice(0, choiceCount - 1)
  return { asset, quantity, choices: shuffle([quantity, ...distractors], rng) }
}

export function markCounted(indices: readonly number[], index: number, quantity: number): readonly number[] {
  if (!Number.isInteger(quantity) || !Number.isInteger(index) || index < 0 || index >= quantity || indices.includes(index)) {
    return indices
  }
  return [...indices, index]
}
