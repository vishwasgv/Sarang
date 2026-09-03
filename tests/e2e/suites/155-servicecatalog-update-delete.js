/**
 * Suite 155 — Section C medium gap: serviceCatalog.update/delete
 * (service-catalog.handler.ts). create/list/listCategories already covered
 * via real UI (suite 95); update/delete were the actual gap. No business-
 * type gate on this screen.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E155'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    let svc1Id, svc2Id, svc3Id
    await r.step('seed-services-via-api', async () => {
      const s1 = await page.evaluate(async (n) => window.api.serviceCatalog.create({
        serviceName: n, durationMinutes: 30, basePrice: 300, taxRate: 18,
      }), `${TEST_PREFIX} Update Me ${suffix}`)
      svc1Id = s1?.data?.id
      const s2 = await page.evaluate(async (n) => window.api.serviceCatalog.create({
        serviceName: n, durationMinutes: 20, basePrice: 200, taxRate: 18,
      }), `${TEST_PREFIX} Delete Me ${suffix}`)
      svc2Id = s2?.data?.id
      const s3 = await page.evaluate(async (n) => window.api.serviceCatalog.create({
        serviceName: n, durationMinutes: 15, basePrice: 150, taxRate: 18,
      }), `${TEST_PREFIX} In Use ${suffix}`)
      svc3Id = s3?.data?.id
      r.log('services-seeded', !!svc1Id && !!svc2Id && !!svc3Id)
    })

    await r.step('update-service-via-ui', async () => {
      await h.gotoHash(page, '#/service-catalog')
      await page.waitForTimeout(700)
      r.log('service-catalog-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByPlaceholder('Search services...').fill(`${TEST_PREFIX} Update Me`)
      await page.waitForTimeout(500)

      const row = page.locator('div.flex.items-start.gap-4', { hasText: `${TEST_PREFIX} Update Me` }).first()
      await row.locator('button:has(svg.lucide-pencil)').click()
      await page.waitForTimeout(400)

      const form = page.locator('div.space-y-4', { hasText: 'Save Service' }).first()
      await form.getByLabel('Base Price').fill('450')
      await page.waitForTimeout(150)
      await form.getByRole('button', { name: 'Save Service' }).click()
      await page.waitForTimeout(900)
      r.log('update-no-crash', !(await h.hasErrorBoundary(page)))

      const getRes = await page.evaluate((id) => window.api.serviceCatalog.get({ id }), svc1Id)
      r.log('service-actually-updated', getRes?.data?.basePrice === 450, JSON.stringify(getRes?.data?.basePrice))
    })

    await r.step('toggle-active-via-ui', async () => {
      const row = page.locator('div.flex.items-start.gap-4', { hasText: `${TEST_PREFIX} Update Me` }).first()
      await row.locator('button[title="Archive"]').click()
      await page.waitForTimeout(900)
      r.log('toggle-no-crash', !(await h.hasErrorBoundary(page)))

      const getRes = await page.evaluate((id) => window.api.serviceCatalog.get({ id }), svc1Id)
      r.log('service-actually-archived', getRes?.data?.isActive === false, JSON.stringify(getRes?.data?.isActive))
    })

    await r.step('delete-service-via-ui', async () => {
      await page.getByPlaceholder('Search services...').fill(`${TEST_PREFIX} Delete Me`)
      await page.waitForTimeout(500)

      const row = page.locator('div.flex.items-start.gap-4', { hasText: `${TEST_PREFIX} Delete Me` }).first()
      await row.locator('button:has(svg.lucide-trash2)').click()
      await page.waitForTimeout(300)
      await row.getByRole('button', { name: 'Yes' }).click()
      await page.waitForTimeout(900)
      r.log('delete-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.serviceCatalog.list())
      r.log('service-actually-deleted', !(listRes?.data || []).some((s) => s.id === svc2Id), JSON.stringify(listRes?.data?.length))
    })

    await r.step('delete-blocked-when-used-by-appointment', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), `${TEST_PREFIX} Customer ${suffix}`)
      const custId = custRes?.data?.id

      const provRes = await page.evaluate(async ({ name, joinDate }) => window.api.hr.createEmployee({
        fullName: name, phone: `8${String(Date.now()).slice(-9)}`, joinDate,
      }), { name: `${TEST_PREFIX} Provider ${suffix}`, joinDate: h.toLocalISODate(new Date()) })
      const provId = provRes?.data?.id

      const apptRes = await page.evaluate(({ providerId, customerId, serviceCatalogId, serviceTitle, scheduledDate }) => window.api.appointments.create({
        providerId, customerId, serviceCatalogId, serviceTitle, scheduledDate, scheduledTime: '10:00', durationMinutes: 15,
      }), { providerId: provId, customerId: custId, serviceCatalogId: svc3Id, serviceTitle: `${TEST_PREFIX} In Use`, scheduledDate: h.toLocalISODate(new Date()) })
      r.log('appointment-linked-to-service', !!apptRes?.data?.id, JSON.stringify(apptRes?.error || ''))

      const delRes = await page.evaluate((id) => window.api.serviceCatalog.delete({ id }), svc3Id)
      r.log('delete-blocked-with-SVC-005', delRes?.success === false && delRes?.error?.code === 'SVC-005', JSON.stringify(delRes?.error))

      const getRes = await page.evaluate((id) => window.api.serviceCatalog.get({ id }), svc3Id)
      r.log('in-use-service-still-present', !!getRes?.data?.id)
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      let appts = 0, emps = 0, custs = 0, svcs = 0
      try { appts = db.prepare(`DELETE FROM Appointment WHERE serviceTitle LIKE '${TEST_PREFIX}%'`).run().changes } catch { /* noop */ }
      const empIds = db.prepare(`SELECT id FROM Employee WHERE fullName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const id of empIds) { try { emps += db.prepare('DELETE FROM Employee WHERE id = ?').run(id).changes } catch { /* noop */ } }
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const cid of custIds) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      const svcIds = db.prepare(`SELECT id FROM ServiceCatalog WHERE serviceName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const id of svcIds) { try { svcs += db.prepare('DELETE FROM ServiceCatalog WHERE id = ?').run(id).changes } catch { db.prepare('UPDATE ServiceCatalog SET isActive = 0 WHERE id = ?').run(id) } }
      console.log('extra cleanup:', JSON.stringify({ appts, emps, custs, svcs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nSERVICE CATALOG UPDATE / DELETE: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
