/**
 * Suite 136 — Section B verify-first items, reconfirmed 2026-09-03:
 * bankAccounts.update, chartOfAccounts.update, serviceCombo.update/delete,
 * workoutLog.listForCustomer/delete. bankAccounts.update, chartOfAccounts.
 * update, serviceCombo.delete and workoutLog.delete have NO UI trigger
 * anywhere in the renderer (confirmed via grep) -- real product gaps (no
 * way to edit a bank account/COA entry or delete a combo/workout log from
 * the app), covered here API-only. serviceCombo.update (Edit button) and
 * workoutLog.listForCustomer (Progress Trend picker) DO have real UI
 * triggers and are covered via real UI. serviceCombo/workoutLog creates
 * already covered via real UI (suite 95).
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Sec136'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    let bankAccountId
    await r.step('bankAccounts-update-api-only-no-ui-trigger', async () => {
      const createRes = await page.evaluate(async (name) => window.api.bankAccounts.create({
        accountName: name, accountType: 'BANK', bankName: 'E2E Test Bank',
      }), `${TEST_PREFIX} Bank Account ${suffix}`)
      bankAccountId = createRes?.data?.id
      r.log('bank-account-created', !!bankAccountId, JSON.stringify(createRes?.error || ''))
      if (!bankAccountId) return

      const renamedBankAccountName = `${TEST_PREFIX} Renamed Bank Account`
      const updateRes = await page.evaluate(({ id, name }) => window.api.bankAccounts.update({
        id, accountName: name, ifscCode: 'HDFC0001234',
      }), { id: bankAccountId, name: renamedBankAccountName })
      r.log('bank-account-update-api-succeeds', !!updateRes?.success, JSON.stringify(updateRes?.error || ''))

      const listRes = await page.evaluate(async () => window.api.bankAccounts.list({}))
      const found = (listRes?.data || []).find((a) => a.id === bankAccountId)
      r.log('bank-account-actually-updated', found?.accountName === renamedBankAccountName && found?.ifscCode === 'HDFC0001234', JSON.stringify(found))
    })

    let coaId
    await r.step('chartOfAccounts-update-api-only-no-ui-trigger', async () => {
      const coaCode = `E2E${String(suffix).slice(-6)}`
      const createRes = await page.evaluate(({ code, name }) => window.api.chartOfAccounts.create({
        accountCode: code, accountName: name, accountType: 'EXPENSE',
      }), { code: coaCode, name: `${TEST_PREFIX} COA Entry ${suffix}` })
      coaId = createRes?.data?.id
      r.log('coa-entry-created', !!coaId, JSON.stringify(createRes?.error || ''))
      if (!coaId) return

      const renamedCoaName = `${TEST_PREFIX} COA Renamed`
      const updateRes = await page.evaluate(({ id, name }) => window.api.chartOfAccounts.update({
        id, accountName: name, isActive: false,
      }), { id: coaId, name: renamedCoaName })
      r.log('coa-update-api-succeeds', !!updateRes?.success, JSON.stringify(updateRes?.error || ''))

      const getRes = await page.evaluate((id) => window.api.chartOfAccounts.get(id), coaId)
      r.log('coa-actually-updated', getRes?.data?.accountName === renamedCoaName && getRes?.data?.isActive === false, JSON.stringify(getRes?.data))
    })

    await r.step('switch-to-beauty-salon', async () => {
      const sw = await h.switchBusinessType(page, 'Beauty Salon')
      r.log('business-type-switched', sw.to === 'BEAUTY_SALON', JSON.stringify(sw))
    })

    let svc1Id, svc2Id, comboId
    const comboName = `${TEST_PREFIX} Combo ${suffix}`
    await r.step('seed-combo-via-api', async () => {
      const s1 = await page.evaluate(async (n) => window.api.serviceCatalog.create({
        serviceName: n, durationMinutes: 30, basePrice: 300, taxRate: 18,
      }), `${TEST_PREFIX} Haircut ${suffix}`)
      const s2 = await page.evaluate(async (n) => window.api.serviceCatalog.create({
        serviceName: n, durationMinutes: 45, basePrice: 800, taxRate: 18,
      }), `${TEST_PREFIX} Hair Spa ${suffix}`)
      svc1Id = s1?.data?.id
      svc2Id = s2?.data?.id
      r.log('service-catalog-entries-created', !!svc1Id && !!svc2Id)

      const comboRes = await page.evaluate(({ name, ids }) => window.api.serviceCombo.create({
        comboName: name, comboPrice: 900, serviceCatalogIds: ids,
      }), { name: comboName, ids: [svc1Id, svc2Id] })
      comboId = comboRes?.data?.id
      r.log('combo-created', !!comboId, JSON.stringify(comboRes?.error || ''))
    })

    await r.step('update-combo-via-ui', async () => {
      if (!comboId) return r.log('update-combo-via-ui', false, 'no comboId')
      await h.gotoHash(page, '#/service-combos')
      await page.waitForTimeout(700)
      r.log('service-combos-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const row = page.locator('tr', { hasText: comboName }).first()
      await row.getByRole('button', { name: 'Edit' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.locator('input[type="number"]').fill('750')
      await page.waitForTimeout(200)
      await modal.getByRole('button', { name: 'Save Changes' }).click()
      await page.waitForTimeout(900)
      r.log('combo-update-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.serviceCombo.list())
      const found = (listRes?.data || []).find((c) => c.id === comboId)
      r.log('combo-actually-updated', found?.comboPrice === 750 && found?.isActive === true, JSON.stringify(found))
    })

    await r.step('delete-combo-api-only-no-ui-trigger', async () => {
      if (!comboId) return r.log('delete-combo-api-only-no-ui-trigger', false, 'no comboId')
      const delRes = await page.evaluate((id) => window.api.serviceCombo.delete({ id }), comboId)
      r.log('combo-delete-api-succeeds', !!delRes?.success, JSON.stringify(delRes?.error || ''))

      // deleteServiceCombo is a soft delete (isActive=false), same convention
      // as every other shop-defined "definition" row in this codebase --
      // the row stays in list(), only its isActive flag flips.
      const listRes = await page.evaluate(async () => window.api.serviceCombo.list())
      const found = (listRes?.data || []).find((c) => c.id === comboId)
      r.log('combo-actually-soft-deleted', found?.isActive === false, JSON.stringify(found))
    })

    await r.step('switch-to-gym-studio', async () => {
      const sw = await h.switchBusinessType(page, 'Gym / Fitness Studio')
      r.log('business-type-switched-gym', sw.to === 'GYM_STUDIO', JSON.stringify(sw))
    })

    let gymCustomerId, workoutLogId
    const gymCustomerName = `${TEST_PREFIX} Member ${suffix}`
    const exerciseName = `${TEST_PREFIX} Deadlift`
    await r.step('seed-customer-and-workout-log-via-api', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), gymCustomerName)
      gymCustomerId = custRes?.data?.id
      r.log('gym-customer-created', !!gymCustomerId)

      const logRes = await page.evaluate(({ cid, ex }) => window.api.workoutLog.create({
        customerId: cid, exerciseName: ex, weight: 80, reps: 8, sets: 4,
      }), { cid: gymCustomerId, ex: exerciseName })
      workoutLogId = logRes?.data?.id
      r.log('workout-log-created', !!workoutLogId, JSON.stringify(logRes?.error || ''))
    })

    await r.step('view-progress-trend-via-ui', async () => {
      if (!gymCustomerId) return r.log('view-progress-trend-via-ui', false, 'no gymCustomerId')
      await h.gotoHash(page, '#/gym/workouts')
      await page.waitForTimeout(700)
      r.log('workout-log-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const memberField = page.locator('div', { has: page.locator('label', { hasText: 'Member' }) }).last()
      await memberField.getByPlaceholder('Search by name or phone...').fill(gymCustomerName)
      await page.waitForTimeout(700)
      const match = page.locator('div.absolute button', { hasText: gymCustomerName })
      r.log('member-search-result-found', await match.count() > 0)
      await match.first().click()
      await page.waitForTimeout(700)

      const exerciseSelect = page.locator('select', { has: page.locator(`option[value="${exerciseName}"]`) }).first()
      r.log('exercise-option-present', await exerciseSelect.count() > 0)
      await exerciseSelect.selectOption(exerciseName)
      await page.waitForTimeout(700)
      r.log('progress-trend-no-crash', !(await h.hasErrorBoundary(page)))

      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('progress-trend-no-longer-shows-select-a-member', !bodyText.includes('Select a member to see their progress.'), 'listForCustomer drove the progress trend render')
    })

    await r.step('delete-workout-log-api-only-no-ui-trigger', async () => {
      if (!workoutLogId) return r.log('delete-workout-log-api-only-no-ui-trigger', false, 'no workoutLogId')
      const delRes = await page.evaluate((id) => window.api.workoutLog.delete({ id }), workoutLogId)
      r.log('workout-log-delete-api-succeeds', !!delRes?.success, JSON.stringify(delRes?.error || ''))

      const listRes = await page.evaluate((cid) => window.api.workoutLog.listForCustomer({ customerId: cid }), gymCustomerId)
      r.log('workout-log-actually-deleted', !(listRes?.data || []).some((l) => l.id === workoutLogId), JSON.stringify(listRes?.data))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'GYM_STUDIO') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      let bankAccounts = 0, coas = 0, catalogItems = 0, combos = 0, workoutLogs = 0, custs = 0
      try { bankAccounts += db.prepare(`DELETE FROM BankAccount WHERE accountName LIKE '${TEST_PREFIX}%'`).run().changes } catch { /* noop */ }
      try { coas += db.prepare(`DELETE FROM ChartOfAccounts WHERE accountName LIKE '${TEST_PREFIX}%'`).run().changes } catch { /* noop */ }
      const comboIds = db.prepare(`SELECT id FROM ServiceCombo WHERE comboName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const cid of comboIds) {
        try { db.prepare('DELETE FROM ServiceComboItem WHERE comboId = ?').run(cid) } catch { /* noop */ }
        try { combos += db.prepare('DELETE FROM ServiceCombo WHERE id = ?').run(cid).changes } catch { /* noop */ }
      }
      try { catalogItems += db.prepare(`DELETE FROM ServiceCatalog WHERE serviceName LIKE '${TEST_PREFIX}%'`).run().changes } catch { /* noop */ }
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const cid of custIds) {
        try { workoutLogs += db.prepare('DELETE FROM WorkoutLog WHERE customerId = ?').run(cid).changes } catch { /* noop */ }
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ bankAccounts, coas, combos, catalogItems, workoutLogs, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nSECTION B VERIFY-FIRST ITEMS: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
