import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { ThemeId } from '../shared/contracts'
import { DEFAULT_SETTINGS, getAssets, shuffle } from './catalog'

const themes: readonly ThemeId[] = ['farm', 'fruit', 'sea', 'vegetable', 'school']

describe('asset catalog', () => {
  it('catalog_has_unique_ids_and_six_assets_per_theme', () => {
    const ids = new Set<string>()

    for (const theme of themes) {
      const assets = getAssets(theme)
      expect(assets).toHaveLength(6)
      for (const asset of assets) {
        expect(asset.theme).toBe(theme)
        expect(asset.labelVi.trim()).not.toBe('')
        expect(asset.id).toMatch(/^[a-z]+(?:-[a-z]+)*$/)
        expect(ids.has(asset.id)).toBe(false)
        ids.add(asset.id)
      }
    }

    expect(ids.size).toBe(30)
  })

  it('all_asset_paths_exist_and_are_local', () => {
    const paths = themes.flatMap((theme) => getAssets(theme).map((asset) => asset.image))
    expect(new Set(paths).size).toBe(30)
    const licenses = readFileSync(new URL('../../public/assets/LICENSES.md', import.meta.url), 'utf8')

    for (const path of paths) {
      expect(path).toMatch(/^\/assets\/images\/[a-z-]+\.(svg|png)$/)
      expect(existsSync(new URL(`../../public${path}`, import.meta.url)), path).toBe(true)
      expect(licenses).toContain('`' + path.split('/').at(-1) + '`')
    }
  })

  it('rejects an unsupported theme', () => {
    expect(() => getAssets('unknown' as ThemeId)).toThrow(/theme/i)
  })
})

describe('shuffle', () => {
  it('shuffle_preserves_input_and_elements', () => {
    const items = Object.freeze(['cow', 'pig', 'duck'])
    const result = shuffle(items, () => 0)

    expect(result).toEqual(['pig', 'duck', 'cow'])
    expect(result).not.toBe(items)
    expect(items).toEqual(['cow', 'pig', 'duck'])
  })

  it('rejects an empty pool', () => {
    expect(() => shuffle([], () => 0)).toThrow(/pool/i)
  })

  it.each([-0.01, 1, Number.NaN, Number.POSITIVE_INFINITY])('rejects RNG sample %s', (sample) => {
    expect(() => shuffle(['cow', 'pig'], () => sample)).toThrow(/rng/i)
  })
})

it('default_settings_are_finite_and_quiet', () => {
  expect(DEFAULT_SETTINGS).toEqual({
    game: 'connect',
    theme: 'farm',
    level: 1,
    minutes: 5,
    roundLimit: 3,
    audio: false,
    reducedMotion: true,
  })
})
