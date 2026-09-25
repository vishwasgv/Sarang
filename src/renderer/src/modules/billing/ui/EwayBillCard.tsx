import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'

// Prepare the file for generating an e-way bill on the e-way bill portal (Part A and Part B).
export function EwayBillCard({ invoiceId }: { invoiceId: string }) {
  const { t } = useTranslation()
  const { error: toastError, success: toastSuccess } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const [mode, setMode] = useState('ROAD')
  const [vehicle, setVehicle] = useState('')
  const [transporterId, setTransporterId] = useState('')
  const [transporterName, setTransporterName] = useState('')
  const [distance, setDistance] = useState('')
  const [busy, setBusy] = useState(false)

  if (!hasPermission('reports.tax')) return null

  async function download() {
    setBusy(true)
    try {
      const res = await window.api.einvoice.exportEwayBill({
        invoiceId, mode, vehicleNumber: vehicle || undefined, transporterId: transporterId || undefined,
        transporterName: transporterName || undefined, distanceKm: distance ? Number(distance) : undefined
      })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('ewayBill.couldNotPrepare')); return }
      const data = res.data as { saved: boolean; path?: string } | undefined
      if (data?.saved) toastSuccess(t('ewayBill.fileSaved'), data.path ?? '')
    } catch {
      toastError(t('common.error'), t('ewayBill.couldNotPrepare'))
    } finally { setBusy(false) }
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
      <h3 className="text-sm font-semibold text-dark dark:text-slate-100">{t('ewayBill.title')}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400">{t('ewayBill.help')}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <Select label={t('ewayBill.mode')} value={mode} onChange={(e) => setMode(e.target.value)}>
          {['ROAD', 'RAIL', 'AIR', 'SHIP'].map((m) => <option key={m} value={m}>{t(`ewayBill.modes.${m}`)}</option>)}
        </Select>
        <Input label={t('ewayBill.vehicle')} value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="MH12AB1234" />
        <Input label={t('ewayBill.transporterId')} value={transporterId} onChange={(e) => setTransporterId(e.target.value)} />
        <Input label={t('ewayBill.transporterName')} value={transporterName} onChange={(e) => setTransporterName(e.target.value)} />
        <Input label={t('ewayBill.distance')} type="number" min="0" value={distance} onChange={(e) => setDistance(e.target.value)} />
      </div>
      <Button variant="secondary" onClick={download} loading={busy}>{t('ewayBill.download')}</Button>
    </div>
  )
}
