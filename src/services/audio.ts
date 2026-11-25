export type AudioCue = 'counting' | 'shadow' | 'connect' | 'correct' | 'warning' | 'end' | `number-${number}`

let activeAudio: HTMLAudioElement | undefined

function onPlaybackFinished(event: Event): void {
  if (event.currentTarget === activeAudio) stopAudio()
}

export function stopAudio(): void {
  const audio = activeAudio
  if (!audio) return

  activeAudio = undefined
  audio.removeEventListener('ended', onPlaybackFinished)
  audio.removeEventListener('error', onPlaybackFinished)
  audio.pause()
  audio.removeAttribute('src')
  audio.load()
}

export async function playCue(cue: AudioCue, enabled: boolean): Promise<void> {
  stopAudio()
  if (!enabled) return

  let audio: HTMLAudioElement | undefined
  try {
    audio = new Audio(`/assets/audio/vi/${cue}.mp3`)
    audio.addEventListener('ended', onPlaybackFinished)
    audio.addEventListener('error', onPlaybackFinished)
    activeAudio = audio
    await audio.play()
  } catch {
    if (audio === activeAudio) stopAudio()
  }
}
