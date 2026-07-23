/**
 * Runs every suite in tests/e2e/suites/*.js sequentially against the real
 * dev app (suites share one real SQLite DB via the harness's
 * snapshot/restore mechanism, so they cannot run in parallel safely).
 *
 * Starts the electron-vite dev server itself if one isn't already running
 * on :5173, and stops it again afterward if it was the one that started it
 * — so `npm run test:e2e` works as a single self-contained command.
 */
const path = require('path')
const fs = require('fs')
const http = require('http')
const { spawn, execSync } = require('child_process')

const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const SUITES_DIR = path.join(__dirname, 'suites')

function checkDevServer() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:5173', { timeout: 1500 }, (res) => { res.resume(); resolve(true) })
    req.on('error', () => resolve(false))
    req.on('timeout', () => { req.destroy(); resolve(false) })
  })
}

async function waitForDevServer(timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await checkDevServer()) return true
    await new Promise((r) => setTimeout(r, 1000))
  }
  return false
}

// A plain `.kill()` only signals the immediate child. On Windows the real
// process is several layers deep (cmd.exe -> npm -> electron-vite -> electron.exe),
// so a bare kill leaves the rest of the tree running as an orphan that can go on
// hammering the shared dev DB long after this script exits (this is exactly how a
// prior session's Electron/E2E processes were left running for hours colliding
// with the user's own npm run dev window). taskkill /T kills the whole tree.
function killTree(proc) {
  if (!proc || proc.pid == null) return
  if (process.platform === 'win32') {
    try { execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: 'ignore' }) } catch { /* already exited */ }
  } else {
    try { proc.kill() } catch { /* already exited */ }
  }
}

async function main() {
  const filterArg = process.argv[2] // optional: node run-all.js 03-billing.js
  let devServerProc = null
  let startedByUs = false

  if (!(await checkDevServer())) {
    console.log('Starting electron-vite dev server...')
    // Route through cmd.exe /c explicitly on Windows rather than spawning npm.cmd
    // directly — Node's implicit .cmd handling throws `spawn EINVAL` on this platform's
    // Node version (v24.12.0) unless shell:true is used, and shell:true brings its own
    // arg-escaping deprecation warning. This is a plain, unmagical child process instead.
    devServerProc = process.platform === 'win32'
      ? spawn('cmd.exe', ['/c', 'npm', 'run', 'dev'], { cwd: PROJECT_ROOT, detached: false, stdio: 'ignore' })
      : spawn('npm', ['run', 'dev'], { cwd: PROJECT_ROOT, detached: false, stdio: 'ignore' })
    startedByUs = true
    const ready = await waitForDevServer()
    if (!ready) {
      console.error('Dev server did not become ready in time.')
      if (devServerProc) killTree(devServerProc)
      process.exit(1)
    }
    console.log('Dev server ready.')
  }

  const files = fs.readdirSync(SUITES_DIR)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => !filterArg || f.includes(filterArg))
    .sort()

  const allResults = []
  for (const file of files) {
    console.log(`\n${'='.repeat(70)}\nSUITE: ${file}\n${'='.repeat(70)}`)
    const suite = require(path.join(SUITES_DIR, file))
    try {
      const r = await suite.run()
      allResults.push({ file, summary: r.summary(), results: r.all })
    } catch (e) {
      console.error(`FATAL in ${file}:`, e)
      allResults.push({ file, summary: { total: 1, pass: 0, fail: 1 }, results: [{ name: 'suite-fatal', ok: false, detail: String(e) }] })
    }
  }

  console.log(`\n${'='.repeat(70)}\nOVERALL SUMMARY\n${'='.repeat(70)}`)
  let totalPass = 0, totalFail = 0
  for (const { file, summary } of allResults) {
    console.log(`${summary.fail === 0 ? '✓' : '✗'} ${file}: ${summary.pass}/${summary.total}`)
    totalPass += summary.pass
    totalFail += summary.fail
  }
  console.log(`\nTOTAL: ${totalPass + totalFail} checks, ${totalPass} passed, ${totalFail} failed`)

  if (startedByUs && devServerProc) {
    killTree(devServerProc)
  }

  process.exit(totalFail > 0 ? 1 : 0)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
