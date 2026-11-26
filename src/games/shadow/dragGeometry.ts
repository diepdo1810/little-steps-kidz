export interface Point {
  x: number
  y: number
}

export interface TargetRect {
  id: string
  left: number
  top: number
  right: number
  bottom: number
}

function axisInterval(start: number, delta: number, min: number, max: number): [number, number] | undefined {
  if (delta === 0) {
    return start >= min && start <= max ? [-Infinity, Infinity] : undefined
  }

  const first = (min - start) / delta
  const second = (max - start) / delta
  return [Math.min(first, second), Math.max(first, second)]
}

export function firstTargetOnDragPath(
  startCenter: Point,
  endCenter: Point,
  artworkSize: { width: number; height: number },
  targets: readonly TargetRect[],
): string | undefined {
  const dx = endCenter.x - startCenter.x
  const dy = endCenter.y - startCenter.y
  let firstTime = Infinity
  let firstId: string | undefined

  for (const target of targets) {
    const margin = Math.min(target.right - target.left, target.bottom - target.top) * 0.35
    const xPadding = artworkSize.width / 2 + margin
    const yPadding = artworkSize.height / 2 + margin
    const x = axisInterval(startCenter.x, dx, target.left - xPadding, target.right + xPadding)
    const y = axisInterval(startCenter.y, dy, target.top - yPadding, target.bottom + yPadding)
    if (!x || !y) continue

    // A crossing requires both axis intervals to overlap within the segment.
    const entry = Math.max(0, x[0], y[0])
    const exit = Math.min(1, x[1], y[1])
    if (entry <= exit && entry < firstTime) {
      firstTime = entry
      firstId = target.id
    }
  }

  return firstId
}
