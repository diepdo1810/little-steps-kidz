// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { DEFAULT_SETTINGS, getAssets } from '../../assets/catalog'
import ConnectGame from './ConnectGame.vue'

enableAutoUnmount(afterEach)

const assets = getAssets('farm')
let notifyResize: (() => void) | undefined

beforeEach(() => {
  notifyResize = undefined
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) {
      notifyResize = callback
    }
    observe() {}
    disconnect() {}
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function setupGame(sample = 0.21, pool: typeof assets = assets.slice(0, 2)) {
  const random = vi.spyOn(Math, 'random').mockReturnValue(sample)
  const game = mount(ConnectGame, {
    props: {
      settings: DEFAULT_SETTINGS,
      assets: pool,
      active: true,
      roundKey: 'first',
    },
  })

  function target(side: 'left' | 'right', id: string) {
    return game.get<HTMLButtonElement>(`button[data-connect-side="${side}"][data-connect-id="${id}"]`)
  }

  function lineCount() {
    return game.findAll('svg line:not([data-preview])').length
  }

  function setGeometry(offset = 0) {
    vi.spyOn(game.get('svg').element, 'getBoundingClientRect')
      .mockImplementation(() => new DOMRect(10, 20, 600, 250))
    for (const [side, x] of [['left', 50], ['right', 450]] as const) {
      for (const [id, y] of [['cow', 60], ['pig', 130]] as const) {
        const button = target(side, id)
        const anchorX = side === 'left' ? x + 85 : x + 5
        vi.spyOn(button.element, 'getBoundingClientRect')
          .mockImplementation(() => new DOMRect(x + offset, y, 100, 50))
        vi.spyOn(button.get('.connect-anchor').element, 'getBoundingClientRect')
          .mockImplementation(() => new DOMRect(anchorX + offset, y + 20, 10, 10))
      }
    }
    notifyResize?.()
  }

  return { game, random, target, lineCount, setGeometry }
}

async function pointer(
  element: Element,
  type: string,
  x: number,
  y: number,
  { id = 1, primary = true, button = 0 } = {},
) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button })
  Object.assign(event, { pointerId: id, isPrimary: primary })
  element.dispatchEvent(event)
  await nextTick()
}

