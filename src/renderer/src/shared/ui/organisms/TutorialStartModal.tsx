import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '@shared/ui/molecules/Modal'
import { Button } from '@shared/ui/atoms/Button'
import { Select } from '@shared/ui/atoms/Select'
import { useBusinessStore } from '@app/store/business.store'
import { useNotificationStore } from '@app/store/notification.store'
import { api } from '@renderer/services/ipc-client'
import { MANUAL_CHAPTERS } from '@renderer/modules/manual/manifest'

interface TutorialStartModalProps {
  open: boolean
  onClose: () => void
}

// Phase 60 — reuses the Manual's own business-type-to-friendly-title list
// (MANUAL_CHAPTERS' 'business' group) rather than maintaining a third copy
// of "every business type with a nice label" alongside NAV_ITEMS and
// TEMPLATE_DEFAULTS.
const BUSINESS_TYPE_OPTIONS = MANUAL_CHAPTERS
  .filter((c) => c.group === 'business' && c.businessTypes?.length)
  .map((c) => ({ value: c.businessTypes![0], label: c.title }))
  .sort((a, b) => a.label.localeCompare(b.label))

export function TutorialStartModal({ open, onClose }: TutorialStartModalProps) {
  const { t } = useTranslation()
  const myBusinessType = useBusinessStore((s) => s.profile?.businessType)
  const { error: toastError } = useNotificationStore()
  const [selected, setSelected] = useState<string>(myBusinessType ?? BUSINESS_TYPE_OPTIONS[0]?.value ?? 'GENERAL')
  const [starting, setStarting] = useState(false)

  async function handleStart() {
    setStarting(true)
    try {
      const res = await api.tutorial.start({ businessType: selected })
      if (res.success === false) {
        toastError(t('common.error'), res.error?.message ?? 'Could not start the tutorial.')
        setStarting(false)
      }
      // On success the whole app relaunches — nothing more to do here.
    } catch {
      toastError(t('common.error'), 'Could not start the tutorial.')
      setStarting(false)
    }
  }

  const myTypeLabel = BUSINESS_TYPE_OPTIONS.find((o) => o.value === myBusinessType)?.label ?? myBusinessType ?? ''

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('tour.pickBusinessTypeTitle')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={starting}>{t('tour.cancelButton')}</Button>
          <Button variant="primary" onClick={handleStart} loading={starting}>{t('tour.startButton')}</Button>
        </>
      }
    >
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t('tour.pickBusinessTypeSubtitle')}</p>
      <Select
        label={t('tour.pickBusinessTypeTitle')}
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        {myBusinessType && (
          <option value={myBusinessType}>{t('tour.myBusinessType', { type: myTypeLabel })}</option>
        )}
        {BUSINESS_TYPE_OPTIONS.filter((o) => o.value !== myBusinessType).map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
    </Modal>
  )
}
