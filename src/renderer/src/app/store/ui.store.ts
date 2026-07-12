import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface UiState {
  sidebarCollapsed: boolean
  activeRoute: string
  toggleSidebar: () => void
  setActiveRoute: (route: string) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      activeRoute: '/',

      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setActiveRoute: (activeRoute) => set({ activeRoute })
    }),
    {
      name: 'sarang-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed })
    }
  )
)
