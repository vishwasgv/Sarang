import { app } from 'electron'
import { getPrisma } from '../database/db'

// Phase 59.13 — Update-check: default to automatic, not manual-only.
// PHASE_59_MONETIZATION_LICENSING_MASTER_PROMPT.md Section 59.13. Scope is
// deliberately check-and-notify only, never silent auto-download-install
// (that reverses electron-builder.config.ts's explicit `publish: null` / "no
// auto-update, ever" stance and deserves its own separate decision).

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
    return result.hasUpdate ? result : null
  } catch {
    return null // offline, GitHub unreachable, etc. — never surfaced as an error
  }
}
