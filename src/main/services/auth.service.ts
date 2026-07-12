import bcrypt from 'bcryptjs'
import { createHash } from 'crypto'
import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import type { ApiResponse } from '../ipc/channels'
import { generateSessionToken, saveSession, loadSavedSession, clearSavedSession } from '../security/session-persistence'

// Session token is stored as sha256(rawToken) — raw token lives only in electron-store
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

const SALT_ROUNDS = 12

// In-memory session (single-user desktop app)
let currentSession: { userId: string; username: string; roleId: string } | null = null

// In-memory brute-force guard: 5 attempts per 15 min window per key.
// Shared factory so login (keyed by username) and changePassword (keyed by
// userId — see below) get the identical lockout behavior from one place,
// rather than changePassword silently having none at all.
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

function makeRateLimiter(maxAttempts: number, windowMs: number) {
  const attempts = new Map<string, { count: number; windowStart: number }>()
  return {
    check(key: string): { blocked: boolean; remainingMs?: number } {
      const now = Date.now()
      const entry = attempts.get(key)
      if (!entry || now - entry.windowStart > windowMs) {
        attempts.set(key, { count: 1, windowStart: now })
        return { blocked: false }
      }
      if (entry.count >= maxAttempts) {
        return { blocked: true, remainingMs: windowMs - (now - entry.windowStart) }
      }
      entry.count++
      return { blocked: false }
    },
    reset(key: string): void {
      attempts.delete(key)
    }
  }
}

const loginRateLimiter = makeRateLimiter(MAX_ATTEMPTS, WINDOW_MS)
const changePasswordRateLimiter = makeRateLimiter(MAX_ATTEMPTS, WINDOW_MS)

/** Authenticates with rate limiting (AUTH-004 after 5 failures per 15 min). Resets counter on success. */
export async function login(username: string, password: string, rememberMe = false): Promise<ApiResponse> {
  try {
    const rateCheck = loginRateLimiter.check(username)
    if (rateCheck.blocked) {
      const waitMin = Math.ceil((rateCheck.remainingMs ?? 0) / 60000)
      return { success: false, error: { code: 'AUTH-004', message: `Too many failed login attempts. Please try again in ${waitMin} minute(s).` } }
    }

    const db = getPrisma()
    const user = await db.user.findUnique({
      where: { username },
      include: { role: true }
    })

    if (!user) {
      await logAction({ action: 'LOGIN_FAILED', newValue: { username, reason: 'invalid_credentials' } })
      return { success: false, error: { code: 'AUTH-001', message: 'Incorrect username or password. Please try again.' } }
    }

    if (!user.isActive) {
      return { success: false, error: { code: 'AUTH-002', message: 'This account has been disabled. Please contact your administrator.' } }
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash)
    if (!passwordValid) {
      await logAction({ userId: user.id, action: 'LOGIN_FAILED', entityType: 'User', entityId: user.id, newValue: { username, reason: 'invalid_credentials' } })
      return { success: false, error: { code: 'AUTH-001', message: 'Incorrect username or password. Please try again.' } }
    }

    loginRateLimiter.reset(username)

    // Session persistence (GAP D6) — raw token in electron-store, hashed token in DB
    let sessionToken: string | undefined
    if (rememberMe) {
      sessionToken = generateSessionToken()
      const expiresAt = new Date(Date.now() + 30 * 86400 * 1000)
      await db.user.update({ where: { id: user.id }, data: { lastLogin: new Date(), sessionToken: hashToken(sessionToken), tokenExpiresAt: expiresAt } })
      await saveSession(user.id, sessionToken)
    } else {
      await db.user.update({ where: { id: user.id }, data: { lastLogin: new Date(), sessionToken: null, tokenExpiresAt: null } })
    }

    currentSession = { userId: user.id, username: user.username, roleId: user.roleId }

    await logAction({ userId: user.id, action: 'USER_LOGIN', entityType: 'User', entityId: user.id })

    return {
      success: true,
      data: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        role: { id: user.role.id, name: user.role.roleName }
      }
    }
  } catch (err) {
    console.error('[Auth] Login error:', err)
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function loginWithToken(): Promise<ApiResponse> {
  try {
    const saved = await loadSavedSession()
    if (!saved) return { success: false, error: { code: 'AUTH-003', message: 'No saved session.' } }

    const db = getPrisma()
    const user = await db.user.findFirst({
      where: { id: saved.userId, sessionToken: hashToken(saved.token), isActive: true },
      include: { role: true }
    })

    if (!user || !user.tokenExpiresAt || user.tokenExpiresAt < new Date()) {
      await clearSavedSession()
      return { success: false, error: { code: 'AUTH-003', message: 'Saved session expired.' } }
    }

    currentSession = { userId: user.id, username: user.username, roleId: user.roleId }

    // Rolling token — rotate on every auto-login so a captured token window is capped at one session
    try {
      const newToken = generateSessionToken()
      const newExpiry = new Date(Date.now() + 30 * 86400 * 1000)
      await db.user.update({ where: { id: user.id }, data: { sessionToken: hashToken(newToken), tokenExpiresAt: newExpiry } })
      await saveSession(user.id, newToken)
    } catch (rotateErr) {
      console.error('[Auth] Token rotation failed (non-fatal):', rotateErr)
    }

    await logAction({ userId: user.id, action: 'USER_AUTO_LOGIN', entityType: 'User', entityId: user.id })

    return {
      success: true,
      data: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        role: { id: user.role.id, name: user.role.roleName }
      }
    }
  } catch (err) {
    console.error('[Auth] Token login error:', err)
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened.' } }
  }
}

