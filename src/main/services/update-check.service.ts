import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { getPrisma } from '../database/db'
import { getLicenseState } from './license.service'
import { logger } from '../utils/logger'

// Phase 59.13 — Update-check: default to automatic, not manual-only.
// PHASE_59_MONETIZATION_LICENSING_MASTER_PROMPT.md Section 59.13.
//
// 2026-09-15 — upgraded from check-and-notify-only (a raw GitHub Releases API
// fetch, pointing the user at a manual full-installer download page) to a
// real differential auto-download via electron-updater, reusing the exact
// same GitHub Releases hosting the manual flow already used (electron-builder
// now emits latest.yml + a .blockmap alongside the installer — see
// electron-builder.config.ts's `publish` field — so electron-updater can
// fetch only the changed blocks instead of the full ~1GB installer).
//
// Gating, per the founder's explicit 2026-09-10 ask ("never to free/trial
// users, never to lapsed/unrenewed subscribers"): eligible = tier PAID AND
// status ACTIVE or WARNING (still paying, inside the pre-expiry grace
// window) — TRIAL, EXPIRED, and NOT_ACTIVATED never trigger a download.
// This is enforced the same way every other license check in this app is
// (see license.service.ts's own header comment: a disclosed, honest trust
// mechanism re-derived from the locally-verified signed key, not hardened
// DRM) — proportionate to, and consistent with, the rest of this codebase's
// stated licensing threat model, not a new stricter standard invented just
// for this feature. Ineligible installs keep today's exact prior behavior
// unchanged: manual "Check for Updates" button, manual full-installer link.
const AUTO_UPDATE_READY_VERSION_KEY = 'auto_update_ready_version'
// 2026-09-22 — founder ask: don't silently download in the background at
// all any more, even for an eligible install; ask permission first (like
// an Android security-patch prompt), download only once the user says yes.
// PENDING = detected + eligible, not yet approved for download.
// DISMISSED = the user said "not now" for that exact version — never
// re-prompt for the SAME version again (a newer release still prompts).
const PENDING_UPDATE_VERSION_KEY = 'pending_update_version'
const DISMISSED_UPDATE_VERSION_KEY = 'dismissed_update_version'

export async function isEligibleForAutoUpdate(): Promise<boolean> {
  const state = await getLicenseState()
  return state.tier === 'PAID' && (state.status === 'ACTIVE' || state.status === 'WARNING')
}

let autoUpdaterConfigured = false
function configureAutoUpdaterOnce(): void {
  if (autoUpdaterConfigured) return
  autoUpdaterConfigured = true
  autoUpdater.autoDownload = false // we decide when to download, only after the eligibility gate above
  autoUpdater.autoInstallOnAppQuit = false // never surprise-install on a normal quit; only via the explicit "Restart & Install" action
  autoUpdater.logger = null // this app's own `logger` util is used at each call site below instead
  autoUpdater.on('update-downloaded', (info) => {
    const db = getPrisma()
    db.setting.upsert({
      where: { settingKey: AUTO_UPDATE_READY_VERSION_KEY },
      update: { settingValue: info.version },
      create: { settingKey: AUTO_UPDATE_READY_VERSION_KEY, settingValue: info.version, settingType: 'STRING' }
    }).catch((err) => logger.warn('[AutoUpdate] failed to persist ready-version setting:', err))
  })
  autoUpdater.on('error', (err) => logger.warn('[AutoUpdate] electron-updater error (non-fatal, silently ignored):', err))
}

/** The version already downloaded and waiting for a restart, if any (null if none, or the current install is already on it). */
export async function getUpdateReadyVersion(): Promise<string | null> {
  const db = getPrisma()
  try {
    const row = await db.setting.findUnique({ where: { settingKey: AUTO_UPDATE_READY_VERSION_KEY } })
    if (!row?.settingValue || row.settingValue === app.getVersion()) return null
    return row.settingValue
  } catch {
    // Called unconditionally on every dashboard load (analytics.service.ts) —
    // a transient DB error here must never take down the whole dashboard.
    return null
  }
}

/** Quits and installs the already-downloaded update. No-op (never throws) if nothing is actually ready. */
export async function restartAndInstallUpdate(): Promise<void> {
  const ready = await getUpdateReadyVersion()
  if (!ready) return
  autoUpdater.quitAndInstall()
}

/**
 * Records that an eligible update is available and awaiting the user's
 * explicit go-ahead — never downloads anything itself. Called from the same
 * check cadence checkForUpdatesIfDue() already ran on. Never throws.
 */
async function recordPendingUpdateIfEligible(latestVersion: string): Promise<void> {
  try {
    if (!(await isEligibleForAutoUpdate())) return
    const db = getPrisma()
    const [dismissed, ready] = await Promise.all([
      db.setting.findUnique({ where: { settingKey: DISMISSED_UPDATE_VERSION_KEY } }),
      getUpdateReadyVersion()
    ])
    if (dismissed?.settingValue === latestVersion) return // user already said "not now" for this exact version
    if (ready === latestVersion) return // already downloaded, just waiting for a restart
    await db.setting.upsert({
      where: { settingKey: PENDING_UPDATE_VERSION_KEY },
      update: { settingValue: latestVersion },
      create: { settingKey: PENDING_UPDATE_VERSION_KEY, settingValue: latestVersion, settingType: 'STRING' }
    })
  } catch (err) {
    logger.warn('[AutoUpdate] failed to record pending update (non-fatal):', err)
  }
}

