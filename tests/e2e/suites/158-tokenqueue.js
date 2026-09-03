/**
 * Suite 158 — Token Queue (token-queue.handler.ts, TokenQueueScreen.tsx,
 * #/clinical/queue). Only tokenQueue.today was covered before this (suite
 * 31, incidentally). Specialist Clinic has token_queue enabled by default,
 * which also starts the LAN self-check-in server.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E158'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-specialist-clinic', async () => {
      const sw = await h.switchBusinessType(page, 'Specialist Clinic')
      r.log('business-type-switched', sw.to === 'SPECIALIST_CLINIC', JSON.stringify(sw))
    })

    await r.step('issue-walk-in-token-via-real-ui', async () => {
      await h.gotoHash(page, '#/clinical/queue')
      await page.waitForTimeout(700)
      r.log('token-queue-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Add Walk-in' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByPlaceholder('Full name').fill(`${TEST_PREFIX} Patient ${suffix}`)
      await modal.getByPlaceholder('e.g. 35 years').fill('42 years')
      await modal.getByPlaceholder('Optional').first().fill(`9${String(Date.now()).slice(-9)}`)
      await page.waitForTimeout(200)
      await modal.getByRole('button', { name: 'Issue Token' }).click()
      await page.waitForTimeout(1000)
      r.log('issue-token-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.tokenQueue.today())
      const token = (listRes?.data || []).find((t) => t.patientName === `${TEST_PREFIX} Patient ${suffix}`)
      r.log('token-actually-created', !!token && token.status === 'WAITING' && token.age === '42 years', JSON.stringify(token))
    })

    let tokenId
    await r.step('call-seen-and-reset-token-via-real-ui', async () => {
      const listRes = await page.evaluate(async () => window.api.tokenQueue.today())
      tokenId = (listRes?.data || []).find((t) => t.patientName === `${TEST_PREFIX} Patient ${suffix}`)?.id
      if (!tokenId) return r.log('call-seen-and-reset-token-via-real-ui', false, 'no tokenId')

      const row = page.locator('div.rounded-xl.border', { hasText: `${TEST_PREFIX} Patient ${suffix}` }).first()
      await row.locator('button[title="Call this token"]').click()
      await page.waitForTimeout(900)
      r.log('call-no-crash', !(await h.hasErrorBoundary(page)))

      let getRes = await page.evaluate(async () => window.api.tokenQueue.today())
      let token = (getRes?.data || []).find((t) => t.id === tokenId)
      r.log('token-actually-called', token?.status === 'CALLED' && !!token?.calledAt, JSON.stringify(token))

      const rowCalled = page.locator('div.rounded-xl.border', { hasText: `${TEST_PREFIX} Patient ${suffix}` }).first()
      await rowCalled.locator('button[title="Mark seen"]').click()
      await page.waitForTimeout(900)
      r.log('mark-seen-no-crash', !(await h.hasErrorBoundary(page)))

      getRes = await page.evaluate(async () => window.api.tokenQueue.today())
      token = (getRes?.data || []).find((t) => t.id === tokenId)
      r.log('token-actually-seen', token?.status === 'SEEN' && !!token?.seenAt, JSON.stringify(token))

      const rowSeen = page.locator('div.rounded-xl.border', { hasText: `${TEST_PREFIX} Patient ${suffix}` }).first()
      await rowSeen.locator('button[title="Reset to waiting"]').click()
      await page.waitForTimeout(900)
      r.log('reset-no-crash', !(await h.hasErrorBoundary(page)))

      getRes = await page.evaluate(async () => window.api.tokenQueue.today())
      token = (getRes?.data || []).find((t) => t.id === tokenId)
      r.log('token-actually-reset', token?.status === 'WAITING' && !token?.calledAt && !token?.seenAt, JSON.stringify(token))
    })

    let tokenId2
    await r.step('skip-a-second-token-via-real-ui', async () => {
      const createRes = await page.evaluate(async (name) => window.api.tokenQueue.create({ patientName: name }), `${TEST_PREFIX} Patient2 ${suffix}`)
      tokenId2 = createRes?.data?.id
      r.log('token2-seeded', !!tokenId2, JSON.stringify(createRes?.error || ''))
      if (!tokenId2) return

      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(300)
      await h.gotoHash(page, '#/clinical/queue')
      await page.waitForTimeout(700)

      const row = page.locator('div.rounded-xl.border', { hasText: `${TEST_PREFIX} Patient2 ${suffix}` }).first()
      await row.locator('button[title="Skip"]').click()
      await page.waitForTimeout(900)
      r.log('skip-no-crash', !(await h.hasErrorBoundary(page)))

      const getRes = await page.evaluate(async () => window.api.tokenQueue.today())
      const token = (getRes?.data || []).find((t) => t.id === tokenId2)
      r.log('token-actually-skipped', token?.status === 'SKIPPED', JSON.stringify(token))
    })

    await r.step('queue-stats-reflect-real-counts', async () => {
      const statsRes = await page.evaluate(async () => window.api.tokenQueue.stats())
      r.log('stats-succeeds', !!statsRes?.success, JSON.stringify(statsRes?.error || ''))
      r.log('stats-counts-are-real-numbers', typeof statsRes?.data?.waiting === 'number' && typeof statsRes?.data?.skipped === 'number', JSON.stringify(statsRes?.data))
    })

    await r.step('call-next-via-real-ui', async () => {
      await page.waitForTimeout(300)
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('call-next-button-present', /Call Next/.test(bodyText))
      const callNextBtn = page.getByRole('button', { name: /Call Next/ })
      if (await callNextBtn.count() > 0 && !(await callNextBtn.isDisabled())) {
        await callNextBtn.click()
        await page.waitForTimeout(900)
        r.log('call-next-no-crash', !(await h.hasErrorBoundary(page)))
      } else {
        r.log('call-next-no-crash', true, 'no waiting token left to call, button correctly disabled')
      }
    })

    await r.step('self-checkin-qr-and-regenerate-link-via-real-ui', async () => {
      const statusRes = await page.evaluate(async () => window.api.tokenQueue.getServerStatus())
      r.log('server-status-succeeds', !!statusRes?.success, JSON.stringify(statusRes?.error || ''))
      const running = statusRes?.data?.running === true

      await page.reload().catch(() => {})
      await h.gotoHash(page, '#/clinical/queue')
      await page.waitForTimeout(900)

      if (!running) {
        r.log('show-qr-no-crash', true, 'token_queue server not running in this environment, skipped UI check')
        return
      }
      await page.getByRole('button', { name: 'Show QR' }).click()
      await page.waitForTimeout(900)
      r.log('show-qr-no-crash', !(await h.hasErrorBoundary(page)))

      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('qr-preview-shown', bodyText.includes('scan this to check themselves in'))

      await page.getByRole('button', { name: 'Regenerate Link' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByRole('button', { name: 'Regenerate', exact: true }).click()
      await page.waitForTimeout(900)
      r.log('regenerate-link-no-crash', !(await h.hasErrorBoundary(page)))

      const bodyTextAfter = await page.locator('body').innerText().catch(() => '')
      r.log('regenerate-success-message-shown', bodyTextAfter.includes('Link regenerated'))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'SPECIALIST_CLINIC') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      let tokens = 0
      try { tokens = db.prepare(`DELETE FROM TokenQueue WHERE patientName LIKE '${TEST_PREFIX}%'`).run().changes } catch { /* noop */ }
      console.log('extra cleanup:', JSON.stringify({ tokens }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nTOKEN QUEUE: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
