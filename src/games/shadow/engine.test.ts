import { describe, expect, it } from 'vitest'
import { getAssets } from '../../assets/catalog'
import { createShadowBoard, matchShadow } from './engine'
import type { ShadowBoard } from './engine'

const pool = getAssets('farm')
const [cow, pig] = pool
const fixedRng = () => 0.999
const board: ShadowBoard = { sources: [cow, pig], targets: [pig, cow] }

describe('Shadow board', () => {
  it.each([[0, 1], [0.21, 2], [0.41, 3], [0.61, 4], [0.999, 5]])(
    'maps sample %f to %i unique pairs',
    (sample, pairs) => {
      const { sources, targets } = createShadowBoard(pool, () => sample)
      expect(sources).toHaveLength(pairs)
      expect(targets).toHaveLength(pairs)
      expect(new Set(sources.map(({ id }) => id)).size).toBe(pairs)
      expect(new Set(targets.map(({ id }) => id))).toEqual(new Set(sources.map(({ id }) => id)))
    },
  )

  it('same_asset_ids_in_sources_targets', () => {
    const fixedPool = Object.freeze([...pool])
    const { sources, targets } = createShadowBoard(fixedPool, fixedRng)
    expect(sources.map(({ id }) => id)).toEqual(['cow', 'pig', 'rooster', 'goat', 'duck'])
    expect(targets.map(({ id }) => id).sort()).toEqual(['cow', 'duck', 'goat', 'pig', 'rooster'])
    for (const target of targets) {
      expect(target).toBe(sources.find(({ id }) => id === target.id))
    }
    expect(fixedPool).toEqual(pool)
  })

  it('shuffles targets even when the RNG returns the source order', () => {
    const { sources, targets } = createShadowBoard(pool, fixedRng)
    expect(targets.map(({ id }) => id)).not.toEqual(sources.map(({ id }) => id))
  })

  it('reject_small_pool', () => {
    expect(() => createShadowBoard(pool.slice(0, 3), fixedRng)).toThrow(RangeError)
    expect(() => createShadowBoard([], fixedRng)).toThrow(RangeError)
  })

  it('rejects duplicate IDs that would create ambiguous pairs', () => {
    expect(() => createShadowBoard([cow, { ...pig, id: 'cow' }], () => 0.21)).toThrow(RangeError)
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
