import { create } from 'zustand'

// Phase 60 — Interactive Onboarding Tutorial. Purely in-memory, transient
// UI state (which step of the guided walkthrough is showing right now) —
// deliberately NOT persisted (no zustand/persist middleware), since a tour
// in progress is meaningless across an app restart and tutorial mode itself
// already goes through a full relaunch on entry, which naturally resets
// this store to its defaults.

export interface TourStep {
  id: string
  /** i18n key for the title. Leave empty and use titleLiteral instead for pre-translated strings (e.g. a nav label already run through t()). */
  titleKey: string
  /** Pre-translated title, used as-is instead of titleKey when present (e.g. auto-generated steps whose title is a nav item's own already-localized label). */
  titleLiteral?: string
  bodyKey: string
  bodyParams?: Record<string, string>
  /** CSS selector for the real element this step points at. Null = a centered, un-anchored intro/outro card. */
  targetSelector: string | null
  /** Route to navigate to before showing this step, if not already there. */
  route?: string
}

interface TourState {
  isOpen: boolean
  steps: TourStep[]
  currentIndex: number
  start: (steps: TourStep[]) => void
  next: () => void
  back: () => void
  close: () => void
}

export const useTourStore = create<TourState>()((set, get) => ({
  isOpen: false,
  steps: [],
  currentIndex: 0,

  start: (steps) => set({ isOpen: true, steps, currentIndex: 0 }),

  next: () => {
    const { currentIndex, steps } = get()
    if (currentIndex >= steps.length - 1) {
      set({ isOpen: false, steps: [], currentIndex: 0 })
      return
    }
    set({ currentIndex: currentIndex + 1 })
  },

  back: () => {
    const { currentIndex } = get()
    if (currentIndex <= 0) return
    set({ currentIndex: currentIndex - 1 })
  },

  close: () => set({ isOpen: false, steps: [], currentIndex: 0 })
}))
