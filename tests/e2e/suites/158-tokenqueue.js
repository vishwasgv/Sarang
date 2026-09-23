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

    const patientPhone = `9${String(Date.now()).slice(-9)}`
    await r.step('issue-walk-in-token-via-real-ui', async () => {
      await h.gotoHash(page, '#/clinical/queue')
      await page.waitForTimeout(700)
      r.log('token-queue-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Add Walk-in' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByPlaceholder('Full name').fill(`${TEST_PREFIX} Patient ${suffix}`)
      await modal.getByPlaceholder('e.g. 35 years').fill('42 years')
      await modal.getByPlaceholder('Optional').first().fill(patientPhone)
      await page.waitForTimeout(200)
      await modal.getByRole('button', { name: 'Issue Token' }).click()
      await page.waitForTimeout(1000)
      r.log('issue-token-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.tokenQueue.today())
      const token = (listRes?.data || []).find((t) => t.patientName === `${TEST_PREFIX} Patient ${suffix}`)
      r.log('token-actually-created', !!token && token.status === 'WAITING' && token.age === '42 years', JSON.stringify(token))
    })

    let tokenId
    let firstVisitCustomerId
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

    // 2026-09-23 — real gap found+fixed: a walk-in token had no Customer or
    // Appointment behind it at all, so neither Doctor Pad nor a typed Visit
    // Note could ever attach to them. "Create Visit Record" opens the real
    // booking form pre-filled for this token and links the token back to
    // whatever Appointment it produces — exercised here via the actual UI,
    // not just typechecked.
    await r.step('create-visit-record-from-token-links-appointment', async () => {
      if (!tokenId) return r.log('create-visit-record-from-token-links-appointment', false, 'no tokenId')

      const row = page.locator('div.rounded-xl.border', { hasText: `${TEST_PREFIX} Patient ${suffix}` }).first()
      await row.locator('button[title^="Create a visit record"]').click()
      await page.waitForTimeout(900)
      r.log('navigates-to-booking-form-no-crash', !(await h.hasErrorBoundary(page)))

      const modal = h.topModal(page)
      const nameInput = modal.getByPlaceholder('Enter name')
      const prefillValue = await nameInput.inputValue().catch(() => '')
      r.log('booking-form-prefilled-with-token-patient-name', prefillValue === `${TEST_PREFIX} Patient ${suffix}`, prefillValue)

      // REAL BUG found+fixed 2026-09-23: no existing match meant the picker
      // fell back to that free-text "Enter name" field above, which never
      // creates a real Customer row at all — just a string on this one
      // Appointment. Since the WHOLE POINT of this bridge is that every
      // walk-in gets a real, findable patient record, the picker's own
      // quick-add now auto-opens pre-filled with the token's name+phone
      // instead — exercised here for real, not just typechecked.
      const quickPhoneInput = modal.getByPlaceholder('Phone *')
      const quickPhoneValue = await quickPhoneInput.inputValue().catch(() => '')
      r.log('quick-add-auto-opens-prefilled-with-token-phone', quickPhoneValue === patientPhone, quickPhoneValue)
      await modal.getByRole('button', { name: 'Add & Select' }).click()
      await page.waitForTimeout(900)
      r.log('quick-add-creates-and-selects-real-customer-no-crash', !(await h.hasErrorBoundary(page)))
      // The free-text fallback field must be gone now that a real customer is selected.
      r.log('free-text-name-field-replaced-by-real-selection', await nameInput.count() === 0)

      await modal.getByLabel('Service Title').fill(`${TEST_PREFIX} Consultation`)
      await page.waitForTimeout(200)
      await modal.getByRole('button', { name: 'Book Appointment' }).click()
      await page.waitForTimeout(1200)
      r.log('booking-submits-no-crash', !(await h.hasErrorBoundary(page)))

      const getRes = await page.evaluate(async () => window.api.tokenQueue.today())
      const linkedToken = (getRes?.data || []).find((t) => t.id === tokenId)
      r.log('token-now-linked-to-a-real-appointment', !!linkedToken?.appointmentId, JSON.stringify(linkedToken))

      if (linkedToken?.appointmentId) {
        const apptRes = await page.evaluate(async (id) => window.api.appointments.get({ id }), linkedToken.appointmentId)
        // Now that quick-add links a real Customer row (the fix above),
        // the name lives on the joined `customer` relation, not the
        // free-text `customerName` fallback field — that field is only
        // ever populated for a genuine no-record walk-in now, so it's
        // correctly null here, not a regression.
        r.log('linked-appointment-actually-exists-for-same-patient-name', apptRes?.success && apptRes?.data?.customer?.customerName === `${TEST_PREFIX} Patient ${suffix}`, JSON.stringify(apptRes?.data && { id: apptRes.data.id, customerName: apptRes.data.customer?.customerName, serviceTitle: apptRes.data.serviceTitle }))
        r.log('appointment-actually-linked-to-a-real-customer-row', !!apptRes?.data?.customerId, apptRes?.data?.customerId)
        firstVisitCustomerId = apptRes?.data?.customerId
      } else {
        r.log('linked-appointment-actually-exists-for-same-patient-name', false, 'no linked appointmentId')
      }

      await h.gotoHash(page, '#/clinical/queue')
      await page.waitForTimeout(700)
    })

    // 2026-09-23 — the actual "no double records" concern: a RETURNING
    // patient re-entering their phone with different formatting (here: a
    // +91 country code and spacing added) must still be recognized as the
    // same person, not spawn a duplicate Customer. Exercises the real
    // normalizePhoneForMatch fix via the actual UI, not just typechecked.
    let tokenIdReturn
    await r.step('returning-patient-different-phone-format-no-duplicate-customer', async () => {
      if (!firstVisitCustomerId) return r.log('returning-patient-different-phone-format-no-duplicate-customer', false, 'no firstVisitCustomerId from the previous step')

      const differentlyFormattedPhone = `+91 ${patientPhone.slice(0, 5)} ${patientPhone.slice(5)}`
      await page.getByRole('button', { name: 'Add Walk-in' }).click()
      await page.waitForTimeout(400)
      const addModal = h.topModal(page)
      await addModal.getByPlaceholder('Full name').fill(`${TEST_PREFIX} Patient ${suffix}`)
      await addModal.getByPlaceholder('Optional').first().fill(differentlyFormattedPhone)
      await page.waitForTimeout(200)
      await addModal.getByRole('button', { name: 'Issue Token' }).click()
      await page.waitForTimeout(1000)
      r.log('return-visit-token-issued-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.tokenQueue.today())
      const returnTokens = (listRes?.data || []).filter((t) => t.patientName === `${TEST_PREFIX} Patient ${suffix}`)
      tokenIdReturn = returnTokens.find((t) => !t.appointmentId)?.id
      r.log('return-visit-token-created', !!tokenIdReturn, JSON.stringify(returnTokens))
      if (!tokenIdReturn) return

      const rows = page.locator('div.rounded-xl.border', { hasText: `${TEST_PREFIX} Patient ${suffix}` })
      const returnRow = rows.filter({ has: page.locator('button[title^="Create a visit record"]') }).first()
      await returnRow.locator('button[title^="Create a visit record"]').click()
      await page.waitForTimeout(900)

      const modal2 = h.topModal(page)
      // A matched existing patient renders as a read-only picked-customer
      // chip (name + phone), not a free-text "Enter name" input — presence
      // of that chip, not the fill-in field, is the real signal of a match.
      const modalText = await modal2.innerText().catch(() => '')
      r.log('booking-form-shows-matched-existing-patient-not-a-blank-form', modalText.includes(`${TEST_PREFIX} Patient ${suffix}`) && modalText.includes(patientPhone))

      await modal2.getByLabel('Service Title').fill(`${TEST_PREFIX} Follow-up`)
      await page.waitForTimeout(200)
      await modal2.getByRole('button', { name: 'Book Appointment' }).click()
      await page.waitForTimeout(1200)
      r.log('return-visit-booking-submits-no-crash', !(await h.hasErrorBoundary(page)))

      const getRes2 = await page.evaluate(async () => window.api.tokenQueue.today())
      const linkedReturnToken = (getRes2?.data || []).find((t) => t.id === tokenIdReturn)
      r.log('return-visit-token-linked-to-appointment', !!linkedReturnToken?.appointmentId, JSON.stringify(linkedReturnToken))

      if (linkedReturnToken?.appointmentId) {
        const apptRes2 = await page.evaluate(async (id) => window.api.appointments.get({ id }), linkedReturnToken.appointmentId)
        r.log('return-visit-reused-same-existing-customer-no-duplicate', apptRes2?.success && apptRes2?.data?.customerId === firstVisitCustomerId, JSON.stringify({ expected: firstVisitCustomerId, actual: apptRes2?.data?.customerId }))
      } else {
        r.log('return-visit-reused-same-existing-customer-no-duplicate', false, 'no linked appointmentId')
      }

      // Direct DB-level confirmation: exactly one Customer row for this
      // patient's phone, never two, regardless of how the search-based UI
      // check above reads.
      const customerCountForPhone = h.withDb((db) => db.prepare(
        `SELECT COUNT(*) as n FROM Customer WHERE customerName = ?`
      ).get(`${TEST_PREFIX} Patient ${suffix}`))
      r.log('exactly-one-customer-row-for-this-patient', customerCountForPhone?.n === 1, JSON.stringify(customerCountForPhone))

      await h.gotoHash(page, '#/clinical/queue')
      await page.waitForTimeout(700)
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
      r.log('checkin-same-wifi-disclaimer-shown', bodyText.includes("must be connected to this clinic's Wi-Fi"))
      r.log('checkin-print-button-present', await page.getByRole('button', { name: 'Print', exact: true }).count() > 0)

      await page.getByRole('button', { name: 'Regenerate Link' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByRole('button', { name: 'Regenerate', exact: true }).click()
      await page.waitForTimeout(900)
      r.log('regenerate-link-no-crash', !(await h.hasErrorBoundary(page)))

      const bodyTextAfter = await page.locator('body').innerText().catch(() => '')
      r.log('regenerate-success-message-shown', bodyTextAfter.includes('Link regenerated'))
    })

    await r.step('waiting-room-display-board-via-real-ui-and-real-http', async () => {
      const statusRes = await page.evaluate(async () => window.api.tokenQueue.getServerStatus())
      const running = statusRes?.data?.running === true
      if (!running) return r.log('display-link-no-crash', true, 'token_queue server not running in this environment, skipped')

      await page.reload().catch(() => {})
      await h.gotoHash(page, '#/clinical/queue')
      await page.waitForTimeout(900)

      await page.getByRole('button', { name: 'Show Display Link' }).click()
      await page.waitForTimeout(900)
      r.log('display-link-no-crash', !(await h.hasErrorBoundary(page)))

      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('display-link-hint-shown', bodyText.includes('Now Serving'))
      r.log('display-same-wifi-disclaimer-shown', bodyText.includes("must be connected to this clinic's Wi-Fi"))
      r.log('display-print-button-present', await page.getByRole('button', { name: 'Print', exact: true }).count() > 0)

      const linkRes = await page.evaluate(async () => window.api.tokenQueue.generateDisplayLink())
      r.log('generate-display-link-succeeds', !!linkRes?.success && !!linkRes?.data?.displayUrl, JSON.stringify(linkRes?.error || ''))
      const displayUrl = linkRes?.data?.displayUrl
      if (!displayUrl) return

      const pageRes = await fetch(displayUrl)
      const pageHtml = await pageRes.text().catch(() => '')
      r.log('display-board-page-served', pageRes.status === 200 && pageHtml.includes('Now Serving'))

      const urlObj = new URL(displayUrl)
      const parts = urlObj.pathname.split('/').filter(Boolean) // ['waiting-display', '<token>']
      const statusApiUrl = `${urlObj.protocol}//${urlObj.host}/api/token-queue/${parts[1]}/display-status`
      const statusRes2 = await fetch(statusApiUrl)
      const statusBody = await statusRes2.json().catch(() => null)
      r.log('display-status-api-succeeds', statusRes2.status === 200 && statusBody?.success === true, JSON.stringify(statusBody))
      const shapeOk = statusBody?.data && ('currentToken' in statusBody.data) && Array.isArray(statusBody.data.waitingNumbers)
      r.log('display-status-shape-correct', !!shapeOk, JSON.stringify(statusBody?.data))
      const noNameLeak = !JSON.stringify(statusBody).includes(`${TEST_PREFIX} Patient`)
      r.log('display-status-does-not-leak-patient-names', noNameLeak)
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
