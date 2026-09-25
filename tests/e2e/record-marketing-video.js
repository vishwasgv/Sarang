/**
 * One-off script (not part of the regular suite) to screen-record real
 * product footage for a Sarang marketing video, using the standard live-UAT
 * harness (real Electron process, real dev DB, real UI — no mockups).
 *
 * Follows the same clean-data pattern as capture-marketing-screenshots.js:
 * temporarily renames the BusinessProfile + adds a few "Demo ..." products,
 * restores both in a `finally` block so the shared dev DB is untouched
 * afterward.
 *
 * Output: tests/e2e/shots/marketing/video/<video>.webm plus a beats.json
 * manifest (label + start/end ms offsets from recording start) so a
 * downstream ffmpeg pass can cut/caption each beat precisely.
 */
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { _electron } = require('playwright-core')
const {
  PROJECT_ROOT, getMainWindow, closeApp, gotoHash, login, withDb,
  resetAdminPasswordForSuite, randomizeAdminPassword, sleep,
} = require('./harness')

const OUT_DIR = path.join(__dirname, 'shots', 'marketing', 'video')
fs.mkdirSync(OUT_DIR, { recursive: true })
const ELECTRON_BIN = path.join(PROJECT_ROOT, 'node_modules', 'electron', 'dist', 'electron.exe')

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
      const id = 'demovid-' + crypto.randomBytes(8).toString('hex')
      const invId = 'demovid-inv-' + crypto.randomBytes(8).toString('hex')
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

async function main() {
  resetAdminPasswordForSuite()
  const state = setup()
  const beats = []
  let app
  let t0
  try {
    app = await _electron.launch({
      executablePath: ELECTRON_BIN,
      args: ['.'],
      cwd: PROJECT_ROOT,
      recordVideo: { dir: OUT_DIR, size: { width: 1440, height: 900 } },
    })
    t0 = Date.now()
    const page = await getMainWindow(app)
    await page.setViewportSize({ width: 1440, height: 900 })
    await login(page)
    await sleep(800)

    const mark = (label) => { beats.push({ label, start: Date.now() - t0 }) }
    const endMark = () => { beats[beats.length - 1].end = Date.now() - t0 }

    // 1. Dashboard
    mark('dashboard')
    await gotoHash(page, '/')
    await sleep(4500)
    endMark()

    // 2. Billing — add a real demo product to the cart, watch the total update
    mark('billing')
    await gotoHash(page, '/billing/new')
    await sleep(1200)
    const searchBox = page.locator('input[placeholder*="Search product" i], input[placeholder*="scan" i]').first()
    if (await searchBox.count()) {
      await searchBox.fill('Demo Wireless Mouse')
      await sleep(900)
      const result = page.locator('text=Demo Wireless Mouse').first()
      if (await result.count()) await result.click().catch(() => {})
      await sleep(700)
    }
    await sleep(3200)
    endMark()

    // 3. Inventory — filtered to clean demo products
    mark('inventory')
    await gotoHash(page, '/inventory')
    await sleep(1000)
    const invSearch = page.locator('input[placeholder*="Search products" i]')
    if (await invSearch.count()) {
      await invSearch.fill('Demo ')
      await sleep(900)
    }
    await sleep(3000)
    endMark()

    // 4. Reports catalog
    mark('reports')
    await gotoHash(page, '/reports')
    await sleep(4500)
    endMark()

    // 5. AI Assistant
    mark('ai')
    await gotoHash(page, '/ai-assistant')
    await sleep(4000)
    endMark()

    // 6. Settings > Industry — grid of business-type tiles (50 verticals)
    mark('verticals')
    await gotoHash(page, '/settings/industry')
    await sleep(1500)
    await page.mouse.wheel(0, 500).catch(() => {})
    await sleep(1500)
    await page.mouse.wheel(0, 500).catch(() => {})
    await sleep(2000)
    endMark()

    // 7. Settings > Language — 13-language list
    mark('language')
    await gotoHash(page, '/settings')
    await sleep(1000)
    const langNav = page.locator('button:has-text("Language"), a:has-text("Language"), div:has-text("Language")').first()
    if (await langNav.count()) await langNav.click().catch(() => {})
    await sleep(4000)
    endMark()

    // 8. Back to dashboard — closing beat
    mark('closing')
    await gotoHash(page, '/')
    await sleep(3500)
    endMark()

    console.log('BEATS_JSON_START')
    console.log(JSON.stringify(beats, null, 2))
    console.log('BEATS_JSON_END')
  } finally {
    if (app) await closeApp(app)
    teardown(state)
    randomizeAdminPassword()
    fs.writeFileSync(path.join(OUT_DIR, 'beats.json'), JSON.stringify(beats, null, 2))
    console.log('Video + manifest saved under', OUT_DIR)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
