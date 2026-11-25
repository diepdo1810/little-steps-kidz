import { expect, test, type Locator, type Page } from '@playwright/test'
import { DEFAULT_SETTINGS } from '../src/assets/catalog'
import { SESSION_KEY, SETTINGS_KEY } from '../src/services/storage'
import type { Session } from '../src/session/sessionManager'

test.use({ viewport: { width: 800, height: 360 }, actionTimeout: 3500 })
const games = { connect: 'Nối hình giống nhau', shadow: 'Ghép hình với bóng', counting: 'Đếm đồ vật' }
const stop = (page: Page) => page.getByRole('button', { name: 'Dừng phiên' })
const end = (page: Page) => page.getByRole('region', { name: 'Đã kết thúc phiên' })
const start = (page: Page) => page.getByRole('button', { name: 'Bắt đầu' })
const adult = (page: Page) => page.getByRole('button', { name: 'Cài đặt người lớn' })
async function openSettings(page: Page, game: keyof typeof games) {
  if (page.url() === 'about:blank') await page.goto('/')
  await page.getByRole('button', { name: games[game], exact: true }).click()
}
async function play(page: Page, game: keyof typeof games = 'connect', level = 1, rounds = 3) {
  await openSettings(page, game)
  await page.getByRole('combobox', { name: 'Mức độ', exact: true }).selectOption(String(level))
  await page.getByRole('combobox', { name: 'Số lượt tối đa', exact: true }).selectOption(String(rounds))
  await start(page).click()
  await expect(stop(page)).toBeVisible()
}
async function saved(page: Page): Promise<Session | null> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), SESSION_KEY)
}
async function correctCount(page: Page) {
  await expect(page.locator('.counting-object').first()).toBeVisible()
  const n = await page.locator('.counting-object').count()
  await page.getByRole('button', { name: String(n), exact: true }).click()
}
async function center(target: Locator) {
  const box = await target.boundingBox()
  if (!box) throw Error('Missing target geometry')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}
async function drag(page: Page, source: Locator, target: Locator, release = true) {
  const from = await center(source), to = await center(target)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 5 })
  if (release) await page.mouse.up()
}
function connect(page: Page, side: string, id?: string) {
  return page.locator(`[data-connect-side="${side}"]${id ? `[data-connect-id="${id}"]` : ''}`)
}
async function connectIds(page: Page) {
  return connect(page, 'left').evaluateAll((buttons) => buttons.map(b => (b as HTMLElement).dataset.connectId!))
}
async function screenshot(page: Page, name: string) {
  const path = test.info().outputPath(name + '.png')
  await page.screenshot({ path })
  await test.info().attach(name, { path, contentType: 'image/png' })
}

test('connect_two_pairs_tap_and_drag', async ({ page }) => {
  await play(page, 'connect', 1, 1)
  await screenshot(page, 'connect-landscape')
  const [a, b] = await connectIds(page)
  await connect(page, 'right', a).click()
  await connect(page, 'left', a).click()
  await expect(page.locator('.connect-lines line')).toHaveCount(1)
  await drag(page, connect(page, 'left', b), connect(page, 'right', b))
  await expect(end(page)).toBeVisible()
  expect((await saved(page))?.reason).toBe('rounds')
})

test('connect_wrong_pair_cancel_resize', async ({ page }) => {
  await play(page)
  const [a, b] = await connectIds(page)
  await drag(page, connect(page, 'left', a), connect(page, 'right', b))
  await expect(page.locator('.connect-lines line')).toHaveCount(0)
  await drag(page, connect(page, 'left', b), connect(page, 'right', b), false)
  await expect(page.locator('line[data-preview]')).toBeVisible()
  await connect(page, 'left', b).dispatchEvent('pointercancel', { pointerId: 1 })
  await page.mouse.up()
  await expect(page.locator('.connect-lines line')).toHaveCount(0)
  await connect(page, 'left', b).click()
  await connect(page, 'right', b).click()
  const line = page.locator('.connect-lines line')
  const before = await line.getAttribute('x2')
  await page.setViewportSize({ width: 568, height: 320 })
  await expect(line).not.toHaveAttribute('x2', before!)
  expect((await saved(page))?.completedRounds).toBe(0)
})

