import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GraduationCap, X } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { Button } from '@shared/ui/atoms/Button'

// Phase 60 — shown across every screen for the entire duration of a
// tutorial session (isTutorialModeActive() is checked once at app startup,
// see AppLayout.tsx) — the persistent, impossible-to-miss "nothing here is
// saved" disclosure the master prompt's Section 5 requires.
export function TutorialBanner() {
  const { t } = useTranslation()
  const [exiting, setExiting] = useState(false)

  async function handleExit() {
    setExiting(true)
    try {
      await api.tutorial.exit()
      // No further UI update needed on success — exitTutorial() relaunches
      // the whole app, this window is about to close.
    } catch {
      setExiting(false)
    }
  }

  return (
    <div className="h-9 shrink-0 bg-brand text-white flex items-center justify-between px-4 text-sm font-medium z-20">
      <div className="flex items-center gap-2">
        <GraduationCap size={15} />
        <span>{t('tour.bannerText')}</span>
      </div>
      <Button variant="ghost" size="sm" onClick={handleExit} loading={exiting} className="!h-7 !px-2 !text-white hover:!bg-white/15" icon={<X size={13} />}>
        {t('tour.bannerExit')}
      </Button>
    </div>
  )
}
