import { app, BrowserWindow, dialog, shell, nativeTheme, session } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { registerAllIpcHandlers } from './ipc'
import { initializeDatabase, closeDatabase } from './database/db'
import { checkDatabaseIntegrity, createBackup } from './services/backup.service'
import { createNotification } from './services/notification.service'
import { getPrisma } from './database/db'
import { seedDefaultData } from './database/seed'
import { logger } from './utils/logger'
import { scanPaymentOverdueNotifications } from './services/payment-overdue.service'
import { ensureQrOrderServerState, stopQrOrderServer } from './server/qr-order-server'
import { ensureKitchenDisplayServerState, stopKitchenDisplayServer } from './server/kitchen-display-server'
import { ensureFieldOrderServerState, stopFieldOrderServer } from './server/field-order-server'
import { initKitchenDisplayWindowWatcher } from './windows/kitchen-display-window'
import { generateComplianceTasksForAllClients } from './services/compliance-event.service'
import { isModuleEnabled } from './services/industry-template.service'
import { recordUsageTick, flushUsageQueue } from './services/usage-metrics.service'
import { shutdownAi } from './services/ai-query.service'
import { resolveTutorialBoot, getTutorialDbPath, seedTutorialDemoData, deleteTutorialArtifacts } from './services/tutorial.service'
import { isSetupComplete, completeSetup } from './services/setup.service'
import { login } from './services/auth.service'
import { isAllowedExternalUrl } from './utils/external-link.util'

process.env.APP_ROOT = app.getAppPath()

// Tracks the last due count to avoid spamming in-app alerts on every 60-min tick
let _lastDueCount = 0

async function evaluateNotificationQueue(): Promise<void> {
  try {
    const db = getPrisma()
    const dueCount = await db.notificationQueue.count({
      where: { status: 'PENDING', scheduledFor: { lte: new Date() } },
    })
    if (dueCount > 0 && dueCount !== _lastDueCount) {
      _lastDueCount = dueCount
      await createNotification({
        title: 'WhatsApp Reminders Due',
        message: `${dueCount} reminder${dueCount > 1 ? 's are' : ' is'} ready to send. Visit the Notifications screen.`,
        notificationType: 'INFO',
      })
    } else if (dueCount === 0) {
      _lastDueCount = 0
    }
  } catch (err) {
    logger.error('[NotificationEngine] Evaluation failed:', err)
  }
}

// Auto-generates the next-due ComplianceTask for every active client from the
// seeded statutory calendar (GST/TDS/ROC/ITR) — CA_FIRM/COMPANY_SECRETARY
// only, gated on the compliance_tasks module flag (not a business-type
// check, same "module flag gates behavior" convention this file's other
// checks already use). Idempotent, so running it hourly alongside the other
// evaluators is safe — see generateComplianceTasksForAllClients's own header
// comment for the exact-match dedup it relies on.
async function generateComplianceTasks(): Promise<void> {
  try {
    if (!(await isModuleEnabled('compliance_tasks'))) return
    const { created } = await generateComplianceTasksForAllClients()
    if (created > 0) {
      await createNotification({
        title: 'Compliance Tasks Generated',
        message: `${created} new compliance task${created > 1 ? 's were' : ' was'} created from the statutory calendar.`,
        notificationType: 'INFO',
      })
    }
  } catch (err) {
    logger.error('[ComplianceTaskGenerator] Failed:', err)
  }
}