test('connect_small_height_disables_six_pairs', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 450 })
  await openSettings(page, 'connect')
  const level = page.getByRole('combobox', { name: 'Mức độ', exact: true })
  await level.selectOption('5')
  await page.setViewportSize({ width: 568, height: 320 })
  await expect(level.locator('option[value="5"]')).toBeDisabled()
  await expect(level).toHaveValue('5')
  await expect(start(page)).toBeDisabled()
  await expect(page.getByText(/chiều cao/i).first()).toBeVisible()
})

test('connect_safe_area_insets_are_included_in_level_capacity', async ({ page }) => {
  await page.setViewportSize({ width: 740, height: 384 })
  await openSettings(page, 'connect')
  const level = page.getByRole('combobox', { name: 'Mức độ', exact: true })
  await level.selectOption('5')
  await page.evaluate(() => {
    const style = document.createElement('style')
    style.id = 'safe-area-test'
    style.textContent = ':root { --safe-area-inset-top: 32px; --safe-area-inset-bottom: 24px; }'
    document.head.append(style)
  })
  await expect(level.locator('option[value="5"]')).toBeDisabled()
  await expect(start(page)).toBeDisabled()
  await page.evaluate(() => { document.querySelector('#safe-area-test')!.textContent = ':root { --safe-area-inset-top: 0px; --safe-area-inset-bottom: 0px; }' })
  await expect(level.locator('option[value="5"]')).toBeEnabled()
  await start(page).click()
  await expect(stop(page)).toBeVisible()
  await page.evaluate(() => { document.querySelector('#safe-area-test')!.textContent = ':root { --safe-area-inset-top: 32px; --safe-area-inset-bottom: 24px; }' })
  await expect(end(page)).toBeVisible()
  expect((await saved(page))?.reason).toBe('stopped')
})

test('shadow_snap_and_wrong_drop', async ({ page }) => {
  await play(page, 'shadow', 3, 1)
  await screenshot(page, 'shadow-landscape')
  const sources = page.locator('[data-shadow-side="source"]')
  const [a, b] = await sources.evaluateAll((els) => els.map(el => (el as HTMLElement).dataset.shadowId!))
  const target = (id: string) => page.locator(`[data-shadow-side="target"][data-shadow-id="${id}"]`)
  await drag(page, sources.first(), target(b))
  await expect(page.locator('[data-shadow-matched]')).toHaveCount(0)
  await drag(page, sources.first(), target(a))
  await expect(target(a)).toBeDisabled()
  await sources.nth(1).click()
  await target(b).click()
  await expect(end(page)).toBeVisible()
})

test('count_wrong_then_correct', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0.75 })
  await play(page, 'counting', 3, 1)
  const pictures = page.locator('.counting-object img')
  await expect(pictures).toHaveCount(4)
  for (const picture of await pictures.all()) {
    await expect(picture).toBeVisible()
    const artwork = await picture.evaluate(async element => {
      const img = element as HTMLImageElement
      await img.decode()
      const box = img.getBoundingClientRect()
      return { path: new URL(img.currentSrc).pathname, dimensions: [img.naturalWidth, img.naturalHeight, box.width, box.height] }
    })
    expect(artwork.path).toBe('/assets/images/duck.svg')
    expect(Math.min(...artwork.dimensions)).toBeGreaterThan(0)
  }
  await screenshot(page, 'counting-landscape')
  const objects = page.locator('.counting-object')
  const n = await objects.count()
  await objects.first().click()
  await objects.first().click()
  await expect(page.locator('.counting-object[aria-pressed=true]')).toHaveCount(1)
  await page.locator('.counting-choice').filter({ hasNotText: new RegExp('^' + n + '$') }).first().click()
  await expect(objects).toHaveCount(n)
  expect((await saved(page))?.completedRounds).toBe(0)
  await correctCount(page)
  await expect(end(page)).toBeVisible()
})

