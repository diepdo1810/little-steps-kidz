import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { DEFAULT_SETTINGS } from '../assets/catalog'
import { playCue, stopAudio, type AudioCue } from '../services/audio'
import { decodeSettings, localCues, unavailableReason } from '../services/settings'
import { createStorage, SETTINGS_KEY, SESSION_KEY } from '../services/storage'
import type { GameId, Settings } from '../shared/contracts'
import { decodeSession, finishRound, isSettings, startSession, stopSession, tick, type Session } from './sessionManager'

type AdultScreen = 'settings' | 'preferences'
type Screen = 'loading' | 'home' | AdultScreen | 'learning' | 'end'

function canResume(rawGrant: string | null, writer: unknown, session: Session, now: number) {
  if (!rawGrant || typeof writer !== 'string') return false
  try {
    const grant = JSON.parse(rawGrant) as Record<string, unknown> | null
    return grant?.writerId === writer && grant.id === session.id && grant.completedRounds === session.completedRounds &&
      typeof grant.lastSeenAt === 'number' && grant.lastSeenAt >= session.startedAt && grant.lastSeenAt <= now
  } catch {
    return false
  }
}

export function useSession() {
  const storage = createStorage()
  const screen = ref<Screen>('loading')
  const settings = shallowRef<Settings>({ ...DEFAULT_SETTINGS })
  const session = shallowRef<Session | null>(null)
  const notice = ref('')
  const blocked = ref(false)
  const settingsReady = ref(false)
  const clearing = ref(false)
  const landscape = ref(window.innerWidth > window.innerHeight)
  const visible = ref(!document.hidden)
  const roundKey = ref('')
  const feedback = ref(false)
  const interactive = computed(() => screen.value === 'learning' && !!roundKey.value &&
    visible.value && landscape.value && !feedback.value)

  let nextRound: number | undefined
  let feedbackSaved = false
  let interacted = false
  let alive = true
  let epoch = 0
  let queue = Promise.resolve()
  let writerActions = Promise.resolve()
  let releaseWriter: (() => void) | undefined
  let parked = false
  let writerId = ''
  let reviewingFallback = false
  let activationGeneration = 0

  function randomId() {
    return Array.from(crypto.getRandomValues(new Uint32Array(4)), n => n.toString(16).padStart(8, '0')).join('')
  }

  // Keep the origin lock through the active board and its final queued write.
  // Adult operations use the same lock briefly. A second tab can retry after Stop.
  function withWriter(operation: () => Promise<unknown>) {
    const run = async () => {
      if (!alive || parked) return
      if (!navigator.locks) {
        notice.value = 'Để lưu phiên an toàn, hãy mở ứng dụng qua HTTPS hoặc trên thiết bị Android được hỗ trợ.'
        if (screen.value === 'loading') screen.value = 'end'
        return
      }
      await navigator.locks.request(SESSION_KEY, { ifAvailable: true }, async lock => {
        if (!alive || parked) return
        if (!lock) {
          notice.value = 'Một cửa sổ khác đang sử dụng phiên học. Hãy dừng phiên ở đó rồi thử lại.'
          if (screen.value === 'loading') screen.value = 'end'
          return
        }
        await operation()
        if (alive && !parked && screen.value === 'learning') {
          await new Promise<void>(resolve => { releaseWriter = resolve })
        }
        await queue
      })
    }
    writerActions = writerActions.then(run).catch(() => { if (alive) storageFailed() })
    return writerActions
  }

  function cancelNextRound() {
    window.clearTimeout(nextRound)
    nextRound = undefined
  }

  function leaveLearning() {
    cancelNextRound()
    stopAudio()
    roundKey.value = ''
    feedback.value = false
    feedbackSaved = false
    releaseWriter?.()
    releaseWriter = undefined
  }

  function storageFailed() {
    blocked.value = true
    notice.value = 'Không thể lưu dữ liệu trên thiết bị. Hãy kiểm tra bộ nhớ rồi xóa dữ liệu trong Cài đặt người lớn để bắt đầu lại.'
    // A settings save can fail while Start is queued behind it. There is no
    // session to end yet, so return the adult to the form with its warning.
    if (screen.value === 'loading' && session.value === null) {
      screen.value = 'settings'
      return
    }
    if (screen.value === 'learning' || screen.value === 'loading') {
      leaveLearning()
      screen.value = 'end'
      if (session.value?.status === 'active') session.value = stopSession(session.value, Date.now())
    }
  }

  // Native Preferences writes are async. Preserve chronology across rounds, stop and clear.
  function enqueue(operation: () => Promise<void>) {
    const submitted = epoch
    const result = queue.then(async () => {
      if (submitted !== epoch) return false
      try {
        await operation()
        return true
      } catch {
        epoch++
        if (alive) storageFailed()
        // An active snapshot alone cannot resume, even if this cleanup also fails.
        try { await storage.remove(SESSION_KEY) } catch { /* Storage may be entirely unavailable. */ }
        return false
      }
    })
    queue = result.then(() => {})
    return result
  }

  function persist(value: Session) {
    const snapshot = JSON.stringify(value.status === 'active' ? { ...value, writerId } : value)
    return enqueue(() => storage.set(SESSION_KEY, snapshot))
  }

  function cue(name: AudioCue) {
    if (interacted && visible.value && session.value?.settings.audio && localCues.has(name)) {
      void playCue(name, true)
    }
  }

  function end(value: Session) {
    leaveLearning()
    session.value = value
    screen.value = 'end'
    void persist(value)
    cue('end')
  }

  function checkClock() {
    const current = session.value
    if (screen.value !== 'learning' || current?.status !== 'active') return false
    const checked = tick(current, Date.now())
    if (checked.status === 'ended') {
      end(checked)
      return false
    }
    session.value = checked
    return true
  }

  function allowInput() {
    return checkClock() && interactive.value && !document.hidden
  }

  function scheduleNext() {
    if (!feedbackSaved || nextRound !== undefined || !visible.value || !checkClock()) return
    nextRound = window.setTimeout(() => {
      nextRound = undefined
      if (!checkClock() || document.hidden) return
      feedbackSaved = false
      feedback.value = false
      roundKey.value = session.value!.id + '/' + session.value!.completedRounds
    }, 420)
  }

  async function complete() {
    if (!allowInput()) return
    feedback.value = true
    feedbackSaved = false
    const value = finishRound(session.value!, Date.now())
    if (value.status === 'ended') {
      end(value)
      return
    }
    session.value = value
    cue('correct')
    if (await persist(value) && alive && session.value?.id === value.id && checkClock()) {
      feedbackSaved = true
      scheduleNext()
    }
  }

  function stop() {
    if (checkClock()) end(stopSession(session.value!, Date.now()))
  }

  function checkSize() {
    landscape.value = window.innerWidth > window.innerHeight
    checkClock()
  }

  function onVisibility() {
    visible.value = !document.hidden
    if (!visible.value) stopAudio()
    if (!checkClock()) return
    void persist(session.value!)
    if (visible.value) {
      scheduleNext()
    } else {
      cancelNextRound()
    }
  }

  function onPageHide() {
    if (checkClock() && roundKey.value) {
      // A clean exit grants one reload after outstanding saves finish. A new
      // writer ID on every activation also invalidates any copied tab grant.
      const { id, lastSeenAt, completedRounds } = session.value!
      const grant = JSON.stringify({ id, writerId, lastSeenAt, completedRounds })
      const submitted = epoch
      void queue.then(() => {
        if (!parked || submitted !== epoch || blocked.value) return
        try { sessionStorage.setItem(SESSION_KEY, grant) } catch { /* Require adult restart. */ }
      })
    }
    parked = true
    leaveLearning()
    screen.value = 'loading'
  }

  function onPageShow() {
    if (!parked) return onVisibility()
    parked = false
    visible.value = !document.hidden
    void withWriter(restore)
  }

  function isAdultScreen() {
    return screen.value === 'settings' || screen.value === 'preferences'
  }

  function updateSettings(changes: Partial<Settings>) {
    const value = { ...settings.value, ...changes }
    if (!settingsReady.value || blocked.value || clearing.value || !isAdultScreen() || !isSettings(value)) return
    settings.value = value
    reviewingFallback = false
    notice.value = ''
    void withWriter(async () => {
      if (blocked.value) return
      await enqueue(async () => {
        // The two adult views can stay open in separate tabs. Merge only
        // the edited fields so hidden preferences are never overwritten.
        const saved = await readSettings()
        await storage.set(SETTINGS_KEY, JSON.stringify(saved ? { ...saved, ...changes } : value))
      })
    })
  }

  async function readSettings(): Promise<Settings | null> {
    const rawSettings = await storage.get(SETTINGS_KEY)
    if (rawSettings === null) return { ...DEFAULT_SETTINGS }
    const decoded = decodeSettings(rawSettings)
    if (decoded?.migrated) await storage.set(SETTINGS_KEY, JSON.stringify(decoded.settings))
    return decoded?.settings ?? null
  }

  function reviewFallback(game: GameId, target: AdultScreen) {
    settings.value = { ...DEFAULT_SETTINGS, game }
    reviewingFallback = true
    notice.value = 'Cài đặt đã lưu không hợp lệ. Hãy kiểm tra các giá trị mặc định.'
    screen.value = target
  }

  function openAdult(target: AdultScreen, game?: GameId) {
    stopAudio()
    // Keep recovery visible while another tab owns the writer. Editable
    // fields wait for the durable settings read under the same lock.
    screen.value = target
    settingsReady.value = false
    const expectedEntry = ++activationGeneration
    if (game) settings.value = { ...settings.value, game }
    if (!blocked.value) notice.value = 'Đang đồng bộ cài đặt trên thiết bị.'
    void withWriter(async () => {
      if (blocked.value || expectedEntry !== activationGeneration) return
      const savedSettings = await readSettings()
      if (!alive || parked || blocked.value || expectedEntry !== activationGeneration) return
      settingsReady.value = true
      if (!savedSettings) {
        reviewFallback(game ?? DEFAULT_SETTINGS.game, target)
        return
      }
      settings.value = savedSettings
      reviewingFallback = false
      notice.value = ''
      if (game && game !== savedSettings.game) updateSettings({ game })
    })
  }

  function openSettings(game?: GameId) {
    if (screen.value === 'home' || screen.value === 'end') {
      openAdult('settings', game ?? session.value?.settings.game)
    }
  }

  function openPreferences() {
    if (screen.value === 'home') openAdult('preferences')
  }

  async function clearData() {
    if (screen.value !== 'preferences' || clearing.value) return
    clearing.value = true
    let ok = false
    await withWriter(async () => {
      ok = await enqueue(async () => {
        await storage.remove(SESSION_KEY)
        await storage.remove(SETTINGS_KEY)
        sessionStorage.removeItem(SESSION_KEY)
      })
    })
    clearing.value = false
    if (ok && alive) {
      settings.value = { ...DEFAULT_SETTINGS }
      reviewingFallback = false
      session.value = null
      blocked.value = false
      settingsReady.value = true
      notice.value = 'Đã xóa dữ liệu trên thiết bị.'
    }
  }

  async function activate(value: Session, fresh: boolean, expectedStart?: number) {
    writerId = randomId()
    if (!await persist(value) || !alive || parked) return
    if (expectedStart !== undefined && (expectedStart !== activationGeneration || screen.value !== 'loading')) {
      await persist(stopSession(value, Date.now()))
      return
    }
    session.value = value
    screen.value = 'learning'
    checkSize()
    if (!checkClock()) return
    roundKey.value = value.id + '/' + value.completedRounds
    if (fresh) cue(value.settings.game)
  }

  function start() {
    if (screen.value !== 'settings' || !settingsReady.value || blocked.value || clearing.value || !isSettings(settings.value)) return
    const reason = unavailableReason(settings.value)
    if (reason) {
      notice.value = reason
      return
    }
    interacted = true
    notice.value = ''
    screen.value = 'loading'
    const expectedStart = ++activationGeneration
    void withWriter(async () => {
      // A queued adult setting write may have failed while this Start was
      // waiting for the writer lock. Re-check only after that queue drains.
      if (blocked.value || clearing.value || screen.value !== 'loading') return
      const savedSettings = await readSettings()
      if (!alive || parked || blocked.value || clearing.value || expectedStart !== activationGeneration || screen.value !== 'loading') return
      if (!savedSettings && !reviewingFallback) {
        reviewFallback(settings.value.game, 'settings')
        return
      }
      const refreshed = savedSettings && { ...savedSettings, game: settings.value.game }
      if (refreshed && JSON.stringify(refreshed) !== JSON.stringify(settings.value)) {
        settings.value = refreshed
        reviewingFallback = false
        notice.value = 'Cài đặt đã thay đổi ở cửa sổ khác. Hãy kiểm tra lại trước khi bắt đầu.'
        screen.value = 'settings'
        return
      }
      const reasonAfterSave = unavailableReason(settings.value)
      if (reasonAfterSave) {
        notice.value = reasonAfterSave
        screen.value = 'settings'
        return
      }
      if (!savedSettings || savedSettings.game !== settings.value.game) {
        const approved = JSON.stringify(settings.value)
        if (!await enqueue(() => storage.set(SETTINGS_KEY, approved)) || !alive || parked ||
          expectedStart !== activationGeneration || screen.value !== 'loading') return
      }
      await activate(startSession(randomId(), settings.value, Date.now()), true, expectedStart)
    })
  }

  async function restore() {
    const expectedActivation = ++activationGeneration
    try {
      const [savedSettings, rawSession] = await Promise.all([readSettings(), storage.get(SESSION_KEY)])
      if (!alive || parked) return
      if (screen.value !== 'loading' || expectedActivation !== activationGeneration) {
        // Back can cancel startup while the native durable read is pending.
        // The synchronous grant removal prevents an immediate reload from
        // resuming; this terminal write also closes the old active snapshot.
        if (screen.value !== 'loading') {
          const pending = decodeSession(rawSession, Date.now())
          if (pending?.status === 'active') {
            await enqueue(() => storage.set(SESSION_KEY, JSON.stringify(stopSession(pending, Date.now()))))
          }
        }
        return
      }
      settings.value = savedSettings ?? { ...DEFAULT_SETTINGS }
      session.value = null
      notice.value = ''
      blocked.value = false
      const now = Date.now()
      const value = decodeSession(rawSession, now)
      const rawGrant = sessionStorage.getItem(SESSION_KEY)
      if (rawGrant !== null) sessionStorage.removeItem(SESSION_KEY)
      if (value?.status === 'active') {
        if (canResume(rawGrant, JSON.parse(rawSession!).writerId, value, now)) {
          await activate(value, false, expectedActivation)
        } else {
          notice.value = 'Phiên trước đã bị gián đoạn. Người lớn có thể bắt đầu phiên mới.'
          end({ ...value, status: 'ended', reason: 'invalid' })
        }
      } else if (rawSession !== null) {
        session.value = value
        screen.value = 'end'
        if (!value || value.reason === 'invalid') notice.value = 'Phiên đã kết thúc vì dữ liệu hoặc giờ thiết bị không hợp lệ.'
        if (value && JSON.stringify(value) !== rawSession) void persist(value)
      } else {
        screen.value = 'home'
      }
    } catch {
      if (alive) storageFailed()
    }
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('resume', onVisibility)
    window.addEventListener('littleStepsBack', onAndroidBack)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('focus', checkClock)
    window.addEventListener('resize', checkSize)
    checkSize()
    void withWriter(restore)
  })
  onBeforeUnmount(() => {
    alive = false
    document.removeEventListener('visibilitychange', onVisibility)
    document.removeEventListener('resume', onVisibility)
    window.removeEventListener('littleStepsBack', onAndroidBack)
    window.removeEventListener('pageshow', onPageShow)
    window.removeEventListener('pagehide', onPageHide)
    window.removeEventListener('focus', checkClock)
    window.removeEventListener('resize', checkSize)
    leaveLearning()
  })

  function playInputCue(name: AudioCue) {
    if (allowInput()) {
      interacted = true
      cue(name)
    }
  }
  function home() {
    if (!isAdultScreen() || clearing.value) return
    activationGeneration++
    screen.value = 'home'
  }

  function onAndroidBack(event: Event) {
    if (screen.value === 'home') return
    event.preventDefault()
    if (isAdultScreen()) {
      home()
    } else if (screen.value === 'learning') {
      stop()
    } else if (screen.value === 'end') {
      screen.value = 'home'
    } else if (screen.value === 'loading') {
      activationGeneration++
      try { sessionStorage.removeItem(SESSION_KEY) } catch { /* Prevent resume grant reuse when storage is unavailable. */ }
      screen.value = 'home'
    }
  }

  return { screen, settings, session, notice, blocked, clearing, landscape, roundKey, interactive,
    feedback, settingsReady, start, stop, complete, allowInput, playInputCue, openSettings, openPreferences, updateSettings, clearData, home }
}
