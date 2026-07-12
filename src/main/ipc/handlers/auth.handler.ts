import * as authService from '../../services/auth.service'
import * as setupService from '../../services/setup.service'
import * as settingsService from '../../services/settings.service'
import * as auditService from '../../services/audit.service'
import { requirePermission, requireSession } from '../permission-guard'
import { getPrisma } from '../../database/db'
import { LoginSchema, ChangePasswordSchema } from '../../validation/auth.validation'
import { SetupPayloadSchema } from '../../validation/setup.validation'
import { BusinessProfileUpdateSchema } from '../../validation/business-profile.validation'
import { unlink } from 'fs/promises'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('auth:login', async (payload) => {
    const parsed = LoginSchema.safeParse(payload)
    if (!parsed.success) {
      return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid login data.' } }
    }
    const p = parsed.data as { username: string; password: string; rememberMe?: boolean }
    return authService.login(p.username, p.password, p.rememberMe ?? false)
  })

  handle('auth:loginWithToken', async () => authService.loginWithToken())

  handle('auth:logout', async () => authService.logout())

  handle('auth:getCurrentUser', async () => authService.getCurrentUser())

  handle('auth:getPermissions', async () => authService.getPermissions())

  handle('auth:changePassword', async (payload) => {
    const deny = requireSession(); if (deny) return deny
    const parsed = ChangePasswordSchema.safeParse(payload)
    if (!parsed.success) {
      return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid data.' } }
    }
    // Was previously trusting the client-supplied userId outright — this is
    // meant to be a strictly self-service "change YOUR OWN password" path
    // (admin-driven resets go through the separately-permission-gated
    // users:adminResetPassword instead). Binding to the session's own
    // userId here is what actually enforces that; the payload's userId was
    // otherwise pure decoration.
    if (parsed.data.userId !== authService.getCurrentSession()?.userId) {
      return { success: false, error: { code: 'PERM-001', message: 'You do not have permission to perform this action.' } }
    }
    return authService.changePassword(parsed.data.userId, parsed.data.oldPassword, parsed.data.newPassword)
  })

  handle('setup:isSetupComplete', async () => setupService.isSetupComplete())

  handle('setup:completeSetup', async (payload) => {
    const parsed = SetupPayloadSchema.safeParse(payload)
    if (!parsed.success) {
      return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid setup data.' } }
    }
    return setupService.completeSetup(parsed.data)
  })

  handle('businessProfile:get', async () => {
    const deny = requireSession(); if (deny) return deny
    const db = getPrisma()
    const profile = await db.businessProfile.findFirst()
    return { success: true, data: profile }
  })

  handle('businessProfile:update', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const parsed = BusinessProfileUpdateSchema.safeParse(payload)
    if (!parsed.success) {
      return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid business profile data.' } }
    }
    const db = getPrisma()
    const existing = await db.businessProfile.findFirst()
    if (!existing) return { success: false, error: { code: 'SYS-001', message: 'Business profile not found.' } }
    const updated = await db.businessProfile.update({ where: { id: existing.id }, data: parsed.data })
    // Logo replaced or removed — delete the now-orphaned file rather than leaving it in userData/logos/ forever.
    if ('logoPath' in parsed.data && existing.logoPath && existing.logoPath !== parsed.data.logoPath) {
      await unlink(existing.logoPath).catch(() => {})
    }
    // Log what was actually persisted (parsed.data), not the raw payload — Zod silently
    // strips unrecognized keys, so logging the raw payload could show a field in the
    // audit trail that was never actually written to the database.
    await auditService.logAction({ userId: authService.getCurrentSession()?.userId, action: 'BUSINESS_PROFILE_UPDATED', entityType: 'BusinessProfile', entityId: existing.id, newValue: parsed.data })
    return { success: true, data: updated }
  })

  handle('settings:get', async (key) => {
    const deny = requireSession(); if (deny) return deny
    return settingsService.getSetting(key as string)
  })

  handle('settings:set', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const { key, value } = payload as { key: string; value: string }
    return settingsService.setSetting(key, value)
  })

  handle('settings:getAll', async () => {
    const deny = requireSession(); if (deny) return deny
    return settingsService.getAllSettings()
  })
}
