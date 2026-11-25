import { describe, expect, it } from 'vitest'
import { getAssets } from '../../assets/catalog'
import { createQuestion, markCounted } from './engine'

const assets = getAssets('farm')

describe('createQuestion', () => {
  it('generates every quantity from one to five with three distinct answers', () => {
    const quantities = new Set<number>()
    for (const sample of [0, 0.19, 0.2, 0.39, 0.4, 0.59, 0.6, 0.79, 0.8, 0.999]) {
      const { asset, quantity, choices } = createQuestion(assets, () => sample)
      quantities.add(quantity)
      expect(assets).toContain(asset)
      expect(choices).toHaveLength(3)
      expect(new Set(choices).size).toBe(3)
      expect(choices.filter((choice) => choice === quantity)).toHaveLength(1)
      expect(choices.every((choice) => Number.isInteger(choice) && choice >= 1 && choice <= 5)).toBe(true)
    }
    expect(quantities).toEqual(new Set([1, 2, 3, 4, 5]))
  })

  it.each([[0, 1], [0.999, 5]])('maps sample %f to %i objects', (sample, quantity) => {
    expect(createQuestion(assets, () => sample).quantity).toBe(quantity)
  })

  it('can place the answer in each of the three choices', () => {
    const positions = new Set<number>()
    for (const sample of [0, 0.4, 0.7, 0.999]) {
      const { quantity, choices } = createQuestion(assets, () => sample)
      positions.add(choices.indexOf(quantity))
    }
    expect(positions).toEqual(new Set([0, 1, 2]))
  })

  it('empty_pool_rejected', () => {
    expect(() => createQuestion([], () => 0)).toThrow(RangeError)
  })

  it.each([NaN, -0.01, 1])('rejects out-of-range RNG result %s', (sample) => {
    expect(() => createQuestion(assets, () => sample)).toThrow(RangeError)
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