test('three_rounds_ends_no_restart', async ({ page }) => {
  await play(page, 'counting')
  for (let round = 1; round <= 3; round++) {
    await correctCount(page)
    await expect.poll(async () => (await saved(page))?.completedRounds).toBe(round)
    if (round < 3) await expect(page.locator('.round-feedback')).toHaveCount(0)
  }
  await expect(end(page)).toBeVisible()
  await page.reload()
  await expect(end(page)).toBeVisible()
  await expect(start(page)).toHaveCount(0)
  await adult(page).click()
  await expect(start(page)).toBeEnabled()
  expect((await saved(page))?.status).toBe('ended')
})

for (const scenario of ['drag', 'feedback'] as const) {
  test('expiry_during_drag_or_feedback / ' + scenario, async ({ page }) => {
    await page.clock.install()
    await play(page, scenario === 'drag' ? 'connect' : 'counting')
    const session = (await saved(page))!
    if (scenario === 'drag') {
      const [a] = await connectIds(page)
      await drag(page, connect(page, 'left', a), connect(page, 'right', a), false)
      await expect(page.locator('line[data-preview]')).toBeVisible()
      // Change only wall time; the pointer release itself must check the deadline.
      await page.clock.setSystemTime(session.deadlineAt)
      await page.mouse.up()
    } else {
      await correctCount(page)
      await expect(page.locator('.round-feedback')).toBeVisible()
      await page.clock.setSystemTime(session.deadlineAt)
      await page.clock.runFor(600)
    }
    await expect(end(page)).toBeVisible()
    await page.clock.runFor(1000)
    expect(await saved(page)).toMatchObject({ status: 'ended', reason: 'time', completedRounds: scenario === 'drag' ? 0 : 1 })
    await expect(page.locator('.round-feedback, .connect-game, .counting-game')).toHaveCount(0)
  })
}

test('reload_and_background_do_not_extend', async ({ page }) => {
  await page.clock.install()
  await play(page, 'counting')
  await correctCount(page)
  const original = (await saved(page))!
  await page.reload()
  await expect(stop(page)).toBeVisible()
  expect(await saved(page)).toMatchObject({ deadlineAt: original.deadlineAt, completedRounds: 1, id: original.id })
  // Chromium headless doesn't background the tab; simulate the OS visibility signal.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.clock.setSystemTime(original.deadlineAt + 100)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(end(page)).toBeVisible()
  expect(await saved(page)).toMatchObject({ deadlineAt: original.deadlineAt, reason: 'time' })
})

for (const action of ['stop', 'clear'] as const) {
  test('suspended_tab_cannot_undo_' + action, async ({ page, context }) => {
    await play(page, 'counting')
    const other = await context.newPage()
    await other.goto('/')
    await expect(other.locator('.counting-game, .session-end')).toBeVisible()
    const devtools = await context.newCDPSession(other)
    await devtools.send('Page.setWebLifecycleState', { state: 'frozen' })
    await stop(page).click()
    await expect.poll(async () => (await saved(page))?.reason).toBe('stopped')
    if (action === 'clear') {
      await adult(page).click()
      await page.getByRole('button', { name: 'Xóa dữ liệu trên thiết bị' }).click()
      await expect.poll(() => saved(page)).toBeNull()
    }
    await devtools.send('Page.setWebLifecycleState', { state: 'active' })
    await other.evaluate(() => {
      window.dispatchEvent(new Event('focus'))
      document.dispatchEvent(new Event('resume'))
      const quantity = document.querySelectorAll('.counting-object').length
      const choice = [...document.querySelectorAll<HTMLButtonElement>('.counting-choice')]
        .find(button => button.textContent?.trim() === String(quantity))
      choice?.click()
    })
    await expect(other.locator('.counting-game')).toHaveCount(0)
    await page.reload()
    if (action === 'stop') {
      await expect(end(page)).toBeVisible()
      expect(await saved(page)).toMatchObject({ status: 'ended', reason: 'stopped', completedRounds: 0 })
    } else {
      await expect(page.getByRole('button', { name: games.connect, exact: true })).toBeVisible()
      expect(await saved(page)).toBeNull()
    }
  })
}

