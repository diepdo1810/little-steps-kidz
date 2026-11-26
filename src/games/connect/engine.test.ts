import { describe, expect, it } from 'vitest'
import { getAssets } from '../../assets/catalog'
import { connectPair, createBoard, maxPairsForHeight } from './engine'

const pool = getAssets('farm')
const identityRng = () => 0.99
const [cow, pig] = pool
const board = { left: [cow, pig], right: [pig, cow] }
const ids = (assets: typeof pool) => assets.map(({ id }) => id)

describe('createBoard', () => {
  it('board_has_unique_equal_sets', () => {
    const selected = createBoard(pool, 5, () => 0)
    const leftIds = ids(selected.left)
    const rightIds = ids(selected.right)

    expect(leftIds).toHaveLength(5)
    expect(new Set(leftIds).size).toBe(5)
    expect(rightIds).toHaveLength(5)
    expect(new Set(rightIds)).toEqual(new Set(leftIds))
    expect(rightIds).not.toEqual(leftIds)
    expect(ids(pool)).toEqual(['cow', 'pig', 'rooster', 'goat', 'duck', 'dog'])
  })

  it('connects a board with only one pair', () => {
    const single = createBoard([cow], 1, identityRng)
    expect(single).toEqual({ left: [cow], right: [cow] })
    expect(connectPair([], 'cow', 'cow', single)).toEqual(['cow'])
  })

  it('identical_shuffle_rotates', () => {
    const result = createBoard(pool, 3, identityRng)
    expect(ids(result.left)).toEqual(['cow', 'pig', 'rooster'])
    expect(ids(result.right)).toEqual(['pig', 'rooster', 'cow'])
  })

  it('pool_too_small_rejected', () => {
    expect(() => createBoard([cow], 2, identityRng)).toThrow(RangeError)
    expect(() => createBoard([], 2, identityRng)).toThrow(RangeError)
  })

  it.each([0, 2.5, 6, 7, NaN])('rejects unsupported pair count %s', (pairs) => {
    expect(() => createBoard(pool, pairs, identityRng)).toThrow(RangeError)
  })

  it('rejects blank IDs and duplicate IDs in the pool', () => {
    expect(() => createBoard([cow, pig, { ...cow, id: ' ' }], 2, identityRng)).toThrow(RangeError)
    expect(() => createBoard([cow, pig, { ...cow }], 2, identityRng)).toThrow(RangeError)
  })
})

describe('connectPair', () => {
  it('adds a correct unmatched ID without mutating existing matches', () => {
    const matched = Object.freeze(['cow'])
    expect(connectPair(matched, 'pig', 'pig', board)).toEqual(['cow', 'pig'])
    expect(matched).toEqual(['cow'])
  })

  it('wrong_pair_preserves_matches', () => {
    const matched = ['cow']
    expect(connectPair(matched, 'pig', 'cow', board)).toBe(matched)
  })

  it('duplicate_pair_no_change', () => {
    const matched = ['cow']
    expect(connectPair(matched, 'cow', 'cow', board)).toBe(matched)
  })

  it('unknown_pair_rejected', () => {
    const matched = ['cow']
    expect(connectPair(matched, 'dog', 'dog', board)).toBe(matched)
  })

  it('requires the matching ID in each column', () => {
    const matched: string[] = []
    expect(connectPair(matched, 'cow', 'cow', { left: [cow], right: [pig] })).toBe(matched)
  })
})

it('height_limits_rows', () => {
  expect(maxPairsForHeight(47, 6)).toBe(0)
  expect(maxPairsForHeight(48, 6)).toBe(1)
  expect(maxPairsForHeight(111, 6)).toBe(1)
  expect(maxPairsForHeight(112, 6)).toBe(2)
  expect(maxPairsForHeight(303, 6)).toBe(4)
  expect(maxPairsForHeight(304, 6)).toBe(5)
  expect(maxPairsForHeight(1000, 12)).toBe(5)
  expect(maxPairsForHeight(1000, 3)).toBe(3)
  expect(maxPairsForHeight(-30, 6)).toBe(0)
  expect(maxPairsForHeight(308, 0)).toBe(0)
  expect(maxPairsForHeight(308, -2)).toBe(0)
  expect(maxPairsForHeight(NaN, 6)).toBe(0)
})
