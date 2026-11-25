import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'

const audioDirectory = 'public/assets/audio/vi'
const audioCues = existsSync(audioDirectory)
  ? readdirSync(audioDirectory).filter(name => name.endsWith('.mp3')).map(name => name.slice(0, -4))
  : []

function offlineCache(): Plugin {
  return {
    name: 'little-steps-offline-cache',
    apply: 'build',
    writeBundle(options) {
      const directory = resolve(options.dir ?? 'dist')
      const template = readFileSync('build/service-worker.js', 'utf8')
      const hash = createHash('sha256').update(template)
      const files = readdirSync(directory, { recursive: true, withFileTypes: true })
        .filter(entry => entry.isFile() && /\.(html|js|css|svg|png|mp3|woff2)$/.test(entry.name) && entry.name !== 'sw.js')
        .map(entry => relative(directory, join(entry.parentPath, entry.name)).split(sep).join('/')).sort()

      for (const file of files) hash.update(file).update('\0').update(readFileSync(join(directory, file)))
      const version = hash.digest('hex').slice(0, 20)
      writeFileSync(join(directory, 'sw.js'), template
        .replace('__CACHE_VERSION__', JSON.stringify(version))
        .replace('__LOCAL_URLS__', JSON.stringify(files.map(file => '/' + file))))
    },
  }
}

export default defineConfig({
  plugins: [vue(), offlineCache()],
  define: { __LOCAL_AUDIO_CUES__: JSON.stringify(audioCues) },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
})
