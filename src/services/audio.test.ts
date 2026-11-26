// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { playCue, stopAudio } from './audio'
import type { AudioCue } from './audio'

const media = HTMLMediaElement.prototype

function mockPlayback() {
  return vi.spyOn(media, 'play').mockResolvedValue(undefined)
}

function playedAudio(play: ReturnType<typeof mockPlayback>, index = 0): HTMLAudioElement {
  const audio = play.mock.contexts[index]
  expect(audio).toBeInstanceOf(HTMLAudioElement)
  return audio as HTMLAudioElement
}

beforeEach(() => {
  vi.spyOn(media, 'pause').mockImplementation(() => {})
  vi.spyOn(media, 'load').mockImplementation(() => {})
})

afterEach(() => {
  stopAudio()
  vi.restoreAllMocks()
})

it('muted_does_not_play', async () => {
  const play = mockPlayback()

  await playCue('counting', false)
  expect(play).not.toHaveBeenCalled()

  await playCue('number-1', true)
  const audio = playedAudio(play)
  expect(audio.getAttribute('src')).toBe('/assets/audio/vi/number-1.mp3')

  await playCue('correct', false)
  expect(play).toHaveBeenCalledTimes(1)
  expect(audio.hasAttribute('src')).toBe(false)
})

it('new_cue_stops_previous', async () => {
  const play = mockPlayback()
  const pause = vi.mocked(media.pause)

  await playCue('counting', true)
  await playCue('correct', true)

  expect(play).toHaveBeenCalledTimes(2)
  expect(pause.mock.contexts).toEqual([playedAudio(play)])
  expect(pause.mock.invocationCallOrder[0]).toBeLessThan(play.mock.invocationCallOrder[1])
  expect(playedAudio(play).hasAttribute('src')).toBe(false)
  expect(playedAudio(play, 1).getAttribute('src')).toBe('/assets/audio/vi/correct.mp3')
})

it('failed_audio_does_not_throw', async () => {
  const play = mockPlayback().mockRejectedValueOnce(new DOMException('Playback blocked', 'NotAllowedError'))

  await expect(playCue('shadow', true)).resolves.toBeUndefined()

  expect(play).toHaveBeenCalledTimes(1)
  expect(playedAudio(play).hasAttribute('src')).toBe(false)
})

it('stop_clears_audio', async () => {
  const play = mockPlayback()
  const pause = vi.mocked(media.pause)
  const load = vi.mocked(media.load)

  await playCue('end', true)
  const audio = playedAudio(play)
  expect(audio.getAttribute('src')).toBe('/assets/audio/vi/end.mp3')

  stopAudio()
  stopAudio()

  expect(audio.hasAttribute('src')).toBe(false)
  expect(pause.mock.contexts).toEqual([audio])
  expect(load.mock.contexts).toEqual([audio])
})

it('cue_paths_are_local', async () => {
  const cues: Array<[AudioCue, string]> = [
    ['counting', '/assets/audio/vi/counting.mp3'],
    ['shadow', '/assets/audio/vi/shadow.mp3'],
    ['connect', '/assets/audio/vi/connect.mp3'],
    ['correct', '/assets/audio/vi/correct.mp3'],
    ['warning', '/assets/audio/vi/warning.mp3'],
    ['end', '/assets/audio/vi/end.mp3'],
    ['number-1', '/assets/audio/vi/number-1.mp3'],
    ['number-10', '/assets/audio/vi/number-10.mp3'],
  ]
  const paths: string[] = []
  vi.spyOn(media, 'play').mockImplementation(function (this: HTMLMediaElement) {
    paths.push(this.getAttribute('src') ?? '')
    return Promise.resolve()
  })

  for (const [cue] of cues) await playCue(cue, true)

  expect(paths).toEqual(cues.map(([, path]) => path))
})

it.each(['ended', 'error'])('audio_%s_releases_the_element', async (event) => {
  const play = mockPlayback()
  const pause = vi.mocked(media.pause)

  await playCue('counting', true)
  const audio = playedAudio(play)

  audio.dispatchEvent(new Event(event))
  expect(audio.hasAttribute('src')).toBe(false)
  stopAudio()

  expect(pause.mock.contexts).toEqual([audio])
})

it('previous_playback_failure_does_not_stop_the_new_cue', async () => {
  let rejectOldPlayback!: (error: DOMException) => void
  const oldPlayback = new Promise<void>((_, reject) => { rejectOldPlayback = reject })
  const play = mockPlayback().mockReturnValueOnce(oldPlayback)

  const pending = playCue('number-1', true)
  await playCue('number-2', true)
  const next = playedAudio(play, 1)
  expect(next.getAttribute('src')).toBe('/assets/audio/vi/number-2.mp3')

  rejectOldPlayback(new DOMException('Old playback stopped', 'AbortError'))
  await expect(pending).resolves.toBeUndefined()

  expect(next.getAttribute('src')).toBe('/assets/audio/vi/number-2.mp3')
})
