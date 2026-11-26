import { expect, it } from 'vitest'
import { roundSizeForTurn } from './roundProgression'

it.each([1, 2, 3, 4, 5, 5, 4, 3, 2, 1].map((size, index) => [index + 1, size]))(
  'returns the round size for turn %i', (turn, expected) => {
    expect(roundSizeForTurn(turn)).toBe(expected)
  },
)

it.each([0, 11, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid turn %s', turn => {
  expect(() => roundSizeForTurn(turn)).toThrow(RangeError)
})
