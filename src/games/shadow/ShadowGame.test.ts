// @vitest-environment jsdom
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, getAssets } from '../../assets/catalog'
import type { Level } from '../../shared/contracts'
import ShadowGame from './ShadowGame.vue'

enableAutoUnmount(afterEach)

const assets = getAssets('farm')
const sourceSelector = 'button[data-shadow-side="source"]'
const targetSelector = 'button[data-shadow-side="target"]'
const dragSelector = '[data-shadow-drag]'

function setupGame(level: Level = 3, pool = assets.slice(0, 2)) {
  const game = mount(ShadowGame, {
    props: {
      settings: { ...DEFAULT_SETTINGS, game: 'shadow', level },
      assets: pool,
      active: true,
      roundKey: 'first',
    },
  })
  const source = (id: string) => game.get<HTMLButtonElement>(`${sourceSelector}[data-shadow-id="${id}"]`)
  const target = (id: string) => game.get<HTMLButtonElement>(`${targetSelector}[data-shadow-id="${id}"]`)
  const snapped = () => game.findAll(`${targetSelector}[data-shadow-matched] img`)

  function setGeometry() {
    for (const [id, x] of [['cow', 20], ['pig', 140]] as const) {
      vi.spyOn(source(id).element, 'getBoundingClientRect').mockReturnValue(new DOMRect(x, 20, 90, 90))
      vi.spyOn(target(id).element, 'getBoundingClientRect').mockReturnValue(new DOMRect(x, 180, 90, 90))
    }
  }

  return { game, source, target, snapped, setGeometry }
}

async function pointer(element: HTMLElement, type: string, x: number, y: number, id = 1) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 })
  Object.assign(event, { pointerId: id, isPrimary: id === 1 })
  element.dispatchEvent(event)
  await nextTick()
}

describe('ShadowGame', () => {
  it('renders two rows, labeled controls and the same local image on both level 1 tiles', () => {
    const { game, source, target } = setupGame(1, assets.slice(0, 1))
    expect(game.findAll(sourceSelector)).toHaveLength(1)
    expect(game.findAll(targetSelector)).toHaveLength(1)
    expect(source('cow').element.parentElement).not.toBe(target('cow').element.parentElement)
    expect(source('cow').attributes('aria-label')).toBe('Hình Bò')
    expect(target('cow').attributes('aria-label')).toBe('Ô đích ghép Bò')
    expect(target('cow').get('img').attributes('src')).toBe(source('cow').get('img').attributes('src'))
    expect(game.text()).toBe('')
  })

  it('uses the exact source image to mask the level 2 shadow', () => {
    const { source, target } = setupGame(2, assets.slice(0, 1))
    const original = source('cow').get('img').attributes('src')
    expect(target('cow').attributes('aria-label')).toBe('Bóng Bò')
    expect(target('cow').find('img').exists()).toBe(false)
    expect(target('cow').get('.shadow-silhouette').attributes('style')).toContain(`url("${original}")`)
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

  it('tracks a captured drag and snaps by drop coordinates', async () => {
    const { game, source, snapped, setGeometry } = setupGame()
    setGeometry()
    const tile = source('cow').element
    let captured: number | undefined
    tile.setPointerCapture = (id) => { captured = id }
    tile.hasPointerCapture = (id) => captured === id
    tile.releasePointerCapture = () => { captured = undefined }

    await pointer(tile, 'pointerdown', 55, 55)
    expect(captured).toBe(1)
    await pointer(tile, 'pointermove', 65, 140)
    expect(game.get(dragSelector).attributes('src')).toBe(assets[0].image)
    await pointer(tile, 'pointerup', 55, 210)
    expect(captured).toBeUndefined()
    expect(game.find(dragSelector).exists()).toBe(false)
    expect(snapped()).toHaveLength(1)
  })

  it('restores a wrong drop without clearing a locked pair', async () => {
    const { game, source, target, snapped, setGeometry } = setupGame(4, assets.slice(0, 3))
    setGeometry()
    await source('pig').trigger('click')
    await target('pig').trigger('click')
    const tile = source('cow').element
    const wrongTarget = target('rooster').element
    vi.spyOn(wrongTarget, 'getBoundingClientRect').mockReturnValue(new DOMRect(260, 180, 90, 90))
    await pointer(tile, 'pointerdown', 55, 55)
    await pointer(tile, 'pointermove', 155, 155)
    await pointer(tile, 'pointerup', 295, 210)
    expect(game.find(dragSelector).exists()).toBe(false)
    expect(source('cow').attributes('aria-pressed')).toBe('false')
    expect(source('cow').get('img').attributes('src')).toBe(assets[0].image)
    expect(snapped().map((image) => image.attributes('src'))).toEqual([assets[1].image])
    await target('cow').trigger('click')
    expect(snapped()).toHaveLength(1)
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
      await pointer(tile, 'pointermove', 55, 150)
      expect(game.find(dragSelector).exists()).toBe(true)
      if (event === 'resize') {
        window.dispatchEvent(new Event('resize'))
        await nextTick()
      } else {
        await pointer(tile, event, 55, 150)
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
    await pointer(tile, 'pointermove', 55, 150)
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
    await pointer(tile, 'pointermove', 55, 145)
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
    await pointer(source('cow').element, 'pointermove', 55, 145)
    await game.setProps({ roundKey: 'second' })
    setGeometry()
    await pointer(source('cow').element, 'pointerup', 55, 210)
    expect(game.find(dragSelector).exists()).toBe(false)
    expect(source('pig').element.disabled).toBe(false)
    expect(snapped()).toHaveLength(0)
    expect(game.emitted('complete')).toBeUndefined()
  })

  it('emits completion once for each round', async () => {
    const { game, source, target } = setupGame(2, assets.slice(0, 1))
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
