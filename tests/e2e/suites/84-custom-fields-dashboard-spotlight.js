/**
 * Suite 84 — Phase 66 Custom Fields + Per-Vertical Dashboard Spotlight.
 * Zero prior E2E coverage existed for either mechanism before this suite
 * (confirmed via a fresh gap-analysis research pass) — the biggest single
 * gap found across the whole Phase 61-67 E2E closure effort.
 *
 * Part A: Custom Field definitions (all 4 field types, all 5 built-in
 * entities), real values attached on real records, and the
 * deactivate-preserves-history semantics.
 * Part B: analytics:getVerticalSpotlightKpis dispatch correctness across
 * all 18 discriminated-union `kind` values, each via its real representative
 * business type (switched via raw IPC — this suite touches far too many
 * business types for a real UI tile-click round-trip per type to be
 * practical), plus a live Dashboard-screen render check for a few
 * representative kinds.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Phase66'
const suffix = Date.now()

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  const createdFieldDefIds = []
  const createdCustomerIds = []
  const createdSupplierIds = []
  const createdProductIds = []
  const createdExpenseIds = []
  const createdInvoiceIds = []

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    // ══════════════════════════════════════════════════════════════════
    // Part A — Custom Fields
    // ══════════════════════════════════════════════════════════════════

    await r.step('custom-fields-screen-loads-no-crash', async () => {
      await h.gotoHash(page, '#/settings')
      await page.waitForTimeout(600)
      const tile = page.locator('button', { hasText: 'Custom Fields' })
      r.log('custom-fields-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        r.log('custom-fields-section-no-crash', !(await h.hasErrorBoundary(page)))
      }
    })

    let customerFieldId, supplierFieldId, productFieldId, expenseFieldId, invoiceFieldId

    await r.step('create-one-custom-field-definition-per-entity-type-via-api', async () => {
      const custRes = await page.evaluate(() => window.api.customFields.create({
        entityType: 'CUSTOMER', fieldName: `${'E2E Phase66'} Referral Source`, fieldType: 'SELECT',
        selectOptions: ['Walk-in', 'Google', 'Referral'],
      }))
      customerFieldId = custRes?.data?.id
      if (customerFieldId) createdFieldDefIds.push(customerFieldId)
      r.log('customer-select-field-created', !!customerFieldId, JSON.stringify(custRes?.error || ''))

      const supRes = await page.evaluate(() => window.api.customFields.create({
        entityType: 'SUPPLIER', fieldName: 'E2E Phase66 Vendor Rating', fieldType: 'TEXT',
      }))
      supplierFieldId = supRes?.data?.id
      if (supplierFieldId) createdFieldDefIds.push(supplierFieldId)
      r.log('supplier-text-field-created', !!supplierFieldId, JSON.stringify(supRes?.error || ''))

      const prodRes = await page.evaluate(() => window.api.customFields.create({
        entityType: 'PRODUCT', fieldName: 'E2E Phase66 Warranty Months', fieldType: 'NUMBER',
      }))
      productFieldId = prodRes?.data?.id
      if (productFieldId) createdFieldDefIds.push(productFieldId)
      r.log('product-number-field-created', !!productFieldId, JSON.stringify(prodRes?.error || ''))

      const expRes = await page.evaluate(() => window.api.customFields.create({
        entityType: 'EXPENSE', fieldName: 'E2E Phase66 Approved On', fieldType: 'DATE',
      }))
      expenseFieldId = expRes?.data?.id
      if (expenseFieldId) createdFieldDefIds.push(expenseFieldId)
      r.log('expense-date-field-created', !!expenseFieldId, JSON.stringify(expRes?.error || ''))

      const invRes = await page.evaluate(() => window.api.customFields.create({
        entityType: 'INVOICE', fieldName: 'E2E Phase66 PO Reference', fieldType: 'TEXT',
      }))
      invoiceFieldId = invRes?.data?.id
      if (invoiceFieldId) createdFieldDefIds.push(invoiceFieldId)
      r.log('invoice-text-field-created', !!invoiceFieldId, JSON.stringify(invRes?.error || ''))
    })

    await r.step('select-field-without-options-rejected', async () => {
      const res = await page.evaluate(() => window.api.customFields.create({
        entityType: 'CUSTOMER', fieldName: 'E2E Phase66 Bad Select', fieldType: 'SELECT',
      }))
      r.log('select-without-options-rejected', res?.success === false, JSON.stringify(res?.error))
    })

    let taggedCustomerId

    await r.step('attach-custom-field-values-to-real-records', async () => {
      const custRes = await page.evaluate(({ fieldId }) => window.api.customers.create({
        customerName: 'E2E Phase66 Tagged Customer', phone: `9${String(Date.now()).slice(-9)}`, creditLimit: 0, taxExempt: false,
        customFields: { [fieldId]: 'Google' },
      }), { fieldId: customerFieldId })
      taggedCustomerId = custRes?.data?.id
      if (taggedCustomerId) createdCustomerIds.push(taggedCustomerId)
      const custFields = JSON.parse(custRes?.data?.customFields || '{}')
      r.log('customer-custom-field-value-persisted', custFields[customerFieldId] === 'Google', JSON.stringify(custFields))

      const supRes = await page.evaluate(({ fieldId }) => window.api.suppliers.create({
        supplierName: 'E2E Phase66 Tagged Supplier', customFields: { [fieldId]: 'A+' },
      }), { fieldId: supplierFieldId })
      if (supRes?.data?.id) createdSupplierIds.push(supRes.data.id)
      const supFields = JSON.parse(supRes?.data?.customFields || '{}')
      r.log('supplier-custom-field-value-persisted', supFields[supplierFieldId] === 'A+', JSON.stringify(supFields))

      const prodRes = await page.evaluate(({ fieldId }) => window.api.products.create({
        productName: 'E2E Phase66 Tagged Product', productType: 'STANDARD', unit: 'PCS',
        costPrice: 10, sellingPrice: 20, taxRate: 0, customFields: { [fieldId]: 12 },
      }), { fieldId: productFieldId })
      if (prodRes?.data?.id) createdProductIds.push(prodRes.data.id)
      const prodFields = JSON.parse(prodRes?.data?.customFields || '{}')
      r.log('product-custom-field-value-persisted', prodFields[productFieldId] === 12, JSON.stringify(prodFields))

      const catRes = await page.evaluate(() => window.api.expenses.listCategories())
      const categoryId = catRes?.data?.[0]?.id
      const today = h.toLocalISODate(new Date())
      const expRes = await page.evaluate(({ categoryId, fieldId, today }) => window.api.expenses.create({
        categoryId, expenseName: 'E2E Phase66 Tagged Expense', amount: 500, expenseDate: today,
        customFields: { [fieldId]: today },
      }), { categoryId, fieldId: expenseFieldId, today })
      if (expRes?.data?.id) createdExpenseIds.push(expRes.data.id)
      const expFields = JSON.parse(expRes?.data?.customFields || '{}')
      r.log('expense-custom-field-value-persisted', expFields[expenseFieldId] === today, JSON.stringify(expFields))

      const prod2Res = await page.evaluate((name) => window.api.products.create({
        productName: name, productType: 'STANDARD', unit: 'PCS', costPrice: 50, sellingPrice: 100, taxRate: 18, openingQuantity: 5,
      }), `${TEST_PREFIX} Invoice Line Product ${suffix}`)
      if (prod2Res?.data?.id) createdProductIds.push(prod2Res.data.id)
      const invRes = await page.evaluate(({ customerId, productId, fieldId }) => window.api.billing.createInvoice({
        customerId, paymentMethod: 'CASH', customFields: { [fieldId]: 'PO-99182' },
        items: [{ productId, quantity: 1, unitPrice: 100, taxRate: 18 }],
      }), { customerId: taggedCustomerId, productId: prod2Res?.data?.id, fieldId: invoiceFieldId })
      if (invRes?.data?.id) createdInvoiceIds.push(invRes.data.id)
      const invFields = JSON.parse(invRes?.data?.customFields || '{}')
      r.log('invoice-custom-field-value-persisted', invFields[invoiceFieldId] === 'PO-99182', JSON.stringify(invFields))
    })

    await r.step('custom-field-value-round-trips-via-real-ui-customer-form', async () => {
      await h.gotoHash(page, '#/customers')
      await page.waitForTimeout(700)
      r.log('customers-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))
      // Clicking the row navigates to a detail page (no CustomFieldsEditor
      // there) -- the field only renders inside the Edit modal, opened via
      // the row's own "Edit" pencil button.
      const rowContainer = page.locator('tr, [role="row"]', { hasText: 'E2E Phase66 Tagged Customer' }).first()
      const present = await rowContainer.count() > 0
      r.log('tagged-customer-row-visible', present)
      if (present) {
        await rowContainer.locator('button[title="Edit"]').click()
        await page.waitForTimeout(600)
        const bodyText = await page.locator('body').innerText().catch(() => '')
        r.log('custom-field-editor-shows-referral-source', bodyText.includes('Referral Source'), 'expected the custom field label to render on the customer edit form')
        await page.keyboard.press('Escape').catch(() => {})
        await page.waitForTimeout(300)
      }
    })

    await r.step('deactivate-field-preserves-existing-history', async () => {
      const deactRes = await page.evaluate((id) => window.api.customFields.update({ id, isActive: false }), customerFieldId)
      r.log('field-deactivated', deactRes?.data?.isActive === false, JSON.stringify(deactRes?.error || ''))

      const activeOnly = await page.evaluate(async () => window.api.customFields.list({ entityType: 'CUSTOMER', activeOnly: true }))
      const stillOfferedWhenActiveOnly = (activeOnly?.data || []).some((f) => f.id === customerFieldId)
      r.log('deactivated-field-no-longer-offered-for-new-records', !stillOfferedWhenActiveOnly, JSON.stringify(activeOnly?.data?.map((f) => f.id)))

      const allFields = await page.evaluate(async () => window.api.customFields.list({ entityType: 'CUSTOMER' }))
      const stillListedOverall = (allFields?.data || []).some((f) => f.id === customerFieldId)
      r.log('deactivated-field-still-listed-unfiltered', stillListedOverall, JSON.stringify(allFields?.data?.map((f) => f.id)))

      const custAfter = await page.evaluate((id) => window.api.customers.get(id), taggedCustomerId)
      const fieldsAfter = JSON.parse(custAfter?.data?.customFields || '{}')
      r.log('deactivate-preserves-existing-records-value-history', fieldsAfter[customerFieldId] === 'Google', JSON.stringify(fieldsAfter))
    })

    // ══════════════════════════════════════════════════════════════════
    // Part B — Dashboard Spotlight (all 18 kind values)
    // ══════════════════════════════════════════════════════════════════

    async function switchTo(businessType) {
      const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), businessType)
      await page.reload()
      await page.waitForTimeout(1200)
      return res
    }

    async function checkSpotlightKind(businessType, expectedKind) {
      await switchTo(businessType)
      const res = await page.evaluate(async (bt) => window.api.analytics.getVerticalSpotlightKpis({ businessType: bt }), businessType)
      r.log(`spotlight-${businessType}-is-${expectedKind}`, res?.success === true && res?.data?.kind === expectedKind, JSON.stringify(res?.data || res?.error))
    }

    // Each explicitly-branched vertical, one representative business type
    // per discriminated-union `kind`.
    await r.step('spotlight-membership-gym-studio', () => checkSpotlightKind('GYM_STUDIO', 'membership'))
    await r.step('spotlight-legal-lawyer', () => checkSpotlightKind('LAWYER', 'legal'))
    await r.step('spotlight-photography-photo-studio', () => checkSpotlightKind('PHOTO_STUDIO', 'photography'))
    await r.step('spotlight-driving-driving-school', () => checkSpotlightKind('DRIVING_SCHOOL', 'driving'))
    await r.step('spotlight-vaccination-vet-clinic', () => checkSpotlightKind('VET_CLINIC', 'vaccination'))
    await r.step('spotlight-recall-dental-clinic', () => checkSpotlightKind('DENTAL_CLINIC', 'recall'))
    await r.step('spotlight-chronic-recall-gp-clinic', () => checkSpotlightKind('GP_CLINIC', 'chronicRecall'))
    await r.step('spotlight-referral-specialist-clinic', () => checkSpotlightKind('SPECIALIST_CLINIC', 'referral'))
    await r.step('spotlight-outcome-progress-physio-clinic', () => checkSpotlightKind('PHYSIO_CLINIC', 'outcomeProgress'))
    await r.step('spotlight-hotel-hotel-lodge', () => checkSpotlightKind('HOTEL_LODGE', 'hotel'))
    await r.step('spotlight-lab-diagnostic-lab', () => checkSpotlightKind('DIAGNOSTIC_LAB', 'lab'))
    await r.step('spotlight-coaching-coaching-institute', () => checkSpotlightKind('COACHING_INSTITUTE', 'coaching'))
    await r.step('spotlight-compliance-ca-firm', () => checkSpotlightKind('CA_FIRM', 'compliance'))
    await r.step('spotlight-compliance-company-secretary', () => checkSpotlightKind('COMPANY_SECRETARY', 'compliance'))
    await r.step('spotlight-jobcards-car-service-center', () => checkSpotlightKind('CAR_SERVICE_CENTER', 'jobCards'))
    await r.step('spotlight-placement-placement-agency', () => checkSpotlightKind('PLACEMENT_AGENCY', 'placement'))
    await r.step('spotlight-general-general', () => checkSpotlightKind('GENERAL', 'general'))
    // Generic-bucket representatives -- neither has its own explicit branch,
    // both fall through to APPOINTMENT_BASED_TYPES/PROJECT_BASED_TYPES.has().
    await r.step('spotlight-appointment-beauty-salon', () => checkSpotlightKind('BEAUTY_SALON', 'appointment'))
    await r.step('spotlight-project-independent-consultant', () => checkSpotlightKind('INDEPENDENT_CONSULTANT', 'project'))

    await r.step('dashboard-screen-renders-membership-spotlight-live', async () => {
      await switchTo('GYM_STUDIO')
      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(1000)
      r.log('dashboard-loads-no-crash-membership-kind', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'dashboard-spotlight-membership')
    })

    await r.step('dashboard-screen-renders-chronic-recall-spotlight-live', async () => {
      await switchTo('GP_CLINIC')
      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(1000)
      r.log('dashboard-loads-no-crash-chronic-recall-kind-greenfield', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'dashboard-spotlight-chronic-recall')
    })

    await r.step('dashboard-screen-renders-hotel-spotlight-live', async () => {
      await switchTo('HOTEL_LODGE')
      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(1000)
      r.log('dashboard-loads-no-crash-hotel-kind', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'dashboard-spotlight-hotel')
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType) {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    const genericCleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(genericCleaned))
    const cleanup = h.withDb((db) => {
      const counts = {}
      const del = (table, where, ...args) => { try { counts[table] = (counts[table] || 0) + db.prepare(`DELETE FROM ${table} WHERE ${where}`).run(...args).changes } catch { /* noop */ } }
      for (const invId of createdInvoiceIds) {
        del('InvoiceItem', 'invoiceId = ?', invId)
        del('CustomerLedger', 'invoiceId = ?', invId)
        del('"Invoice"', 'id = ?', invId)
      }
      for (const expId of createdExpenseIds) del('Expense', 'id = ?', expId)
      for (const pid of createdProductIds) {
        del('Inventory', 'productId = ?', pid)
        try { db.prepare('DELETE FROM Product WHERE id = ?').run(pid) } catch { db.prepare('UPDATE Product SET isActive = 0 WHERE id = ?').run(pid) }
      }
      for (const sid of createdSupplierIds) {
        del('SupplierLedger', 'supplierId = ?', sid)
        try { db.prepare('DELETE FROM Supplier WHERE id = ?').run(sid) } catch { db.prepare('UPDATE Supplier SET isActive = 0 WHERE id = ?').run(sid) }
      }
      for (const cid of createdCustomerIds) {
        del('CustomerLedger', 'customerId = ?', cid)
        try { db.prepare('DELETE FROM Customer WHERE id = ?').run(cid) } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      for (const fid of createdFieldDefIds) del('CustomFieldDefinition', 'id = ?', fid)
      return counts
    })
    console.log('extra cleanup (Phase 66 tables):', JSON.stringify(cleanup))
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nCUSTOM FIELDS + DASHBOARD SPOTLIGHT (PHASE 66): ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
