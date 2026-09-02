import { getPrisma } from '../database/db'
import type { ApiResponse } from '../ipc/channels'
import { LICENSE_INTERNAL_SETTING_KEYS } from './license.service'

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
