import { describe, expect, it } from 'vitest'
import { firstTargetOnDragPath } from './dragGeometry'
import type { TargetRect } from './dragGeometry'

const artwork = { width: 20, height: 10 }
const cucumber: TargetRect = { id: 'cucumber', left: 80, right: 120, top: 80, bottom: 120 }
const carrot: TargetRect = { id: 'carrot', left: 180, right: 220, top: 80, bottom: 120 }

describe('firstTargetOnDragPath', () => {
  it('detects a crossing even when both segment endpoints miss the zone', () => {
    expect(firstTargetOnDragPath({ x: 0, y: 100 }, { x: 160, y: 100 }, artwork, [cucumber])).toBe('cucumber')
  })

  it('takes the earliest crossing in either direction regardless of DOM order', () => {
    expect(firstTargetOnDragPath({ x: 0, y: 100 }, { x: 250, y: 100 }, artwork, [carrot, cucumber])).toBe('cucumber')
    expect(firstTargetOnDragPath({ x: 250, y: 100 }, { x: 0, y: 100 }, artwork, [cucumber, carrot])).toBe('carrot')
  })

  it('misses paths outside the expanded zone', () => {
    expect(firstTargetOnDragPath({ x: 0, y: 60 }, { x: 160, y: 60 }, artwork, [cucumber])).toBeUndefined()
    expect(firstTargetOnDragPath({ x: 0, y: 100 }, { x: 55, y: 100 }, artwork, [cucumber])).toBeUndefined()
  })

  it('includes a path tangent to the zone expanded by artwork and the shorter target side', () => {
    const tallTarget = { ...cucumber, bottom: 160 }
    expect(firstTargetOnDragPath({ x: 0, y: 61 }, { x: 160, y: 61 }, artwork, [tallTarget])).toBe('cucumber')
    expect(firstTargetOnDragPath({ x: 0, y: 60 }, { x: 160, y: 60 }, artwork, [tallTarget])).toBeUndefined()
  })

  it('breaks equal-time ties by target DOM order', () => {
    const overlappingCarrot = { ...cucumber, id: carrot.id, top: 90, bottom: 130 }
    expect(firstTargetOnDragPath({ x: 0, y: 100 }, { x: 160, y: 100 }, artwork, [overlappingCarrot, cucumber])).toBe('carrot')
    expect(firstTargetOnDragPath({ x: 0, y: 100 }, { x: 160, y: 100 }, artwork, [cucumber, overlappingCarrot])).toBe('cucumber')
  })

  it('includes a zone reached only at the final point of a segment', () => {
    expect(firstTargetOnDragPath({ x: 100, y: 0 }, { x: 100, y: 61 }, artwork, [cucumber])).toBe('cucumber')
  })
})
