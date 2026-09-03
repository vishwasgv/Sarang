/**
 * Suite 97 — Coverage-gap closure (2026-09-03 full-codebase audit,
 * continuation of suites 11/96/13): categories.update/archive,
 * locations.create/update, inventory.transferStock, and
 * tax.create/update/delete all had ZERO E2E coverage of any kind before
 * this suite — none of these IPC channels, nor the screens that drive
 * them (Manage Categories modal, Locations screen + its Transfer Stock
 * modal, Settings → Tax Configuration), had ever been exercised by any
 * prior suite.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Cov97'
const suffix = Date.now()

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()

  const catName = `${TEST_PREFIX} Category ${suffix}`
  const catNameRenamed = `${TEST_PREFIX} Category Renamed ${suffix}`
  let catId = null

  const loc2Name = `${TEST_PREFIX} Warehouse ${suffix}`
  const loc2NameEdited = `${TEST_PREFIX} Warehouse Edited ${suffix}`
  let loc2Id = null
  let defaultLocationId = null
  let defaultLocationName = null

  const productName = `${TEST_PREFIX} Transfer Product ${suffix}`
  let productId = null

  const taxName = `${TEST_PREFIX} Tax ${suffix}`
  const taxNameEdited = `${TEST_PREFIX} Tax Edited ${suffix}`
  let taxId = null

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    // ═══════════════════════ Categories: update + archive ══════════════════
    await r.step('create-category-for-edit-archive', async () => {
      const res = await page.evaluate(async (name) => window.api.categories.create({ name }), catName)
      catId = res?.data?.id
      r.log('category-created', !!catId, JSON.stringify(res?.error || ''))
    })

    await r.step('category-edited-via-real-ui', async () => {
      if (!catId) return r.log('skipped-no-category-id', false)
      await h.gotoHash(page, '#/products')
      await page.waitForTimeout(700)
      // exact:true matters here — the category filter chips on this same
      // screen render each category's own name as a button, and our test
      // category name itself contains the substring "Category".
      await page.getByRole('button', { name: 'Category', exact: true }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      const nameP = modal.locator('p', { hasText: catName }).first()
      const row = nameP.locator('xpath=../..')
      r.log('category-row-visible-in-modal', await row.count() > 0)
      await row.locator('button[title="Edit"]').click()
      await page.waitForTimeout(300)
      const nameInput = modal.locator('input.flex-1').first()
      await nameInput.fill('')
      await nameInput.fill(catNameRenamed)
      await modal.locator('button[title="Save"]').click()
      await page.waitForTimeout(600)
      r.log('category-edit-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('category-rename-persisted', () => h.withDb((db) => {
      if (!catId) return r.log('skipped-no-category-id', false)
      const row = db.prepare('SELECT * FROM ProductCategory WHERE id = ?').get(catId)
      r.log('category-renamed', row?.name === catNameRenamed, JSON.stringify(row?.name))
    }))

    await r.step('category-archived-via-real-ui', async () => {
      if (!catId) return r.log('skipped-no-category-id', false)
      const modal = h.topModal(page)
      const nameP = modal.locator('p', { hasText: catNameRenamed }).first()
      const row = nameP.locator('xpath=../..')
      await row.locator('button[title="Archive"]').click()
      await page.waitForTimeout(400)
      const confirmModal = h.topModal(page)
      await confirmModal.getByRole('button', { name: 'Archive', exact: true }).click()
      await page.waitForTimeout(700)
      r.log('category-archive-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('category-archive-persisted-and-gone-from-modal-list', async () => {
      if (!catId) return r.log('skipped-no-category-id', false)
      const row = h.withDb((db) => db.prepare('SELECT * FROM ProductCategory WHERE id = ?').get(catId))
      r.log('category-marked-inactive', row?.isActive === 0, JSON.stringify(row?.isActive))

      const modal = h.topModal(page)
      const rowCount = await modal.locator('div', { hasText: catNameRenamed }).count()
      r.log('archived-category-gone-from-modal-list', rowCount === 0, `rowCount=${rowCount}`)
      await modal.getByRole('button', { name: 'Done' }).click()
      await page.waitForTimeout(300)
    })

    // ═══════════════════════ Locations: create + update ════════════════════
    await r.step('setup-default-location-lookup', () => h.withDb((db) => {
      const row = db.prepare('SELECT id, name FROM Location WHERE isDefault = 1').get()
      defaultLocationId = row?.id ?? null
      defaultLocationName = row?.name ?? null
      r.log('default-location-found', !!defaultLocationId, JSON.stringify(row))
    }))

    await r.step('location-created-via-real-ui', async () => {
      await h.gotoHash(page, '#/locations')
      await page.waitForTimeout(700)
      r.log('locations-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.locator('button', { hasText: 'New Location' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByPlaceholder('e.g. Main Warehouse, Retail Counter').fill(loc2Name)
      await modal.getByPlaceholder('Optional').fill('E2E Cov97 Warehouse Address')
      await modal.getByRole('button', { name: 'Save Changes' }).click()
      await page.waitForTimeout(700)
      r.log('location-create-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('location-created-persisted', () => h.withDb((db) => {
      const row = db.prepare('SELECT * FROM Location WHERE name = ?').get(loc2Name)
      r.log('location-row-exists', !!row, JSON.stringify(row))
      if (row) loc2Id = row.id
      r.log('location-address-correct', row?.address === 'E2E Cov97 Warehouse Address', JSON.stringify(row?.address))
    }))

    await r.step('location-edited-via-real-ui', async () => {
      if (!loc2Id) return r.log('skipped-no-location-id', false)
      const row = page.locator('tr', { hasText: loc2Name }).first()
      r.log('location-row-visible-in-list', await row.count() > 0)
      await row.getByRole('button', { name: 'Edit' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      const nameInput = modal.getByPlaceholder('e.g. Main Warehouse, Retail Counter')
      await nameInput.fill('')
      await nameInput.fill(loc2NameEdited)
      await modal.getByRole('button', { name: 'Save Changes' }).click()
      await page.waitForTimeout(700)
      r.log('location-edit-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('location-edit-persisted', () => h.withDb((db) => {
      if (!loc2Id) return r.log('skipped-no-location-id', false)
      const row = db.prepare('SELECT * FROM Location WHERE id = ?').get(loc2Id)
      r.log('location-renamed', row?.name === loc2NameEdited, JSON.stringify(row?.name))
    }))

    // ═══════════════════════ inventory.transferStock ════════════════════════
    await r.step('create-product-with-opening-stock-for-transfer', async () => {
      const res = await page.evaluate(async (name) => window.api.products.create({
        productName: name, productType: 'STANDARD', unit: 'PCS',
        costPrice: 50, sellingPrice: 100, taxRate: 0, openingQuantity: 10,
      }), productName)
      productId = res?.data?.id
      r.log('transfer-product-created', !!productId, JSON.stringify(res?.error || ''))
    })

    await r.step('stock-transferred-via-real-ui', async () => {
      if (!productId || !loc2Id) return r.log('skipped-missing-product-or-location', false)
      await h.gotoHash(page, '#/locations')
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: 'Transfer Stock' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByPlaceholder('Search a product…').fill(productName)
      await page.waitForTimeout(500)
      await modal.getByRole('button', { name: new RegExp(productName) }).click()
      const selects = modal.locator('select')
      await selects.nth(0).selectOption({ label: defaultLocationName })
      await selects.nth(1).selectOption({ label: loc2NameEdited })
      await modal.locator('input[type="number"]').fill('4')
      await modal.getByRole('button', { name: 'Transfer Stock', exact: true }).click()
      await page.waitForTimeout(700)
      r.log('stock-transfer-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('stock-transfer-persisted-in-both-locations', () => h.withDb((db) => {
      if (!productId || !loc2Id) return r.log('skipped-missing-product-or-location', false)
      const destStock = db.prepare('SELECT * FROM LocationStock WHERE productId = ? AND locationId = ?').get(productId, loc2Id)
      r.log('destination-location-received-4-units', destStock?.quantity === 4, JSON.stringify(destStock))
      const movement = db.prepare("SELECT * FROM InventoryMovement WHERE productId = ? AND movementType = 'TRANSFER_IN' ORDER BY createdAt DESC LIMIT 1").get(productId)
      r.log('transfer-inventory-movement-logged', !!movement, JSON.stringify(movement))
    }))

    // ═══════════════════════ Tax: create + update + delete ══════════════════
    await r.step('tax-created-via-real-ui', async () => {
      await h.gotoHash(page, '#/settings')
      await page.waitForTimeout(600)
      await page.locator('button', { hasText: 'Tax Configuration' }).click()
      await page.waitForTimeout(500)
      await page.locator('button', { hasText: 'Add Tax' }).click()
      await page.waitForTimeout(300)
      await page.locator('input[placeholder="e.g. GST 18%"]').fill(taxName)
      await page.locator('input[placeholder="e.g. 18"]').fill('12')
      await page.locator('button', { hasText: 'Add Tax Rate' }).click()
      await page.waitForTimeout(700)
      r.log('tax-create-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('tax-created-persisted', () => h.withDb((db) => {
      const row = db.prepare('SELECT * FROM TaxConfiguration WHERE taxName = ?').get(taxName)
      r.log('tax-row-exists', !!row, JSON.stringify(row))
      if (row) taxId = row.id
      r.log('tax-rate-correct', row?.rate === 12, JSON.stringify(row?.rate))
    }))

    await r.step('tax-edited-via-real-ui', async () => {
      if (!taxId) return r.log('skipped-no-tax-id', false)
      const row = page.locator('div', { hasText: taxName }).filter({ has: page.locator('button[title="Edit"]') }).last()
      r.log('tax-row-visible-in-list', await row.count() > 0)
      await row.locator('button[title="Edit"]').click()
      await page.waitForTimeout(300)
      const nameInput = page.locator('input[placeholder="e.g. GST 18%"]')
      await nameInput.fill('')
      await nameInput.fill(taxNameEdited)
      await page.locator('button', { hasText: 'Save Changes' }).click()
      await page.waitForTimeout(700)
      r.log('tax-edit-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('tax-edit-persisted', () => h.withDb((db) => {
      if (!taxId) return r.log('skipped-no-tax-id', false)
      const row = db.prepare('SELECT * FROM TaxConfiguration WHERE id = ?').get(taxId)
      r.log('tax-renamed', row?.taxName === taxNameEdited, JSON.stringify(row?.taxName))
    }))

    await r.step('tax-deleted-via-real-ui', async () => {
      if (!taxId) return r.log('skipped-no-tax-id', false)
      const row = page.locator('div', { hasText: taxNameEdited }).filter({ has: page.locator('button[title="Delete"]') }).last()
      await row.locator('button[title="Delete"]').click()
      await page.waitForTimeout(400)
      const confirmModal = h.topModal(page)
      await confirmModal.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(700)
      r.log('tax-delete-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('tax-delete-persisted', () => h.withDb((db) => {
      if (!taxId) return r.log('skipped-no-tax-id', false)
      const row = db.prepare('SELECT * FROM TaxConfiguration WHERE id = ?').get(taxId)
      // Per the screen's own confirm-dialog copy: delete deactivates rather
      // than hard-removing the row (existing invoices reference it).
      r.log('tax-marked-inactive-not-hard-deleted', row?.isActive === 0, JSON.stringify(row))
    }))
  } catch (e) {
    r.log('FATAL', false, String((e && e.message) || e))
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()

    const cleanup = h.withDb((db) => {
      let categories = 0, locations = 0, locationStock = 0, movements = 0, products = 0, taxes = 0

      if (catId) categories += db.prepare('DELETE FROM ProductCategory WHERE id = ?').run(catId).changes

      if (productId) {
        movements += db.prepare('DELETE FROM InventoryMovement WHERE productId = ?').run(productId).changes
        locationStock += db.prepare('DELETE FROM LocationStock WHERE productId = ?').run(productId).changes
        db.prepare('DELETE FROM Inventory WHERE productId = ?').run(productId)
        try { products += db.prepare('DELETE FROM Product WHERE id = ?').run(productId).changes } catch { /* left as-is if still referenced */ }
      }
      if (loc2Id) {
        try { locations += db.prepare('DELETE FROM Location WHERE id = ?').run(loc2Id).changes } catch { db.prepare('UPDATE Location SET isActive = 0 WHERE id = ?').run(loc2Id) }
      }
      if (taxId) taxes += db.prepare('DELETE FROM TaxConfiguration WHERE id = ?').run(taxId).changes

      return { categories, locations, locationStock, movements, products, taxes }
    })
    console.log('categories-locations-tax cleanup:', JSON.stringify(cleanup))
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nCATEGORIES/LOCATIONS/TAX: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
