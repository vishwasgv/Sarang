import { create } from 'zustand'

interface ThemeState {
  isDark: boolean
  toggleTheme: () => void
  setTheme: (dark: boolean) => void
}

function applyTheme(dark: boolean) {
  if (dark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  try { localStorage.setItem('sarang-theme', dark ? 'dark' : 'light') } catch { /* ignore */ }
}

const saved = (() => {
  try { return localStorage.getItem('sarang-theme') } catch { return null }
})()
const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false
const initialDark = saved ? saved === 'dark' : prefersDark

applyTheme(initialDark)

export const useThemeStore = create<ThemeState>((set) => ({
  isDark: initialDark,
  toggleTheme: () => set(s => {
    applyTheme(!s.isDark)
    return { isDark: !s.isDark }
  }),
  setTheme: (dark) => set(() => {
    applyTheme(dark)
    return { isDark: dark }
  }),
}))
