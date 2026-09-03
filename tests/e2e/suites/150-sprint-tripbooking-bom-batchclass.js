/**
 * Suite 150 — Section C medium CRUD gap: sprint.delete (create/update
 * already covered API-only, suite 24), tripBooking.updateStatus (list/
 * createCharter/createSeat/generateInvoice already covered, suites 92/93),
 * bom.delete (upsert covered widely, delete never), batchClass.create/
 * update/enroll/unenroll (list/get/markAttendance already covered, suite
 * 35). Four unrelated verticals in one suite since each gap is small.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E150'

async function fillByLabel(scope, labelText, value) {
  await scope.locator('label', { hasText: labelText }).first().locator('xpath=following-sibling::input[1]').fill(value)
}

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    // ── sprint.delete — Software Agency, ProjectsScreen "Sprints" tab ──────
    await r.step('switch-to-software-agency', async () => {
      const sw = await h.switchBusinessType(page, 'Software / IT Agency')
      r.log('business-type-switched', sw.to === 'SOFTWARE_AGENCY', JSON.stringify(sw))
    })

    let clientId, projectId
    const projectName = `${TEST_PREFIX} Sprint Project ${suffix}`
    await r.step('seed-client-and-project', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), `${TEST_PREFIX} Client ${suffix}`)
      clientId = custRes?.data?.id

      const projRes = await page.evaluate(({ cid, name }) => window.api.serviceProject.create({
        clientId: cid, projectName: name, projectType: 'FEATURE_DEVELOPMENT',
      }), { cid: clientId, name: projectName })
      projectId = projRes?.data?.id
      r.log('client-and-project-created', !!clientId && !!projectId, JSON.stringify(projRes?.error || ''))
    })

    function projectRow() {
      return page.locator('span.font-medium', { hasText: projectName }).first().locator('xpath=ancestor::div[contains(@class,"gap-3")][1]')
    }

    let sprintId
    await r.step('create-and-delete-sprint-via-ui', async () => {
      if (!projectId) return r.log('create-and-delete-sprint-via-ui', false, 'no projectId')
      await h.gotoHash(page, '#/service/service-projects')
      await page.waitForTimeout(700)
      r.log('projects-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const row = projectRow()
      await row.locator('button[title="Sprints"]').click()
      await page.waitForTimeout(500)
      r.log('sprints-tab-opens-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'New Sprint' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.locator('label', { hasText: 'Start Date' }).locator('xpath=following-sibling::input').fill(h.toLocalISODate(new Date()))
      await modal.locator('label', { hasText: 'End Date' }).locator('xpath=following-sibling::input').fill(h.toLocalISODate(new Date(Date.now() + 14 * 24 * 3600000)))
      await modal.getByRole('button', { name: 'Create Sprint' }).click()
      await page.waitForTimeout(1000)
      r.log('sprint-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((pid) => window.api.sprint.list({ projectId: pid }), projectId)
      const found = (listRes?.data || [])[0]
      sprintId = found?.id
      r.log('sprint-persisted', !!sprintId, JSON.stringify(found))
      if (!sprintId) return

      const sprintRow = page.locator('tr', { hasText: `Sprint ${found.sprintNumber}` }).first()
      await sprintRow.locator('button:has(svg.lucide-trash2)').click()
      await page.waitForTimeout(400)
      const confirmDialog = h.topModal(page)
      r.log('confirm-dialog-title-correct', (await confirmDialog.locator('text=Delete Sprint').count()) > 0)
      await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('sprint-delete-no-crash', !(await h.hasErrorBoundary(page)))

      const afterRes = await page.evaluate((pid) => window.api.sprint.list({ projectId: pid }), projectId)
      r.log('sprint-actually-deleted', !(afterRes?.data || []).some((s) => s.id === sprintId), JSON.stringify(afterRes?.data))
    })

    // ── tripBooking.updateStatus — Tours & Travels, TripBookingScreen ──────
    await r.step('switch-to-tours-travels', async () => {
      await h.gotoHash(page, '#/settings/industry')
      await page.waitForTimeout(1200)
      const sw = await h.switchBusinessType(page, 'Tours & Travels')
      r.log('business-type-switched-tours', sw.to === 'TOURS_TRAVELS', JSON.stringify(sw))
    })

    let tourCustomerId, vehicleId
    const regNumber = `${TEST_PREFIX}-${suffix}`
    await r.step('seed-tours-customer-and-vehicle', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `8${String(Date.now()).slice(-9)}`,
      }), `${TEST_PREFIX} Tours Customer ${suffix}`)
      tourCustomerId = custRes?.data?.id

      const vehRes = await page.evaluate((reg) => window.api.vehicle.create({
        registrationNumber: reg, vehicleType: 'SEDAN', seatingCapacity: 4,
      }), regNumber)
      vehicleId = vehRes?.data?.id
      r.log('tours-customer-and-vehicle-created', !!tourCustomerId && !!vehicleId, JSON.stringify(vehRes?.error || ''))
    })

    let bookingId, bookingNumber
    await r.step('create-charter-booking-and-cancel-via-ui', async () => {
      if (!tourCustomerId || !vehicleId) return r.log('create-charter-booking-and-cancel-via-ui', false, 'missing prerequisites')
      const today = h.toLocalISODate(new Date())
      const bookRes = await page.evaluate(({ custId, vehId, today }) => window.api.tripBooking.createCharter({
        customerId: custId, vehicleId: vehId, tripStartDate: today, packageRate: 4000,
      }), { custId: tourCustomerId, vehId: vehicleId, today })
      bookingId = bookRes?.data?.id
      bookingNumber = bookRes?.data?.bookingNumber
      r.log('charter-booking-created', !!bookingId, JSON.stringify(bookRes?.error || ''))
      if (!bookingId) return

      await h.gotoHash(page, '#/tours/bookings')
      await page.waitForTimeout(700)
      r.log('bookings-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const row = page.locator('span.font-semibold', { hasText: bookingNumber }).first().locator('xpath=ancestor::div[contains(@class,"items-start")][1]')
      await row.getByRole('button', { name: 'Cancel Booking' }).click()
      await page.waitForTimeout(1000)
      r.log('cancel-booking-no-crash', !(await h.hasErrorBoundary(page)))

      const afterRes = await page.evaluate(() => window.api.tripBooking.list({}))
      const found = (afterRes?.data || []).find((b) => b.id === bookingId)
      r.log('booking-actually-cancelled', found?.status === 'CANCELLED', JSON.stringify(found?.status))
    })

    // ── bom.delete — Manufacturing, BillOfMaterialsScreen ──────────────────
    await r.step('switch-to-manufacturing', async () => {
      const sw = await h.switchBusinessType(page, 'Manufacturing')
      r.log('business-type-switched-mfg', sw.to === 'MANUFACTURING', JSON.stringify(sw))
    })

    let mfgProductId, mfgProductName, rawMaterialId
    await r.step('seed-product-rawmaterial-and-bom', async () => {
      const rmRes = await page.evaluate(async (name) => window.api.rawMaterials.create({
        name, unit: 'KG', currentStock: 500, reorderLevel: 10, unitCost: 15,
      }), `${TEST_PREFIX} Raw Material ${suffix}`)
      rawMaterialId = rmRes?.data?.id

      mfgProductName = `${TEST_PREFIX} Widget ${suffix}`
      const prodRes = await page.evaluate(async (name) => window.api.products.create({
        productName: name, productType: 'STANDARD', sellingPrice: 300, unit: 'NOS', openingQuantity: 0,
      }), mfgProductName)
      mfgProductId = prodRes?.data?.id
      r.log('product-and-rawmaterial-created', !!mfgProductId && !!rawMaterialId, JSON.stringify(prodRes?.error || ''))

      if (mfgProductId && rawMaterialId) {
        const bomRes = await page.evaluate(({ pid, rid }) => window.api.bom.upsert({
          productId: pid, outputQty: 1, items: [{ rawMaterialId: rid, quantityNeeded: 3 }],
        }), { pid: mfgProductId, rid: rawMaterialId })
        r.log('bom-created', !!bomRes?.success, JSON.stringify(bomRes?.error || ''))
      }
    })

    await r.step('delete-bom-via-ui', async () => {
      if (!mfgProductId) return r.log('delete-bom-via-ui', false, 'no mfgProductId')
      await h.gotoHash(page, '#/manufacturing/bom')
      await page.waitForTimeout(700)
      r.log('bom-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const row = page.locator('h3', { hasText: mfgProductName }).first().locator('xpath=ancestor::div[contains(@class,"items-start")][1]')
      await row.locator('button:has(svg.lucide-trash2)').click()
      await page.waitForTimeout(400)
      const confirmDialog = h.topModal(page)
      await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('bom-delete-no-crash', !(await h.hasErrorBoundary(page)))

      // bom.delete is a soft delete (isActive: false) -- bom.get() itself
      // doesn't filter by isActive, only listBoms() does.
      const getRes = await page.evaluate((pid) => window.api.bom.get({ productId: pid }), mfgProductId)
      r.log('bom-actually-deleted', getRes?.data?.isActive === false, JSON.stringify(getRes?.data?.isActive))

      const listRes = await page.evaluate(() => window.api.bom.list())
      r.log('bom-hidden-from-active-list', !(listRes?.data || []).some((b) => b.productId === mfgProductId), JSON.stringify(listRes?.data?.length))
    })

    // ── batchClass.create/update/enroll/unenroll — Gym / Fitness Studio ────
    await r.step('switch-to-gym-studio', async () => {
      const sw = await h.switchBusinessType(page, 'Gym / Fitness Studio')
      r.log('business-type-switched-gym', sw.to === 'GYM_STUDIO', JSON.stringify(sw))
    })

    const className = `${TEST_PREFIX} Yoga ${suffix}`
    let batchClassId
    await r.step('create-and-update-batchclass-via-ui', async () => {
      await h.gotoHash(page, '#/gym/classes')
      await page.waitForTimeout(700)
      r.log('batchclasses-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'New Class' }).click()
      await page.waitForTimeout(400)
      let modal = h.topModal(page)
      await fillByLabel(modal, 'Class Name', className)
      await modal.getByRole('button', { name: 'MON', exact: true }).click()
      await page.waitForTimeout(200)
      await modal.getByRole('button', { name: 'Save Class' }).click()
      await page.waitForTimeout(1000)
      r.log('batchclass-created-no-crash', !(await h.hasErrorBoundary(page)))

      let listRes = await page.evaluate(() => window.api.batchClass.list({}))
      let found = (listRes?.data || []).find((c) => c.className === className)
      batchClassId = found?.id
      r.log('batchclass-persisted', !!batchClassId && found?.maxCapacity === 20, JSON.stringify(found))
      if (!batchClassId) return

      function classCard() {
        return page.locator('p.font-semibold', { hasText: className }).first().locator('xpath=ancestor::div[contains(@class,"space-y-4")][1]')
      }
      await classCard().getByRole('button', { name: 'Edit' }).click()
      await page.waitForTimeout(400)
      modal = h.topModal(page)
      await modal.locator('label', { hasText: 'Capacity' }).locator('xpath=following-sibling::input').fill('15')
      await modal.getByRole('button', { name: 'Save Class' }).click()
      await page.waitForTimeout(1000)
      r.log('batchclass-update-no-crash', !(await h.hasErrorBoundary(page)))

      listRes = await page.evaluate(() => window.api.batchClass.list({}))
      found = (listRes?.data || []).find((c) => c.id === batchClassId)
      r.log('batchclass-update-persisted', found?.maxCapacity === 15, JSON.stringify(found))
    })

    let memberId
    await r.step('enroll-and-unenroll-member-via-ui', async () => {
      if (!batchClassId) return r.log('enroll-and-unenroll-member-via-ui', false, 'no batchClassId')
      const memberName = `${TEST_PREFIX} Member ${suffix}`
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `7${String(Date.now()).slice(-9)}`,
      }), memberName)
      memberId = custRes?.data?.id
      r.log('member-created', !!memberId, JSON.stringify(custRes?.error || ''))
      if (!memberId) return

      function classCard() {
        return page.locator('p.font-semibold', { hasText: className }).first().locator('xpath=ancestor::div[contains(@class,"space-y-4")][1]')
      }
      await classCard().getByRole('button', { name: 'Enrollment' }).click()
      await page.waitForTimeout(500)
      const enrollModal = h.topModal(page)
      await enrollModal.getByPlaceholder('Search member...').fill(memberName)
      await page.waitForTimeout(400)
      await enrollModal.getByRole('button', { name: 'Enroll' }).click()
      await page.waitForTimeout(900)
      r.log('enroll-no-crash', !(await h.hasErrorBoundary(page)))

      let getRes = await page.evaluate((id) => window.api.batchClass.get({ id }), batchClassId)
      let enrolled = JSON.parse(getRes?.data?.enrolledMemberIds || '[]')
      r.log('member-actually-enrolled', enrolled.includes(memberId), JSON.stringify(enrolled))

      await classCard().getByRole('button', { name: 'Enrollment' }).click()
      await page.waitForTimeout(500)
      const unenrollModal = h.topModal(page)
      await unenrollModal.getByRole('button', { name: 'Remove' }).click()
      await page.waitForTimeout(900)
      r.log('unenroll-no-crash', !(await h.hasErrorBoundary(page)))

      getRes = await page.evaluate((id) => window.api.batchClass.get({ id }), batchClassId)
      enrolled = JSON.parse(getRes?.data?.enrolledMemberIds || '[]')
      r.log('member-actually-unenrolled', !enrolled.includes(memberId), JSON.stringify(enrolled))
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
      let projects = 0, sprints = 0
      const projIds = db.prepare(`SELECT id FROM ServiceProject WHERE projectName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const pid of projIds) {
        try { sprints += db.prepare('DELETE FROM Sprint WHERE projectId = ?').run(pid).changes } catch { /* noop */ }
        try { projects += db.prepare('DELETE FROM ServiceProject WHERE id = ?').run(pid).changes } catch { /* noop */ }
      }

      let bookings = 0, vehicles = 0
      const bookingIds = db.prepare(`SELECT tb.id FROM TripBooking tb JOIN Customer c ON c.id = tb.customerId WHERE c.customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const id of bookingIds) { try { bookings += db.prepare('DELETE FROM TripBooking WHERE id = ?').run(id).changes } catch { /* noop */ } }
      const vehicleIds = db.prepare(`SELECT id FROM TourVehicle WHERE registrationNumber LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const id of vehicleIds) {
        try { db.prepare('DELETE FROM VehicleServiceLog WHERE vehicleId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM TripBooking WHERE vehicleId = ?').run(id) } catch { /* noop */ }
        try { vehicles += db.prepare('DELETE FROM TourVehicle WHERE id = ?').run(id).changes } catch { /* noop */ }
      }

      let boms = 0, prods = 0, rawMats = 0
      try { db.prepare(`DELETE FROM BillOfMaterialItem WHERE bomId IN (SELECT id FROM BillOfMaterial WHERE productId IN (SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%'))`).run() } catch { /* noop */ }
      try { boms += db.prepare(`DELETE FROM BillOfMaterial WHERE productId IN (SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%')`).run().changes } catch { /* noop */ }
      const prodIds = db.prepare(`SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const pid of prodIds) {
        db.prepare('DELETE FROM Inventory WHERE productId = ?').run(pid)
        db.prepare('DELETE FROM LocationStock WHERE productId = ?').run(pid)
        db.prepare('DELETE FROM InventoryMovement WHERE productId = ?').run(pid)
        db.prepare('DELETE FROM ProductCostHistory WHERE productId = ?').run(pid)
        try { prods += db.prepare('DELETE FROM Product WHERE id = ?').run(pid).changes } catch { /* noop */ }
      }
      const rawMatIds = db.prepare(`SELECT id FROM RawMaterial WHERE name LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const rid of rawMatIds) {
        db.prepare('DELETE FROM RawMaterialMovement WHERE rawMaterialId = ?').run(rid)
        db.prepare('DELETE FROM RawMaterialBatch WHERE rawMaterialId = ?').run(rid)
        try { rawMats += db.prepare('DELETE FROM RawMaterial WHERE id = ?').run(rid).changes } catch { /* noop */ }
      }

      let classes = 0
      const classIds = db.prepare(`SELECT id FROM BatchClass WHERE className LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const cid of classIds) {
        try { db.prepare('DELETE FROM BatchClassAttendance WHERE classId = ?').run(cid) } catch { /* noop */ }
        try { classes += db.prepare('DELETE FROM BatchClass WHERE id = ?').run(cid).changes } catch { /* noop */ }
      }

      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let custs = 0
      for (const cid of custIds) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ projects, sprints, bookings, vehicles, boms, prods, rawMats, classes, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nSPRINT / TRIPBOOKING / BOM / BATCHCLASS: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
