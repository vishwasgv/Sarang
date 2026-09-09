import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { HardDrive, FolderOpen } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { api } from '@renderer/services/ipc-client'
import { AszurexMark } from '@shared/ui/atoms/Brand'
import { useNotificationStore } from '@app/store/notification.store'

interface BackupPromptScreenProps {
  onDone: () => void
}

// Fresh-audit fix (2026-07-12): auto-backup is on by default, but its
// destination silently defaulted to the same disk as the live database
// unless an owner happened to find Settings and redirect it — defeating the
// one scenario backups exist for (a disk failure). Shown exactly once,
// right after first login (backup:* channels need a real session, which
// doesn't exist yet inside SetupWizard) — skippable, never blocks anyone,
// matches this app's own "nudge, don't force" backup philosophy.
export function BackupPromptScreen({ onDone }: BackupPromptScreenProps) {
  const { t } = useTranslation()
  const { error: toastError } = useNotificationStore()
  const [saving, setSaving] = useState(false)

  async function finish() {
    // Best-effort dismiss — this screen must always advance even if the
    // dismiss-prompt IPC call fails, so failure is swallowed intentionally
    // here (not left to become an unhandled rejection in callers).
    try {
      await api.app.dismissBackupPrompt()
    } catch {
      // ignore — advancing regardless is the intended behavior
    } finally {
      onDone()
    }
  }

  async function handleChooseFolder() {
    setSaving(true)
    try {
      const picked = await api.backup.pickDestinationFolder()
      if (picked.success && picked.data) {
        const res = await api.backup.setDestination({ path: (picked.data as { folderPath: string }).folderPath })
        if (!res.success) {
          toastError(t('common.error'), (res.error as { message?: string })?.message ?? t('backup.promptSaveLocationFailed'))
          setSaving(false)
          return
        }
      } else if (!picked.success) {
        toastError(t('common.error'), (picked.error as { message?: string })?.message ?? t('backup.promptFolderPickerFailed'))
        setSaving(false)
        return
      }
      // picked.success && !picked.data means the user cancelled the folder
      // dialog — not an error, just treat it the same as skipping.
      await finish()
    } catch {
      toastError(t('common.error'), t('backup.promptSaveLocationFailed'))
      setSaving(false)
    }
  }

  async function handleSkip() {
    setSaving(true)
    await finish()
  }

  return (
    // overflow-y-auto — same install-blocking bug class fixed in
    // DisclaimerScreen.tsx (2026-07-16, real user report).
    <div className="min-h-screen bg-dark flex flex-col items-center justify-center p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="bg-brand px-8 py-6 text-white text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-4">
            <HardDrive size={36} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold">{t('backup.promptTitle')}</h1>
          <p className="text-brand-100 mt-1 text-base opacity-90 inline-flex items-center gap-1.5">
            {t('backup.promptByAszurex')} <AszurexMark width={18} />
          </p>
        </div>

        <div className="px-8 py-6 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t('backup.promptWarningPre')} <strong>{t('backup.promptWarningEmphasis')}</strong> {t('backup.promptWarningPost')}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t('backup.promptAdvice')}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              onClick={handleChooseFolder}
              loading={saving}
              icon={<FolderOpen size={16} />}
              className="flex-1"
            >
              {t('backup.promptChooseFolderButton')}
            </Button>
            <Button
              variant="secondary"
              onClick={handleSkip}
              disabled={saving}
              className="flex-1"
            >
              {t('backup.promptSkipButton')}
            </Button>
          </div>
          <p className="text-xs text-slate-400 text-center">
            {t('backup.promptSkipHint')}
          </p>
        </div>
      </motion.div>
    </div>
  )
}
