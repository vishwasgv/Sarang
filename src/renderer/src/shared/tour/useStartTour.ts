import { useTranslation } from 'react-i18next'
import { useIndustryStore, type TemplateModule } from '@app/store/industry.store'
import { useAuthStore } from '@app/store/auth.store'
import type { NavItem } from '@shared/ui/layout/Sidebar'
import { useTourStore } from './tour.store'
import { getUniversalSteps, generateVerticalSteps } from './steps'

/**
 * Composes the universal + vertical-specific tour segments for whichever
 * business type is CURRENTLY active (the real one in normal use, or the
 * seeded demo one while inside a tutorial session — this hook doesn't need
 * to know or care which) and starts the guided walkthrough.
 */
export function useStartTour() {
  const { t } = useTranslation()
  const isLoaded = useIndustryStore((s) => s.isLoaded)
  const isModuleEnabled = useIndustryStore((s) => s.isModuleEnabled)
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const start = useTourStore((s) => s.start)

  function startTour() {
    if (!isLoaded) return false

    const translateLabel = (item: NavItem) => (item.i18nKey ? t(item.i18nKey, item.label) : item.label)
    const vertical = generateVerticalSteps(
      (m) => isModuleEnabled(m as TemplateModule),
      hasPermission,
      translateLabel
    )
    start([...getUniversalSteps(), ...vertical])
    return true
  }

  return { startTour, isLoaded }
}
