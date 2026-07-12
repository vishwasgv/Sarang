/**
 * Suite 0 — harness smoke test. Confirms launch/login/nav mechanics work
 * before any real-feature suite is trusted to build on them.
 */
const h = require('../harness')

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()

  const app = await h.launchApp()
  try {
    const page = await h.getMainWindow(app)
    await r.step('login', async () => {
      await h.login(page)
      r.log('login', !(await h.hasErrorBoundary(page)))
    })

    await r.step('dashboard-loads', async () => {
      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(500)
      r.log('dashboard-loads', !(await h.hasErrorBoundary(page)))
    })

    await r.step('business-type-readable', async () => {
      const bt = h.getBusinessType()
      r.log('business-type-readable', typeof bt === 'string' && bt.length > 0, bt)
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nSMOKE: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
