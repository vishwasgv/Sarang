import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Badge } from '@shared/ui/atoms/Badge'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { formatDate } from '@shared/utils/locale.util'

export interface EInvoiceInvoice {
  id: string
  irn?: string | null
  irnAckNo?: string | null
  irnAckDate?: string | null
}

// Prepare the e-invoice file for one invoice, then record the IRN the e-invoice portal returned.
export function EInvoiceCard({ invoice, onChanged }: { invoice: EInvoiceInvoice; onChanged: () => void }) {
  const { t } = useTranslation()
  const { error: toastError, success: toastSuccess } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const canEdit = hasPermission('reports.tax')
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [irn, setIrn] = useState('')
  const [ackNo, setAckNo] = useState('')
  const [ackDate, setAckDate] = useState('')
  const [qr, setQr] = useState('')

  async function download() {
    setBusy(true)
    try {
      const res = await window.api.einvoice.exportJson({ invoiceId: invoice.id })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('einvoice.couldNotPrepare')); return }
      const data = res.data as { saved: boolean; path?: string } | undefined
      if (data?.saved) toastSuccess(t('einvoice.fileSaved'), data.path ?? '')
    } catch {
      toastError(t('common.error'), t('einvoice.couldNotPrepare'))
    } finally { setBusy(false) }
  }

  async function save() {
    setSaving(true)
    try {
      const res = await window.api.einvoice.saveIrn({ invoiceId: invoice.id, irn, ackNo: ackNo || undefined, ackDate: ackDate || undefined, signedQr: qr || undefined })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('einvoice.couldNotSave')); return }
      toastSuccess(t('einvoice.irnSaved'), '')
      setIrn(''); setAckNo(''); setAckDate(''); setQr('')
      onChanged()
    } catch {
      toastError(t('common.error'), t('einvoice.couldNotSave'))
    } finally { setSaving(false) }
  }

  async function clear() {
    const res = await window.api.einvoice.clearIrn({ invoiceId: invoice.id })
    if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('einvoice.couldNotSave')); return }
    onChanged()
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100">{t('einvoice.title')}</h3>
        {invoice.irn ? <Badge variant="success">{t('einvoice.hasIrn')}</Badge> : <Badge variant="warning">{t('einvoice.noIrn')}</Badge>}
      </div>

      {invoice.irn ? (
        <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
          <p className="font-mono text-xs break-all">{invoice.irn}</p>
          {invoice.irnAckNo && <p>{t('einvoice.ackNo')}: {invoice.irnAckNo}{invoice.irnAckDate ? ` · ${formatDate(invoice.irnAckDate)}` : ''}</p>}
          {canEdit && <Button size="sm" variant="ghost" onClick={clear}>{t('einvoice.remove')}</Button>}
        </div>
      ) : (
        canEdit && (
          <>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('einvoice.steps')}</p>
            <Button variant="secondary" onClick={download} loading={busy}>{t('einvoice.download')}</Button>
            <div className="grid sm:grid-cols-2 gap-3 pt-2">
              <Input label={t('einvoice.irn')} value={irn} onChange={(e) => setIrn(e.target.value)} />
              <Input label={t('einvoice.ackNo')} value={ackNo} onChange={(e) => setAckNo(e.target.value)} />
              <Input label={t('einvoice.ackDate')} type="date" value={ackDate} onChange={(e) => setAckDate(e.target.value)} />
              <Input label={t('einvoice.signedQr')} value={qr} onChange={(e) => setQr(e.target.value)} />
            </div>
            <Button onClick={save} loading={saving} disabled={!irn.trim()}>{t('einvoice.saveIrn')}</Button>
          </>
        )
      )}
    </div>
  )
}
