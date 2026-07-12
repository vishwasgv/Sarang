import { getPrisma } from '../database/db'
import type { ApiResponse } from '../ipc/channels'

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