test('start_after_writer_contention_uses_saved_adult_settings', async ({ page, context }) => {
  await play(page, 'counting', 1, 1)
  const firstId = (await saved(page))!.id
  const other = await context.newPage()
  await other.goto('/')
  await expect(end(other)).toBeVisible()
  await stop(page).click()
  await expect.poll(async () => (await saved(page))?.reason).toBe('stopped')
  await page.close()

  await adult(other).click()
  await start(other).click()
  await expect(stop(other)).toBeVisible()
  const next = await saved(other)
  expect(next?.id).not.toBe(firstId)
  expect(next?.settings).toMatchObject({ game: 'counting', roundLimit: 1 })
  await correctCount(other)
  await expect(end(other)).toBeVisible()
})

test('adult_settings_remain_visible_until_writer_lock_is_available', async ({ page, context }) => {
  await play(page, 'counting')
  const other = await context.newPage()
  await other.goto('/')
  await expect(end(other)).toBeVisible()
  await adult(other).click()
  await expect(other.locator('.settings-form')).toBeVisible()
  await expect(other.getByRole('alert')).toBeVisible()
  await expect(start(other)).toBeDisabled()
})

test('adult_settings_remain_visible_without_web_locks', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 800, height: 360 } })
  try {
    await context.addInitScript(() => Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined }))
    const page = await context.newPage()
    await page.goto('/')
    await expect(end(page)).toBeVisible()
    await adult(page).click()
    await expect(page.locator('.settings-form')).toBeVisible()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(start(page)).toBeDisabled()
  } finally {
    await context.close()
  }
})

test('abrupt_loss_then_clock_rollback_requires_adult_start', async ({ page, context, browser, baseURL }) => {
  await page.clock.install()
  await play(page, 'counting')
  const original = (await saved(page))!
  await page.clock.setSystemTime(original.startedAt + 240_000)
  await page.clock.runFor(250)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  // Snapshot a running process without letting a pagehide handler save anything.
  const next = await browser.newContext({ baseURL, storageState: await context.storageState(), viewport: { width: 800, height: 360 } })
  try {
    const relaunched = await next.newPage()
    await relaunched.clock.install({ time: original.startedAt + 30_000 })
    await relaunched.goto('/')
    await expect(end(relaunched)).toBeVisible()
    await expect(stop(relaunched)).toHaveCount(0)
    await adult(relaunched).click()
    await start(relaunched).click()
    await expect(relaunched.locator('.counting-game')).toBeVisible()
    expect((await saved(relaunched))?.id).not.toBe(original.id)
  } finally {
    await next.close()
  }
})

test('parked_writer_rechecks_after_another_tab_clears', async ({ page, context }) => {
  await play(page, 'counting')
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })))
  const devtools = await context.newCDPSession(page)
  await devtools.send('Page.setWebLifecycleState', { state: 'frozen' })
  const other = await context.newPage()
  await other.goto('/')
  await expect(other.locator('.counting-game, .session-end')).toBeVisible()
  if (await stop(other).isVisible()) await stop(other).click()
  await adult(other).click()
  await other.getByRole('button', { name: 'Xóa dữ liệu trên thiết bị' }).click()
  await expect.poll(() => saved(other)).toBeNull()
  await devtools.send('Page.setWebLifecycleState', { state: 'active' })
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))
  await expect(page.getByRole('button', { name: games.connect, exact: true })).toBeVisible()
  expect(await saved(page)).toBeNull()
  await adult(page).click()
  await expect(page.getByRole('combobox', { name: 'Trò chơi', exact: true })).toHaveValue('connect')
})

// MainActivity uses dispatchEvent's return value to decide whether Android handles Back.
function androidBack(page: Page) {
  return page.evaluate(() => window.dispatchEvent(new Event('littleStepsBack', { cancelable: true })))
}

test('android_back_stops_or_navigates_without_starting_a_session', async ({ page }) => {
  await openSettings(page, 'counting')
  await expect(start(page)).toBeEnabled()
  expect(await androidBack(page)).toBe(false)
  await expect(page.getByRole('button', { name: games.connect, exact: true })).toBeVisible()
  expect(await saved(page)).toBeNull()
  expect(await androidBack(page)).toBe(true)

  await play(page, 'counting')
  const original = (await saved(page))!
  expect(await androidBack(page)).toBe(false)
  await expect(end(page)).toBeVisible()
  await expect.poll(() => saved(page)).toMatchObject({ id: original.id, status: 'ended', reason: 'stopped' })
  expect(await androidBack(page)).toBe(false)
  await expect(page.getByRole('button', { name: games.connect, exact: true })).toBeVisible()
  expect(await androidBack(page)).toBe(true)
  await page.reload()
  await expect(end(page)).toBeVisible()
  expect((await saved(page))?.id).toBe(original.id)
})

