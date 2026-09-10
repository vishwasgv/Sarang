import { getPrisma } from '../database/db'
import type { ApiResponse } from '../ipc/channels'
import { LICENSE_INTERNAL_SETTING_KEYS } from './license.service'

// Security-critical Setting rows with their own dedicated, re-authenticated
// write path — same threat class as LICENSE_INTERNAL_SETTING_KEYS above, just
// discovered later. Real gap found+fixed: this generic setter was only ever
// blocking license-internal keys, so a settings.modify-holder (the same
// permission auth:regenerateRecoveryCode itself reuses — see that handler's
// comment) could call settings:set with key 'recovery_code_hash' to plant an
// attacker-known bcrypt hash directly, silently bypassing
// regenerateRecoveryCode()'s explicit "must re-enter your CURRENT password"
// re-auth requirement and its audit-log entry — turning a momentarily
// unlocked/hijacked Admin session into a permanent password-reset backdoor
// with no trace. audit_log_chain_tip/audit_log_last_failure_at are
// audit.service.ts's own internal bookkeeping (never meant to be
// user-writable at all) and ratelimit_* rows back the brute-force lockout in
// auth.service.ts — writable here, an Admin session could zero out anyone's
// lockout counter and defeat AUTH-004 outright.
const OTHER_INTERNAL_SETTING_KEYS: ReadonlySet<string> = new Set([
  'recovery_code_hash',
  'audit_log_chain_tip',
  'audit_log_last_failure_at'
])
const INTERNAL_SETTING_KEY_PREFIXES = ['ratelimit_']

export async function getSetting(key: string): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const setting = await db.setting.findUnique({ where: { settingKey: key } })
    return { success: true, data: setting?.settingValue ?? null }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function setSetting(key: string, value: string): Promise<ApiResponse> {
  // 2026-09-02 hardening — license-internal Setting rows (license_key,
  // license_enforcement_suspended, etc.) must only ever be written by
  // license.service.ts's own functions, which write via raw db.setting.upsert
  // directly and never route through here. This generic key/value setter has
  // no per-key allowlist otherwise and is reachable from the renderer via
  // settings:set, gated only by settings.modify — a permission the sole
  // Admin/business-owner always holds. See license.service.ts's
  // LICENSE_INTERNAL_SETTING_KEYS doc comment for the full threat this closes.
  if (LICENSE_INTERNAL_SETTING_KEYS.has(key)) {
    return { success: false, error: { code: 'LIC-003', message: 'This setting is managed internally and cannot be changed directly.' } }
  }
  if (OTHER_INTERNAL_SETTING_KEYS.has(key) || INTERNAL_SETTING_KEY_PREFIXES.some(prefix => key.startsWith(prefix))) {
    return { success: false, error: { code: 'LIC-003', message: 'This setting is managed internally and cannot be changed directly.' } }
  }
  try {
    const db = getPrisma()
    await db.setting.upsert({
      where: { settingKey: key },
      create: { settingKey: key, settingValue: value },
      update: { settingValue: value }
    })
    return { success: true }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function getAllSettings(): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const settings = await db.setting.findMany()
    const map: Record<string, string> = {}
    for (const s of settings) map[s.settingKey] = s.settingValue
    return { success: true, data: map }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}
