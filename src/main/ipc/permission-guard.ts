import { getPrisma } from '../database/db'
import { getCurrentSession } from '../services/auth.service'
import type { ApiResponse } from './channels'

// Enforce IPC-level permission checks
// Called from every handler that requires authorization
export async function requirePermission(permissionKey: string): Promise<ApiResponse | null> {
  const session = getCurrentSession()

  if (!session) {
    return { success: false, error: { code: 'AUTH-003', message: 'Your session has expired. Please sign in again.' } }
  }

  try {
    const db = getPrisma()
    const granted = await db.rolePermission.findFirst({
      where: {
        roleId: session.roleId,
        permission: { permissionKey }
      }
    })

    if (!granted) {
      return { success: false, error: { code: 'PERM-001', message: 'You do not have permission to perform this action.' } }
    }

    return null // null = allowed
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

// Require active session without checking specific permission
export function requireSession(): ApiResponse | null {
  const session = getCurrentSession()
  if (!session) {
    return { success: false, error: { code: 'AUTH-003', message: 'Your session has expired. Please sign in again.' } }
  }
  return null
}

// Boolean permission check for handlers that need to redact part of a response
// rather than deny the whole request (e.g. a dashboard payload where only the
// profit/expense fields require an extra permission beyond the base view gate).
export async function hasPermission(permissionKey: string): Promise<boolean> {
  const session = getCurrentSession()
  if (!session) return false
  try {
    const db = getPrisma()
    const granted = await db.rolePermission.findFirst({
      where: { roleId: session.roleId, permission: { permissionKey } }
    })
    return !!granted
  } catch {
    return false
  }
}