test('android_back_during_start_cancels_pending_session', async ({ page }) => {
  await openSettings(page, 'connect')
  await expect(start(page)).toBeEnabled()
  const useSystemDefault = await start(page).evaluate(button => {
    (button as HTMLButtonElement).form!.requestSubmit()
    return window.dispatchEvent(new Event('littleStepsBack', { cancelable: true }))
  })
  expect(useSystemDefault).toBe(false)
  await expect(page.getByRole('button', { name: games.connect, exact: true })).toBeVisible()
  expect(await saved(page)).toBeNull()
  await expect(stop(page)).toHaveCount(0)
})

test('android_back_cancels_start_while_settings_read_is_pending', async ({ page }) => {
  await openSettings(page, 'connect')
  await expect(start(page)).toBeEnabled()
  await page.evaluate((key) => {
    const original = Storage.prototype.getItem
    let signal!: () => void
    ;(window as any).__settingsReadStarted = new Promise<void>(resolve => { signal = resolve })
    Storage.prototype.getItem = function (this: Storage, name: string) {
      if (name === key) {
        Storage.prototype.getItem = original
        signal()
        return new Promise<string | null>(resolve => {
          ;(window as any).__resolveSettingsRead = () => resolve(original.call(this, name))
        }) as any
      }
      return original.call(this, name)
    } as any
  }, SETTINGS_KEY)
  await start(page).click()
  await page.evaluate(() => (window as any).__settingsReadStarted)
  expect(await androidBack(page)).toBe(false)
  await page.evaluate(() => (window as any).__resolveSettingsRead())
  await expect(page.getByRole('button', { name: games.connect, exact: true })).toBeVisible()
  await expect.poll(() => saved(page)).toBeNull()
  await expect(stop(page)).toHaveCount(0)
})

test('android_back_during_resumed_activation_keeps_session_terminal', async ({ page }) => {
  await play(page, 'counting')
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })))
  await expect.poll(() => page.evaluate(key => sessionStorage.getItem(key), SESSION_KEY)).not.toBeNull()
  await page.addInitScript((key) => {
    const original = Storage.prototype.getItem
    Storage.prototype.getItem = function (this: Storage, name: string) {
      const value = original.call(this, name)
      if (this === window.sessionStorage && name === key) {
        Storage.prototype.getItem = original
        window.dispatchEvent(new Event('littleStepsBack', { cancelable: true }))
      }
      return value
    }
  }, SESSION_KEY)
  await page.reload()
  await expect(page.getByRole('button', { name: games.connect, exact: true })).toBeVisible()
  await expect.poll(() => saved(page)).toMatchObject({ status: 'ended', reason: 'stopped' })
  await expect(page.locator('.counting-game')).toHaveCount(0)
})

test('android_back_during_restore_read_invalidates_resume_grant', async ({ page, context }) => {
  await play(page, 'counting')
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })))
  await expect.poll(() => page.evaluate(key => sessionStorage.getItem(key), SESSION_KEY)).not.toBeNull()
  await page.addInitScript((key) => {
    const original = Storage.prototype.getItem
    let signal!: () => void
    ;(window as any).__restoreReadStarted = new Promise<void>(resolve => { signal = resolve })
    Storage.prototype.getItem = function (this: Storage, name: string) {
      if (this === window.localStorage && name === key) {
        Storage.prototype.getItem = original
        signal()
        return new Promise<string | null>(resolve => {
          ;(window as any).__resolveRestoreRead = () => resolve(original.call(this, name))
        }) as any
      }
      return original.call(this, name)
    } as any
  }, SESSION_KEY)
  await page.reload()
  await page.evaluate(() => (window as any).__restoreReadStarted)
  expect(await androidBack(page)).toBe(false)
  expect(await page.evaluate(key => sessionStorage.getItem(key), SESSION_KEY)).toBeNull()
  await page.evaluate(() => (window as any).__resolveRestoreRead())
  await expect(page.getByRole('button', { name: games.connect, exact: true })).toBeVisible()
  await expect.poll(() => saved(page)).toMatchObject({ status: 'ended', reason: 'stopped' })
  const relaunched = await context.newPage()
  await relaunched.goto('/')
  await expect(end(relaunched)).toBeVisible()
  await expect(relaunched.locator('.counting-game')).toHaveCount(0)
})

