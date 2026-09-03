/**
 * Suite 125 — hearing.* + caseDisbursement.* (whole files, zero prior
 * coverage) + legalCase.update/updateStage/checkConflict/delete (broader-
 * gap-list "Nested sub-feature gaps" under Section A, 2026-09-03). create
 * is already covered via real UI (suite 19); everything else on
 * LegalCasesScreen.tsx's case-detail side panel had never been touched.
 * hearing.delete/caseDisbursement.delete/legalCase.delete have no UI
 * trigger anywhere in the renderer -- covered via direct API.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Law125'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-lawyer', async () => {
      const sw = await h.switchBusinessType(page, 'Lawyer')
      r.log('business-type-switched', sw.to === 'LAWYER', JSON.stringify(sw))
    })

    // ── Seed a prior case so a later opposingPartyName match triggers a
    // real checkConflict hit (advisory-only, not blocking). ───────────────
    const existingClientName = `${TEST_PREFIX} Existing Client ${suffix}`
    let existingClientId
    await r.step('seed-existing-client-and-case', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), existingClientName)
      existingClientId = custRes?.data?.id
      r.log('existing-client-created', !!existingClientId, JSON.stringify(custRes?.error || ''))
      if (existingClientId) {
        const priorCaseNumber = `${TEST_PREFIX}/000/${suffix}`
        const priorCaseTitle = `${TEST_PREFIX} Prior Case`
        const priorCourtName = `${TEST_PREFIX} Prior Court`
        const caseRes = await page.evaluate(({ clientId, priorCaseNumber, priorCaseTitle, priorCourtName }) => window.api.legalCase.create({
          caseNumber: priorCaseNumber, caseTitle: priorCaseTitle, caseType: 'CIVIL', courtName: priorCourtName, clientId,
        }), { clientId: existingClientId, priorCaseNumber, priorCaseTitle, priorCourtName })
        r.log('prior-case-created', !!caseRes?.success, JSON.stringify(caseRes?.error || ''))
      }
    })

    const caseNumber = `${TEST_PREFIX}/${suffix}`
    let caseClientId
    await r.step('create-client-and-case-with-conflict-check-via-ui', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), `${TEST_PREFIX} Client ${suffix}`)
      caseClientId = custRes?.data?.id
      r.log('case-client-created', !!caseClientId, JSON.stringify(custRes?.error || ''))

      await h.gotoHash(page, '#/legal/cases')
      await page.waitForTimeout(700)
      r.log('cases-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'New Case' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.getByPlaceholder('OS/123/2024').fill(caseNumber)
      await modal.getByPlaceholder('Ramesh Sharma vs State of Maharashtra').fill(`${TEST_PREFIX} Test vs Opposing`)
      // Opposing party name matches the existing client seeded above --
      // exercises the real (advisory-only) conflict-of-interest check.
      await modal.getByPlaceholder('State of Maharashtra', { exact: true }).fill(existingClientName)
      await page.waitForTimeout(900)
      const modalText = await modal.innerText().catch(() => '')
      r.log('conflict-of-interest-detected', modalText.includes('Possible conflict of interest'), modalText.slice(0, 800))

      await modal.getByPlaceholder('District Court, Mumbai').fill(`${TEST_PREFIX} Court`)
      await modal.getByLabel('Client').selectOption(caseClientId)
      await page.waitForTimeout(300)
      await modal.getByRole('button', { name: 'Create Case' }).click()
      await page.waitForTimeout(1200)
      r.log('case-created-no-crash', !(await h.hasErrorBoundary(page)))
    })

    let caseId
    await r.step('open-case-detail', async () => {
      const row = page.locator('tr', { hasText: caseNumber }).first()
      r.log('case-row-visible', await row.count() > 0)
      await row.click()
      await page.waitForTimeout(800)
      r.log('detail-panel-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.legalCase.list({}))
      const cases = listRes?.data?.cases || listRes?.data || []
      const found = cases.find((c) => c.caseNumber === caseNumber)
      caseId = found?.id
      r.log('case-persisted', !!caseId, JSON.stringify(found))
    })

    await r.step('update-case-stage-via-ui', async () => {
      if (!caseId) return r.log('update-case-stage-via-ui', false, 'no caseId')
      const stageSelect = page.locator('select').filter({ has: page.locator('option[value="EVIDENCE"]') })
      await stageSelect.selectOption('EVIDENCE')
      await page.waitForTimeout(1000)
      r.log('stage-update-no-crash', !(await h.hasErrorBoundary(page)))

      const detailRes = await page.evaluate((id) => window.api.legalCase.get({ id }), caseId)
      r.log('stage-actually-updated', detailRes?.data?.caseStage === 'EVIDENCE', JSON.stringify(detailRes?.data?.caseStage))
    })

    await r.step('save-limitation-date-via-ui', async () => {
      if (!caseId) return r.log('save-limitation-date-via-ui', false, 'no caseId')
      const future = h.toLocalISODate(new Date(Date.now() + 60 * 24 * 3600000))
      const limitationCard = page.locator('p', { hasText: 'Limitation / Deadline Date' }).first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
      await limitationCard.locator('input[type="date"]').fill(future)
      await limitationCard.locator('button', { hasText: 'Save' }).click()
      await page.waitForTimeout(1000)
      r.log('limitation-save-no-crash', !(await h.hasErrorBoundary(page)))

      const detailRes = await page.evaluate((id) => window.api.legalCase.get({ id }), caseId)
      const savedDate = detailRes?.data?.limitationDate ? h.toLocalISODate(new Date(detailRes.data.limitationDate)) : null
      r.log('limitation-date-actually-saved', savedDate === future, JSON.stringify({ savedDate, future }))
    })

    // ── Hearing 1: create -> complete ("Done") ───────────────────────────────
    let hearing1Id
    await r.step('add-hearing-1-and-complete-via-ui', async () => {
      if (!caseId) return r.log('add-hearing-1-and-complete-via-ui', false, 'no caseId')
      const hearingsCard = page.locator('p', { hasText: 'Hearings (' }).first().locator('xpath=ancestor::div[contains(@class,"space-y-3")][1]')
      await hearingsCard.locator('button', { hasText: 'Add' }).click()
      await page.waitForTimeout(400)
      const nextWeek = h.toLocalISODate(new Date(Date.now() + 7 * 24 * 3600000))
      await hearingsCard.locator('input[type="date"]').fill(nextWeek)
      await hearingsCard.locator('button', { hasText: 'Add Hearing' }).click()
      await page.waitForTimeout(1000)
      r.log('hearing-1-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((cid) => window.api.hearing.list({ caseId: cid }), caseId)
      const hearings = listRes?.data || []
      const h1 = hearings[0]
      hearing1Id = h1?.id
      r.log('hearing-1-persisted', !!hearing1Id && h1?.status === 'SCHEDULED', JSON.stringify(h1))
      if (!hearing1Id) return

      const freshCard = page.locator('p', { hasText: 'Hearings (' }).first().locator('xpath=ancestor::div[contains(@class,"space-y-3")][1]')
      await freshCard.locator('button', { hasText: 'Done' }).first().click()
      await page.waitForTimeout(1000)
      r.log('hearing-1-complete-no-crash', !(await h.hasErrorBoundary(page)))

      const afterRes = await page.evaluate((cid) => window.api.hearing.list({ caseId: cid }), caseId)
      const h1After = (afterRes?.data || []).find((x) => x.id === hearing1Id)
      r.log('hearing-1-actually-completed', h1After?.status === 'COMPLETED', JSON.stringify(h1After))
    })

    // ── Hearing 2: create -> adjourn ──────────────────────────────────────────
    let hearing2Id
    await r.step('add-hearing-2-and-adjourn-via-ui', async () => {
      if (!caseId) return r.log('add-hearing-2-and-adjourn-via-ui', false, 'no caseId')
      const hearingsCard = page.locator('p', { hasText: 'Hearings (' }).first().locator('xpath=ancestor::div[contains(@class,"space-y-3")][1]')
      await hearingsCard.locator('button', { hasText: 'Add' }).click()
      await page.waitForTimeout(400)
      const in10Days = h.toLocalISODate(new Date(Date.now() + 10 * 24 * 3600000))
      await hearingsCard.locator('input[type="date"]').fill(in10Days)
      await hearingsCard.locator('button', { hasText: 'Add Hearing' }).click()
      await page.waitForTimeout(1000)
      r.log('hearing-2-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((cid) => window.api.hearing.list({ caseId: cid }), caseId)
      const hearings = listRes?.data || []
      const h2 = hearings.find((x) => x.id !== hearing1Id)
      hearing2Id = h2?.id
      r.log('hearing-2-persisted', !!hearing2Id, JSON.stringify(h2))
      if (!hearing2Id) return

      const freshCard = page.locator('p', { hasText: 'Hearings (' }).first().locator('xpath=ancestor::div[contains(@class,"space-y-3")][1]')
      await freshCard.locator('button', { hasText: 'Adjourn' }).first().click()
      await page.waitForTimeout(500)
      const adjournModal = h.topModal(page)
      const nextMonth = h.toLocalISODate(new Date(Date.now() + 30 * 24 * 3600000))
      await adjournModal.locator('input[type="date"]').fill(nextMonth)
      await adjournModal.getByPlaceholder('Adjourned for arguments...').fill(`${TEST_PREFIX} adjourned for arguments`)
      await adjournModal.locator('button', { hasText: 'Adjourn', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('hearing-2-adjourn-no-crash', !(await h.hasErrorBoundary(page)))

      const afterRes = await page.evaluate((cid) => window.api.hearing.list({ caseId: cid }), caseId)
      const h2After = (afterRes?.data || []).find((x) => x.id === hearing2Id)
      r.log('hearing-2-actually-adjourned', h2After?.status === 'ADJOURNED' && !!h2After?.nextDate, JSON.stringify(h2After))
    })

    // ── Disbursement: create -> markBilled ────────────────────────────────────
    let disbursementId
    await r.step('add-disbursement-and-mark-billed-via-ui', async () => {
      if (!caseId) return r.log('add-disbursement-and-mark-billed-via-ui', false, 'no caseId')
      const disbCard = page.locator('p', { hasText: /^Court Fees/ }).first().locator('xpath=ancestor::div[contains(@class,"space-y-3")][1]')
      await disbCard.locator('button', { hasText: 'Add' }).click()
      await page.waitForTimeout(400)
      await disbCard.getByPlaceholder('e.g. Court filing fee, Stamp duty').fill(`${TEST_PREFIX} Court filing fee`)
      await disbCard.locator('input[type="number"]').fill('2500')
      await disbCard.locator('button', { hasText: 'Save' }).click()
      await page.waitForTimeout(1000)
      r.log('disbursement-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((cid) => window.api.caseDisbursement.list({ caseId: cid }), caseId)
      const disbursements = listRes?.data || []
      const d = disbursements.find((x) => x.description === `${TEST_PREFIX} Court filing fee`)
      disbursementId = d?.id
      r.log('disbursement-persisted', !!disbursementId && Number(d?.amount) === 2500 && !d?.isBilledToClient, JSON.stringify(d))
      if (!disbursementId) return

      const freshDisbCard = page.locator('p', { hasText: /^Court Fees/ }).first().locator('xpath=ancestor::div[contains(@class,"space-y-3")][1]')
      await freshDisbCard.locator('button', { hasText: 'Not Billed' }).click()
      await page.waitForTimeout(1000)
      r.log('mark-billed-no-crash', !(await h.hasErrorBoundary(page)))

      const afterRes = await page.evaluate((cid) => window.api.caseDisbursement.list({ caseId: cid }), caseId)
      const dAfter = (afterRes?.data || []).find((x) => x.id === disbursementId)
      r.log('disbursement-actually-marked-billed', dAfter?.isBilledToClient === true, JSON.stringify(dAfter))
    })

    await r.step('close-case-via-ui', async () => {
      if (!caseId) return r.log('close-case-via-ui', false, 'no caseId')
      await page.locator('button', { hasText: 'Close Case' }).click()
      await page.waitForTimeout(1000)
      r.log('close-case-no-crash', !(await h.hasErrorBoundary(page)))

      const detailRes = await page.evaluate((id) => window.api.legalCase.get({ id }), caseId)
      r.log('case-actually-closed', detailRes?.data?.status === 'CLOSED', JSON.stringify(detailRes?.data?.status))
    })

    // ── hearing.delete/caseDisbursement.delete/legalCase.delete: no UI
    // trigger anywhere -- API-only. ───────────────────────────────────────────
    await r.step('delete-hearing-disbursement-case-via-api', async () => {
      if (hearing1Id) {
        const res = await page.evaluate((id) => window.api.hearing.delete({ id }), hearing1Id)
        r.log('hearing-delete-succeeds', !!res?.success, JSON.stringify(res?.error || ''))
        const after = await page.evaluate((cid) => window.api.hearing.list({ caseId: cid }), caseId)
        r.log('hearing-actually-gone', !(after?.data || []).some((x) => x.id === hearing1Id))
      }
      if (disbursementId) {
        const res = await page.evaluate((id) => window.api.caseDisbursement.delete({ id }), disbursementId)
        r.log('disbursement-delete-succeeds', !!res?.success, JSON.stringify(res?.error || ''))
        const after = await page.evaluate((cid) => window.api.caseDisbursement.list({ caseId: cid }), caseId)
        r.log('disbursement-actually-gone', !(after?.data || []).some((x) => x.id === disbursementId))
      }
      if (caseId) {
        const res = await page.evaluate((id) => window.api.legalCase.delete({ id }), caseId)
        r.log('legalCase-delete-succeeds', !!res?.success, JSON.stringify(res?.error || ''))
        const after = await page.evaluate(() => window.api.legalCase.list({}))
        const cases = after?.data?.cases || after?.data || []
        r.log('legalCase-actually-gone', !cases.some((c) => c.id === caseId))
      }
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'LAWYER') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      const caseIds = db.prepare(`SELECT id FROM LegalCase WHERE caseNumber LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let hearings = 0, disbursements = 0, timeEntries = 0, cases = 0
      for (const cid of caseIds) {
        hearings += db.prepare('DELETE FROM Hearing WHERE caseId = ?').run(cid).changes
        disbursements += db.prepare('DELETE FROM CaseDisbursement WHERE caseId = ?').run(cid).changes
        timeEntries += db.prepare('DELETE FROM TimeEntry WHERE caseId = ?').run(cid).changes
        try { cases += db.prepare('DELETE FROM LegalCase WHERE id = ?').run(cid).changes } catch { /* noop */ }
      }
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let custs = 0
      for (const cid of custIds) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ cases, hearings, disbursements, timeEntries, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nLEGAL CASE HEARING/DISBURSEMENT: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
