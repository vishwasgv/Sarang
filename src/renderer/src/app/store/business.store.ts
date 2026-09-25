import { create } from 'zustand'
import type { BusinessProfile } from '@shared/types/api.types'
import { setActiveTaxCountry } from '@shared/utils/tax.util'

interface BusinessState {
  profile: BusinessProfile | null
  settings: Record<string, string>
  setProfile: (profile: BusinessProfile | null) => void
  setSettings: (settings: Record<string, string>) => void
  getSetting: (key: string, defaultValue?: string) => string
}

export const useBusinessStore = create<BusinessState>((set, get) => ({
  profile: null,
  settings: {},

  setProfile: (profile) => { setActiveTaxCountry(profile?.country); set({ profile }) },
  setSettings: (settings) => set({ settings }),

  getSetting: (key, defaultValue = '') => {
    return get().settings[key] ?? defaultValue
  }
}))
