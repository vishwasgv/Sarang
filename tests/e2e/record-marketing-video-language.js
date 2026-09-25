/**
 * Supplemental one-off recording — just the Settings > Language section beat
 * that the main record-marketing-video.js run missed (its combined
 * button/a/div has-text selector's `.first()` grabbed an ancestor wrapper
 * div instead of the actual nav button, so the click was a silent no-op).
 * Same clean-data pattern as the main script; produces one short clip to
 * splice into the assembled video alongside the main recording's other beats.
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

function setup() {
  return withDb((db) => {
    const bp = db.prepare('SELECT id, businessName, businessType FROM BusinessProfile LIMIT 1').get()
    // RETAIL is a languageLock:'multi' vertical — the dev DB's current type
    // (DENTAL_CLINIC) is a deliberately English-only service vertical, which
    // hides the 13-language list entirely (real, intentional lock, not a bug
    // — see project memory feedback_vertical_screens_language_lock).
    db.prepare('UPDATE BusinessProfile SET businessName = ?, businessType = ? WHERE id = ?')
      .run(DEMO_BUSINESS_NAME, 'RETAIL', bp.id)
    return { originalBusinessName: bp.businessName, originalBusinessType: bp.businessType, businessProfileId: bp.id }
  })
}
function teardown(state) {
  withDb((db) => {
    db.prepare('UPDATE BusinessProfile SET businessName = ?, businessType = ? WHERE id = ?')
      .run(state.originalBusinessName, state.originalBusinessType, state.businessProfileId)
  })
}

async function main() {
  resetAdminPasswordForSuite()
  const state = setup()
  let app
  try {
    app = await _electron.launch({
      executablePath: ELECTRON_BIN,
      args: ['.'],
      cwd: PROJECT_ROOT,
      recordVideo: { dir: OUT_DIR, size: { width: 1440, height: 900 } },
    })
    const page = await getMainWindow(app)
    await page.setViewportSize({ width: 1440, height: 900 })
    await login(page)
    await sleep(800)

    await gotoHash(page, '/settings')
    await sleep(1000)
    const langBtn = page.getByRole('button', { name: 'Language', exact: true })
    await langBtn.waitFor({ state: 'visible', timeout: 5000 })
    await langBtn.click()
    await sleep(5500)
    console.log('Language section clicked and held.')
  } finally {
    if (app) await closeApp(app)
    teardown(state)
    randomizeAdminPassword()
    console.log('Video saved under', OUT_DIR)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