async function checkAutoBackupReminder(): Promise<void> {
  try {
    const db = getPrisma()
    const settings = await db.setting.findMany({
      where: { settingKey: { in: ['auto_backup_enabled', 'auto_backup_interval_days'] } }
    })
    const settingMap: Record<string, string> = {}
    for (const s of settings) settingMap[s.settingKey] = s.settingValue

    if (settingMap['auto_backup_enabled'] !== 'true') return

    // `daysSinceBackup >= NaN` is always false in JS — an invalid stored value
    // must fall back to the default, not silently disable auto-backup forever.
    const parsedInterval = parseInt(settingMap['auto_backup_interval_days'] ?? '7', 10)
    const intervalDays = Number.isFinite(parsedInterval) && parsedInterval > 0 ? parsedInterval : 7
    const lastBackup = await db.backup.findFirst({ orderBy: { backupDate: 'desc' }, select: { backupDate: true } })

    const daysSinceBackup = lastBackup
      ? Math.floor((Date.now() - lastBackup.backupDate.getTime()) / 86400000)
      : Infinity

    if (daysSinceBackup >= intervalDays) {
      await createBackup(undefined)
      logger.info(`[Backup] Auto-backup created (${daysSinceBackup} days since last backup).`)
      await createNotification({
        title: 'Auto-Backup Complete',
        message: `Your data was automatically backed up (${daysSinceBackup} days since last backup).`,
        notificationType: 'INFO'
      })
    }
  } catch (err) {
    logger.error('[Backup] Auto-backup check failed:', err)
  }
}

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null
let hasFinalizedUsageTickForQuit = false