test('stale_adult_form_must_review_latest_saved_settings_before_start', async ({ page, context }) => {
  await page.goto('/')
  const other = await context.newPage()
  await other.goto('/')
  await adult(page).click()
  await adult(other).click()
  const limit = other.getByRole('combobox', { name: 'Số lượt tối đa', exact: true })
  await expect(limit).toBeEnabled()
  await page.getByRole('combobox', { name: 'Số lượt tối đa', exact: true }).selectOption('10')
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), SETTINGS_KEY))
    .toContain('"roundLimit":10')
  await start(other).click()
  await expect(other.locator('.settings-form')).toBeVisible()
  await expect(limit).toHaveValue('10')
  await expect(other.getByRole('alert')).toContainText('cửa sổ khác')
  expect(await saved(other)).toBeNull()
  await start(other).click()
  await expect(stop(other)).toBeVisible()
  expect((await saved(other))?.settings.roundLimit).toBe(10)
})

test('stop_always_available', async ({ page }) => {
  await play(page)
  await page.setViewportSize({ width: 360, height: 800 })
  await expect(page.getByRole('img', { name: 'Xoay ngang thiết bị' })).toBeVisible()
  await expect(page.locator('.connect-target:visible')).toHaveCount(0)
  await stop(page).click()
  await expect(end(page)).toBeVisible()
  expect((await saved(page))?.reason).toBe('stopped')
})

for (const entry of ['adult', 'counting'] as const) {
  test(`invalid_settings_warn_before_start_from_${entry}`, async ({ page }) => {
    const invalid = JSON.stringify({ ...DEFAULT_SETTINGS, roundLimit: 0 })
    await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [SETTINGS_KEY, invalid])
    await page.goto('/')
    if (entry === 'adult') await adult(page).click()
    else await openSettings(page, entry)

    await expect(start(page)).toBeEnabled()
    const warning = page.getByRole('alert')
    await expect(warning).toContainText('Cài đặt đã lưu không hợp lệ')
    await expect(warning).toBeInViewport()
    const game = entry === 'adult' ? 'connect' : entry
    await expect(page.getByRole('combobox', { name: 'Trò chơi', exact: true })).toHaveValue(game)
    await expect(page.getByRole('combobox', { name: 'Chủ đề', exact: true })).toHaveValue('farm')
    await expect(page.getByRole('combobox', { name: 'Mức độ', exact: true })).toHaveValue('1')
    await expect(page.getByRole('combobox', { name: 'Thời lượng', exact: true })).toHaveValue('5')
    await expect(page.getByRole('combobox', { name: 'Số lượt tối đa', exact: true })).toHaveValue('3')
    await expect(page.getByLabel('Giọng nói tiếng Việt')).not.toBeChecked()
    await expect(page.getByLabel('Giảm chuyển động')).toBeChecked()
    expect(await saved(page)).toBeNull()
    expect(await page.evaluate(key => localStorage.getItem(key), SETTINGS_KEY)).toBe(invalid)

    await start(page).click()
    await expect(stop(page)).toBeVisible()
    expect((await saved(page))?.settings).toEqual({ ...DEFAULT_SETTINGS, game })
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SETTINGS_KEY)).toEqual({ ...DEFAULT_SETTINGS, game })
  })
}

test('invalid_settings_discovered_at_start_return_to_adult_review', async ({ page }) => {
  await openSettings(page, 'shadow')
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null')?.game, SETTINGS_KEY)).toBe('shadow')
  await page.evaluate(key => localStorage.setItem(key, '{'), SETTINGS_KEY)
  await start(page).click()

  await expect(page.getByRole('alert')).toContainText('Cài đặt đã lưu không hợp lệ')
  await expect(page.getByRole('combobox', { name: 'Trò chơi', exact: true })).toHaveValue('connect')
  expect(await saved(page)).toBeNull()
  await start(page).click()
  await expect(stop(page)).toBeVisible()
  expect((await saved(page))?.settings).toEqual(DEFAULT_SETTINGS)
})

