/**
 * Suite 106 — provider-schedule.handler.ts + service-provider-skill.handler.ts
 * (broader-gap-list closure, 2026-09-03). Real UI on ProviderScheduleScreen
 * (weekly schedule + holidays) and the Employees screen's skill-checklist
 * pills (Phase 58 §2 stylist skill-matching). getCancellationPolicy/
 * upsertCancellationPolicy have no UI trigger anywhere -- API-only.
 * getAvailability/listQualified are read paths already implicitly exercised
 * by AppointmentsScreen's booking flow (suite 02 explicitly skips the
 * provider-specific slot picker there, since a freshly-created Employee has
 * no configured hours) -- verified directly here now that this suite has
 * just configured a real weekly schedule + skill for the provider.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Prov'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    let providerId
    await r.step('create-provider', async () => {
      const joinDate = h.toLocalISODate(new Date())
      const res = await page.evaluate(async ({ name, joinDate }) => window.api.hr.createEmployee({
        fullName: name, phone: `9${String(Date.now()).slice(-9)}`, joinDate,
      }), { name: `${TEST_PREFIX} Provider`, joinDate })
      providerId = res?.data?.id
      r.log('provider-created', !!providerId, JSON.stringify(res?.error || ''))
    })

    await r.step('configure-weekly-schedule-via-ui', async () => {
      if (!providerId) return r.log('configure-weekly-schedule-via-ui', false, 'no providerId')
      await h.gotoHash(page, '#/provider-schedule')
      await page.waitForTimeout(700)
      r.log('provider-schedule-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const selects = page.locator('select')
      if (await selects.count() > 0) {
        const providerSelect = selects.first()
        const optionText = await providerSelect.locator('option', { hasText: `${TEST_PREFIX} Provider` }).first().textContent().catch(() => null)
        if (optionText) await providerSelect.selectOption({ label: optionText.trim() })
        await page.waitForTimeout(500)
      }

      // Monday's schedule row -- narrow the start-time input to the one
      // inside the card that shows "Monday" (each day is its own Card).
      const mondayRow = page.locator('p', { hasText: 'Monday' }).first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
      await mondayRow.locator('input[type="time"]').first().fill('10:00')
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: /Save Schedule|Saved!/ }).click()
      await page.waitForTimeout(1200)
      r.log('schedule-saved-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((pid) => window.api.providerSchedule.list({ providerId: pid }), providerId)
      const monday = (listRes?.data || []).find((s) => s.dayOfWeek === 1)
      r.log('monday-start-time-persisted', monday?.startTime === '10:00', JSON.stringify(monday))
    })

    let holidayId
    await r.step('add-and-delete-holiday-via-ui', async () => {
      const holidayDate = h.toLocalISODate(new Date(Date.now() + 60 * 24 * 3600000))
      await page.getByLabel('Date').fill(holidayDate)
      await page.getByLabel('Holiday Name').fill('E2E Prov Test Holiday')
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('holiday-added-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.providerSchedule.listHolidays())
      const found = (listRes?.data || []).find((hh) => hh.name === 'E2E Prov Test Holiday')
      holidayId = found?.id
      r.log('holiday-persisted', !!holidayId, JSON.stringify(found))
      if (!holidayId) return

      const row = page.locator('span', { hasText: 'E2E Prov Test Holiday' }).first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
      await row.locator('button:has(svg.lucide-trash2)').click()
      await page.waitForTimeout(300)
      await row.getByRole('button', { name: 'Yes' }).click()
      await page.waitForTimeout(1000)
      r.log('holiday-delete-no-crash', !(await h.hasErrorBoundary(page)))

      const afterDelete = await page.evaluate(async () => window.api.providerSchedule.listHolidays())
      const stillThere = (afterDelete?.data || []).some((hh) => hh.id === holidayId)
      r.log('holiday-actually-gone', !stillThere)
    })

    // getCancellationPolicy/upsertCancellationPolicy have no UI trigger anywhere -- API-only.
    await r.step('cancellation-policy-via-api', async () => {
      const before = await page.evaluate(async () => window.api.providerSchedule.getCancellationPolicy())
      r.log('get-cancellation-policy-succeeds', !!before?.success, JSON.stringify(before?.error || ''))

      const upsertRes = await page.evaluate(async () => window.api.providerSchedule.upsertCancellationPolicy({
        noticePeriodHours: 12, cancellationFeeType: 'FLAT', cancellationFeeValue: 100, notes: 'E2E Prov test policy',
      }))
      r.log('upsert-cancellation-policy-succeeds', !!upsertRes?.success, JSON.stringify(upsertRes?.error || ''))

      const after = await page.evaluate(async () => window.api.providerSchedule.getCancellationPolicy())
      r.log('cancellation-policy-persisted', after?.data?.noticePeriodHours === 12 && after?.data?.notes === 'E2E Prov test policy', JSON.stringify(after?.data))
    })

    // ── service-provider-skill: skill pills on the Employees screen ─────────
    let originalModules
    let serviceCatalogId
    await r.step('enable-service-catalog-and-seed-service', async () => {
      const tpl = await page.evaluate(async () => window.api.industry.getTemplate())
      originalModules = tpl?.data?.enabledModules || []
      const withCatalog = [...new Set([...originalModules, 'service_catalog'])]
      const res = await page.evaluate(async (modules) => window.api.industry.updateModules({ modules }), withCatalog)
      r.log('service-catalog-module-enabled', !!res?.success, JSON.stringify(res?.error || ''))

      const svcRes = await page.evaluate(async (name) => window.api.serviceCatalog.create({ serviceName: name }), `${TEST_PREFIX} Service`)
      serviceCatalogId = svcRes?.data?.id
      r.log('service-catalog-item-created', !!serviceCatalogId, JSON.stringify(svcRes?.error || ''))
      await page.reload()
      await page.waitForTimeout(1500)
    })

    await r.step('set-provider-skill-via-ui', async () => {
      if (!providerId || !serviceCatalogId) return r.log('set-provider-skill-via-ui', false, 'missing precondition')
      await h.gotoHash(page, '#/hr/employees')
      await page.waitForTimeout(700)
      r.log('employees-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      // The list is Card-based (onClick on the whole Card opens a detail
      // panel, not the edit form directly) -- clicking any inner text node
      // still bubbles to that handler. Same proven pattern as suite 66's
      // own hr.updateEmployee coverage.
      await page.locator('p', { hasText: `${TEST_PREFIX} Provider` }).first().click()
      await page.waitForTimeout(400)
      const detailPanel = h.topModal(page)
      await detailPanel.locator('button', { hasText: 'Edit' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      const skillPill = modal.getByRole('button', { name: `${TEST_PREFIX} Service` })
      r.log('skill-pill-present', await skillPill.count() > 0)
      await skillPill.click()
      await page.waitForTimeout(300)
      await modal.locator('button', { hasText: 'Save' }).click()
      await page.waitForTimeout(1200)
      r.log('employee-save-no-crash', !(await h.hasErrorBoundary(page)))

      const skillsRes = await page.evaluate((pid) => window.api.providerSkills.listForEmployee({ employeeId: pid }), providerId)
      r.log('skill-persisted', (skillsRes?.data || []).includes(serviceCatalogId), JSON.stringify(skillsRes?.data))
    })

    await r.step('availability-and-qualified-providers-via-api', async () => {
      if (!providerId || !serviceCatalogId) return r.log('availability-and-qualified-providers-via-api', false, 'missing precondition')
      // Next Monday, so the 10:00 schedule configured above actually applies.
      const today = new Date()
      const daysUntilMonday = (8 - today.getDay()) % 7 || 7
      const nextMonday = h.toLocalISODate(new Date(today.getTime() + daysUntilMonday * 24 * 3600000))

      const availRes = await page.evaluate(({ pid, date }) => window.api.providerSchedule.getAvailability({ providerId: pid, date, durationMinutes: 30 }), { pid: providerId, date: nextMonday })
      r.log('get-availability-succeeds', !!availRes?.success, JSON.stringify(availRes))

      const qualRes = await page.evaluate((sid) => window.api.providerSkills.listQualified({ serviceCatalogId: sid }), serviceCatalogId)
      // Returns an array of raw provider-id strings, not objects.
      const includesOurProvider = (qualRes?.data || []).includes(providerId)
      r.log('list-qualified-includes-our-provider', includesOurProvider, JSON.stringify(qualRes?.data))
    })

    await r.step('restore-service-catalog-module', async () => {
      const res = await page.evaluate(async (modules) => window.api.industry.updateModules({ modules }), originalModules)
      r.log('service-catalog-module-restored', !!res?.success, JSON.stringify(res?.error || ''))
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      const empIds = db.prepare("SELECT id FROM Employee WHERE fullName LIKE 'E2E Prov%'").all().map((r2) => r2.id)
      let schedules = 0, skills = 0, employees = 0
      for (const eid of empIds) {
        schedules += db.prepare('DELETE FROM ProviderSchedule WHERE providerId = ?').run(eid).changes
        skills += db.prepare('DELETE FROM ServiceProviderSkill WHERE employeeId = ?').run(eid).changes
        try { employees += db.prepare('DELETE FROM Employee WHERE id = ?').run(eid).changes } catch { db.prepare('UPDATE Employee SET isActive = 0 WHERE id = ?').run(eid) }
      }
      const holidays = db.prepare("DELETE FROM ClinicHoliday WHERE name LIKE 'E2E Prov%'").run().changes
      const services = db.prepare("DELETE FROM ServiceCatalog WHERE serviceName LIKE 'E2E Prov%'").run().changes
      db.prepare("DELETE FROM CancellationPolicy WHERE notes = 'E2E Prov test policy'").run()
      console.log('extra cleanup:', JSON.stringify({ schedules, skills, employees, holidays, services }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nPROVIDER SCHEDULE/HOLIDAYS/SKILLS: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