// ── Splash screen ─────────────────────────────────────────────────────────────
// Shown during DB init and Electron renderer warm-up so the user never sees
// a blank grey window on startup.
function createSplashWindow(): void {
  splashWindow = new BrowserWindow({
    width: 380,
    height: 280,
    frame: false,
    transparent: false,
    resizable: false,
    center: true,
    show: false,
    skipTaskbar: true,
    backgroundColor: '#0F172A',
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  const splashPath = isDev
    ? join(__dirname, '../../resources/splash.html')
    : join(process.resourcesPath, 'splash.html')

  if (existsSync(splashPath)) {
    splashWindow.loadFile(splashPath)
    splashWindow.once('ready-to-show', () => splashWindow?.show())
  }
}

function closeSplash(): void {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close()
    splashWindow = null
  }
}

// ── Main window ───────────────────────────────────────────────────────────────
function createWindow(): void {
  const iconPath = isDev
    ? join(__dirname, '../../resources/icon.png')
    : join(process.resourcesPath, 'icon.png')

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Sarang Business OS Lite',
    backgroundColor: '#F8FAFC',
    show: false,
    autoHideMenuBar: true,
    ...(existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: isDev
    }
  })

  // Prevent arbitrary navigation away from the app origin
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const appUrl = isDev ? 'http://localhost:5173' : `file://${__dirname}`
    if (!url.startsWith(appUrl)) event.preventDefault()
  })

  // R27: Only allow opening known safe domains (+ wa.me, mailto:) in the system browser/mail client
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  mainWindow.once('ready-to-show', () => {
    closeSplash()
    mainWindow?.show()
    if (isDev) mainWindow?.webContents.openDevTools({ mode: 'detach' })
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  nativeTheme.themeSource = 'light'

  // Show splash immediately — before the async DB init so startup feels instant
  createSplashWindow()

  // Phase 60 — resolve BEFORE any database connection exists (deliberately
  // filesystem-only, see tutorial.service.ts's resolveTutorialBoot header
  // comment for why). If a fresh tutorial session is pending, connect to
  // tutorial.db instead of the real database for the rest of this process's
  // lifetime — every screen/service below runs completely unmodified either
  // way, it's just talking to different data.
  const tutorialFlag = resolveTutorialBoot()

  // REAL BUG found+fixed 2026-08-04 (live install verification): every
  // tutorial session, on a genuinely fresh tutorial.db, was crashing with
  // "Tutorial auto-login failed: Incorrect username or password." Root cause
  // was `if (!setupCheck.data)` below — isSetupComplete() always resolves to
  // a truthy `{ complete, needsLicenseOnly }` object, even when complete is
  // false, so that check never actually ran completeSetup(), no admin was
  // ever created, and the subsequent login() with the flag's random
  // credentials always failed. Fixed by checking `.data?.complete` instead.
  // A stale/locked tutorial.db orphaned by a previous run that never reached
  // exitTutorial()'s clean shutdown (crash, forced kill, file still locked
  // on Windows) is a second, separate way this same login failure can occur,
  // so bootTutorialSession() is still retried once after a hard reset if the
  // first attempt fails for any reason, and if it STILL fails, the whole
  // tutorial boot is abandoned in favor of the real app instead of crashing —
  // the tutorial's own UI copy promises it "never affects your actual data,"
  // so its failure must never block the real app behind a scary "Database
  // Error... contact support" dialog implying the user's actual business
  // data is at risk, when it never was.
  async function bootTutorialSession(flag: NonNullable<typeof tutorialFlag>): Promise<void> {
    const setupCheck = await isSetupComplete()
    if (!setupCheck.data?.complete) {
      const setupResult = await completeSetup({
        businessName: 'Sarang Demo Business',
        businessType: flag.businessType,
        ownerName: 'Demo Owner',
        country: 'India',
        currencyCode: 'INR',
        currencySymbol: '₹',
        taxModel: 'GST',
        adminUsername: flag.adminUsername,
        adminPassword: flag.adminPassword,
        adminFullName: 'Demo Admin'
      })
      if (!setupResult.success) {
        throw new Error(`Tutorial setup failed: ${setupResult.error?.message ?? 'unknown error'}`)
      }
      await seedTutorialDemoData()
    }
    const loginResult = await login(flag.adminUsername, flag.adminPassword)
    if (!loginResult.success) {
      throw new Error(`Tutorial auto-login failed: ${loginResult.error?.message ?? 'unknown error'}`)
    }
  }

  try {
    await initializeDatabase(tutorialFlag ? getTutorialDbPath() : undefined)
    // Idempotent — ensures expense categories and GST tax configs exist for existing installs
    await seedDefaultData().catch(e => logger.warn('[Seed] Non-fatal seed error on startup:', e))

    if (tutorialFlag) {
      try {
        await bootTutorialSession(tutorialFlag)
      } catch (firstErr) {
        logger.warn('[Tutorial] First boot attempt failed (likely a stale tutorial.db orphaned by a previous session) — resetting and retrying fresh.', firstErr)
        await closeDatabase()
        deleteTutorialArtifacts()
        await initializeDatabase(getTutorialDbPath())
        await bootTutorialSession(tutorialFlag)
      }
    }
  } catch (err) {
    if (tutorialFlag) {
      logger.error('[Tutorial] Tutorial boot failed even after a reset retry — abandoning the tutorial and booting the real app instead.', err)
      await closeDatabase().catch(() => {})
      deleteTutorialArtifacts()
      try {
        await initializeDatabase(undefined)
        await seedDefaultData().catch(e => logger.warn('[Seed] Non-fatal seed error on startup:', e))
      } catch (realAppErr) {
        closeSplash()
        dialog.showErrorBox(
          'Sarang — Database Error',
          `Failed to initialize the database.\n\n${(realAppErr as Error).message ?? String(realAppErr)}\n\nPlease ensure you have write access to:\n${app.getPath('userData')}\n\nContact support if this issue persists.`
        )
        app.quit()
        return
      }
    } else {
      closeSplash()
      dialog.showErrorBox(
        'Sarang — Database Error',
        `Failed to initialize the database.\n\n${(err as Error).message ?? String(err)}\n\nPlease ensure you have write access to:\n${app.getPath('userData')}\n\nContact support if this issue persists.`
      )
      app.quit()
      return
    }
  }

  // Async integrity check — logs for diagnostics, and pushes a real notification
  // (same mechanism as the auto-backup/reminder notifications below) so a
  // corrupted database isn't something the user only discovers by happening to
  // open Settings > Backup & Recovery.
  checkDatabaseIntegrity().then(r => {
    if (!r.ok) {
      logger.error('[DB] Integrity issue on startup:', r.message)
      createNotification({
        title: 'Database Integrity Issue',
        message: `${r.message} Go to Backup & Recovery to restore from a backup.`,
        notificationType: 'ERROR'
      }).catch(() => {})
    } else {
      logger.info('[DB] Integrity check passed.')
    }
  }).catch(() => {})

  // Auto-backup reminder check (GAP G7.2) — must re-check periodically, not just
  // at startup: a shop that leaves the app running for days without restarting
  // would otherwise never get auto-backed-up again after the initial check.
  checkAutoBackupReminder().catch(() => {})

  // Aggregate, anonymous daily active-usage tracking (disclosed once at
  // install in SetupWizard, never surfaced again during normal use) —
  // start/recover today's tick immediately, then opportunistically try to
  // deliver any queued backlog. See usage-metrics.service.ts's header
  // comment for the full design; never load-bearing, never blocks startup.
  recordUsageTick().then(() => flushUsageQueue()).catch(() => {})

  // Notification evaluation engine: fire on startup + every 60 min (spec §13.7)
  evaluateNotificationQueue().catch(() => {})
  scanPaymentOverdueNotifications().catch(() => {})
  generateComplianceTasks().catch(() => {})
  setInterval(() => {
    checkAutoBackupReminder().catch(() => {})
    evaluateNotificationQueue().catch(() => {})
    scanPaymentOverdueNotifications().catch(() => {})
    generateComplianceTasks().catch(() => {})
  }, 60 * 60 * 1000)

  // Usage-metrics tick — shorter cadence than the hour-ly evaluators above
  // by design (see usage-metrics.service.ts): keeps the elapsed-time math
  // tight and bounds how much a crash can lose to at most one interval.
  setInterval(() => {
    recordUsageTick().then(() => flushUsageQueue()).catch(() => {})
  }, 5 * 60 * 1000)

  // R26: Enforce CSP at the webRequest layer (stronger than meta tag alone).
  // Skipped in dev: the production policy's `script-src 'self'` (no
  // unsafe-inline) and `connect-src 'none'` block Vite's React Fast Refresh
  // preamble script and its HMR websocket respectively — with it applied,
  // the renderer never mounts (#root stays empty) under `npm run dev`.
  if (!isDev) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: file:; font-src 'self' data:; connect-src 'none'; frame-src 'none'; object-src 'none'"
          ]
        }
      })
    })
  }

  registerAllIpcHandlers()
  initKitchenDisplayWindowWatcher()
  createWindow()

  // Phase 47 — starts the local LAN QR-ordering HTTP server only if the
  // opt-in module is already enabled from a prior session; zero-footprint
  // (never binds a port) otherwise, matching every other opt-in module.
  ensureQrOrderServerState().catch(e => logger.error('[QROrderServer] Startup check failed:', e))
  ensureKitchenDisplayServerState().catch(e => logger.error('[KitchenDisplayServer] Startup check failed:', e))
  ensureFieldOrderServerState().catch(e => logger.error('[FieldOrderServer] Startup check failed:', e))

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopQrOrderServer().catch(() => {})
  stopKitchenDisplayServer().catch(() => {})
  stopFieldOrderServer().catch(() => {})
  // REAL BUG found+fixed 2026-07-31: shutdownAi() (disposes the local LLM's
  // native context/model handles) was defined but never called from
  // anywhere — dead code, so the AI Assistant's native resources were never
  // explicitly released on quit (the OS reclaims the process's memory
  // regardless, but the intended explicit release path never ran).
  shutdownAi().catch(() => {})
  if (process.platform !== 'darwin') app.quit()
})

// Final usage-tick true-up before quitting — DB-only, no network call, so
// this never adds a perceptible delay to quitting (unlike a flush attempt,
// which is deliberately never made here — see usage-metrics.service.ts).
// The guard flag prevents an infinite loop: the first before-quit defers
// quitting until the tick resolves, then calls app.quit() again, which
// fires before-quit a second time — the flag lets that second call through.
app.on('before-quit', (event) => {
  if (hasFinalizedUsageTickForQuit) return
  event.preventDefault()
  recordUsageTick().catch(() => {}).finally(() => {
    hasFinalizedUsageTickForQuit = true
    app.quit()
  })
})

// Block all new window creation from renderer content
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    const appUrl = isDev ? 'http://localhost:5173' : `file://${__dirname}`
    if (!url.startsWith(appUrl)) event.preventDefault()
  })
})
