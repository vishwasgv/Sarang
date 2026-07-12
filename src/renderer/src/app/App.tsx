import React, { useEffect, useState, useCallback } from 'react'
import { HashRouter } from 'react-router-dom'
import { AppRouter } from './router'
import { useAuthStore } from './store/auth.store'
import { useBusinessStore } from './store/business.store'
import { useIndustryStore } from './store/industry.store'
import { useThemeStore } from './store/theme.store'
import { api } from '@renderer/services/ipc-client'
import type { BusinessProfile } from '@shared/types/api.types'
import { ErrorBoundary } from '@renderer/shared/ui/ErrorBoundary'
import { useSessionTimeout } from '@renderer/shared/hooks/useSessionTimeout'
import { BrandIcon, AszurexMark } from '@shared/ui/atoms/Brand'

export default function App() {
  const { setUser, setPermissions, setLoading, clear } = useAuthStore()
  const { setProfile, setSettings } = useBusinessStore()
  const { loadTemplate } = useIndustryStore()
  useThemeStore() // ensures dark class is applied on startup from persisted preference
  const [isReady, setIsReady] = useState(false)

  const authUser = useAuthStore(s => s.user)
  const bizSettings = useBusinessStore(s => s.settings)

  // initializeApp() below fetches business profile/settings/industry template before
  // any session exists (all three IPC channels require an active session), so that
  // first attempt always fails silently and this state stays empty for the rest of
  // the renderer's life unless something else happens to trigger a re-fetch (e.g.
  // visiting Settings, which does its own fetch on save). Re-fetch once a real
  // session exists — covers both a manual login and a token auto-login, since
  // both eventually populate authUser via the same store.
  useEffect(() => {
    if (!authUser) return
    api.businessProfile.get().then((res) => {
      if (res.success && res.data) setProfile(res.data as BusinessProfile)
    })
    api.settings.getAll().then((res) => {
      if (res.success && res.data) setSettings(res.data as Record<string, string>)
    })
    loadTemplate()
  }, [authUser])

  useEffect(() => {
    initializeApp()
  }, [])

  async function initializeApp() {
    try {
      // Load industry template (feature flags)
      await loadTemplate()

      // Business profile/settings are fetched by the authUser-keyed effect above, once a
      // session actually exists — both IPC channels require one, so fetching here (before
      // any login has happened) would always fail. Removed a dead pre-session fetch that
      // used to sit here for exactly that reason.

      // Check current in-memory session, then try token auto-login (GAP D6)
      let userRes = await api.auth.getCurrentUser()
      if (!userRes.success) {
        userRes = await api.auth.loginWithToken()
        if (userRes.success) {
          // Token login succeeded — load permissions
          const permRes = await api.auth.getPermissions()
          if (permRes.success && permRes.data) {
            const perms = permRes.data as string[]
            if (userRes.data) (userRes.data as { permissions?: string[] }).permissions = perms
          }
        }
      }
      if (userRes.success && userRes.data) {
        const user = userRes.data as { id: string; fullName: string; username: string; role: { id: string; name: string }; permissions?: string[] }
        setUser({
          id: user.id,
          fullName: user.fullName,
          username: user.username,
          role: user.role,
          permissions: user.permissions,
          isActive: true
        })
        if (user.permissions) setPermissions(user.permissions)
      } else {
        clear()
      }
    } catch (err) {
      console.error('[App] Initialization error:', err)
      clear()
    } finally {
      setLoading(false)
      setIsReady(true)
    }
  }

  // Session timeout (GAP GR29) — idle timer, clears session on timeout
  const sessionTimeoutMins = (() => {
    const raw = bizSettings?.['session_timeout_minutes']
    const mins = raw ? parseInt(raw, 10) : 30
    return isNaN(mins) || mins <= 0 ? 30 : mins
  })()

  const handleSessionTimeout = useCallback(async () => {
    await api.auth.logout().catch(() => {})
    clear()
  }, [clear])

  useSessionTimeout(sessionTimeoutMins * 60 * 1000, handleSessionTimeout, !!authUser)

  if (!isReady) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <BrandIcon size={112} className="mx-auto mb-6 drop-shadow-lg" />
          <p className="text-2xl font-semibold text-dark tracking-tight">Starting Sarang…</p>
          <p className="text-lg text-brand mt-4 inline-flex items-center gap-2.5 font-medium">
            Powered by Aszurex <AszurexMark width={36} />
          </p>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <HashRouter>
        <AppRouter />
      </HashRouter>
    </ErrorBoundary>
  )
}