test('settings_persist_and_clear', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 })
  await openSettings(page, 'shadow')
  await page.getByRole('combobox', { name: 'Chủ đề', exact: true }).selectOption('sea')
  await page.getByRole('combobox', { name: 'Mức độ', exact: true }).selectOption('4')
  await page.getByRole('combobox', { name: 'Thời lượng', exact: true }).selectOption('10')
  await page.getByRole('combobox', { name: 'Số lượt tối đa', exact: true }).selectOption('7')
  await page.getByLabel('Giảm chuyển động').uncheck()
  await screenshot(page, 'adult-settings')
  await page.reload()
  await adult(page).click()
  await expect(page.getByRole('combobox', { name: 'Trò chơi', exact: true })).toHaveValue('shadow')
  await expect(page.getByRole('combobox', { name: 'Chủ đề', exact: true })).toHaveValue('sea')
  await expect(page.getByRole('combobox', { name: 'Mức độ', exact: true })).toHaveValue('4')
  await expect(page.getByRole('combobox', { name: 'Thời lượng', exact: true })).toHaveValue('10')
  await expect(page.getByRole('combobox', { name: 'Số lượt tối đa', exact: true })).toHaveValue('7')
  await expect(page.getByLabel('Giảm chuyển động')).not.toBeChecked()
  await start(page).click()
  await stop(page).click()
  await adult(page).click()
  await page.getByRole('button', { name: 'Xóa dữ liệu trên thiết bị' }).click()
  await expect.poll(() => page.evaluate(([a, b]) => [localStorage.getItem(a), localStorage.getItem(b)], [SETTINGS_KEY, SESSION_KEY])).toEqual([null, null])
  await expect(page.getByRole('combobox', { name: 'Số lượt tối đa', exact: true })).toHaveValue('3')
})

test('no_visible_child_text_except_numbers', async ({ page }) => {
  for (const game of ['connect', 'shadow', 'counting'] as const) {
    await play(page, game)
    const text = (await page.locator('body').innerText()).trim()
    if (game === 'counting') expect(text).toMatch(/^\d+(\s+\d+)+$/)
    else expect(text).toBe('')
    await stop(page).click()
    await expect(end(page)).toBeVisible()
    expect((await page.locator('body').innerText()).trim()).toBe('')
    await adult(page).click()
    await page.getByRole('button', { name: 'Về trang chủ' }).click()
  }
})

test('no_external_requests', async ({ page, context, baseURL }) => {
  const requests: string[] = []
  context.on('request', request => requests.push(request.url()))
  for (const game of ['counting', 'shadow', 'connect'] as const) {
    await play(page, game)
    await stop(page).click()
    await adult(page).click()
    await page.getByRole('button', { name: 'Về trang chủ' }).click()
  }
  expect(requests.length).toBeGreaterThan(5)
  expect(requests.filter(url => new URL(url).origin !== baseURL)).toEqual([])
})

test('offline_after_initial_cache', async ({ page, context }) => {
  await page.goto('/')
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  const cached = await page.evaluate(async () => {
    const cache = await caches.open((await caches.keys()).find(key => key.startsWith('little-steps-'))!)
    return (await cache.keys()).map(request => new URL(request.url).pathname)
  })
  expect(cached.filter(url => url.endsWith('.svg'))).toHaveLength(30)
  await context.setOffline(true)
  await page.reload()
  await page.getByRole('button', { name: games.shadow, exact: true }).click()
  await page.getByRole('combobox', { name: 'Chủ đề', exact: true }).selectOption('sea')
  await start(page).click()
  await expect(page.locator('.shadow-source img')).toBeVisible()
  await expect.poll(() => page.locator('.shadow-source img').first().evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  await page.locator('.shadow-source').first().click()
  await page.locator('.shadow-target').first().click()
  await expect.poll(async () => (await saved(page))?.completedRounds).toBe(1)
})

test('storage_failure_stops_safely', async ({ page }) => {
  await play(page, 'counting')
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw Error('storage full') } })
  await correctCount(page)
  await expect(end(page)).toBeVisible()
  expect((await page.locator('body').innerText()).trim()).toBe('')
  await adult(page).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await page.reload()
  await expect(stop(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: games.connect, exact: true })).toBeVisible()
})