/** The version awaiting the user's download permission, if any — null once approved, dismissed, or already fully downloaded. */
export async function getPendingUpdateVersion(): Promise<string | null> {
  try {
    const db = getPrisma()
    const row = await db.setting.findUnique({ where: { settingKey: PENDING_UPDATE_VERSION_KEY } })
    if (!row?.settingValue || row.settingValue === app.getVersion()) return null
    return row.settingValue
  } catch {
    return null
  }
}

/** User said yes — actually starts the differential download. Clears the pending flag either way so the prompt never gets stuck showing. */
export async function approveUpdateDownload(): Promise<void> {
  const db = getPrisma()
  try {
    configureAutoUpdaterOnce()
    const checkResult = await autoUpdater.checkForUpdates()
    if (checkResult) await autoUpdater.downloadUpdate()
  } finally {
    await db.setting.deleteMany({ where: { settingKey: PENDING_UPDATE_VERSION_KEY } }).catch(() => {})
  }
}

/** User said "not now" — remembers this exact version so it won't nag again until a newer one ships. */
export async function dismissPendingUpdate(): Promise<void> {
  const db = getPrisma()
  const pending = await getPendingUpdateVersion()
  if (pending) {
    await db.setting.upsert({
      where: { settingKey: DISMISSED_UPDATE_VERSION_KEY },
      update: { settingValue: pending },
      create: { settingKey: DISMISSED_UPDATE_VERSION_KEY, settingValue: pending, settingType: 'STRING' }
    })
  }
  await db.setting.deleteMany({ where: { settingKey: PENDING_UPDATE_VERSION_KEY } }).catch(() => {})
}

const RELEASES_URL = 'https://api.github.com/repos/vishwasgv/Sarang/releases/latest'
export const DOWNLOAD_URL = 'https://aszurex.com/sarang'

export interface UpdateCheckResult {
  hasUpdate: boolean
  latestVersion: string
  currentVersion: string
  downloadUrl?: string
}

export async function fetchLatestReleaseInfo(): Promise<UpdateCheckResult> {
  const currentVersion = app.getVersion()
  const response = await fetch(RELEASES_URL, {
    headers: { 'User-Agent': `Sarang-Business-OS/${currentVersion}` },
    signal: AbortSignal.timeout(8000)
  })
  if (!response.ok) throw new Error(`GitHub releases fetch failed: ${response.status}`)
  const release = await response.json() as { tag_name?: string }
  const latestVersion = (release.tag_name ?? '').replace(/^v/, '')
  const hasUpdate = latestVersion !== '' && latestVersion !== currentVersion
  return { hasUpdate, latestVersion: latestVersion || currentVersion, currentVersion, downloadUrl: hasUpdate ? DOWNLOAD_URL : undefined }
}

const AUTO_CHECK_SETTING_KEY = 'auto_update_check_enabled'
const LAST_AUTO_CHECK_SETTING_KEY = 'auto_update_check_last_run_at'

export async function isAutoUpdateCheckEnabled(): Promise<boolean> {
  const db = getPrisma()
  const s = await db.setting.findUnique({ where: { settingKey: AUTO_CHECK_SETTING_KEY } })
  // Default ON per the founder's explicit ask — absence of the row (never
  // toggled) means enabled, not disabled. Disclosed in AboutScreen/Settings
  // copy, and always user-toggleable off — never a silent background call
  // the user can't see or control.
  return s?.settingValue !== 'false'
}

export async function setAutoUpdateCheckEnabled(enabled: boolean): Promise<void> {
  const db = getPrisma()
  await db.setting.upsert({
    where: { settingKey: AUTO_CHECK_SETTING_KEY },
    update: { settingValue: String(enabled) },
    create: { settingKey: AUTO_CHECK_SETTING_KEY, settingValue: String(enabled), settingType: 'BOOLEAN' }
  })
}

/**
 * At-most-once-per-day auto-check, respecting the user's toggle. Returns the
 * result only when a check actually ran (for the dashboard alert to use);
 * returns null when skipped (toggle off, checked too recently, or offline)
 * — never throws, this must never be load-bearing for anything.
 */
export async function checkForUpdatesIfDue(): Promise<UpdateCheckResult | null> {
  try {
    const enabled = await isAutoUpdateCheckEnabled()
    if (!enabled) return null

    const db = getPrisma()
    const lastRun = await db.setting.findUnique({ where: { settingKey: LAST_AUTO_CHECK_SETTING_KEY } })
    const lastRunAt = lastRun?.settingValue ? new Date(lastRun.settingValue) : null
    if (lastRunAt && Date.now() - lastRunAt.getTime() < 20 * 60 * 60 * 1000) return null // ~once/day

    const result = await fetchLatestReleaseInfo()
    await db.setting.upsert({
      where: { settingKey: LAST_AUTO_CHECK_SETTING_KEY },
      update: { settingValue: new Date().toISOString() },
      create: { settingKey: LAST_AUTO_CHECK_SETTING_KEY, settingValue: new Date().toISOString(), settingType: 'STRING' }
    })
    if (result.hasUpdate) {
      // Fire-and-forget, same convention as license.service.ts's own
      // background pings — never awaited, never allowed to slow down or fail
      // the dashboard-alert path this function feeds. Only RECORDS the
      // update as pending — never downloads without the user's explicit
      // go-ahead, see recordPendingUpdateIfEligible()'s own header comment.
      void recordPendingUpdateIfEligible(result.latestVersion)
    }
    return result.hasUpdate ? result : null
  } catch {
    return null // offline, GitHub unreachable, etc. — never surfaced as an error
  }
}
