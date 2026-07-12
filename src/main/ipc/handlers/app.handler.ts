import { dialog, app } from 'electron'
import { copyFile, mkdir, stat } from 'fs/promises'
import { extname, join } from 'path'
import { getPrisma } from '../../database/db'
import { logger } from '../../utils/logger'
import { requireSession } from '../permission-guard'
import { logoToBase64DataUri, generateUpiQr, canShowUpiQr } from '../../services/print.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

const CURRENT_VERSION = app.getVersion()
const RELEASES_URL = 'https://api.github.com/repos/aszurex/sarang-business-os/releases/latest'
const DOWNLOAD_URL = 'https://aszurex.com/sarang'

export function register(handle: HandleFn): void {
  handle('app:getPaths', async () => {
    return {
      success: true,
      data: {
        userData: app.getPath('userData'),
        logs: join(app.getPath('userData'), 'logs'),
        backups: join(app.getPath('userData'), 'backups')
      }
    }
  })

  handle('app:getPlatform', async () => {
    return { success: true, data: process.platform }
  })

  handle('app:isDisclaimerAccepted', async () => {
    try {
      const db = getPrisma()
      const setting = await db.setting.findUnique({ where: { settingKey: 'disclaimer_accepted' } })
      return { success: true, data: setting?.settingValue === 'true' }
    } catch {
      return { success: true, data: false }
    }
  })

  handle('app:acknowledgeDisclaimer', async () => {
    try {
      const db = getPrisma()
      await db.setting.upsert({
        where: { settingKey: 'disclaimer_accepted' },
        update: { settingValue: 'true' },
        create: { settingKey: 'disclaimer_accepted', settingValue: 'true' }
      })
      return { success: true }
    } catch (err) {
      logger.error('[App] acknowledgeDisclaimer error:', err)
      return { success: false, error: { code: 'SYS-001', message: 'Could not save your response. Please try again.' } }
    }
  })

  // Fresh-audit fix (2026-07-12): auto-backup was already on by default, but
  // its destination silently defaulted to the same disk as the live
  // database unless an owner happened to find Settings and redirect it —
  // defeating the one scenario backups exist for (disk failure). Can't be
  // part of SetupWizard itself (backup:* channels are permission-gated and
  // no session exists until after the wizard's own admin-account creation
  // step, followed by a separate manual login) — instead a one-time prompt
  // shown once, right after first login, same no-session-required pattern
  // as the disclaimer gate above (a "have we asked this owner already" flag,
  // not sensitive data).
  handle('app:isBackupPromptDismissed', async () => {
    try {
      const db = getPrisma()
      const setting = await db.setting.findUnique({ where: { settingKey: 'backup_prompt_dismissed' } })
      return { success: true, data: setting?.settingValue === 'true' }
    } catch {
      return { success: true, data: false }
    }
  })

  handle('app:dismissBackupPrompt', async () => {
    try {
      const db = getPrisma()
      await db.setting.upsert({
        where: { settingKey: 'backup_prompt_dismissed' },
        update: { settingValue: 'true' },
        create: { settingKey: 'backup_prompt_dismissed', settingValue: 'true' }
      })
      return { success: true }
    } catch (err) {
      logger.error('[App] dismissBackupPrompt error:', err)
      return { success: false, error: { code: 'SYS-001', message: 'Could not save your response. Please try again.' } }
    }
  })

  handle('app:checkForUpdates', async () => {
    try {
      const response = await fetch(RELEASES_URL, {
        headers: { 'User-Agent': `Sarang-Business-OS/${CURRENT_VERSION}` },
        signal: AbortSignal.timeout(8000)
      })
      if (!response.ok) {
        return { success: false, error: { code: 'NET-001', message: 'Could not reach the update server. Check your internet connection.' } }
      }
      const release = await response.json() as { tag_name?: string }
      const latestVersion = (release.tag_name ?? '').replace(/^v/, '')
      const hasUpdate = latestVersion !== '' && latestVersion !== CURRENT_VERSION
      return { success: true, data: { hasUpdate, latestVersion: latestVersion || CURRENT_VERSION, currentVersion: CURRENT_VERSION, downloadUrl: hasUpdate ? DOWNLOAD_URL : undefined } }
    } catch (err) {
      logger.warn('[App] checkForUpdates failed:', err)
      return { success: false, error: { code: 'NET-001', message: 'Could not check for updates. Check your internet connection.' } }
    }
  })

  handle('dialog:openFile', async (payload) => {
    const opts = (payload ?? {}) as { title?: string; accept?: string[]; maxSizeBytes?: number }
    const filters = opts.accept?.length
      ? [{ name: 'Images', extensions: opts.accept.map((a) => a.replace(/^\./, '')) }]
      : [{ name: 'All Files', extensions: ['*'] }]
    const result = await dialog.showOpenDialog({
      title: opts.title ?? 'Select File',
      properties: ['openFile'],
      filters
    })
    if (result.canceled || !result.filePaths[0]) {
      return { success: true, data: null }
    }
    const srcPath = result.filePaths[0]
    const ext = extname(srcPath).toLowerCase()
    // Enforce the caller's own accept list, not a fixed allow-list — a caller that only
    // asked for .jpg/.png/.webp shouldn't silently get .gif/.bmp waved through just
    // because those happen to be in some other caller's allowed set.
    const allowedExts = opts.accept?.length ? opts.accept.map((a) => a.toLowerCase()) : ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
    if (opts.accept && !allowedExts.includes(ext)) {
      return { success: false, error: { code: 'VAL-002', message: 'Invalid file type. Only images are allowed.' } }
    }
    // Opt-in per caller (e.g. logo pickers pass maxSizeBytes) — this is a shared, generic
    // file-picker channel also used for unrelated uploads (e.g. product images), so a size
    // cap must never apply unless the specific caller asked for one.
    if (opts.maxSizeBytes) {
      const srcStat = await stat(srcPath)
      if (srcStat.size > opts.maxSizeBytes) {
        const mb = (opts.maxSizeBytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')
        return { success: false, error: { code: 'VAL-003', message: `Image is too large. Please choose a file under ${mb}MB.` } }
      }
    }
    const logoDir = join(app.getPath('userData'), 'logos')
    await mkdir(logoDir, { recursive: true })
    const destName = `logo_${Date.now()}${ext}`
    const destPath = join(logoDir, destName)
    await copyFile(srcPath, destPath)
    return { success: true, data: destPath }
  })

  handle('app:getBusinessLogoDataUri', async () => {
    const deny = requireSession(); if (deny) return deny
    const profile = await getPrisma().businessProfile.findFirst()
    if (!profile?.logoPath) return { success: true, data: null }
    try {
      return { success: true, data: logoToBase64DataUri(profile.logoPath) }
    } catch {
      return { success: true, data: null }
    }
  })

  // Generic UPI-QR endpoint for any renderer-side, self-built print flow that
  // isn't already routed through print.service.ts's own generateInvoiceHtml/
  // generateReceiptHtml (which embed the QR server-side already). Returns
  // null (not an error) whenever canShowUpiQr() says no — no upiId
  // configured, or the business isn't in India (UPI is India-only) — so
  // every caller can treat "no QR" as a normal, silent case.
  handle('app:generateUpiPaymentQr', async (payload) => {
    const deny = requireSession(); if (deny) return deny
    const { amount, note } = (payload ?? {}) as { amount?: number; note?: string }
    if (!amount || amount <= 0.01 || !note) return { success: true, data: null }
    const profile = await getPrisma().businessProfile.findFirst({ select: { businessName: true, upiId: true, country: true } })
    if (!canShowUpiQr(profile)) return { success: true, data: null }
    try {
      const qrDataUrl = await generateUpiQr(profile!.upiId!, profile!.businessName, amount, note)
      return { success: true, data: { qrDataUrl } }
    } catch {
      return { success: true, data: null }
    }
  })
}
