import { create } from 'zustand'
import type { User } from '@shared/types/api.types'

interface AuthState {
  user: User | null
  permissions: Set<string>
  isLoading: boolean
  setUser: (user: User | null) => void
  setPermissions: (perms: string[]) => void
  setLoading: (loading: boolean) => void
  hasPermission: (key: string) => boolean
  clear: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  permissions: new Set(),
  isLoading: true,

  setUser: (user) => set({ user }),
  setPermissions: (perms) => set({ permissions: new Set(perms) }),
  setLoading: (isLoading) => set({ isLoading }),

  hasPermission: (key) => get().permissions.has(key),

  clear: () => set({ user: null, permissions: new Set(), isLoading: false })
}))
