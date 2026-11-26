// @vitest-environment jsdom
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, getAssets } from '../../assets/catalog'
import ShadowGame from './ShadowGame.vue'

enableAutoUnmount(afterEach)
afterEach(() => vi.restoreAllMocks())

const assets = getAssets('farm')
const sourceSelector = 'button[data-shadow-side="source"]'
const targetSelector = 'button[data-shadow-side="target"]'
const dragSelector = '[data-shadow-drag]'

function setupGame(roundSize = 2, pool: typeof assets = assets.slice(0, 2)) {
  const random = vi.spyOn(Math, 'random').mockReturnValue(0.21)
  const game = mount(ShadowGame, {
    props: {
      settings: { ...DEFAULT_SETTINGS, game: 'shadow' },
      assets: pool,
      active: true,
      roundKey: 'first',
      roundSize,
    },
  })
  const source = (id: string) => game.get<HTMLButtonElement>(`${sourceSelector}[data-shadow-id="${id}"]`)
  const target = (id: string) => game.get<HTMLButtonElement>(`${targetSelector}[data-shadow-id="${id}"]`)
  const snapped = () => game.findAll(`${targetSelector}[data-shadow-matched] img`)

  function setSourceGeometry(id: string, x: number) {
    vi.spyOn(source(id).element, 'getBoundingClientRect').mockReturnValue(new DOMRect(x, 20, 90, 90))
    vi.spyOn(source(id).get('img').element, 'getBoundingClientRect').mockReturnValue(new DOMRect(x + 10, 30, 70, 70))
  }

  function setTargetGeometry(id: string, x: number) {
    vi.spyOn(target(id).element, 'getBoundingClientRect').mockReturnValue(new DOMRect(x, 180, 90, 90))
  }

  function setGeometry() {
    for (const [id, x] of ([['cow', 20], ['pig', 140]] as const).slice(0, roundSize)) {
      setSourceGeometry(id, x)
      setTargetGeometry(id, x)
    }
  }

  return { game, random, source, target, snapped, setGeometry, setSourceGeometry, setTargetGeometry }
}

function trackPointerCapture(tile: HTMLButtonElement) {
  let captured: number | undefined
  tile.setPointerCapture = (id) => { captured = id }
  tile.hasPointerCapture = (id) => captured === id
  tile.releasePointerCapture = () => {
    const event = new Event('lostpointercapture', { bubbles: true })
    Object.assign(event, { pointerId: captured })
    captured = undefined
    tile.dispatchEvent(event)
  }
}

async function pointer(element: HTMLElement, type: string, x: number, y: number, id = 1) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 })
  Object.assign(event, { pointerId: id, isPrimary: id === 1 })
  element.dispatchEvent(event)
  await nextTick()
}