export async function logout(): Promise<ApiResponse> {
  if (currentSession) {
    try {
      const db = getPrisma()
      await db.user.update({ where: { id: currentSession.userId }, data: { sessionToken: null, tokenExpiresAt: null } })
    } catch {}
    await logAction({ userId: currentSession.userId, action: 'USER_LOGOUT', entityType: 'User', entityId: currentSession.userId })
    currentSession = null
  }
  await clearSavedSession()
  return { success: true }
}

export function getCurrentSession() {
  return currentSession
}

export async function getCurrentUser(): Promise<ApiResponse> {
  if (!currentSession) {
    return { success: false, error: { code: 'AUTH-003', message: 'Your session has expired. Please sign in again.' } }
  }

  try {
    const db = getPrisma()
    const user = await db.user.findUnique({
      where: { id: currentSession.userId },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } }
    })

    if (!user || !user.isActive) {
      currentSession = null
      return { success: false, error: { code: 'AUTH-003', message: 'Your session has expired. Please sign in again.' } }
    }

    const permissions = user.role.rolePermissions.map((rp) => rp.permission.permissionKey)

    return {
      success: true,
      data: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        role: { id: user.role.id, name: user.role.roleName },
        permissions
      }
    }
  } catch (err) {
    console.error('[Auth] getCurrentUser error:', err)
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function changePassword(userId: string, oldPassword: string, newPassword: string): Promise<ApiResponse> {
  try {
    const rateCheck = changePasswordRateLimiter.check(userId)
    if (rateCheck.blocked) {
      const waitMin = Math.ceil((rateCheck.remainingMs ?? 0) / 60000)
      return { success: false, error: { code: 'AUTH-004', message: `Too many password-change attempts. Please try again in ${waitMin} minute(s).` } }
    }

    const db = getPrisma()
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) return { success: false, error: { code: 'AUTH-001', message: 'User not found.' } }

    const valid = await bcrypt.compare(oldPassword, user.passwordHash)
    if (!valid) return { success: false, error: { code: 'AUTH-001', message: 'Current password is incorrect.' } }

    const lengthError = await checkPasswordLength(newPassword)
    if (lengthError) return lengthError

    changePasswordRateLimiter.reset(userId)
    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS)
    // Invalidate all remember-me sessions so stolen tokens cannot be reused after a password change
    await db.user.update({ where: { id: userId }, data: { passwordHash: newHash, sessionToken: null, tokenExpiresAt: null } })
    await clearSavedSession()
    await logAction({ userId, action: 'PASSWORD_CHANGED', entityType: 'User', entityId: userId })

    return { success: true }
  } catch (err) {
    console.error('[Auth] changePassword error:', err)
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function getPermissions(): Promise<ApiResponse> {
  if (!currentSession) {
    return { success: false, error: { code: 'PERM-001', message: 'You do not have permission to perform this action.' } }
  }

  try {
    const db = getPrisma()
    const rolePermissions = await db.rolePermission.findMany({
      where: { roleId: currentSession.roleId },
      include: { permission: true }
    })
    const permissions = rolePermissions.map((rp) => rp.permission.permissionKey)
    return { success: true, data: permissions }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

const DEFAULT_PASSWORD_MIN_LENGTH = 10

// Single source of truth for the live-configurable password minimum — every
// path that sets a password (create, change, admin reset) must call this
// instead of hardcoding its own number, or the three can drift out of sync
// with each other again (exactly what F.15's audit found: CreateUserSchema
// hardcoded 6 while changePassword/adminResetPassword read this Setting).
export async function getPasswordMinLength(): Promise<number> {
  const db = getPrisma()
  const setting = await db.setting.findUnique({ where: { settingKey: 'password_min_length' } })
  const parsed = setting ? parseInt(setting.settingValue, 10) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PASSWORD_MIN_LENGTH
}

export async function checkPasswordLength(password: string): Promise<ApiResponse | null> {
  const minLen = await getPasswordMinLength()
  if (password.length < minLen) {
    return { success: false, error: { code: 'VAL-001', message: `Password must be at least ${minLen} characters.` } }
  }
  return null
}

// Convenience object for import * as authService consumers
export const authService = {
  login,
  loginWithToken,
  logout,
  getCurrentUser,
  getCurrentSession,
  getPermissions,
  changePassword,
  hashPassword
}
