import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { GitBranch } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Card } from '@shared/ui/molecules/Card'
import { Input } from '@shared/ui/atoms/Input'
import { useNotificationStore } from '@app/store/notification.store'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDate, toLocalISODate } from '@shared/utils/locale.util'

interface Summary { id: string; branchName: string; periodFrom: string; periodTo: string; generatedAt: string; figures: { sales: number; purchases: number; expenses: number } }

function monthBounds(): { from: string; to: string } {
  const now = new Date()
  return { from: toLocalISODate(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 0)) }
}

// Send this shop's figures to head office, and read the files sent by other shops.
export function BranchSummariesScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [list, setList] = useState<Summary[]>([])
  const [name, setName] = useState('')
  const [range, setRange] = useState(monthBounds)
  const [busy, setBusy] = useState<'export' | 'import' | null>(null)

  const load = useCallback(async () => {
    const res = await window.api.branchSummaries.list()
    if (res.success && res.data) setList(res.data as Summary[])
  }, [])
  useEffect(() => { load() }, [load])

  async function exportFile() {
    setBusy('export')
    try {
      const res = await window.api.branchSummaries.export({ branchName: name || undefined, dateFrom: range.from, dateTo: range.to })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('accounting.branches.couldNot')); return }
      const data = res.data as { saved: boolean; path?: string } | undefined
      if (data?.saved) toastSuccess(t('accounting.branches.exported'), data.path ?? '')
    } finally { setBusy(null) }
  }

  async function importFiles() {
    setBusy('import')
    try {
      const res = await window.api.branchSummaries.import()
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('accounting.branches.couldNot')); return }
      const data = res.data as { imported: number; problems: { file: string; message: string }[] }
      if (data.imported > 0) toastSuccess(t('accounting.branches.imported', { count: data.imported }))
      for (const p of data.problems) toastError(p.file, p.message)
      await load()
    } finally { setBusy(null) }
  }

  async function remove(id: string) {
    const res = await window.api.branchSummaries.remove({ id })
    if (res.success) await load()
    else toastError(t('common.error'), res.error?.message ?? t('accounting.branches.couldNot'))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center"><GitBranch size={18} className="text-brand" /></div>
        <div>
          <h1 className="text-lg font-bold text-dark dark:text-slate-100">{t('accounting.branches.title')}</h1>
          <p className="text-xs text-slate-400">{t('accounting.branches.subtitle')}</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 dark:bg-slate-950 space-y-6 max-w-4xl">
        <Card padding="md" className="space-y-3">
          <h2 className="font-semibold text-dark dark:text-slate-100">{t('accounting.branches.sendTitle')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('accounting.branches.sendHelp')}</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <Input label={t('accounting.branches.branchName')} value={name} onChange={(e) => setName(e.target.value)} />
            <Input label={t('accounting.branches.from')} type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
            <Input label={t('accounting.branches.to')} type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
          </div>
          <Button onClick={exportFile} loading={busy === 'export'}>{t('accounting.branches.makeFile')}</Button>
        </Card>

        <Card padding="md" className="space-y-3">
          <h2 className="font-semibold text-dark dark:text-slate-100">{t('accounting.branches.receiveTitle')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('accounting.branches.receiveHelp')}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={importFiles} loading={busy === 'import'}>{t('accounting.branches.chooseFiles')}</Button>
            <Button variant="outline" onClick={() => navigate('/reports')}>{t('accounting.branches.openReport')}</Button>
          </div>
          {list.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-xs uppercase text-slate-400">
                  <th className="px-3 py-2 text-start">{t('accounting.branches.branchName')}</th>
                  <th className="px-3 py-2 text-start">{t('accounting.branches.period')}</th>
                  <th className="px-3 py-2 text-end">{t('accounting.branches.sales')}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id} className="border-b border-slate-50 dark:border-slate-800">
                    <td className="px-3 py-2">{s.branchName}</td>
                    <td className="px-3 py-2 text-slate-500">{formatDate(s.periodFrom)} – {formatDate(s.periodTo)}</td>
                    <td className="px-3 py-2 text-end">{formatCurrency(s.figures.sales)}</td>
                    <td className="px-3 py-2 text-end"><Button size="sm" variant="ghost" onClick={() => remove(s.id)}>{t('common.delete')}</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <p className="text-xs text-slate-400">{t('accounting.branches.note')}</p>
      </div>
    </div>
  )
}
