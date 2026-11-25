import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { DEFAULT_SETTINGS } from '../assets/catalog'
import { playCue, stopAudio, type AudioCue } from '../services/audio'
import { boardInset, localCues, unavailableReason } from '../services/settings'
import { createStorage, SETTINGS_KEY, SESSION_KEY } from '../services/storage'
import type { GameId, Settings } from '../shared/contracts'
import { decodeSession, finishRound, isSettings, startSession, stopSession, tick, type Session } from './sessionManager'

type Screen = 'loading' | 'home' | 'settings' | 'learning' | 'end'

interface LearningOrientationPlugin {
  setLearning(options: { active: boolean }): Promise<void>
}

const LearningOrientation = registerPlugin<LearningOrientationPlugin>('LearningOrientation')

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
  const width = ref(window.innerWidth)
  const height = ref(window.innerHeight)
  const safeTop = ref(0)
  const safeBottom = ref(0)
  const landscape = computed(() => width.value > height.value)
  const boardHeight = computed(() => Math.min(width.value, height.value) - boardInset -
    Math.max(0, safeTop.value - 8) - Math.max(0, safeBottom.value - 8))
  const visible = ref(!document.hidden)
  const roundKey = ref('')
  const feedback = ref(false)
  const interactive = computed(() => screen.value === 'learning' && !!roundKey.value &&
    visible.value && landscape.value && !feedback.value)

  let timer: number | undefined
  let nextRound: number | undefined
  let feedbackSaved = false
  let interacted = false
  let alive = true
  let epoch = 0
  let queue = Promise.resolve()
  let writerActions = Promise.resolve()
  let releaseWriter: (() => void) | undefined
  let safeAreaObserver: ResizeObserver | undefined
  let parked = false
  let writerId = ''
  let reviewingFallback = false
  let activationGeneration = 0

  function readSafeInset(name: '--safe-area-inset-top' | '--safe-area-inset-bottom') {
    const probe = document.querySelector('.safe-area-probe')
    const value = Number.parseFloat(probe ? getComputedStyle(probe)[name === '--safe-area-inset-top' ? 'paddingTop' : 'paddingBottom'] : '8')
    return Number.isFinite(value) ? value : 0
  }

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

  function cancelTimers() {
    window.clearInterval(timer)
    window.clearTimeout(nextRound)
    timer = nextRound = undefined
  }

  function leaveLearning() {
    cancelTimers()
    stopAudio()
    roundKey.value = ''
    feedback.value = false
    feedbackSaved = false
    releaseWriter?.()
    releaseWriter = undefined
  }

  function storageFailed() {
    blocked.value = true
    notice.value = 'Không thể lưu dữ liệu trên thiết bị. Hãy kiểm tra bộ nhớ rồi xóa dữ liệu tại đây để bắt đầu lại.'
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
    width.value = window.innerWidth
    height.value = window.innerHeight
    safeTop.value = readSafeInset('--safe-area-inset-top')
    safeBottom.value = readSafeInset('--safe-area-inset-bottom')
    if (!checkClock() || !landscape.value) return
    const reason = unavailableReason(session.value!.settings, boardHeight.value)
    if (reason) {
      notice.value = reason
      stop()
    }
  }

  function startTicker() {
    if (timer === undefined && visible.value && screen.value === 'learning') {
      timer = window.setInterval(checkClock, 200)
    }
  }

  function onVisibility() {
    visible.value = !document.hidden
    if (!visible.value) stopAudio()
    if (!checkClock()) return
    void persist(session.value!)
    if (visible.value) {
      startTicker()
      scheduleNext()
    } else {
      cancelTimers()
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

  function updateSettings(value: Settings) {
    if (!settingsReady.value || blocked.value || clearing.value || screen.value !== 'settings' || !isSettings(value)) return
    settings.value = { ...value }
    reviewingFallback = false
    notice.value = ''
    const encoded = JSON.stringify(value)
    void withWriter(() => enqueue(() => storage.set(SETTINGS_KEY, encoded)))
  }

  async function readSettings(): Promise<Settings | null> {
    const rawSettings = await storage.get(SETTINGS_KEY)
    if (rawSettings === null) return { ...DEFAULT_SETTINGS }
    let decoded: unknown
    try { decoded = JSON.parse(rawSettings) } catch { return null }
    return isSettings(decoded) ? decoded : null
  }

  function reviewFallback(game = DEFAULT_SETTINGS.game) {
    settings.value = { ...DEFAULT_SETTINGS, game }
    reviewingFallback = true
    notice.value = 'Cài đặt đã lưu không hợp lệ. Hãy kiểm tra các giá trị mặc định trước khi bắt đầu.'
    screen.value = 'settings'
  }

  function openSettings(game?: GameId) {
    if (!['home', 'end'].includes(screen.value)) return
    stopAudio()
    // Adult recovery must stay visible even while another tab owns the
    // session writer. Start remains disabled until this callback reloads
    // durable settings under the lock.
    screen.value = 'settings'
    settingsReady.value = false
    if (!blocked.value) notice.value = 'Đang đồng bộ cài đặt trên thiết bị.'
    void withWriter(async () => {
      // A failed session write still needs to expose the adult recovery UI
      // and its warning; do not attempt another storage read first.
      if (blocked.value) {
        screen.value = 'settings'
        return
      }
      const savedSettings = await readSettings()
      if (!alive || parked || blocked.value) return
      settingsReady.value = true
      if (!savedSettings) {
        reviewFallback(game)
        return
      }
      settings.value = savedSettings
      reviewingFallback = false
      notice.value = ''
      if (game && game !== settings.value.game) updateSettings({ ...settings.value, game })
    })
  }

  async function clearData() {
    if (screen.value !== 'settings' || clearing.value) return
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
    startTicker()
    roundKey.value = value.id + '/' + value.completedRounds
    if (fresh) cue(value.settings.game)
  }

  function start() {
    if (screen.value !== 'settings' || !settingsReady.value || blocked.value || clearing.value || !isSettings(settings.value)) return
    const reason = unavailableReason(settings.value, boardHeight.value)
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
        reviewFallback()
        return
      }
      if (savedSettings && JSON.stringify(savedSettings) !== JSON.stringify(settings.value)) {
        settings.value = savedSettings
        reviewingFallback = false
        notice.value = 'Cài đặt đã thay đổi ở cửa sổ khác. Hãy kiểm tra lại trước khi bắt đầu.'
        screen.value = 'settings'
        return
      }
      const reasonAfterSave = unavailableReason(settings.value, boardHeight.value)
      if (reasonAfterSave) {
        notice.value = reasonAfterSave
        screen.value = 'settings'
        return
      }
      if (!savedSettings) {
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
    const probe = document.querySelector('.safe-area-probe')
    if (probe && 'ResizeObserver' in window) {
      safeAreaObserver = new ResizeObserver(checkSize)
      safeAreaObserver.observe(probe)
    }
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
    safeAreaObserver?.disconnect()
    leaveLearning()
  })

  function playInputCue(name: AudioCue) {
    if (allowInput()) {
      interacted = true
      cue(name)
    }
  }
  function home() {
    if (screen.value === 'settings') screen.value = 'home'
  }

  function onAndroidBack(event: Event) {
    if (screen.value === 'home') return
    event.preventDefault()
    if (screen.value === 'settings') {
      screen.value = 'home'
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

  watch(() => screen.value === 'learning', active => {
    if (Capacitor.isNativePlatform()) void LearningOrientation.setLearning({ active }).catch(() => {})
  }, { immediate: true })

  return { screen, settings, session, notice, blocked, clearing, landscape, boardHeight, roundKey, interactive,
    feedback, settingsReady, start, stop, complete, allowInput, playInputCue, openSettings, updateSettings, clearData, home }
}
