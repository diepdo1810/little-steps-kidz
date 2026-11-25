import { describe, expect, it } from 'vitest'
import { getAssets } from '../../assets/catalog'
import type { Level } from '../../shared/contracts'
import { createQuestion, markCounted } from './engine'

const assets = getAssets('farm')

describe('createQuestion', () => {
  it('all_levels_generate_valid_unique_options', () => {
    const levels: readonly [Level, number, number][] = [[1, 2, 2], [2, 3, 2], [3, 5, 2], [4, 5, 3], [5, 10, 3]]
    for (const [level, max, choicesCount] of levels) {
      const quantities = new Set<number>()
      for (const sample of [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.999]) {
        const { asset, quantity, choices } = createQuestion(assets, level, () => sample)
        quantities.add(quantity)
        expect(assets).toContain(asset)
        expect(choices).toHaveLength(choicesCount)
        expect(new Set(choices).size).toBe(choicesCount)
        expect(choices.filter((choice) => choice === quantity)).toHaveLength(1)
        expect(choices.every((choice) => Number.isInteger(choice) && choice >= 1 && choice <= max)).toBe(true)
      }
      expect(quantities.size).toBe(max)
      expect(quantities.has(1)).toBe(true)
      expect(quantities.has(max)).toBe(true)
    }
  })

  it('answer_is_not_always_same_position', () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      const positions = new Set<number>()
      for (const sample of [0, 0.4, 0.7, 0.999]) {
        const { quantity, choices } = createQuestion(assets, level, () => sample)
        positions.add(choices.indexOf(quantity))
      }
      expect(positions.size).toBe(level < 4 ? 2 : 3)
    }
  })

  it('empty_pool_rejected', () => {
    expect(() => createQuestion([], 1, () => 0)).toThrow(RangeError)
  })

  it.each([NaN, -0.01, 1])('rejects out-of-range RNG result %s', (sample) => {
    expect(() => createQuestion(assets, 1, () => sample)).toThrow(RangeError)
  })
})

describe('markCounted', () => {
  it('count_marks_only_once', () => {
    const counted = Object.freeze([1])
    expect(markCounted(counted, 1, 3)).toBe(counted)
    expect(markCounted(counted, 0, 3)).toEqual([1, 0])
    expect(markCounted(counted, 2, 3)).toEqual([1, 2])
    expect(counted).toEqual([1])
  })

  it('invalid_index_ignored', () => {
    const counted = [1]
    for (const index of [-1, 1.5, 3, NaN, Infinity]) {
      expect(markCounted(counted, index, 3)).toBe(counted)
    }
    expect(markCounted(counted, 2, NaN)).toBe(counted)
  })
})
