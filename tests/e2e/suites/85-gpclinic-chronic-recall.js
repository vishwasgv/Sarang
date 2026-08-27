/**
 * Suite 85 — GP Clinic vertical (chronic_condition_records). Zero prior
 * E2E coverage existed for this vertical before this suite — it's a
 * genuinely GREENFIELD Phase 67 §9.1 item (chronic-condition recall
 * tracking + a real trailing-12-month compliance report), not an upgrade
 * to an existing feature. Real UI-driven tag-condition flow, then the
 * update-cycle that actually produces a ChronicRecallComplianceLog row
 * (only created when an EXISTING record is re-saved, comparing the visit
 * against the recall date it's closing out) driven via direct IPC for
 * precision.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E GP'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-gp-clinic', async () => {
      const sw = await h.switchBusinessType(page, 'GP / General Physician')
      r.log('business-type-switched', sw.to === 'GP_CLINIC', JSON.stringify(sw))
    })

    let patientId

    await r.step('create-patient', async () => {
      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E GP Patient', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      patientId = custRes?.data?.id
      r.log('patient-created', !!patientId, JSON.stringify(custRes?.error || ''))
    })

    await r.step('tag-chronic-condition-via-real-ui', async () => {
      await h.gotoHash(page, '#/clinical/chronic-recalls')
      await page.waitForTimeout(700)
      r.log('chronic-recall-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Tag Condition' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      const patientSelect = modal.locator('select')
      await patientSelect.selectOption(patientId)
      await modal.getByPlaceholder('e.g. Diabetes').fill('E2E Diabetes Type 2')

      // "This Visit Date" 30 days ago; "Next Recall Date" 5 days ago --
      // already overdue by the time this suite checks the dashboard counts.
      const dateInputs = modal.locator('input[type="date"]')
      await dateInputs.nth(1).fill(h.toLocalISODate(new Date(Date.now() - 30 * 24 * 3600000))) // This Visit Date (diagnosedDate is index 0)
      await dateInputs.nth(2).fill(h.toLocalISODate(new Date(Date.now() - 5 * 24 * 3600000))) // Next Recall Date
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Save' }).click()
      await page.waitForTimeout(1200)
      r.log('condition-tagged-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'gp-chronic-condition-tagged')
    })

    let recordId

    await r.step('verify-record-and-overdue-band-via-api', async () => {
      const listRes = await page.evaluate(async (pid) => window.api.chronicRecall.list({ patientId: pid }), patientId)
      const found = (listRes?.data || []).find((rec) => rec.conditionName === 'E2E Diabetes Type 2')
      recordId = found?.id
      r.log('record-findable-via-api', !!recordId, JSON.stringify({ lastVisitDate: found?.lastVisitDate, nextRecallDate: found?.nextRecallDate, isActive: found?.isActive }))

      const overdueRes = await page.evaluate(async (pid) => window.api.chronicRecall.list({ patientId: pid, overdueOnly: true }), patientId)
      const stillFound = (overdueRes?.data || []).some((rec) => rec.id === recordId)
      r.log('record-shows-up-in-overdue-filter', stillFound, JSON.stringify(overdueRes?.data?.map((rec) => rec.id)))
    })

    await r.step('dashboard-counts-reflect-overdue-record', async () => {
      const res = await page.evaluate(async () => window.api.chronicRecall.dashboardCounts())
      r.log('dashboard-counts-shows-nonzero-overdue', (res?.data?.overdueCount ?? 0) >= 1, JSON.stringify(res?.data))
    })

    await r.step('re-save-existing-record-creates-compliance-log-entry', async () => {
      if (!recordId) return r.log('re-save-existing-record-creates-compliance-log-entry', false, 'no recordId captured')
      // Patient visits TODAY -- 5 days AFTER the original nextRecallDate
      // (5 days ago), so this recall period was closed out LATE.
      const today = h.toLocalISODate(new Date())
      const nextRecall = h.toLocalISODate(new Date(Date.now() + 90 * 24 * 3600000))
      const upd = await page.evaluate(({ id, patientId, today, nextRecall }) => window.api.chronicRecall.upsert({
        id, patientId, conditionName: 'E2E Diabetes Type 2',
        lastVisitDate: today, nextRecallDate: nextRecall,
      }), { id: recordId, patientId, today, nextRecall })
      r.log('record-re-saved', !!upd?.success, JSON.stringify(upd?.error || ''))
    })

    await r.step('recall-compliance-report-shows-one-late-closure', async () => {
      const res = await page.evaluate(async () => window.api.chronicRecall.complianceReport({ months: 12 }))
      const row = (res?.data?.byCondition || []).find((c) => c.conditionName === 'E2E Diabetes Type 2')
      r.log('compliance-report-includes-our-condition', !!row, JSON.stringify(res?.data))
      r.log('compliance-report-correctly-marks-late-closure-as-not-on-time', !!row && row.onTime === 0 && row.total === 1, JSON.stringify(row))
    })

    let deactivateRecordId

    await r.step('deactivate-preserves-record-but-hides-from-default-active-list', async () => {
      const secondRes = await page.evaluate(({ pid, lastVisit, nextRecall }) => window.api.chronicRecall.upsert({
        patientId: pid, conditionName: 'E2E Hypertension', lastVisitDate: lastVisit, nextRecallDate: nextRecall,
      }), { pid: patientId, lastVisit: h.toLocalISODate(new Date()), nextRecall: h.toLocalISODate(new Date(Date.now() + 60 * 24 * 3600000)) })
      deactivateRecordId = secondRes?.data?.id
      r.log('second-condition-created', !!deactivateRecordId, JSON.stringify(secondRes?.error || ''))

      const deactRes = await page.evaluate((id) => window.api.chronicRecall.deactivate({ id }), deactivateRecordId)
      r.log('condition-deactivated', deactRes?.data?.isActive === false, JSON.stringify(deactRes?.error || ''))

      const defaultList = await page.evaluate(async (pid) => window.api.chronicRecall.list({ patientId: pid }), patientId)
      const hiddenFromDefault = !(defaultList?.data || []).some((rec) => rec.id === deactivateRecordId)
      r.log('deactivated-record-hidden-from-default-active-list', hiddenFromDefault, JSON.stringify(defaultList?.data?.map((rec) => rec.id)))

      const allList = await page.evaluate(async (pid) => window.api.chronicRecall.list({ patientId: pid, activeOnly: false }), patientId)
      const stillPresentUnfiltered = (allList?.data || []).some((rec) => rec.id === deactivateRecordId)
      r.log('deactivated-record-still-listed-unfiltered-history-preserved', stillPresentUnfiltered, JSON.stringify(allList?.data?.map((rec) => rec.id)))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'GP_CLINIC') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
    h.withDb((db) => {
      const records = db.prepare("SELECT ccr.id AS id FROM ChronicConditionRecord ccr JOIN Customer c ON c.id = ccr.patientId WHERE c.customerName LIKE 'E2E GP%'").all()
      let logs = 0, recs = 0
      for (const rec of records) {
        logs += db.prepare('DELETE FROM ChronicRecallComplianceLog WHERE recordId = ?').run(rec.id).changes
        recs += db.prepare('DELETE FROM ChronicConditionRecord WHERE id = ?').run(rec.id).changes
      }
      console.log('extra cleanup: complianceLogs', logs, 'records', recs)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nGP CLINIC VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
