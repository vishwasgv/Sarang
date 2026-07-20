import { app, BrowserWindow, dialog, shell, nativeTheme, session } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { registerAllIpcHandlers } from './ipc'
import { initializeDatabase } from './database/db'
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

  // R27: Only allow opening known safe domains in the system browser
  const ALLOWED_EXTERNAL_DOMAINS = ['aszurex.com', 'www.aszurex.com', 'github.com', 'www.github.com']
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url)
      if (ALLOWED_EXTERNAL_DOMAINS.includes(parsed.hostname)) {
        shell.openExternal(url)
      }
    } catch { /* ignore malformed URLs */ }
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

  try {
    await initializeDatabase()
    // Idempotent — ensures expense categories and GST tax configs exist for existing installs
    await seedDefaultData().catch(e => logger.warn('[Seed] Non-fatal seed error on startup:', e))
  } catch (err) {
    closeSplash()
    dialog.showErrorBox(
      'Sarang — Database Error',
      `Failed to initialize the database.\n\n${(err as Error).message ?? String(err)}\n\nPlease ensure you have write access to:\n${app.getPath('userData')}\n\nContact support if this issue persists.`
    )
    app.quit()
    return
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
  if (process.platform !== 'darwin') app.quit()
})

// Block all new window creation from renderer content
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    const appUrl = isDev ? 'http://localhost:5173' : `file://${__dirname}`
    if (!url.startsWith(appUrl)) event.preventDefault()
  })
})
