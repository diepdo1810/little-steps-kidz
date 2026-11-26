import { describe, expect, it } from 'vitest'
import { getAssets } from '../../assets/catalog'
import { createShadowBoard, matchShadow } from './engine'
import type { ShadowBoard } from './engine'

const pool = getAssets('farm')
const [cow, pig] = pool
const fixedRng = () => 0.999
const board: ShadowBoard = { sources: [cow, pig], targets: [pig, cow] }

describe('Shadow board', () => {
  it.each([1, 2, 3, 4, 5])('uses the requested %i unique pairs', (pairs) => {
    for (const sample of [0, 0.4, 0.999]) {
      const { sources, targets } = createShadowBoard(pool, pairs, () => sample)
      expect(sources).toHaveLength(pairs)
      expect(targets).toHaveLength(pairs)
      expect(new Set(sources.map(({ id }) => id)).size).toBe(pairs)
      expect(new Set(targets.map(({ id }) => id))).toEqual(new Set(sources.map(({ id }) => id)))
    }
  })

  it('uses the RNG to select an asset independently of pair count', () => {
    const first = createShadowBoard(pool, 1, fixedRng)
    const shuffled = createShadowBoard(pool, 1, () => 0)
    expect(first.sources).toEqual([cow])
    expect(shuffled.sources).toEqual([pig])
  })

  it('same_asset_ids_in_sources_targets', () => {
    const fixedPool = Object.freeze([...pool])
    const { sources, targets } = createShadowBoard(fixedPool, 5, fixedRng)
    expect(sources.map(({ id }) => id)).toEqual(['cow', 'pig', 'rooster', 'goat', 'duck'])
    expect(targets.map(({ id }) => id).sort()).toEqual(['cow', 'duck', 'goat', 'pig', 'rooster'])
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

  it.each([0, 6, 1.5, NaN, Infinity])('rejects invalid pair count %s', (pairs) => {
    expect(() => createShadowBoard(pool, pairs, fixedRng)).toThrow(RangeError)
  })

  it('rejects duplicate IDs that would create ambiguous pairs', () => {
    expect(() => createShadowBoard([cow, { ...pig, id: 'cow' }], 2, fixedRng)).toThrow(RangeError)
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
