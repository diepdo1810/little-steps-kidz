import { describe, expect, it } from 'vitest'
import { getAssets } from '../../assets/catalog'
import { createQuestion, markCounted } from './engine'

const assets = getAssets('farm')

describe('createQuestion', () => {
  it.each([1, 2, 3, 4, 5])('uses the requested %i objects with three distinct answers', (requested) => {
    for (const sample of [0, 0.4, 0.999]) {
      const { asset, quantity, choices } = createQuestion(assets, requested, () => sample)
      expect(assets).toContain(asset)
      expect(quantity).toBe(requested)
      expect(choices).toHaveLength(3)
      expect(new Set(choices).size).toBe(3)
      expect(choices.filter((choice) => choice === quantity)).toHaveLength(1)
      expect(choices.every((choice) => Number.isInteger(choice) && choice >= 1 && choice <= 5)).toBe(true)
    }
  })

  it('uses the RNG to select an asset independently of quantity', () => {
    expect(createQuestion(assets, 5, () => 0).asset).toBe(assets[0])
    expect(createQuestion(assets, 5, () => 0.999).asset).toBe(assets.at(-1))
  })

  it('can place the answer in each of the three choices', () => {
    const positions = new Set<number>()
    for (const sample of [0, 0.4, 0.7, 0.999]) {
      const { quantity, choices } = createQuestion(assets, 3, () => sample)
      positions.add(choices.indexOf(quantity))
    }
    expect(positions).toEqual(new Set([0, 1, 2]))
  })

  it('empty_pool_rejected', () => {
    expect(() => createQuestion([], 1, () => 0)).toThrow(RangeError)
  })

  it.each([0, 6, 1.5, NaN, Infinity])('rejects invalid quantity %s', (quantity) => {
    expect(() => createQuestion(assets, quantity, () => 0)).toThrow(RangeError)
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
