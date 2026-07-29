import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { GraduationCap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@shared/ui/atoms/Button'
import { api } from '@renderer/services/ipc-client'
import { AszurexMark } from '@shared/ui/atoms/Brand'
import { useNotificationStore } from '@app/store/notification.store'

interface TutorialPromptScreenProps {
  onDone: () => void
  businessType?: string
}

// Phase 60 — shown exactly once, right after first login (mirrors
// BackupPromptScreen.tsx's own "nudge, don't force" first-run convention).
// Both buttons dismiss the prompt permanently; only "Yes" also starts a
// tutorial session (which relaunches the app into tutorial.db).
export function TutorialPromptScreen({ onDone, businessType }: TutorialPromptScreenProps) {
  const { t } = useTranslation()
  const { error: toastError } = useNotificationStore()
  const [starting, setStarting] = useState(false)

  async function handleSkip() {
    setStarting(true)
    // Best-effort dismiss — this screen must always advance even if the
    // dismiss-prompt IPC call fails (matches BackupPromptScreen.tsx's own
    // "always advance" convention), so failure is swallowed intentionally
    // here rather than left to become an unhandled rejection.
    try {
      await api.app.dismissTutorialPrompt()
    } catch {
      // ignore — advancing regardless is the intended behavior
    } finally {
      onDone()
    }
  }

  async function handleStartTour() {
    setStarting(true)
    try {
      await api.app.dismissTutorialPrompt()
      const res = await api.tutorial.start({ businessType: businessType ?? 'GENERAL' })
      if (res.success === false) {
        toastError('Error', res.error?.message ?? 'Could not start the tutorial.')
        setStarting(false)
        onDone()
      }
      // On success the whole app relaunches into the tutorial — nothing more to do here.
    } catch {
      toastError('Error', 'Could not start the tutorial.')
      setStarting(false)
      onDone()
    }
  }

  return (
    <div className="min-h-screen bg-dark flex flex-col items-center justify-center p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="bg-brand px-8 py-6 text-white text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-4">
            <GraduationCap size={36} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold">{t('tour.startPrompt')}</h1>
          <p className="text-brand-100 mt-1 text-base opacity-90 inline-flex items-center gap-1.5">
            — by Aszurex <AszurexMark width={18} />
          </p>
        </div>

        <div className="px-8 py-6 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t('tour.pickBusinessTypeSubtitle')}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              onClick={handleStartTour}
              loading={starting}
              icon={<GraduationCap size={16} />}
              className="flex-1"
            >
              {t('tour.startPromptYes')}
            </Button>
            <Button
              variant="secondary"
              onClick={handleSkip}
              disabled={starting}
              className="flex-1"
            >
              {t('tour.startPromptLater')}
            </Button>
          </div>
          <p className="text-xs text-slate-400 text-center">
            {t('tour.revisitSubtitle')}
          </p>
        </div>
      </motion.div>
    </div>
  )
}
