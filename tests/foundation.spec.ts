import { expect, test } from '@playwright/test'

test('serves the starter shell and artwork locally', async ({ page, request }) => {
  const externalRequests: string[] = []
  page.on('request', (resource) => {
    if (new URL(resource.url()).origin !== 'http://127.0.0.1:4173') {
      externalRequests.push(resource.url())
    }
  })

  await page.goto('/')
  await expect(page).toHaveTitle('Little Steps Kidz')
  await expect(page.getByRole('main')).toBeVisible()

  const image = await request.get('/assets/images/cow.svg')
  expect(image.ok()).toBe(true)
  expect(image.headers()['content-type']).toContain('image/svg+xml')
  expect(externalRequests).toEqual([])
})
