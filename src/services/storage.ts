import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

export const SETTINGS_KEY = 'little-steps.settings.v1'
export const SESSION_KEY = 'little-steps.session.v1'

export interface StorageAdapter {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

export function createStorage(): StorageAdapter {
  if (Capacitor.isNativePlatform()) {
    return {
      async get(key) {
        const { value } = await Preferences.get({ key })
        return value
      },
      async set(key, value) {
        await Preferences.set({ key, value })
      },
      async remove(key) {
        await Preferences.remove({ key })
      },
    }
  }

  return {
    async get(key) {
      return window.localStorage.getItem(key)
    },
    async set(key, value) {
      window.localStorage.setItem(key, value)
    },
    async remove(key) {
      window.localStorage.removeItem(key)
    },
  }
}
