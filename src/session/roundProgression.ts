/** Return the number of items shown on a one-based lesson turn. */
export function roundSizeForTurn(turn: number): number {
  if (!Number.isInteger(turn) || turn < 1 || turn > 10) {
    throw new RangeError('turn must be an integer from 1 through 10')
  }

  return turn <= 5 ? turn : 11 - turn
}
