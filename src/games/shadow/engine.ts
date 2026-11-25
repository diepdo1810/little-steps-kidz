import { shuffle } from '../../assets/catalog'
import type { Asset, Level, Rng } from '../../shared/contracts'

export interface ShadowBoard {
  sources: Asset[]
  targets: Asset[]
  useShadow: boolean
}

const pairsByLevel: Record<Level, number> = { 1: 1, 2: 1, 3: 2, 4: 3, 5: 4 }

export function createShadowBoard(pool: readonly Asset[], level: Level, rng: Rng): ShadowBoard {
  const pairs = pairsByLevel[level]
  if (!Array.isArray(pool) || pool.length < pairs) {
    throw new RangeError('Not enough assets for the requested pairs')
  }

  const ids = new Set<string>()
  for (const asset of pool) {
    if (typeof asset?.id !== 'string' || !asset.id.trim() || ids.has(asset.id)) {
      throw new RangeError('Shadow Matching requires distinct, nonblank asset IDs')
    }
    ids.add(asset.id)
  }

  const sources = shuffle(pool, rng).slice(0, pairs)
  const targets = shuffle(sources, rng)
  if (pairs > 1 && targets.every((asset, index) => asset.id === sources[index].id)) {
    targets.push(...targets.splice(0, 1))
  }
  return { sources, targets, useShadow: level !== 1 }
}

export function matchShadow(
  matched: readonly string[], sourceId: string, targetId: string, board: ShadowBoard,
): readonly string[] {
  if (
    sourceId !== targetId ||
    matched.includes(sourceId) ||
    !board.sources.some(({ id }) => id === sourceId) ||
    !board.targets.some(({ id }) => id === targetId)
  ) {
    return matched
  }
  return [...matched, sourceId]
}
