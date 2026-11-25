// @vitest-environment jsdom
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, getAssets } from '../../assets/catalog'
import CountingGame from './CountingGame.vue'

enableAutoUnmount(afterEach)
afterEach(() => vi.restoreAllMocks())

const assets = getAssets('farm').slice(0, 1)

function setupGame(pool = assets) {
  const random = vi.spyOn(Math, 'random').mockReturnValue(0.999)
  const game = mount(CountingGame, {
    props: {
      settings: { ...DEFAULT_SETTINGS, game: 'counting', level: 5 },
      assets: pool,
      active: true,
      roundKey: 'first',
    },
  })
  const objects = () => game.findAll<HTMLButtonElement>('button[aria-pressed]')
  const answers = () => game.findAll<HTMLButtonElement>('button:not([aria-pressed])')
  const correct = () => answers().find((answer) => answer.text() === `${objects().length}`)!
  return { game, random, objects, answers, correct }
}

describe('CountingGame', () => {
  it('renders identical local artwork and only numeric answer text', () => {
    const { game, objects, answers } = setupGame()
    expect(objects()).toHaveLength(10)
    expect(answers()).toHaveLength(3)
    expect(game.findAll('img').map((img) => img.attributes('src'))).toEqual(Array(10).fill(assets[0].image))
    expect(objects().map((button) => button.attributes('aria-label'))).toContain('Hình Bò 10')
    expect(answers().every((answer) => /^(?:[1-9]|10)$/.test(answer.text()))).toBe(true)
    expect(game.text().replace(/\s/g, '')).toBe(answers().map((answer) => answer.text()).join(''))
  })

  it('marks each object once and emits the spoken count for new marks', async () => {
    const { game, objects } = setupGame()
    await objects()[4].trigger('click')
    await objects()[4].trigger('click')
    await objects()[0].trigger('click')
    expect(objects().filter((button) => button.attributes('aria-pressed') === 'true')).toHaveLength(2)
    expect(game.emitted('count')).toEqual([[1], [2]])
    expect(game.emitted('complete')).toBeUndefined()
    expect(objects().every((button) => button.text() === '')).toBe(true)
  })

  it('keeps the same question, choices and marks on a wrong answer', async () => {
    const { game, objects, answers } = setupGame()
    await objects()[0].trigger('click')
    const initialChoices = answers().map((button) => button.text())
    const wrong = answers().find((button) => button.text() !== '10')!
    await wrong.trigger('click')
    expect(objects()).toHaveLength(10)
    expect(objects()[0].attributes('aria-pressed')).toBe('true')
    expect(answers().map((button) => button.text())).toEqual(initialChoices)
    expect(answers().every(({ element }) => !element.disabled)).toBe(true)
    expect(game.emitted('complete')).toBeUndefined()
  })

  it('locks the round and emits completion once even before the DOM update', async () => {
    const { game, objects, answers, correct } = setupGame()
    const correctButton = correct().element
    correctButton.click()
    correctButton.click()
    objects()[0].element.click()
    await nextTick()
    expect(game.emitted('complete')).toEqual([[]])
    expect(game.emitted('count')).toBeUndefined()
    expect([...objects(), ...answers()].every(({ element }) => element.disabled)).toBe(true)
  })

  it('ignores both object and choice clicks while inactive', async () => {
    const { game, objects, answers, correct } = setupGame()
    await game.setProps({ active: false })
    expect([...objects(), ...answers()].every(({ element }) => element.disabled)).toBe(true)
    objects()[0].element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    correct().element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(objects()[0].attributes('aria-pressed')).toBe('false')
    expect(game.emitted('count')).toBeUndefined()
    expect(game.emitted('complete')).toBeUndefined()
  })

  it('creates a new question and resets completion and marks on roundKey changes', async () => {
    const { game, random, objects, correct } = setupGame()
    await objects()[0].trigger('click')
    await correct().trigger('click')
    await game.setProps({ active: false })
    await game.setProps({ active: true })
    expect(correct().element.disabled).toBe(true)

    random.mockReturnValue(0)
    await game.setProps({ roundKey: 'second' })
    expect(objects()).toHaveLength(1)
    expect(objects()[0].attributes('aria-pressed')).toBe('false')
    await objects()[0].trigger('click')
    await correct().trigger('click')
    expect(game.emitted('count')).toEqual([[1], [1]])
    expect(game.emitted('complete')).toEqual([[], []])
  })

  it('leaves an empty asset pool inert with no visible fallback text', () => {
    const { game } = setupGame([])
    expect(game.findAll('button')).toHaveLength(0)
    expect(game.text()).toBe('')
  })
})
