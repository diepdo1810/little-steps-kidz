// @vitest-environment jsdom
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { afterEach, expect, it, vi } from 'vitest'
import { createStorage, SESSION_KEY, SETTINGS_KEY } from './storage'

vi.mock('@capacitor/preferences', () => ({
  Preferences: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetAllMocks()
  window.localStorage.clear()
})

it('web_storage_shares_only_the_versioned_keys', async () => {
  const storage = createStorage()
  expect(await storage.get(SESSION_KEY)).toBeNull()

  await storage.set(SETTINGS_KEY, 'settings')
  await storage.set(SESSION_KEY, 'session')
  expect(window.localStorage.getItem('little-steps.settings.v1')).toBe('settings')
  expect(window.localStorage.getItem('little-steps.session.v1')).toBe('session')
  expect(await createStorage().get(SESSION_KEY)).toBe('session')

  await storage.remove(SESSION_KEY)
  expect(await storage.get(SESSION_KEY)).toBeNull()
  expect(await storage.get(SETTINGS_KEY)).toBe('settings')
})

it('storage_errors_propagate', async () => {
  const storage = createStorage()
  const readError = new DOMException('Storage disabled', 'SecurityError')
  const writeError = new DOMException('Storage full', 'QuotaExceededError')
  const removeError = new DOMException('Storage disabled', 'SecurityError')
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw readError })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw writeError })
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw removeError })

  await expect(storage.get(SESSION_KEY)).rejects.toBe(readError)
  await expect(storage.set(SESSION_KEY, 'session')).rejects.toBe(writeError)
  await expect(storage.remove(SESSION_KEY)).rejects.toBe(removeError)
})

it('native_storage_uses_preferences', async () => {
  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
  vi.mocked(Preferences.get).mockResolvedValueOnce({ value: 'session' })
  const writeError = new Error('Native write failed')
  vi.mocked(Preferences.set).mockRejectedValueOnce(writeError)
  const storage = createStorage()

  expect(await storage.get(SESSION_KEY)).toBe('session')
  expect(Preferences.get).toHaveBeenCalledWith({ key: 'little-steps.session.v1' })
  await expect(storage.set(SESSION_KEY, 'session')).rejects.toBe(writeError)
  expect(Preferences.set).toHaveBeenCalledWith({ key: 'little-steps.session.v1', value: 'session' })
  await storage.remove(SESSION_KEY)
  expect(Preferences.remove).toHaveBeenCalledWith({ key: 'little-steps.session.v1' })
})
