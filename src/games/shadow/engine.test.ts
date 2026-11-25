import { describe, expect, it } from 'vitest'
import { getAssets } from '../../assets/catalog'
import { createShadowBoard, matchShadow } from './engine'
import type { ShadowBoard } from './engine'

const pool = getAssets('farm')
const [cow, pig] = pool
const fixedRng = () => 0.999
const board: ShadowBoard = { sources: [cow, pig], targets: [pig, cow], useShadow: true }

describe('Shadow board', () => {
  it('levels_map_to_exact_pair_counts', () => {
    const levels = [1, 2, 3, 4, 5] as const
    expect(levels.map((level) => {
      const { sources, targets, useShadow } = createShadowBoard(pool, level, fixedRng)
      return [sources.length, targets.length, useShadow]
    })).toEqual([[1, 1, false], [1, 1, true], [2, 2, true], [3, 3, true], [4, 4, true]])
  })

  it('same_asset_ids_in_sources_targets', () => {
    const fixedPool = Object.freeze([...pool])
    const { sources, targets } = createShadowBoard(fixedPool, 5, fixedRng)
    expect(sources.map(({ id }) => id)).toEqual(['cow', 'pig', 'rooster', 'goat'])
    expect(targets.map(({ id }) => id).sort()).toEqual(['cow', 'goat', 'pig', 'rooster'])
    for (const target of targets) {
      expect(target).toBe(sources.find(({ id }) => id === target.id))
    }
    expect(fixedPool).toEqual(pool)
  })

  it('shuffles targets even when the RNG returns the source order', () => {
    const { sources, targets } = createShadowBoard(pool, 5, fixedRng)
    expect(targets.map(({ id }) => id)).not.toEqual(sources.map(({ id }) => id))
  })

  it('reject_small_pool', () => {
    expect(() => createShadowBoard(pool.slice(0, 3), 5, fixedRng)).toThrow(RangeError)
    expect(() => createShadowBoard([], 1, fixedRng)).toThrow(RangeError)
  })

  it('rejects duplicate IDs that would create ambiguous pairs', () => {
    expect(() => createShadowBoard([cow, { ...pig, id: 'cow' }], 3, fixedRng)).toThrow(RangeError)
  })

  it('wrong_target_preserves', () => {
    const matched = Object.freeze(['cow'])
    expect(matchShadow(matched, 'pig', 'cow', board)).toBe(matched)
    expect(matchShadow(matched, 'goat', 'goat', board)).toBe(matched)
  })

  it('correct_pair_locks', () => {
    const matched = Object.freeze(['cow'])
    expect(matchShadow(matched, 'pig', 'pig', board)).toEqual(['cow', 'pig'])
    expect(matched).toEqual(['cow'])
  })

  it('duplicate_match_no_change', () => {
    const matched = Object.freeze(['cow'])
    expect(matchShadow(matched, 'cow', 'cow', board)).toBe(matched)
  })
})
