import { shuffle } from '../../assets/catalog'
import type { Asset, Rng } from '../../shared/contracts'

export interface Board {
  left: Asset[]
  right: Asset[]
}

const MIN_PAIRS = 2
const MAX_PAIRS = 6
const MIN_ROW_HEIGHT = 48
const ROW_GAP = 4

export function createBoard(pool: readonly Asset[], pairs: number, rng: Rng): Board {
  if (!Number.isInteger(pairs) || pairs < MIN_PAIRS || pairs > MAX_PAIRS) {
    throw new RangeError('Connect requires 2 to 6 pairs')
  }
  if (!Array.isArray(pool) || pool.length < pairs) {
    throw new RangeError('Not enough assets for the requested pairs')
  }

  const ids = new Set<string>()
  for (const asset of pool) {
    if (typeof asset?.id !== 'string' || !asset.id.trim() || ids.has(asset.id)) {
      throw new RangeError('Connect requires distinct, nonblank asset IDs')
    }
    ids.add(asset.id)
  }

  const left = shuffle(pool, rng).slice(0, pairs)
  const right = shuffle(left, rng)
  if (right.every((asset, index) => asset.id === left[index].id)) {
    return { left, right: [...right.slice(1), right[0]] }
  }
  return { left, right }
}

export function connectPair(
  matched: readonly string[],
  sourceId: string,
  targetId: string,
  board: Board,
): readonly string[] {
  if (
    sourceId !== targetId ||
    matched.includes(sourceId) ||
    !board.left.some(({ id }) => id === sourceId) ||
    !board.right.some(({ id }) => id === targetId)
  ) {
    return matched
  }
  return [...matched, sourceId]
}

export function maxPairsForHeight(usableHeight: number, poolSize: number): number {
  if (!Number.isFinite(usableHeight) || !Number.isFinite(poolSize)) {
    return 0
  }
  const rows = Math.floor((usableHeight + ROW_GAP) / (MIN_ROW_HEIGHT + ROW_GAP))
  return Math.max(0, Math.min(MAX_PAIRS, Math.floor(poolSize), rows))
}
