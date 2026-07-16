import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Shield, HardDrive, WifiOff, AlertCircle } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { api } from '@renderer/services/ipc-client'
import { AszurexMark } from '@shared/ui/atoms/Brand'
import { useNotificationStore } from '@app/store/notification.store'

interface DisclaimerScreenProps {
  onAccepted: () => void
}

export function DisclaimerScreen({ onAccepted }: DisclaimerScreenProps) {
  const { t } = useTranslation()
  const { error: toastError } = useNotificationStore()
  const [checked, setChecked] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleAccept() {
    if (!checked) return
    setSaving(true)
    try {
      const res = await api.app.acknowledgeDisclaimer()
      if (res.success) {
        onAccepted()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
        setSaving(false)
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark flex flex-col items-center justify-center p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-lg max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header — pinned, never scrolls */}
        <div className="bg-brand px-8 py-6 text-white text-center shrink-0">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-4">
            <Shield size={36} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold">Welcome to Sarang Business OS Lite</h1>
          <p className="text-brand-100 mt-1 text-base opacity-90 inline-flex items-center gap-1.5">
            — by Aszurex <AszurexMark width={18} />
          </p>
        </div>

        {/* Body — the only scrollable region. On short/small screens the
            checkbox and Start button used to be pushed below the fold with
            no way to reach them at all (no scrollbar anywhere) — a real
            user-reported install-blocking bug, 2026-07-16. Same
            header/scrollable-body/pinned-footer structure Modal.tsx already
            uses, so the accept action is always reachable regardless of
            window height. */}
        <div className="px-8 py-6 space-y-5 overflow-y-auto">
          <p className="text-lg font-semibold text-slate-800 text-center">
            Please read before you begin
          </p>

          <div className="space-y-4">
            <InfoRow
              icon={<HardDrive size={22} className="text-brand" />}
              title="Your data stays on this device"
              body="All bills, customers, and products are saved only on your computer. Nothing is sent online."
            />
            <InfoRow
              icon={<WifiOff size={22} className="text-success" />}
              title="No internet required"
              body="Sarang works fully offline. You do not need the internet to create bills or manage stock."
            />
            <InfoRow
              icon={<AlertCircle size={22} className="text-warning" />}
              title="This is not accounting software"
              body="Sarang helps manage your business. Please consult a CA or accountant for tax and legal matters."
            />
          </div>

          {/* Legal notice — §1.4 mandatory disclaimer text */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-5 py-4">
            <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
              {t('disclaimer.legalNotice')}
            </p>
          </div>
        </div>

        {/* Checkbox + accept button — pinned, always visible/reachable */}
        <div className="px-8 py-6 space-y-5 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <label className="flex items-start gap-4 cursor-pointer select-none group">
            <div className="mt-0.5 shrink-0">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 text-brand focus:ring-brand cursor-pointer"
              />
            </div>
            <span className="text-base text-slate-700 dark:text-slate-300 group-hover:text-slate-900 transition-colors leading-snug">
              I have read and understood the above information
            </span>
          </label>

          <Button
            size="lg"
            className="w-full"
            disabled={!checked}
            loading={saving}
            onClick={handleAccept}
          >
            Start Using Sarang
          </Button>
        </div>

        {/* Footer — pinned, never scrolls */}
        <div className="px-8 py-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 text-center shrink-0">
          <p className="text-sm text-slate-400 inline-flex items-center justify-center gap-1.5 w-full">
            Built by <span className="text-brand font-semibold">Aszurex</span> <AszurexMark width={14} /> · Trust Beyond Limits
          </p>
        </div>
      </motion.div>
    </div>
  )
}

function InfoRow({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div>
        <p className="font-semibold text-slate-800 text-base">{title}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{body}</p>
      </div>
    </div>
  )
}
