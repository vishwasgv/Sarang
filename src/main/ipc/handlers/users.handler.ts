import * as authService from '../../services/auth.service'
import * as auditService from '../../services/audit.service'
import { requirePermission } from '../permission-guard'
import { getPrisma } from '../../database/db'
import { CreateUserSchema, UpdateUserSchema, DeactivateUserSchema } from '../../validation/users.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('users:list', async () => {
    const deny = await requirePermission('users.view'); if (deny) return deny
    const db = getPrisma()
    const users = await db.user.findMany({ include: { role: true }, orderBy: { fullName: 'asc' } })
    return { success: true, data: users.map((u) => ({ ...u, passwordHash: undefined })) }
  })

  handle('users:create', async (payload) => {
    const deny = await requirePermission('users.create'); if (deny) return deny
    const parsed = CreateUserSchema.safeParse(payload)
    if (!parsed.success) {
      return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid user data.' } }
    }
    const { fullName, username, password, roleId, email, phone } = parsed.data
    const lengthError = await authService.checkPasswordLength(password)
    if (lengthError) return lengthError
    const db = getPrisma()
    const existing = await db.user.findUnique({ where: { username } })
    if (existing) return { success: false, error: { code: 'USER-001', message: 'This username is already in use. Choose a different username.' } }
    const passwordHash = await authService.hashPassword(password)
    const user = await db.user.create({ data: { fullName, username, passwordHash, roleId, email, phone } })
    await auditService.logAction({ userId: authService.getCurrentSession()?.userId, action: 'USER_CREATED', entityType: 'User', entityId: user.id })
    return { success: true, data: { ...user, passwordHash: undefined } }
  })

  handle('users:update', async (payload) => {
    const deny = await requirePermission('users.update'); if (deny) return deny
    const parsed = UpdateUserSchema.safeParse(payload)
    if (!parsed.success) {
      return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid data.' } }
    }
    const { id, fullName, roleId, email, phone } = parsed.data
    const db = getPrisma()
    const updated = await db.user.update({ where: { id }, data: { fullName, roleId, email, phone } })
    await auditService.logAction({ userId: authService.getCurrentSession()?.userId, action: 'USER_UPDATED', entityType: 'User', entityId: id })
    return { success: true, data: { ...updated, passwordHash: undefined } }
  })

  handle('users:deactivate', async (payload) => {
    const deny = await requirePermission('users.disable'); if (deny) return deny
    const parsed = DeactivateUserSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: 'Invalid data.' } }
    const { userId } = parsed.data
    const db = getPrisma()
    const adminRole = await db.role.findFirst({ where: { roleName: 'Admin' } })
    if (adminRole) {
      const adminCount = await db.user.count({ where: { roleId: adminRole.id, isActive: true } })
      const targetUser = await db.user.findUnique({ where: { id: userId } })
      if (targetUser?.roleId === adminRole.id && adminCount <= 1) {
        return { success: false, error: { code: 'USER-002', message: 'At least one administrator must remain active.' } }
      }
    }
    await db.user.update({ where: { id: userId }, data: { isActive: false } })
    await auditService.logAction({ userId: authService.getCurrentSession()?.userId, action: 'USER_DEACTIVATED', entityType: 'User', entityId: userId })
    return { success: true }
  })

  handle('users:adminResetPassword', async (payload) => {
    const deny = await requirePermission('users.update'); if (deny) return deny
    const { userId, newPassword } = payload as { userId: string; newPassword: string }
    if (!userId || !newPassword) return { success: false, error: { code: 'VAL-001', message: 'User ID and new password are required.' } }
    const lengthError = await authService.checkPasswordLength(newPassword)
    if (lengthError) return lengthError
    const db = getPrisma()
    const newHash = await authService.hashPassword(newPassword)
    await db.user.update({ where: { id: userId }, data: { passwordHash: newHash, sessionToken: null, tokenExpiresAt: null } })
    await auditService.logAction({ userId: authService.getCurrentSession()?.userId, action: 'ADMIN_PASSWORD_RESET', entityType: 'User', entityId: userId })
    return { success: true }
  })

  handle('roles:list', async () => {
    const deny = await requirePermission('roles.view'); if (deny) return deny
    const db = getPrisma()
    const roles = await db.role.findMany({ include: { rolePermissions: { include: { permission: true } } } })
    return { success: true, data: roles }
  })

  handle('roles:getPermissions', async () => {
    const deny = await requirePermission('roles.view'); if (deny) return deny
    const db = getPrisma()
    const permissions = await db.permission.findMany({ orderBy: { permissionKey: 'asc' } })
    return { success: true, data: permissions }
  })

  handle('roles:updatePermissions', async (payload) => {
    const deny = await requirePermission('roles.modify'); if (deny) return deny
    const { roleId, permissionIds } = payload as { roleId: string; permissionIds: string[] }
    if (!roleId || !Array.isArray(permissionIds)) {
      return { success: false, error: { code: 'VAL-001', message: 'Invalid role permissions data.' } }
    }
    const db = getPrisma()
    const role = await db.role.findUnique({ where: { id: roleId } })
    if (role?.roleName === 'Admin') {
      return { success: false, error: { code: 'PERM-002', message: 'Admin role permissions cannot be modified.' } }
    }
    await db.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } })
      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({ data: permissionIds.map((permissionId) => ({ roleId, permissionId })) })
      }
    })
    await auditService.logAction({ userId: authService.getCurrentSession()?.userId, action: 'ROLE_PERMISSIONS_UPDATED', entityType: 'Role', entityId: roleId })
    return { success: true }
  })
}
