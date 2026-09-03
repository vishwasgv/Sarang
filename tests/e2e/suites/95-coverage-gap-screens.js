/**
 * Suite 95 — Coverage-gap closure (2026-09-03 full-codebase audit): six
 * screens with ZERO E2E presence of any kind before this suite existed,
 * found by cross-referencing every route in router.tsx against every
 * `gotoHash`/URL string across the whole tests/e2e/suites directory —
 * Cost Centres management, Payments Made (supplier payments list +
 * reverse), the in-app User Manual viewer, Service Combos (Beauty Salon),
 * and Workout Log + Customer Check-In (Gym Studio). Every one of these
 * screens' own IPC channels WAS already exercised via direct API calls
 * elsewhere as other suites' test setup, but the actual screen a real user
 * clicks through — the create/edit forms, the list rendering, the
 * reverse-payment flow — had never been loaded or interacted with by any
 * suite. This suite drives all six through their real UI.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Cov95'
const suffix = Date.now()

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  const ccName = `${TEST_PREFIX} Downtown ${suffix}`
  const ccNameRenamed = `${TEST_PREFIX} Downtown Renamed ${suffix}`
  let ccId = null

  let supplierId = null
  let billId = null
  let supplierPaymentId = null
  const supplierName = `${TEST_PREFIX} Supplier ${suffix}`

  const comboName = `${TEST_PREFIX} Combo ${suffix}`
  let comboId = null
  let svc1Id = null, svc2Id = null

  const gymCustomerName = `${TEST_PREFIX} Member ${suffix}`
  const gymCustomerPhone = `9${String(suffix).slice(-9)}`
  let gymCustomerId = null
  let checkInId = null

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    // ═══════════════════════ Cost Centres management screen ═══════════════
    await r.step('cost-centres-screen-create-via-real-ui', async () => {
      await h.gotoHash(page, '#/cost-centres')
      await page.waitForTimeout(700)
      r.log('cost-centres-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.locator('button', { hasText: 'New Cost Centre' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByPlaceholder(/Marketing, Downtown Branch/).fill(ccName)
      await modal.getByPlaceholder('Optional short code').fill('DT1')
      await modal.getByRole('button', { name: 'Save Changes' }).click()
      await page.waitForTimeout(800)
      r.log('cost-centre-created-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('cost-centre-persisted-and-listed', () => h.withDb((db) => {
      const row = db.prepare('SELECT * FROM CostCentre WHERE name = ?').get(ccName)
      r.log('cost-centre-row-exists', !!row, JSON.stringify(row))
      if (row) ccId = row.id
      r.log('cost-centre-code-persisted', row?.code === 'DT1', JSON.stringify(row?.code))
    }))

    await r.step('cost-centre-edit-and-deactivate-via-real-ui', async () => {
      if (!ccId) return r.log('skipped-no-cost-centre-id', false)
      await h.gotoHash(page, '#/cost-centres')
      await page.waitForTimeout(600)
      const row = page.locator('tr', { hasText: ccName }).first()
      r.log('cost-centre-row-visible-in-list', await row.count() > 0)
      await row.getByRole('button', { name: 'Edit' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      const nameInput = modal.getByPlaceholder(/Marketing, Downtown Branch/)
      await nameInput.fill('')
      await nameInput.fill(ccNameRenamed)
      const activeCheckbox = modal.locator('input[type="checkbox"]')
      await activeCheckbox.uncheck()
      await modal.getByRole('button', { name: 'Save Changes' }).click()
      await page.waitForTimeout(800)
      r.log('cost-centre-edit-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('cost-centre-rename-and-deactivation-persisted', () => h.withDb((db) => {
      if (!ccId) return r.log('skipped-no-cost-centre-id', false)
      const row = db.prepare('SELECT * FROM CostCentre WHERE id = ?').get(ccId)
      r.log('cost-centre-renamed', row?.name === ccNameRenamed, JSON.stringify(row?.name))
      r.log('cost-centre-deactivated', row?.isActive === 0, JSON.stringify(row?.isActive))
    }))

    await r.step('deactivated-cost-centre-shows-inactive-badge', async () => {
      if (!ccId) return r.log('skipped-no-cost-centre-id', false)
      await h.gotoHash(page, '#/cost-centres')
      await page.waitForTimeout(600)
      const row = page.locator('tr', { hasText: ccNameRenamed }).first()
      const rowText = await row.innerText().catch(() => '')
      r.log('inactive-badge-shown-for-deactivated-cost-centre', /Inactive/i.test(rowText), rowText)
    })

    // ═══════════════════════ Payments Made (supplier payments) screen ═════
    await r.step('setup-supplier-bill-and-payment', async () => {
      const supRes = await page.evaluate(async (name) => window.api.suppliers.create({ supplierName: name }), supplierName)
      supplierId = supRes?.data?.id
      r.log('supplier-created', !!supplierId, JSON.stringify(supRes?.error || ''))

      const billRes = await page.evaluate(async (sid) => window.api.bills.create({
        supplierId: sid, items: [{ serviceDescription: 'E2E Cov95 service line', quantity: 1, unitCost: 5000, taxRate: 0 }],
      }), supplierId)
      billId = billRes?.data?.id
      r.log('bill-created', !!billId, JSON.stringify(billRes?.error || ''))

      const payRes = await page.evaluate(async ({ billId, referenceNumber }) => window.api.supplierPayments.record({
        billId, paymentMethod: 'BANK_TRANSFER', amount: 2000, referenceNumber,
      }), { billId, referenceNumber: `${TEST_PREFIX}-REF-${suffix}` })
      supplierPaymentId = payRes?.data?.id
      r.log('supplier-payment-recorded-via-api', !!supplierPaymentId, JSON.stringify(payRes?.error || ''))
    })

    await r.step('supplier-payments-screen-lists-and-searches-payment', async () => {
      if (!supplierPaymentId) return r.log('skipped-no-payment-id', false)
      await h.gotoHash(page, '#/supplier-payments')
      await page.waitForTimeout(700)
      r.log('supplier-payments-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const bodyBefore = await page.locator('body').innerText()
      r.log('payment-row-visible-before-search', bodyBefore.includes(supplierName))

      await page.locator('input[placeholder*="Search bill"]').fill(`${TEST_PREFIX}-REF-${suffix}`)
      await page.waitForTimeout(600)
      const bodyAfter = await page.locator('body').innerText()
      r.log('search-by-reference-number-finds-payment', bodyAfter.includes(supplierName), bodyAfter.slice(0, 500))
    })

    await r.step('reverse-supplier-payment-via-real-ui', async () => {
      if (!supplierPaymentId) return r.log('skipped-no-payment-id', false)
      const row = page.locator('tr', { hasText: supplierName }).first()
      await row.getByLabel('Reverse this payment').click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByPlaceholder('Enter reason for reversal').fill('E2E Cov95 reversal test')
      await modal.getByRole('button', { name: 'Reverse', exact: true }).click()
      await page.waitForTimeout(800)
      r.log('reverse-payment-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('reversal-persisted-and-shown-in-ui', () => h.withDb((db) => {
      if (!supplierPaymentId) return r.log('skipped-no-payment-id', false)
      const row = db.prepare('SELECT * FROM SupplierPayment WHERE id = ?').get(supplierPaymentId)
      r.log('supplier-payment-marked-reversed', row?.isReversed === 1, JSON.stringify(row?.isReversed))
    }))

    await r.step('reversed-payment-shows-reversed-label-in-ui', async () => {
      if (!supplierPaymentId) return r.log('skipped-no-payment-id', false)
      await page.waitForTimeout(300)
      const bodyText = await page.locator('body').innerText()
      r.log('reversed-label-shown', /REVERSED/i.test(bodyText))
    })

    // ═══════════════════════ In-app User Manual viewer ═════════════════════
    await r.step('manual-screen-navigates-and-renders-chapters', async () => {
      await h.gotoHash(page, '#/manual')
      await page.waitForTimeout(700)
      r.log('manual-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const bodyText = await page.locator('body').innerText()
      r.log('manual-shows-getting-started-chapter-by-default', /Getting Started/i.test(bodyText))

      const billingLink = page.locator('button, a', { hasText: 'Billing & Documents' }).first()
      r.log('billing-chapter-link-visible-in-sidebar', await billingLink.count() > 0)
      if (await billingLink.count() > 0) {
        await billingLink.click()
        await page.waitForTimeout(500)
        r.log('manual-chapter-navigation-no-crash', !(await h.hasErrorBoundary(page)))
        const afterNavText = await page.locator('body').innerText()
        r.log('billing-chapter-content-rendered', afterNavText.length > 200, `length=${afterNavText.length}`)
      }
    })

    // ═══════════════════════ Service Combos (Beauty Salon) ═════════════════
    await r.step('switch-to-beauty-salon-for-service-combos', async () => {
      const sw = await h.switchBusinessType(page, 'Beauty Salon')
      r.log('business-type-switched-to-beauty-salon', sw.to === 'BEAUTY_SALON', JSON.stringify(sw))
    })

    await r.step('seed-service-catalog-for-combo', async () => {
      const s1 = await page.evaluate(async (n) => window.api.serviceCatalog.create({
        serviceName: n, durationMinutes: 30, basePrice: 300, taxRate: 18,
      }), `${TEST_PREFIX} Haircut ${suffix}`)
      const s2 = await page.evaluate(async (n) => window.api.serviceCatalog.create({
        serviceName: n, durationMinutes: 45, basePrice: 800, taxRate: 18,
      }), `${TEST_PREFIX} Hair Spa ${suffix}`)
      svc1Id = s1?.data?.id
      svc2Id = s2?.data?.id
      r.log('service-catalog-entries-created', !!svc1Id && !!svc2Id, JSON.stringify({ s1: s1?.error, s2: s2?.error }))
    })

    await r.step('service-combos-screen-create-via-real-ui', async () => {
      await h.gotoHash(page, '#/service-combos')
      await page.waitForTimeout(700)
      r.log('service-combos-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.locator('button', { hasText: 'New Combo' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByPlaceholder('e.g. Wash + Cut + Style').fill(comboName)
      await modal.locator('input[type="number"]').fill('900')
      // Member price total is 300 + 800 = 1100; combo price 900 = ₹200 savings.
      await modal.getByRole('button', { name: `${TEST_PREFIX} Haircut ${suffix}` }).click()
      await modal.getByRole('button', { name: `${TEST_PREFIX} Hair Spa ${suffix}` }).click()
      await modal.getByRole('button', { name: 'Save Changes' }).click()
      await page.waitForTimeout(800)
      r.log('service-combo-created-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('service-combo-persisted-with-correct-services-and-savings', () => h.withDb((db) => {
      const combo = db.prepare('SELECT * FROM ServiceCombo WHERE comboName = ?').get(comboName)
      r.log('service-combo-row-exists', !!combo, JSON.stringify(combo))
      if (combo) {
        comboId = combo.id
        r.log('service-combo-price-correct', combo.comboPrice === 900, JSON.stringify(combo.comboPrice))
        const items = db.prepare('SELECT * FROM ServiceComboItem WHERE comboId = ?').all(combo.id)
        r.log('service-combo-has-both-services', items.length === 2, `count=${items.length}`)
      }
    }))

    await r.step('service-combo-shows-correct-savings-in-ui', async () => {
      if (!comboId) return r.log('skipped-no-combo-id', false)
      await h.gotoHash(page, '#/service-combos')
      await page.waitForTimeout(600)
      const row = page.locator('tr', { hasText: comboName }).first()
      const rowText = await row.innerText().catch(() => '')
      // memberBasePriceTotal (300+800=1100) - comboPrice (900) = 200 savings.
      r.log('combo-row-shows-200-savings', /200/.test(rowText), rowText)
    })

    // ═══════════════════════ Workout Log + Customer Check-In (Gym Studio) ══
    await r.step('switch-to-gym-studio-and-enable-checkin', async () => {
      const sw = await h.switchBusinessType(page, 'Gym / Fitness Studio')
      r.log('business-type-switched-to-gym', sw.to === 'GYM_STUDIO', JSON.stringify(sw))
      // customer_checkin is a universal opt-in module, not defaulted onto
      // any vertical (workout_tracking IS already a GYM_STUDIO default —
      // see industry-template.service.ts's GYM_STUDIO module list).
      const tpl = await page.evaluate(async () => window.api.industry.getTemplate())
      const current = tpl?.data?.enabledModules || []
      if (!current.includes('customer_checkin')) {
        await page.evaluate(async (modules) => window.api.industry.updateModules({ modules }), [...current, 'customer_checkin'])
        // Gotcha (documented in suite 02's own header comment): a raw
        // industry.updateModules() IPC call updates the DB correctly but
        // leaves the renderer's Zustand industry store's enabledModules
        // stale — CustomerCheckInScreen's isModuleEnabled() check reads
        // only that in-memory snapshot, so without a reload it would keep
        // showing the "not enabled" placeholder forever, real DB state
        // notwithstanding.
        await page.reload()
        await page.waitForTimeout(1200)
      }
    })

    await r.step('create-gym-member', async () => {
      const custRes = await page.evaluate(async ({ name, phone }) => window.api.customers.create({ customerName: name, phone }), { name: gymCustomerName, phone: gymCustomerPhone })
      gymCustomerId = custRes?.data?.id
      r.log('gym-member-created', !!gymCustomerId, JSON.stringify(custRes?.error || ''))
    })

    await r.step('workout-log-screen-log-workout-via-real-ui', async () => {
      await h.gotoHash(page, '#/gym/workouts')
      await page.waitForTimeout(700)
      r.log('workout-log-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.locator('button', { hasText: 'Log Workout' }).click()
      await page.waitForTimeout(400)
      // Two CustomerPickers are visible at once on this screen (the Log
      // Workout form's and the separate always-present Progress Trend
      // section's) — .first() picks the form's, matching its earlier
      // position in the DOM.
      await page.getByPlaceholder('Search by name or phone...').first().fill(gymCustomerName)
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: gymCustomerName }).first().click()
      await page.getByPlaceholder('e.g. Bench Press').fill(`${TEST_PREFIX} Bench Press`)
      await page.getByLabel('Weight (kg, optional)').fill('60')
      await page.getByLabel('Reps (optional)').fill('10')
      await page.getByLabel('Sets (optional)').fill('3')
      await page.locator('button', { hasText: 'Save' }).last().click()
      await page.waitForTimeout(800)
      r.log('workout-logged-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('workout-log-persisted-and-shown-in-recent-logs', () => h.withDb((db) => {
      const row = db.prepare("SELECT * FROM WorkoutLog WHERE exerciseName = ?").get(`${TEST_PREFIX} Bench Press`)
      r.log('workout-log-row-exists', !!row, JSON.stringify(row))
      r.log('workout-log-weight-reps-sets-correct', row?.weight === 60 && row?.reps === 10 && row?.sets === 3, JSON.stringify(row))
    }))

    await r.step('workout-log-appears-in-recent-logs-ui', async () => {
      const bodyText = await page.locator('body').innerText()
      r.log('recent-logs-shows-our-workout', bodyText.includes(gymCustomerName) && bodyText.includes(`${TEST_PREFIX} Bench Press`))
    })

    await r.step('customer-checkin-screen-check-in-and-out-via-real-ui', async () => {
      await h.gotoHash(page, '#/attendance/checkin')
      await page.waitForTimeout(700)
      r.log('checkin-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.locator('button', { hasText: 'Check In' }).first().click()
      await page.waitForTimeout(400)
      await page.getByPlaceholder('Search by name or phone...').first().fill(gymCustomerName)
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: gymCustomerName }).first().click()
      await page.locator('button', { hasText: 'Check In' }).last().click()
      await page.waitForTimeout(800)
      r.log('check-in-no-crash', !(await h.hasErrorBoundary(page)))

      const bodyAfterCheckIn = await page.locator('body').innerText()
      r.log('member-shows-as-currently-checked-in', bodyAfterCheckIn.includes(gymCustomerName) && /Currently checked in/i.test(bodyAfterCheckIn))
    })

    await r.step('checkin-persisted-then-checked-out-via-real-ui', async () => {
      checkInId = h.withDb((db) => db.prepare(
        "SELECT ci.id FROM CustomerCheckIn ci JOIN Customer c ON c.id = ci.customerId WHERE c.customerName = ? AND ci.checkOutTime IS NULL"
      ).get(gymCustomerName))?.id
      r.log('checkin-row-exists-and-active', !!checkInId, JSON.stringify(checkInId))
      if (!checkInId) return

      await page.locator('button', { hasText: 'Check Out' }).first().click()
      await page.waitForTimeout(800)
      r.log('check-out-no-crash', !(await h.hasErrorBoundary(page)))

      const row = h.withDb((db) => db.prepare('SELECT * FROM CustomerCheckIn WHERE id = ?').get(checkInId))
      r.log('checkin-row-shows-checkout-time', !!row?.checkOutTime, JSON.stringify(row))
    })

    await r.step('restore-business-type-after-coverage-gap-suite', async () => {
      if (originalBusinessType) {
        await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
      }
    })
  } catch (e) {
    r.log('FATAL', false, String((e && e.message) || e))
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()

    const cleanup = h.withDb((db) => {
      let costCentres = 0, combos = 0, comboItems = 0, workoutLogs = 0, checkIns = 0
      let payments = 0, bills = 0, billItems = 0, suppliers = 0, services = 0, customers = 0

      if (ccId) costCentres += db.prepare('DELETE FROM CostCentre WHERE id = ?').run(ccId).changes

      if (supplierPaymentId) payments += db.prepare('DELETE FROM SupplierPayment WHERE id = ?').run(supplierPaymentId).changes
      if (billId) {
        billItems += db.prepare('DELETE FROM BillItem WHERE billId = ?').run(billId).changes
        try { bills += db.prepare('DELETE FROM Bill WHERE id = ?').run(billId).changes } catch { /* left as-is if still referenced */ }
      }
      if (supplierId) {
        db.prepare('DELETE FROM SupplierLedger WHERE supplierId = ?').run(supplierId)
        try { suppliers += db.prepare('DELETE FROM Supplier WHERE id = ?').run(supplierId).changes } catch { db.prepare('UPDATE Supplier SET isActive = 0 WHERE id = ?').run(supplierId) }
      }

      if (comboId) {
        comboItems += db.prepare('DELETE FROM ServiceComboItem WHERE comboId = ?').run(comboId).changes
        combos += db.prepare('DELETE FROM ServiceCombo WHERE id = ?').run(comboId).changes
      }
      for (const sid of [svc1Id, svc2Id]) {
        if (sid) { try { services += db.prepare('DELETE FROM ServiceCatalog WHERE id = ?').run(sid).changes } catch { /* left if still referenced */ } }
      }

      if (checkInId) checkIns += db.prepare('DELETE FROM CustomerCheckIn WHERE id = ?').run(checkInId).changes
      if (gymCustomerId) {
        workoutLogs += db.prepare('DELETE FROM WorkoutLog WHERE customerId = ?').run(gymCustomerId).changes
        checkIns += db.prepare('DELETE FROM CustomerCheckIn WHERE customerId = ?').run(gymCustomerId).changes
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(gymCustomerId)
        try { customers += db.prepare('DELETE FROM Customer WHERE id = ?').run(gymCustomerId).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(gymCustomerId) }
      }

      return { costCentres, combos, comboItems, workoutLogs, checkIns, payments, bills, billItems, suppliers, services, customers }
    })
    console.log('coverage-gap-screens cleanup:', JSON.stringify(cleanup))
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nCOVERAGE GAP SCREENS: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