describe('ShadowGame', () => {
  it('renders a one-pair board with a silhouette of the exact source artwork', () => {
    const { game, source, target } = setupGame(1, assets.slice(0, 1))
    expect(game.findAll(sourceSelector)).toHaveLength(1)
    expect(game.findAll(targetSelector)).toHaveLength(1)
    expect(source('cow').element.parentElement).not.toBe(target('cow').element.parentElement)
    expect(source('cow').attributes('aria-label')).toBe('Hình Bò')
    expect(target('cow').attributes('aria-label')).toBe('Bóng Bò')
    const original = source('cow').get('img').attributes('src')
    expect(target('cow').find('img').exists()).toBe(false)
    expect(target('cow').get('.shadow-silhouette').attributes('style')).toContain(`url("${original}")`)
    expect(game.text()).toBe('')
  })

  it('uses the five requested silhouettes for the full round', async () => {
    const { game, random, source, target, snapped } = setupGame(5, assets)
    const ids = game.findAll<HTMLButtonElement>(sourceSelector).map(button => button.element.dataset.shadowId!)
    expect(ids).toHaveLength(5)
    expect(game.findAll(`${targetSelector} .shadow-silhouette`)).toHaveLength(5)

    random.mockReturnValue(0.999)
    await game.setProps({ active: false, roundSize: 1 })
    window.dispatchEvent(new Event('resize'))
    await game.setProps({ active: true })
    expect(game.findAll(sourceSelector)).toHaveLength(5)

    for (const id of ids.slice(0, 4)) {
      await source(id).trigger('click')
      await target(id).trigger('click')
      expect(game.emitted('complete')).toBeUndefined()
    }
    const id = ids[4]!
    await source(id).trigger('click')
    await target(id).trigger('click')
    expect(snapped()).toHaveLength(5)
    expect(game.emitted('complete')).toEqual([[]])

    await game.setProps({ roundKey: 'second' })
    expect(game.findAll(sourceSelector)).toHaveLength(1)
  })

  it('snaps pointer taps into the target and clears the source slot', async () => {
    const { game, source, target, snapped, setGeometry } = setupGame()
    setGeometry()
    await pointer(source('cow').element, 'pointerdown', 55, 55)
    await pointer(source('cow').element, 'pointerup', 55, 55)
    expect(source('cow').attributes('aria-pressed')).toBe('true')
    await target('cow').trigger('click', { detail: 1 })
    expect(snapped().map((image) => image.attributes('src'))).toEqual([assets[0].image])
    expect(source('cow').find('img').exists()).toBe(false)
    expect(source('cow').element.disabled).toBe(true)
    expect(target('cow').element.disabled).toBe(true)
    expect(game.emitted('complete')).toBeUndefined()
  })

  it('finishes a captured drag using its final pointerup segment', async () => {
    const { game, source, snapped, setGeometry } = setupGame()
    setGeometry()
    const tile = source('cow').element
    trackPointerCapture(tile)

    await pointer(tile, 'pointerdown', 55, 55)
    expect(tile.hasPointerCapture(1)).toBe(true)
    await pointer(tile, 'pointermove', 65, 90)
    expect(game.get(dragSelector).attributes('src')).toBe(assets[0].image)
    await pointer(tile, 'pointerup', 55, 300)
    expect(tile.hasPointerCapture(1)).toBe(false)
    expect(game.find(dragSelector).exists()).toBe(false)
    expect(snapped()).toHaveLength(1)
  })

  it('snaps the artwork center into a correct zone and completes before pointerup', async () => {
    const { game, source, target, snapped, setGeometry } = setupGame(1, assets.slice(0, 1))
    setGeometry()
    const tile = source('cow').element
    trackPointerCapture(tile)

    await pointer(tile, 'pointerdown', 30, 95)
    await pointer(tile, 'pointermove', 5, 120)
    expect(game.find(dragSelector).exists()).toBe(true)
    await pointer(tile, 'pointermove', 5, 145)
    expect(tile.hasPointerCapture(1)).toBe(false)
    expect(game.find(dragSelector).exists()).toBe(false)
    expect(target('cow').get('img').attributes('src')).toBe(assets[0].image)
    expect(source('cow').find('img').exists()).toBe(false)
    expect(game.emitted('complete')).toEqual([[]])

    await pointer(tile, 'pointerup', 5, 145)
    expect(snapped()).toHaveLength(1)
    expect(game.emitted('complete')).toEqual([[]])
  })

  it('restores a wrong crossing, preserves a locked pair, and allows a fresh drag', async () => {
    const { game, source, target, snapped, setGeometry, setTargetGeometry } = setupGame(3, assets.slice(0, 3))
    setGeometry()
    setTargetGeometry('rooster', 260)
    await source('pig').trigger('click')
    await target('pig').trigger('click')
    const tile = source('cow').element
    trackPointerCapture(tile)

    await pointer(tile, 'pointerdown', 55, 55)
    await pointer(tile, 'pointermove', 160, 90)
    await pointer(tile, 'pointermove', 175, 109)
    expect(game.find(dragSelector).exists()).toBe(true)
    expect(tile.hasPointerCapture(1)).toBe(true)
    await pointer(tile, 'pointermove', 200, 140)
    expect(game.find(dragSelector).exists()).toBe(false)
    expect(tile.hasPointerCapture(1)).toBe(false)
    expect(source('cow').attributes('aria-pressed')).toBe('false')
    expect(source('cow').get('img').attributes('src')).toBe(assets[0].image)
    expect(tile.disabled).toBe(false)
    expect(target('rooster').element.disabled).toBe(false)
    expect(target('cow').element.disabled).toBe(false)
    expect(snapped().map((image) => image.attributes('src'))).toEqual([assets[1].image])

    await pointer(tile, 'pointerup', 55, 210)
    await target('cow').trigger('click')
    expect(snapped()).toHaveLength(1)
    await pointer(tile, 'pointerdown', 55, 55)
    await pointer(tile, 'pointermove', 55, 140)
    expect(target('cow').get('img').attributes('src')).toBe(assets[0].image)
    expect(snapped()).toHaveLength(2)
  })

  it('returns a fast carrot drag at the cucumber before reaching the carrot shadow', async () => {
    const vegetables = getAssets('vegetable').filter(({ id }) => id === 'carrot' || id === 'cucumber')
    const { game, source, snapped, setSourceGeometry, setTargetGeometry } = setupGame(2, vegetables)
    setSourceGeometry('carrot', 20)
    setTargetGeometry('cucumber', 140)
    setTargetGeometry('carrot', 310)
    const tile = source('carrot').element
    const original = source('carrot').get('img').attributes('src')
    trackPointerCapture(tile)

    await pointer(tile, 'pointerdown', 55, 55)
    await pointer(tile, 'pointermove', 490, 210)
    expect(tile.hasPointerCapture(1)).toBe(false)
    expect(game.find(dragSelector).exists()).toBe(false)
    expect(source('carrot').get('img').attributes('src')).toBe(original)
    expect(snapped()).toHaveLength(0)

    await pointer(tile, 'pointermove', 355, 210)
    await pointer(tile, 'pointerup', 355, 210)
    expect(snapped()).toHaveLength(0)
    expect(game.emitted('complete')).toBeUndefined()
  })

  it('clears a selected source on a wrong tap', async () => {
    const { source, target, snapped } = setupGame()
    await source('cow').trigger('click')
    expect(source('cow').attributes('aria-pressed')).toBe('true')
    await target('pig').trigger('click')
    expect(source('cow').attributes('aria-pressed')).toBe('false')
    await target('cow').trigger('click')
    expect(snapped()).toHaveLength(0)
  })

  it.each(['pointercancel', 'lostpointercapture', 'resize'] as const)(
    'clears an unfinished drag on %s', async (event) => {
      const { game, source, snapped, setGeometry } = setupGame()
      setGeometry()
      const tile = source('cow').element
      await pointer(tile, 'pointerdown', 55, 55)
      await pointer(tile, 'pointermove', 55, 90)
      expect(game.find(dragSelector).exists()).toBe(true)
      if (event === 'resize') {
        window.dispatchEvent(new Event('resize'))
        await nextTick()
      } else {
        await pointer(tile, event, 55, 90)
      }
      await pointer(tile, 'pointerup', 55, 210)
      expect(game.find(dragSelector).exists()).toBe(false)
      expect(source('cow').find('img').exists()).toBe(true)
      expect(snapped()).toHaveLength(0)
    },
  )

  it('ignores secondary pointers and leaves the active drag usable', async () => {
    const { game, source, snapped, setGeometry } = setupGame()
    setGeometry()
    const tile = source('cow').element
    await pointer(tile, 'pointerdown', 55, 55, 2)
    await pointer(tile, 'pointermove', 55, 150, 2)
    expect(game.find(dragSelector).exists()).toBe(false)
    await pointer(tile, 'pointerdown', 55, 55)
    await pointer(tile, 'pointermove', 55, 90)
    await pointer(tile, 'pointerup', 55, 210, 2)
    expect(game.find(dragSelector).exists()).toBe(true)
    expect(snapped()).toHaveLength(0)
    await pointer(tile, 'pointerup', 55, 210)
    expect(snapped()).toHaveLength(1)
  })

  it('preserves locked pairs and rejects late input when becoming inactive mid-drag', async () => {
    const { game, source, target, snapped, setGeometry } = setupGame()
    setGeometry()
    await source('pig').trigger('click')
    await target('pig').trigger('click')
    const tile = source('cow').element
    await pointer(tile, 'pointerdown', 55, 55)
    await pointer(tile, 'pointermove', 55, 90)
    expect(game.find(dragSelector).exists()).toBe(true)
    await game.setProps({ active: false })
    expect(game.findAll('button').every(({ element }) => element.disabled)).toBe(true)
    expect(game.find(dragSelector).exists()).toBe(false)
    await pointer(tile, 'pointerup', 55, 210)
    expect(snapped()).toHaveLength(1)
    expect(game.emitted('complete')).toBeUndefined()
  })

  it('clears a tap selection when activity stops', async () => {
    const { game, source, target, snapped } = setupGame()
    await source('cow').trigger('click')
    expect(source('cow').attributes('aria-pressed')).toBe('true')
    await game.setProps({ active: false })
    await game.setProps({ active: true })
    await target('cow').trigger('click')
    expect(snapped()).toHaveLength(0)
  })

  it('resets the board and ignores a stale release after roundKey changes', async () => {
    const { game, source, target, snapped, setGeometry } = setupGame()
    setGeometry()
    await source('pig').trigger('click')
    await target('pig').trigger('click')
    expect(snapped()).toHaveLength(1)
    await pointer(source('cow').element, 'pointerdown', 55, 55)
    await pointer(source('cow').element, 'pointermove', 55, 90)
    await game.setProps({ roundKey: 'second' })
    setGeometry()
    await pointer(source('cow').element, 'pointerup', 55, 210)
    expect(game.find(dragSelector).exists()).toBe(false)
    expect(source('pig').element.disabled).toBe(false)
    expect(snapped()).toHaveLength(0)
    expect(game.emitted('complete')).toBeUndefined()
  })

  it('emits completion once for each round', async () => {
    const { game, source, target } = setupGame(1, assets.slice(0, 1))
    const match = async () => {
      await source('cow').trigger('click')
      await target('cow').trigger('click')
    }
    await match()
    await match()
    await game.setProps({ active: false })
    await game.setProps({ active: true })
    await match()
    expect(game.emitted('complete')).toEqual([[]])
    await game.setProps({ roundKey: 'second' })
    await match()
    expect(game.emitted('complete')).toEqual([[], []])
  })

  it('keeps an invalid round inert when the asset pool is undersized', () => {
    const { game } = setupGame(5, assets.slice(0, 2))
    expect(game.findAll('button')).toHaveLength(0)
    expect(game.emitted('complete')).toBeUndefined()
  })
})
