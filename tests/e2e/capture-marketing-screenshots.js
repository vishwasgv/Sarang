/**
 * One-off script (not part of the regular suite) to capture real product
 * screenshots for the aszurex.com/sarang.html marketing page, using the
 * standard live-UAT harness (real Electron process, real dev DB).
 *
 * The shared dev DB is full of prior phases' test/UAT artifacts (customer
 * names like "Locale Debug Customer", products like "UAT GST Product") that
 * would look unprofessional in a public screenshot. This script:
 *  - Temporarily renames the BusinessProfile to a clean demo name
 *  - Adds a handful of clean "Demo ..." products (additive, doesn't touch
 *    existing rows) so the Inventory screen can be filtered to just those
 *  - Restores the original businessName and removes the demo rows in a
 *    `finally` block, so the shared dev DB is left as it was found.
 *
 * Screenshots are saved to tests/e2e/shots/marketing/.
 */
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const {
  launchApp, getMainWindow, closeApp, gotoHash, login, withDb,
  resetAdminPasswordForSuite, randomizeAdminPassword,
} = require('./harness')

const OUT_DIR = path.join(__dirname, 'shots', 'marketing')
fs.mkdirSync(OUT_DIR, { recursive: true })

const DEMO_BUSINESS_NAME = 'Sarang Retail Demo'
const DEMO_PRODUCTS = [
  { name: 'Demo Wireless Mouse', unit: 'PCS', cost: 320, price: 499, qty: 42, reorder: 10 },
  { name: 'Demo Office Chair', unit: 'PCS', cost: 3200, price: 4499, qty: 8, reorder: 3 },
  { name: 'Demo Notebook Pack (5)', unit: 'PCS', cost: 90, price: 150, qty: 120, reorder: 20 },
  { name: 'Demo LED Bulb 9W', unit: 'PCS', cost: 60, price: 99, qty: 200, reorder: 40 },
  { name: 'Demo Coffee Beans 1kg', unit: 'PCS', cost: 480, price: 699, qty: 35, reorder: 10 },
  { name: 'Demo Bluetooth Speaker', unit: 'PCS', cost: 1100, price: 1599, qty: 15, reorder: 5 },
]

function setup() {
  return withDb((db) => {
    const bp = db.prepare('SELECT id, businessName FROM BusinessProfile LIMIT 1').get()
    db.prepare('UPDATE BusinessProfile SET businessName = ? WHERE id = ?').run(DEMO_BUSINESS_NAME, bp.id)

    const ids = []
    for (const p of DEMO_PRODUCTS) {
      const id = 'demoshot-' + crypto.randomBytes(8).toString('hex')
      const invId = 'demoshot-inv-' + crypto.randomBytes(8).toString('hex')
      db.prepare(`INSERT INTO Product (id, productName, unit, costPrice, sellingPrice, taxRate, isActive, createdAt, updatedAt)
                  VALUES (?, ?, ?, ?, ?, 0, 1, datetime('now'), datetime('now'))`)
        .run(id, p.name, p.unit, p.cost, p.price)
      db.prepare(`INSERT INTO Inventory (id, productId, quantity, reservedQuantity, reorderLevel, reorderQuantity, averageCost, updatedAt)
                  VALUES (?, ?, ?, 0, ?, 0, ?, datetime('now'))`)
        .run(invId, id, p.qty, p.reorder, p.cost)
      ids.push(id)
    }
    return { originalBusinessName: bp.businessName, businessProfileId: bp.id, productIds: ids }
  })
}

function teardown(state) {
  withDb((db) => {
    for (const id of state.productIds) {
      db.prepare('DELETE FROM Inventory WHERE productId = ?').run(id)
      db.prepare('DELETE FROM Product WHERE id = ?').run(id)
    }
    db.prepare('UPDATE BusinessProfile SET businessName = ? WHERE id = ?')
      .run(state.originalBusinessName, state.businessProfileId)
  })
}

async function shotFull(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`) })
  console.log('saved', name)
}

async function shotClip(page, name, clip) {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), clip })
  console.log('saved', name)
}

async function main() {
  resetAdminPasswordForSuite()
  const state = setup()
  let app
  try {
    app = await launchApp()
    const page = await getMainWindow(app)
    await page.setViewportSize({ width: 1440, height: 900 })
    await login(page)
    await page.waitForTimeout(1000)

    // Dashboard — clip to header + KPI cards, excluding the "Top Products"
    // chart panel further down (still shows old test-data product names).
    await gotoHash(page, '/')
    await page.waitForTimeout(1500)
    await shotClip(page, '01-dashboard', { x: 0, y: 0, width: 1440, height: 660 })

    // Billing — the invoice creation screen (POS-style item entry), not the
    // invoice list (which is full of old test customer names).
    await gotoHash(page, '/billing/new')
    await page.waitForTimeout(1500)
    await shotFull(page, '02-billing-new-invoice')

    // Reports — the report catalog, no customer/product data shown.
    await gotoHash(page, '/reports')
    await page.waitForTimeout(1500)
    await shotFull(page, '03-reports')

    // AI Assistant — empty-state screen, no live data shown.
    await gotoHash(page, '/ai-assistant')
    await page.waitForTimeout(1500)
    await shotFull(page, '04-ai-assistant')

    // Inventory — filtered to just the clean "Demo ..." products added above.
    await gotoHash(page, '/inventory')
    await page.waitForTimeout(1200)
    const searchBox = page.locator('input[placeholder*="Search products" i]')
    if (await searchBox.count()) {
      await searchBox.fill('Demo ')
      await page.waitForTimeout(800)
    }
    await shotFull(page, '05-inventory')
  } finally {
    if (app) await closeApp(app)
    teardown(state)
    randomizeAdminPassword()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
