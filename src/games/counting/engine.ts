import { MAX_ROUND_ITEMS, randomIndex, shuffle } from '../../assets/catalog'
import type { Asset, Rng } from '../../shared/contracts'

export interface CountingQuestion {
  asset: Asset
  quantity: number
  choices: number[]
}

export function createQuestion(pool: readonly Asset[], quantity: number, rng: Rng): CountingQuestion {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ROUND_ITEMS) {
    throw new RangeError(`Counting requires 1 to ${MAX_ROUND_ITEMS} objects`)
  }
  if (pool.length === 0) throw new RangeError('Counting requires at least one asset')

  const asset = pool[randomIndex(pool.length, rng)]
  const alternatives = Array.from({ length: MAX_ROUND_ITEMS }, (_, index) => index + 1)
    .filter((choice) => choice !== quantity)
  const distractors = shuffle(alternatives, rng).slice(0, 2)
  return { asset, quantity, choices: shuffle([quantity, ...distractors], rng) }
}

export function markCounted(indices: readonly number[], index: number, quantity: number): readonly number[] {
  if (!Number.isInteger(quantity) || !Number.isInteger(index) || index < 0 || index >= quantity || indices.includes(index)) {
    return indices
  }
  return [...indices, index]
}