describe('ConnectGame', () => {
  it.each([[0, 1], [0.21, 2], [0.41, 3], [0.61, 4], [0.999, 5]])(
    'shows the sampled %f board with %i pairs',
    (sample, pairs) => {
      const { game } = setupGame(sample, assets)
      expect(game.findAll('button[data-connect-side="left"]')).toHaveLength(pairs)
      expect(game.findAll('button[data-connect-side="right"]')).toHaveLength(pairs)
      expect(game.text()).toBe('')
    },
  )

  it('samples a fresh pair count only when the round changes', async () => {
    const { game, random } = setupGame(0, assets)
    const sourceCount = () => game.findAll('button[data-connect-side="left"]').length
    expect(sourceCount()).toBe(1)

    random.mockReturnValue(0.999)
    await game.setProps({ active: false })
    notifyResize?.()
    await game.setProps({ active: true })
    expect(sourceCount()).toBe(1)

    await game.setProps({ roundKey: 'second' })
    expect(sourceCount()).toBe(5)
  })

  it('completes only after all five sampled pairs are linked', async () => {
    const { game, target, lineCount } = setupGame(0.999, assets)
    for (const { id } of assets.slice(0, 4)) {
      await target('left', id).trigger('click')
      await target('right', id).trigger('click')
      expect(game.emitted('complete')).toBeUndefined()
    }
    expect(lineCount()).toBe(4)

    const { id } = assets[4]
    await target('left', id).trigger('click')
    await target('right', id).trigger('click')
    expect(lineCount()).toBe(5)
    expect(game.emitted('complete')).toEqual([[]])
  })

  it('pages the original five pairs without completing early or resampling', async () => {
    const { game, random, target } = setupGame(0.999, assets)
    const visibleIds = (side = 'left') => game.findAll<HTMLButtonElement>(`button[data-connect-side="${side}"]`)
      .map(button => button.element.dataset.connectId!)
    const sampled = visibleIds()
    const sampleCalls = random.mock.calls.length
    vi.spyOn(game.get('section').element, 'getBoundingClientRect')
      .mockReturnValue(new DOMRect(0, 0, 456, 288))
    notifyResize?.()
    await nextTick()

    expect(visibleIds()).toEqual(sampled.slice(0, 3))
    for (const id of sampled.slice(0, 3)) {
      await target('left', id).trigger('click')
      await target('right', id).trigger('click')
    }
    const last = sampled.slice(3)
    expect(visibleIds()).toEqual(last)
    expect(new Set(visibleIds('right'))).toEqual(new Set(last))
    expect(visibleIds('right')).not.toEqual(last)
    expect(game.emitted('complete')).toBeUndefined()
    for (const id of sampled.slice(3)) {
      await target('left', id).trigger('click')
      await target('right', id).trigger('click')
    }
    await target('right', sampled[4]).trigger('click')
    expect(game.emitted('complete')).toEqual([[]])
    expect(random.mock.calls.length).toBe(sampleCalls)
  })

  it('balances four pairs into two subsets and keeps the same IDs when resized', async () => {
    const { game, target, random } = setupGame(0.61, assets)
    const ids = (side = 'left') => game.findAll<HTMLButtonElement>(`button[data-connect-side="${side}"]`)
      .map(button => button.element.dataset.connectId!)
    const sampled = ids()
    const calls = random.mock.calls.length
    const board = game.get('.connect-game').element
    const bounds = vi.spyOn(board, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 456, 288))
    notifyResize?.()
    await nextTick()

    expect(ids()).toEqual(sampled.slice(0, 2))
    const firstMatched = sampled[0]!
    await target('left', firstMatched).trigger('click')
    await target('right', firstMatched).trigger('click')
    expect(target('left', firstMatched).element.disabled).toBe(true)

    bounds.mockReturnValue(new DOMRect(0, 0, 456, 120))
    notifyResize?.()
    await nextTick()
    expect(ids()).toEqual(sampled.slice(1, 2))

    bounds.mockReturnValue(new DOMRect(0, 0, 456, 288))
    notifyResize?.()
    await nextTick()
    expect(ids()).toEqual(sampled.slice(0, 2))
    expect(target('left', firstMatched).element.disabled).toBe(true)

    await target('left', sampled[1]!).trigger('click')
    await target('right', sampled[1]!).trigger('click')
    expect(ids()).toEqual(sampled.slice(2))
    expect(ids('right').sort()).toEqual(sampled.slice(2).sort())
    expect(random.mock.calls.length).toBe(calls)
  })

  it('does not render a board from an insufficient pool', () => {
    const { game } = setupGame(0.41)
    expect(game.findAll('button')).toHaveLength(0)
    expect(game.emitted('complete')).toBeUndefined()
  })

  it('connects pointer taps in either direction and locks completed pairs', async () => {
    const { game, target, lineCount, setGeometry } = setupGame()
    setGeometry()
    const leftCow = target('left', 'cow')
    const rightCow = target('right', 'cow')
    const rightPig = target('right', 'pig')
    const leftPig = target('left', 'pig')

    await pointer(leftCow.element, 'pointerdown', 90, 85)
    await pointer(leftCow.element, 'pointerup', 90, 85)
    expect(leftCow.attributes('aria-pressed')).toBe('true')
    await pointer(rightCow.element, 'pointerdown', 490, 85)
    await pointer(rightCow.element, 'pointerup', 490, 85)
    expect(lineCount()).toBe(1)
    expect(leftCow.element.disabled).toBe(true)
    expect(rightCow.element.disabled).toBe(true)

    await pointer(rightPig.element, 'pointerdown', 490, 155)
    await pointer(rightPig.element, 'pointerup', 490, 155)
    await pointer(leftPig.element, 'pointerdown', 90, 155)
    await pointer(leftPig.element, 'pointerup', 90, 155)
    expect(lineCount()).toBe(2)
    expect(game.emitted('complete')).toEqual([[]])
  })

  it('clears a wrong selection and leaves committed lines intact', async () => {
    const { target, lineCount } = setupGame(0.41, assets.slice(0, 3))
    await target('left', 'cow').trigger('click')
    await target('right', 'cow').trigger('click')

    await target('left', 'pig').trigger('click')
    await target('right', 'rooster').trigger('click')
    expect(target('left', 'pig').attributes('aria-pressed')).toBe('false')
    expect(lineCount()).toBe(1)
    expect(target('right', 'pig').element.disabled).toBe(false)
  })

  it('keeps a same-column tap as a selection and does not connect it', async () => {
    const { target, lineCount } = setupGame()
    await target('left', 'cow').trigger('click')
    await target('left', 'pig').trigger('click')
    expect(lineCount()).toBe(0)
    expect(target('left', 'pig').attributes('aria-pressed')).toBe('true')
    await target('right', 'pig').trigger('click')
    expect(lineCount()).toBe(1)
  })

  it('previews a drag and checks the actual drop position during pointer capture', async () => {
    const { game, target, lineCount, setGeometry } = setupGame()
    setGeometry()
    const source = target('right', 'cow').element
    let captureId: number | undefined
    source.setPointerCapture = (id) => { captureId = id }
    source.hasPointerCapture = (id) => captureId === id
    source.releasePointerCapture = () => { captureId = undefined }

    await pointer(source, 'pointerdown', 490, 85)
    expect(captureId).toBe(1)
    await pointer(source, 'pointermove', 290, 85)
    expect(game.get('line[data-preview]').attributes('x2')).toBe('280')

    // Pointer capture still delivers the drop to the source button.
    await pointer(source, 'pointerup', 90, 85)
    expect(captureId).toBeUndefined()
    expect(game.find('line[data-preview]').exists()).toBe(false)
    expect(lineCount()).toBe(1)
  })

  it.each([
    { side: 'left' as const, startX: 90, endX: 410 },
    { side: 'right' as const, startX: 490, endX: 190 },
  ])('snaps a drag released near the matching target from $side', async ({ side, startX, endX }) => {
    const { game, target, lineCount, setGeometry } = setupGame()
    setGeometry()
    const source = target(side, 'cow').element
    const opposite = side === 'left' ? 'right' : 'left'
    await pointer(source, 'pointerdown', startX, 85)
    await pointer(source, 'pointermove', endX, 85)
    await pointer(source, 'pointerup', endX, 85)
    expect(lineCount()).toBe(1)
    expect(target(opposite, 'cow').attributes('data-connect-id')).toBe('cow')
    expect(game.find('line[data-preview]').exists()).toBe(false)
  })

  it('snaps when the final pointer position reaches a nearby target without a move event', async () => {
    const { target, lineCount, setGeometry } = setupGame()
    setGeometry()
    const source = target('left', 'cow').element
    await pointer(source, 'pointerdown', 90, 85)
    await pointer(source, 'pointerup', 410, 85)
    expect(lineCount()).toBe(1)
  })

  it('does not snap a wrong target, an equal-distance gap, or a distant drag', async () => {
    const { game, target, lineCount, setGeometry } = setupGame()
    setGeometry()

    const wrongSource = target('left', 'cow').element
    await pointer(wrongSource, 'pointerdown', 90, 85)
    await pointer(wrongSource, 'pointermove', 490, 155)
    await pointer(wrongSource, 'pointerup', 490, 155)
    expect(lineCount()).toBe(0)

    const gapSource = target('left', 'cow').element
    await pointer(gapSource, 'pointerdown', 90, 85)
    await pointer(gapSource, 'pointermove', 490, 120)
    await pointer(gapSource, 'pointerup', 490, 120)
    expect(lineCount()).toBe(0)

    const farSource = target('left', 'cow').element
    await pointer(farSource, 'pointerdown', 90, 85)
    await pointer(farSource, 'pointermove', 380, 85)
    await pointer(farSource, 'pointerup', 380, 85)
    expect(lineCount()).toBe(0)
    expect(game.find('line[data-preview]').exists()).toBe(false)
  })

  it.each(['pointercancel', 'lostpointercapture'])('clears a pending gesture on %s', async (type) => {
    const { game, target, lineCount, setGeometry } = setupGame()
    setGeometry()
    const source = target('left', 'cow').element

    await pointer(source, 'pointerdown', 90, 85)
    await pointer(source, 'pointermove', 220, 85)
    expect(game.find('line[data-preview]').exists()).toBe(true)
    await pointer(source, type, 220, 85)
    await pointer(source, 'pointerup', 490, 85)

    expect(game.find('line[data-preview]').exists()).toBe(false)
    expect(lineCount()).toBe(0)
    expect(target('left', 'cow').attributes('aria-pressed')).toBe('false')
    await target('right', 'cow').trigger('click')
    expect(lineCount()).toBe(0)
  })

  it('clears a drag after releasing in the gap', async () => {
    const { game, target, lineCount, setGeometry } = setupGame()
    setGeometry()
    const source = target('left', 'cow').element
    await pointer(source, 'pointerdown', 90, 85)
    await pointer(source, 'pointermove', 290, 85)
    expect(game.find('line[data-preview]').exists()).toBe(true)
    await pointer(source, 'pointerup', 290, 85)
    expect(game.find('line[data-preview]').exists()).toBe(false)
    expect(lineCount()).toBe(0)
  })

  it('ignores secondary pointers and pointer IDs outside the current gesture', async () => {
    const { game, target, lineCount, setGeometry } = setupGame()
    setGeometry()
    const source = target('left', 'cow')
    await pointer(source.element, 'pointerdown', 90, 85, { id: 2, primary: false })
    await pointer(source.element, 'pointerup', 490, 85, { id: 2, primary: false })
    await pointer(source.element, 'pointerdown', 90, 85, { button: 2 })
    await pointer(source.element, 'pointerup', 490, 85, { button: 2 })
    expect(lineCount()).toBe(0)

    await pointer(source.element, 'pointerdown', 90, 85)
    await pointer(source.element, 'pointermove', 220, 85)
    await pointer(source.element, 'pointercancel', 220, 85, { id: 2 })
    await pointer(source.element, 'pointerup', 490, 85, { id: 2 })
    expect(game.find('line[data-preview]').exists()).toBe(true)
    expect(lineCount()).toBe(0)
    await pointer(source.element, 'pointerup', 490, 85)
    expect(lineCount()).toBe(1)
  })

  it('remeasures both endpoints of committed lines on resize', async () => {
    const { game, target, setGeometry } = setupGame()
    setGeometry()
    await target('left', 'cow').trigger('click')
    await target('right', 'cow').trigger('click')

    const line = game.get('svg line')
    expect(line.attributes()).toMatchObject({ x1: '130', y1: '65', x2: '450', y2: '65' })
    setGeometry(30)
    await nextTick()
    expect(line.attributes()).toMatchObject({ x1: '160', y1: '65', x2: '480', y2: '65' })
  })

  it('clears a drag and tap selection when inactive and blocks attempts while inactive', async () => {
    const { game, target, lineCount, setGeometry } = setupGame()
    setGeometry()
    const source = target('left', 'cow').element
    await target('right', 'pig').trigger('click')
    await pointer(source, 'pointerdown', 90, 85)
    await pointer(source, 'pointermove', 240, 85)
    expect(game.find('line[data-preview]').exists()).toBe(true)

    await game.setProps({ active: false })
    expect(game.find('line[data-preview]').exists()).toBe(false)
    expect(game.findAll('button').every((button) => button.element.disabled)).toBe(true)
    await pointer(source, 'pointerup', 490, 85)
    await target('left', 'pig').trigger('click')
    expect(lineCount()).toBe(0)

    await game.setProps({ active: true })
    await target('left', 'pig').trigger('click')
    expect(lineCount()).toBe(0)
  })

  it('clears tap selection on active changes even without a drag', async () => {
    const { game, target, lineCount } = setupGame()
    await target('left', 'cow').trigger('click')
    expect(target('left', 'cow').attributes('aria-pressed')).toBe('true')
    await game.setProps({ active: false })
    await game.setProps({ active: true })
    await target('right', 'cow').trigger('click')
    expect(lineCount()).toBe(0)
  })

  it('ignores stale pointer releases after a round change and resets completed matches', async () => {
    const { game, target, lineCount, setGeometry } = setupGame()
    setGeometry()
    await target('left', 'pig').trigger('click')
    await target('right', 'pig').trigger('click')
    expect(lineCount()).toBe(1)

    const source = target('left', 'cow').element
    await pointer(source, 'pointerdown', 90, 85)
    await pointer(source, 'pointermove', 250, 85)
    await game.setProps({ roundKey: 'second' })
    setGeometry()
    await pointer(target('left', 'cow').element, 'pointerup', 490, 85)

    expect(game.find('line[data-preview]').exists()).toBe(false)
    expect(lineCount()).toBe(0)
    expect(target('left', 'pig').element.disabled).toBe(false)
    expect(game.emitted('complete')).toBeUndefined()
  })

  it('emits complete once per round even with duplicate events or reactivation', async () => {
    const { game, target, lineCount, setGeometry } = setupGame()
    setGeometry()
    for (const id of ['cow', 'pig']) {
      await target('left', id).trigger('click')
      await target('right', id).trigger('click')
    }

    const source = target('left', 'pig')
    await game.setProps({ active: false })
    await game.setProps({ active: true })
    await pointer(source.element, 'pointerdown', 90, 155)
    await pointer(source.element, 'pointerup', 490, 155)
    await source.trigger('click')
    expect(lineCount()).toBe(2)
    expect(game.emitted('complete')).toEqual([[]])

    await game.setProps({ roundKey: 'next' })
    for (const id of ['cow', 'pig']) {
      await target('right', id).trigger('click')
      await target('left', id).trigger('click')
    }
    expect(game.emitted('complete')).toEqual([[], []])
  })
})