test('queued_start_stays_blocked_after_failed_settings_write', async ({ page }) => {
  await openSettings(page, 'connect')
  const limit = page.getByRole('combobox', { name: 'Số lượt tối đa', exact: true })
  await limit.evaluate((element, key) => {
    const write = Storage.prototype.setItem
    Storage.prototype.setItem = function (name, value) {
      if (this === localStorage && name === key) throw Error('settings storage full')
      return write.call(this, name, value)
    }
    // Both user actions reach the form before its asynchronous preference save completes.
    const select = element as HTMLSelectElement
    select.value = '1'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    select.form!.requestSubmit()
  }, SETTINGS_KEY)

  await expect(page.getByRole('alert')).toContainText('Không thể lưu')
  await expect(start(page)).toBeDisabled()
  await expect(stop(page)).toHaveCount(0)
  expect(await saved(page)).toBeNull()
})

test('failed_stop_write_and_remove_require_adult_after_recovery', async ({ page }) => {
  await play(page, 'counting')
  await correctCount(page)
  const original = (await saved(page))!
  await page.reload()
  await expect(page.locator('.counting-game')).toBeVisible()
  await page.evaluate(() => {
    Storage.prototype.setItem = Storage.prototype.removeItem = () => { throw Error('storage unavailable') }
  })
  await stop(page).click()
  await expect(end(page)).toBeVisible()
  // The old active snapshot really survived both failures.
  expect(await saved(page)).toMatchObject({ id: original.id, status: 'active' })
  await page.reload()
  await expect(end(page)).toBeVisible()
  await expect(stop(page)).toHaveCount(0)
  await adult(page).click()
  await expect(start(page)).toBeEnabled()
  await page.getByRole('button', { name: 'Xóa dữ liệu trên thiết bị' }).click()
  await expect(start(page)).toBeEnabled()
  expect(await saved(page)).toBeNull()
  await start(page).click()
  await expect(page.locator('.connect-game')).toBeVisible()
  expect((await saved(page))?.id).not.toBe(original.id)
})

test('quiet_mode_no_audio', async ({ page }) => {
  await page.addInitScript(() => {
    const calls: string[] = []
    Object.assign(window, { mediaCalls: calls })
    HTMLMediaElement.prototype.play = async function () { calls.push(this.src) }
  })
  await play(page, 'counting', 1, 1)
  await page.locator('.counting-object').first().click()
  await correctCount(page)
  await expect(end(page)).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { mediaCalls: string[] }).mediaCalls)).toEqual([])
})

test('no_overlap_targets_568x320_and_800x360', async ({ page }) => {
  test.setTimeout(60000)
  // Force the maximum ten-object question to exercise the tightest counting layout.
  await page.addInitScript(() => { Math.random = () => 0.999 })
  for (const [width, height] of [[568, 320], [800, 360]]) {
    await page.setViewportSize({ width, height })
    for (const game of ['counting', 'shadow', 'connect'] as const) {
      await play(page, game, game === 'connect' ? (height === 320 ? 3 : 4) : 5)
      const boxes = await page.locator('button:visible').evaluateAll(els => els.map(el => el.getBoundingClientRect().toJSON()))
      expect(boxes.length).toBeGreaterThan(4)
      for (const [i, a] of boxes.entries()) {
        expect(Math.min(a.width, a.height)).toBeGreaterThanOrEqual(48)
        expect(a.left >= 0 && a.top >= 0 && a.right <= width && a.bottom <= height).toBeTruthy()
        for (const b of boxes.slice(i + 1)) {
          expect(a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom).toBeFalsy()
        }
      }
      expect(await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight])).toEqual([width, height])
      await stop(page).click()
      await adult(page).click()
      await page.getByRole('button', { name: 'Về trang chủ' }).click()
    }
  }
})
