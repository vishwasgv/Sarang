/**
 * Suite 101 — logistics-carrier/-freight/-shipment/-vehicle handlers
 * (broader-gap-list closure, 2026-09-03). All four had zero E2E coverage of
 * any kind despite ~18 IPC channels between them -- suite 03 only covers
 * Delivery Challan on this vertical. Real UI-driven CRUD across all four
 * screens (Carriers, Fleet, Freight Ledger, Shipments incl. multi-stop
 * beat planning), using two entities per type where a status transition
 * would otherwise hide the Edit/Delete affordance needed to test it.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Logi'
const suffix = Date.now()

// These four screens use plain `<label>+<input/textarea>` pairs (no
// htmlFor/id) rather than the shared Input atom, so Playwright's
// getByLabel() silently times out on them -- walk from the label text
// instead. Select-based fields DO wire htmlFor/id correctly and keep using
// getByLabel/selectOption directly.
async function fillByLabel(scope, labelText, value) {
  await scope.locator('label', { hasText: labelText }).first().locator('xpath=following-sibling::*[self::input or self::textarea][1]').fill(value)
}

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    // ── Carriers: create (kept-alive A), create/update/toggle/delete (B) ────
    await r.step('create-carrier-A-kept-alive', async () => {
      await h.gotoHash(page, '#/logistics/carriers')
      await page.waitForTimeout(700)
      r.log('carriers-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))
      await page.getByRole('button', { name: '+ Add Carrier' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await fillByLabel(modal, 'Carrier Name *', `${TEST_PREFIX} Carrier A ${suffix}`)
      await fillByLabel(modal, 'Rate/kg', '12')
      await modal.getByRole('button', { name: 'Save' }).click()
      await page.waitForTimeout(1000)
      r.log('carrier-A-modal-closed-no-crash', !(await h.hasErrorBoundary(page)))
    })

    let carrierAId
    await r.step('verify-carrier-A-via-api', async () => {
      const res = await page.evaluate(async () => window.api.logisticsCarrier.list({}))
      const found = (res?.data || []).find((c) => c.name === `${TEST_PREFIX} Carrier A ${suffix}`)
      carrierAId = found?.id
      r.log('carrier-A-created', !!carrierAId, JSON.stringify(found))
    })

    await r.step('carrier-B-full-lifecycle-via-ui', async () => {
      await page.getByRole('button', { name: '+ Add Carrier' }).click()
      await page.waitForTimeout(400)
      let modal = h.topModal(page)
      await fillByLabel(modal, 'Carrier Name *', `${TEST_PREFIX} Carrier B ${suffix}`)
      await modal.getByRole('button', { name: 'Save' }).click()
      await page.waitForTimeout(1000)

      const cardName = page.locator('p', { hasText: `${TEST_PREFIX} Carrier B ${suffix}` }).first()
      const card = cardName.locator('xpath=ancestor::div[contains(@class,"space-y-2")][1]')
      await card.getByRole('button', { name: 'Edit' }).click()
      await page.waitForTimeout(400)
      modal = h.topModal(page)
      await fillByLabel(modal, 'GST Number', 'GSTB12345')
      await modal.getByRole('button', { name: 'Save' }).click()
      await page.waitForTimeout(1000)
      r.log('carrier-B-updated-no-crash', !(await h.hasErrorBoundary(page)))

      const afterUpdate = await page.evaluate(async () => window.api.logisticsCarrier.list({}))
      const foundB = (afterUpdate?.data || []).find((c) => c.name === `${TEST_PREFIX} Carrier B ${suffix}`)
      r.log('carrier-B-gst-persisted', foundB?.gstNumber === 'GSTB12345', JSON.stringify(foundB))

      await card.getByRole('button', { name: 'Deactivate' }).click()
      await page.waitForTimeout(1000)
      const afterDeactivate = await page.evaluate(async () => window.api.logisticsCarrier.list({}))
      const foundBOff = (afterDeactivate?.data || []).find((c) => c.name === `${TEST_PREFIX} Carrier B ${suffix}`)
      r.log('carrier-B-deactivated', foundBOff?.isActive === false, JSON.stringify(foundBOff))

      await card.getByRole('button', { name: 'Activate' }).click()
      await page.waitForTimeout(1000)
      const afterActivate = await page.evaluate(async () => window.api.logisticsCarrier.list({}))
      const foundBOn = (afterActivate?.data || []).find((c) => c.name === `${TEST_PREFIX} Carrier B ${suffix}`)
      r.log('carrier-B-reactivated', foundBOn?.isActive === true, JSON.stringify(foundBOn))

      await card.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
      await page.waitForTimeout(1000)
      r.log('carrier-B-delete-no-crash', !(await h.hasErrorBoundary(page)))
      const afterDelete = await page.evaluate(async () => window.api.logisticsCarrier.list({}))
      const stillThere = (afterDelete?.data || []).some((c) => c.name === `${TEST_PREFIX} Carrier B ${suffix}`)
      r.log('carrier-B-actually-gone', !stillThere)
    })

    // ── Fleet: single vehicle covers create/update/updateStatus/delete ──────
    let vehicleId
    await r.step('vehicle-full-lifecycle-via-ui', async () => {
      await h.gotoHash(page, '#/logistics/fleet')
      await page.waitForTimeout(700)
      r.log('fleet-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const vehicleNumber = `E2ELOGI${suffix.toString().slice(-6)}`
      await page.getByRole('button', { name: '+ Add Vehicle' }).click()
      await page.waitForTimeout(400)
      let modal = h.topModal(page)
      await fillByLabel(modal, 'Vehicle Number *', vehicleNumber)
      await fillByLabel(modal, 'Driver Name', 'E2E Logi Driver')
      await modal.getByRole('button', { name: 'Save' }).click()
      await page.waitForTimeout(1000)
      r.log('vehicle-created-no-crash', !(await h.hasErrorBoundary(page)))

      const afterCreate = await page.evaluate(async () => window.api.logisticsVehicle.list({}))
      const found = (afterCreate?.data || []).find((v) => v.vehicleNumber === vehicleNumber)
      vehicleId = found?.id
      r.log('vehicle-created-persisted', !!vehicleId, JSON.stringify(found))
      if (!vehicleId) return

      const row = page.locator('td', { hasText: vehicleNumber }).first().locator('xpath=..')
      await row.getByRole('button', { name: 'Edit' }).click()
      await page.waitForTimeout(400)
      modal = h.topModal(page)
      await fillByLabel(modal, 'Driver Phone', '9876512345')
      await modal.getByRole('button', { name: 'Save' }).click()
      await page.waitForTimeout(1000)
      r.log('vehicle-updated-no-crash', !(await h.hasErrorBoundary(page)))

      const afterUpdate = await page.evaluate((id) => window.api.logisticsVehicle.list({}), null)
      const foundUpd = (afterUpdate?.data || []).find((v) => v.id === vehicleId)
      r.log('vehicle-driver-phone-persisted', foundUpd?.driverPhone === '9876512345', JSON.stringify(foundUpd))

      const statusRow = page.locator('td', { hasText: vehicleNumber }).first().locator('xpath=..')
      await statusRow.locator('select').selectOption('MAINTENANCE')
      await page.waitForTimeout(1000)
      const afterStatus = await page.evaluate(async () => window.api.logisticsVehicle.list({}))
      const foundStatus = (afterStatus?.data || []).find((v) => v.id === vehicleId)
      r.log('vehicle-status-updated', foundStatus?.status === 'MAINTENANCE', JSON.stringify(foundStatus))

      await statusRow.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
      await page.waitForTimeout(1000)
      r.log('vehicle-delete-no-crash', !(await h.hasErrorBoundary(page)))
      const afterDelete = await page.evaluate(async () => window.api.logisticsVehicle.list({}))
      const stillThere = (afterDelete?.data || []).some((v) => v.id === vehicleId)
      r.log('vehicle-actually-gone', !stillThere)
      if (!stillThere) vehicleId = null
    })

    // ── Freight: entry A (update+markPaid), entry B (delete while PENDING) ──
    let freightAId, freightBId
    await r.step('freight-entry-A-create-update-markpaid-via-ui', async () => {
      if (!carrierAId) return r.log('freight-entry-A-create-update-markpaid-via-ui', false, 'no carrierAId')
      await h.gotoHash(page, '#/logistics/freight')
      await page.waitForTimeout(700)
      r.log('freight-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: '+ Add Entry' }).click()
      await page.waitForTimeout(400)
      let modal = h.topModal(page)
      await modal.getByLabel('Carrier').selectOption(carrierAId)
      await fillByLabel(modal, 'Amount (', '1500')
      await modal.getByRole('button', { name: 'Add Entry' }).click()
      await page.waitForTimeout(1000)
      r.log('freight-A-created-no-crash', !(await h.hasErrorBoundary(page)))

      const afterCreate = await page.evaluate(async () => window.api.logisticsFreight.list({}))
      const found = (afterCreate?.data || []).find((e) => e.carrierId === carrierAId && e.amount === 1500)
      freightAId = found?.id
      r.log('freight-A-persisted', !!freightAId, JSON.stringify(found))
      if (!freightAId) return

      const row = page.locator('td', { hasText: `${TEST_PREFIX} Carrier A ${suffix}` }).first().locator('xpath=..')
      await row.getByRole('button', { name: 'Edit', exact: true }).click()
      await page.waitForTimeout(400)
      modal = h.topModal(page)
      await fillByLabel(modal, 'Amount (', '1800')
      await modal.getByRole('button', { name: 'Save Changes' }).click()
      await page.waitForTimeout(1000)
      r.log('freight-A-updated-no-crash', !(await h.hasErrorBoundary(page)))

      const afterUpdate = await page.evaluate((id) => window.api.logisticsFreight.list({}), freightAId)
      const foundUpd = (afterUpdate?.data || []).find((e) => e.id === freightAId)
      r.log('freight-A-amount-updated', foundUpd?.amount === 1800, JSON.stringify(foundUpd))

      const row2 = page.locator('td', { hasText: `${TEST_PREFIX} Carrier A ${suffix}` }).first().locator('xpath=..')
      await row2.getByRole('button', { name: 'Mark Paid' }).click()
      await page.waitForTimeout(1000)
      r.log('freight-A-markpaid-no-crash', !(await h.hasErrorBoundary(page)))

      const afterPaid = h.withDb((db) => db.prepare('SELECT * FROM FreightLedger WHERE id = ?').get(freightAId))
      r.log('freight-A-paid-date-set', !!afterPaid?.paidDate, JSON.stringify(afterPaid))
    })

    await r.step('freight-entry-B-create-delete-via-ui', async () => {
      if (!carrierAId) return r.log('freight-entry-B-create-delete-via-ui', false, 'no carrierAId')
      await page.getByRole('button', { name: '+ Add Entry' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByLabel('Carrier').selectOption(carrierAId)
      await fillByLabel(modal, 'Amount (', '750')
      await modal.getByRole('button', { name: 'Add Entry' }).click()
      await page.waitForTimeout(1000)

      const afterCreate = await page.evaluate(async () => window.api.logisticsFreight.list({}))
      const found = (afterCreate?.data || []).find((e) => e.carrierId === carrierAId && e.amount === 750)
      freightBId = found?.id
      r.log('freight-B-persisted', !!freightBId, JSON.stringify(found))
      if (!freightBId) return

      // Entry A is already PAID by this point and its row has no Delete
      // button at all (PENDING-only in the JSX) -- scope to the row that
      // actually HAS one, not just a Carrier-A-named row, since both
      // entries share that same carrier name text.
      const row = page.locator('tr').filter({ hasText: `${TEST_PREFIX} Carrier A ${suffix}` }).filter({ has: page.getByRole('button', { name: 'Delete', exact: true }) })
      r.log('freight-B-row-with-delete-found', await row.count() === 1)
      await row.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
      await page.waitForTimeout(1000)
      r.log('freight-B-delete-no-crash', !(await h.hasErrorBoundary(page)))

      const stillThere = h.withDb((db) => db.prepare('SELECT 1 FROM FreightLedger WHERE id = ?').get(freightBId))
      r.log('freight-B-actually-gone', !stillThere)
      if (!stillThere) freightBId = null
    })

    // ── Shipments: A (edit + stops + status transitions), B (cancel+delete) ─
    let shipmentAId
    await r.step('shipment-A-create-via-ui', async () => {
      await h.gotoHash(page, '#/logistics/shipments')
      await page.waitForTimeout(700)
      r.log('shipments-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: '+ New Shipment' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await fillByLabel(modal, 'Destination Address *', `${TEST_PREFIX} Shipment A Destination`)
      if (carrierAId) await modal.getByLabel('Carrier').selectOption(carrierAId)
      await fillByLabel(modal, 'Weight (kg)', '25')
      await modal.getByRole('button', { name: '+ Add Item' }).click()
      await page.waitForTimeout(200)
      await modal.getByPlaceholder('Item name').fill('E2E Logi Item')
      await modal.getByPlaceholder('Qty').fill('3')
      await modal.getByRole('button', { name: 'Save', exact: true }).click()
      await page.waitForTimeout(1200)
      r.log('shipment-A-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.logisticsShipment.list({}))
      const found = (listRes?.data || []).find((s) => s.destinationAddress === `${TEST_PREFIX} Shipment A Destination`)
      shipmentAId = found?.id
      r.log('shipment-A-persisted', !!shipmentAId, JSON.stringify(found))
    })

    await r.step('shipment-A-edit-and-add-stops-via-ui', async () => {
      if (!shipmentAId) return r.log('shipment-A-edit-and-add-stops-via-ui', false, 'no shipmentAId')
      const row = page.locator('p', { hasText: `${TEST_PREFIX} Shipment A Destination` }).first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
      await row.getByRole('button', { name: 'Edit' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByPlaceholder('Customer Name (optional)').fill('E2E Logi Stop Customer 1')
      await modal.getByPlaceholder('Destination Address').fill('E2E Logi Stop Address 1')
      await modal.getByRole('button', { name: 'Add Stop' }).click()
      await page.waitForTimeout(700)
      r.log('stop-1-added-no-crash', !(await h.hasErrorBoundary(page)))

      await modal.getByPlaceholder('Customer Name (optional)').fill('E2E Logi Stop Customer 2')
      await modal.getByPlaceholder('Destination Address').fill('E2E Logi Stop Address 2')
      await modal.getByRole('button', { name: 'Add Stop' }).click()
      await page.waitForTimeout(700)

      const stopsRes = await page.evaluate((id) => window.api.logisticsShipment.get(id), shipmentAId)
      const stops = stopsRes?.data?.stops || []
      r.log('two-stops-persisted', stops.length === 2, JSON.stringify(stops.map((s) => s.destinationAddress)))
      const stop1 = stops.find((s) => s.destinationAddress === 'E2E Logi Stop Address 1')
      const stop2 = stops.find((s) => s.destinationAddress === 'E2E Logi Stop Address 2')

      if (stop1) {
        const stop1Row = modal.locator('p', { hasText: 'E2E Logi Stop Customer 1' }).first().locator('xpath=ancestor::div[contains(@class,"justify-between")][1]')
        await stop1Row.getByRole('button', { name: 'Mark Delivered' }).click()
        await page.waitForTimeout(700)
      }
      if (stop2) {
        const stop2Row = modal.locator('p', { hasText: 'E2E Logi Stop Customer 2' }).first().locator('xpath=ancestor::div[contains(@class,"justify-between")][1]')
        await stop2Row.getByRole('button', { name: 'Delete', exact: true }).click()
        await page.waitForTimeout(400)
        await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
        await page.waitForTimeout(700)
      }

      const afterRes = await page.evaluate((id) => window.api.logisticsShipment.get(id), shipmentAId)
      const afterStops = afterRes?.data?.stops || []
      const afterStop1 = afterStops.find((s) => s.destinationAddress === 'E2E Logi Stop Address 1')
      r.log('stop-1-marked-delivered', afterStop1?.status === 'DELIVERED', JSON.stringify(afterStop1))
      r.log('stop-2-actually-deleted', !afterStops.some((s) => s.destinationAddress === 'E2E Logi Stop Address 2'), JSON.stringify(afterStops.map((s) => s.destinationAddress)))

      await h.topModal(page).getByRole('button', { name: 'Cancel', exact: true }).click()
      await page.waitForTimeout(500)
    })

    await r.step('shipment-A-status-transitions-via-ui', async () => {
      if (!shipmentAId) return r.log('shipment-A-status-transitions-via-ui', false, 'no shipmentAId')
      const row = page.locator('p', { hasText: `${TEST_PREFIX} Shipment A Destination` }).first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
      await row.getByRole('button', { name: '→ READY' }).click()
      await page.waitForTimeout(1000)
      let res = await page.evaluate((id) => window.api.logisticsShipment.get(id), shipmentAId)
      r.log('shipment-A-status-ready', res?.data?.status === 'READY', JSON.stringify(res?.data?.status))

      const row2 = page.locator('p', { hasText: `${TEST_PREFIX} Shipment A Destination` }).first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
      await row2.getByRole('button', { name: '→ IN_TRANSIT' }).click()
      await page.waitForTimeout(1000)
      res = await page.evaluate((id) => window.api.logisticsShipment.get(id), shipmentAId)
      r.log('shipment-A-status-in-transit', res?.data?.status === 'IN_TRANSIT', JSON.stringify(res?.data?.status))
    })

    let shipmentBId
    await r.step('shipment-B-create-cancel-delete-via-ui', async () => {
      await page.getByRole('button', { name: '+ New Shipment' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await fillByLabel(modal, 'Destination Address *', `${TEST_PREFIX} Shipment B Destination`)
      await modal.getByRole('button', { name: 'Save', exact: true }).click()
      await page.waitForTimeout(1200)

      const listRes = await page.evaluate(async () => window.api.logisticsShipment.list({}))
      const found = (listRes?.data || []).find((s) => s.destinationAddress === `${TEST_PREFIX} Shipment B Destination`)
      shipmentBId = found?.id
      r.log('shipment-B-persisted', !!shipmentBId, JSON.stringify(found))
      if (!shipmentBId) return

      const row = page.locator('p', { hasText: `${TEST_PREFIX} Shipment B Destination` }).first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
      await row.getByRole('button', { name: '→ CANCELLED' }).click()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: 'Cancel Shipment', exact: true }).last().click()
      await page.waitForTimeout(1000)
      r.log('shipment-B-cancel-no-crash', !(await h.hasErrorBoundary(page)))

      const afterCancel = await page.evaluate((id) => window.api.logisticsShipment.get(id), shipmentBId)
      r.log('shipment-B-status-cancelled', afterCancel?.data?.status === 'CANCELLED', JSON.stringify(afterCancel?.data?.status))

      const row2 = page.locator('p', { hasText: `${TEST_PREFIX} Shipment B Destination` }).first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
      await row2.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
      await page.waitForTimeout(1000)
      r.log('shipment-B-delete-no-crash', !(await h.hasErrorBoundary(page)))

      const stillThere = h.withDb((db) => db.prepare('SELECT 1 FROM Shipment WHERE id = ?').get(shipmentBId))
      r.log('shipment-B-actually-gone', !stillThere)
      if (!stillThere) shipmentBId = null
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      let shipItems = 0, shipStops = 0, ships = 0, freight = 0, vehicles = 0, carriers = 0

      const shipIds = db.prepare("SELECT id FROM Shipment WHERE destinationAddress LIKE 'E2E Logi%'").all().map((r2) => r2.id)
      for (const sid of shipIds) {
        shipItems += db.prepare('DELETE FROM ShipmentItem WHERE shipmentId = ?').run(sid).changes
        shipStops += db.prepare('DELETE FROM ShipmentStop WHERE shipmentId = ?').run(sid).changes
        freight += db.prepare('DELETE FROM FreightLedger WHERE shipmentId = ?').run(sid).changes
        try { ships += db.prepare('DELETE FROM Shipment WHERE id = ?').run(sid).changes } catch { /* noop */ }
      }

      const carrierIds = db.prepare("SELECT id FROM Carrier WHERE name LIKE 'E2E Logi%'").all().map((r2) => r2.id)
      for (const cid of carrierIds) {
        freight += db.prepare('DELETE FROM FreightLedger WHERE carrierId = ?').run(cid).changes
        db.prepare('UPDATE Shipment SET carrierId = NULL WHERE carrierId = ?').run(cid)
        try { carriers += db.prepare('DELETE FROM Carrier WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Carrier SET isActive = 0 WHERE id = ?').run(cid) }
      }

      const vehicleIds = db.prepare("SELECT id FROM Vehicle WHERE vehicleNumber LIKE 'E2ELOGI%'").all().map((r2) => r2.id)
      for (const vid of vehicleIds) {
        db.prepare('UPDATE Shipment SET vehicleId = NULL WHERE vehicleId = ?').run(vid)
        try { vehicles += db.prepare('DELETE FROM Vehicle WHERE id = ?').run(vid).changes } catch { /* noop */ }
      }

      console.log('extra cleanup:', JSON.stringify({ shipItems, shipStops, ships, freight, vehicles, carriers }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nLOGISTICS CARRIER/FLEET/FREIGHT/SHIPMENT: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
