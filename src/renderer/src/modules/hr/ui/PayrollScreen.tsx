import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Wallet, Plus, Trash2, Printer, CheckCircle2, X } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { Card } from '@shared/ui/molecules/Card'
import { Button } from '@shared/ui/atoms/Button'
import { useAuthStore } from '@app/store/auth.store'
import { useBusinessStore } from '@app/store/business.store'
import { useNotificationStore } from '@app/store/notification.store'

interface DeductionLine {
  name: string
  amount: number
}

interface SalaryPaymentRecord {
  id: string
  employeeId: string
  employeeName: string
  periodYear: number
  periodMonth: number
  basicSalary: number
  allowances: { name: string; amount: number }[]
  grossSalary: number
  deductions: DeductionLine[]
  totalDeductions: number
  netPayable: number
  status: 'DRAFT' | 'PAID'
  paidDate: string | null
  paymentMethod: string | null
}

const QUICK_ADD_NAMES = ['PF', 'ESI', 'Professional Tax', 'TDS']

export function PayrollScreen() {
  const { t } = useTranslation()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canManage = hasPermission('hr.manage')
  const taxModel = useBusinessStore((s) => s.profile?.taxModel ?? 'NONE')
  const { error: toastError } = useNotificationStore()
  const today = new Date()
  const [viewMonth, setViewMonth] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 })
  const [records, setRecords] = useState<SalaryPaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selected, setSelected] = useState<SalaryPaymentRecord | null>(null)
  const [draftDeductions, setDraftDeductions] = useState<DeductionLine[]>([])
  const [newDeductionName, setNewDeductionName] = useState('')
  const [newDeductionAmount, setNewDeductionAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [markingPaid, setMarkingPaid] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('CASH')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.payroll.listForPeriod({ year: viewMonth.year, month: viewMonth.month })
      if (res.success && res.data) {
        setRecords((res.data as { records: SalaryPaymentRecord[] }).records)
      } else {
        toastError(res.error?.message ?? t('hr.actionFailed'))
      }
    } catch {
      toastError(t('hr.actionFailed'))
    } finally {
      setLoading(false)
    }
  }, [viewMonth, toastError, t])

  useEffect(() => { load() }, [load])

  function prevMonth() {
    setViewMonth(prev => prev.month === 1 ? { year: prev.year - 1, month: 12 } : { ...prev, month: prev.month - 1 })
  }
  function nextMonth() {
    setViewMonth(prev => prev.month === 12 ? { year: prev.year + 1, month: 1 } : { ...prev, month: prev.month + 1 })
  }

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await api.payroll.generate({ year: viewMonth.year, month: viewMonth.month })
      if (res.success) {
        await load()
      } else {
        toastError(res.error?.message ?? t('hr.actionFailed'))
      }
    } catch {
      toastError(t('hr.actionFailed'))
    } finally {
      setGenerating(false)
    }
  }

  function openRecord(record: SalaryPaymentRecord) {
    setSelected(record)
    setDraftDeductions(record.deductions)
    setNewDeductionName('')
    setNewDeductionAmount('')
    setPaymentMethod(record.paymentMethod ?? 'CASH')
  }

  function addDeductionLine(name: string, amount = 0) {
    if (!name.trim()) return
    setDraftDeductions(prev => [...prev, { name: name.trim(), amount }])
  }

  function removeDeductionLine(index: number) {
    setDraftDeductions(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSaveDeductions() {
    if (!selected) return
    setSaving(true)
    try {
      const res = await api.payroll.updateDeductions({ id: selected.id, deductions: draftDeductions })
      if (res.success && res.data) {
        const updated = res.data as SalaryPaymentRecord
        setSelected(updated)
        setRecords(prev => prev.map(r => r.id === updated.id ? updated : r))
      } else {
        toastError(res.error?.message ?? t('hr.saveFailed'))
      }
    } catch {
      toastError(t('hr.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function handleMarkPaid() {
    if (!selected) return
    if (!window.confirm(t('hr.confirmMarkPaid'))) return
    setMarkingPaid(true)
    try {
      const res = await api.payroll.markPaid({ id: selected.id, paymentMethod })
      if (res.success && res.data) {
        const updated = res.data as SalaryPaymentRecord
        setSelected(updated)
        setRecords(prev => prev.map(r => r.id === updated.id ? updated : r))
      } else {
        toastError(res.error?.message ?? t('hr.actionFailed'))
      }
    } catch {
      toastError(t('hr.actionFailed'))
    } finally {
      setMarkingPaid(false)
    }
  }

  async function handlePrint(id: string) {
    try {
      const res = await api.payroll.print({ id })
      if (!res.success) {
        toastError(res.error?.message ?? t('hr.actionFailed'))
      }
    } catch {
      toastError(t('hr.actionFailed'))
    }
  }

  const monthName = new Date(viewMonth.year, viewMonth.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
  const totalNetPayable = records.reduce((s, r) => s + r.netPayable, 0)
  const netDelta = selected ? selected.grossSalary - draftDeductions.reduce((s, d) => s + d.amount, 0) : 0

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-slate-100">{t('hr.payroll')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t('hr.payrollDesc')}</p>
        </div>
        {canManage && (
          <Button onClick={handleGenerate} disabled={generating}>
            <Plus size={16} className="mr-1.5" /> {generating ? '…' : t('hr.generatePayroll')}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button onClick={prevMonth} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"><ChevronLeft size={16} /></button>
        <span className="font-semibold text-dark dark:text-slate-100">{monthName}</span>
        <button onClick={nextMonth} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"><ChevronRight size={16} /></button>
      </div>

      {records.length > 0 && (
        <div className="bg-brand/5 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center"><Wallet size={18} className="text-brand" /></div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('hr.total')} {t('hr.netPayable')}</p>
            <p className="text-xl font-bold text-dark dark:text-slate-100">₹{totalNetPayable.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
          </div>
          <span className="ml-auto text-xs text-slate-400">{records.length} {t('hr.employees')}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><div className="w-7 h-7 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>
      ) : records.length === 0 ? (
        <div className="text-center py-12">
          <Wallet size={36} className="mx-auto text-slate-300 mb-2" />
          <p className="text-slate-500 dark:text-slate-400">{t('hr.noPayrollForPeriod')}</p>
          <p className="text-slate-400 text-sm mt-1">{t('hr.generatePayrollFirst')}</p>
        </div>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">{t('hr.employee')}</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-300">{t('hr.grossSalary')}</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-300">{t('hr.totalDeductions')}</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-300">{t('hr.netPayable')}</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600 dark:text-slate-300">{t('hr.status')}</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600 dark:text-slate-300"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {records.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <td className="px-4 py-3 cursor-pointer" onClick={() => openRecord(r)}>
                    <p className="font-medium text-dark dark:text-slate-100">{r.employeeName}</p>
                  </td>
                  <td className="text-right px-4 py-3">₹{r.grossSalary.toLocaleString()}</td>
                  <td className="text-right px-4 py-3">₹{r.totalDeductions.toLocaleString()}</td>
                  <td className="text-right px-4 py-3 font-semibold text-dark dark:text-slate-100">₹{r.netPayable.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                  <td className="text-center px-4 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${r.status === 'PAID' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                      {r.status === 'PAID' ? t('hr.paid') : t('hr.draft')}
                    </span>
                  </td>
                  <td className="text-center px-4 py-3">
                    <button onClick={() => handlePrint(r.id)} className="p-1.5 text-slate-400 hover:text-brand rounded hover:bg-slate-100 dark:hover:bg-slate-700" title={t('hr.printPayslip') as string}>
                      <Printer size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <p className="font-semibold text-dark dark:text-slate-100">{selected.employeeName}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{monthName}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-dark dark:hover:text-slate-100"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-300">{t('hr.basicSalary')}</span><span className="font-medium">₹{selected.basicSalary.toLocaleString()}</span></div>
                {selected.allowances.map((a, i) => (
                  <div key={i} className="flex justify-between"><span className="text-slate-600 dark:text-slate-300">{a.name}</span><span className="font-medium">₹{a.amount.toLocaleString()}</span></div>
                ))}
                <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2"><span className="text-slate-600 dark:text-slate-300">{t('hr.grossSalary')}</span><span className="font-medium">₹{selected.grossSalary.toLocaleString()}</span></div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">{t('hr.deductions')}</p>
                {selected.status === 'DRAFT' && taxModel === 'GST' && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {QUICK_ADD_NAMES.map(name => (
                      <button key={name} onClick={() => addDeductionLine(name)} className="text-xs px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 hover:border-brand hover:text-brand" style={{ minHeight: 28 }}>
                        + {name}
                      </button>
                    ))}
                  </div>
                )}
                {draftDeductions.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">{t('hr.noDeductions')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {draftDeductions.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="flex-1 text-slate-600 dark:text-slate-300">{d.name}</span>
                        <span className="font-medium">₹{d.amount.toLocaleString()}</span>
                        {selected.status === 'DRAFT' && (
                          <button onClick={() => removeDeductionLine(i)} className="text-slate-300 hover:text-danger"><Trash2 size={14} /></button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {selected.status === 'DRAFT' && (
                  <div className="flex items-center gap-2 mt-3">
                    <input value={newDeductionName} onChange={e => setNewDeductionName(e.target.value)} placeholder={t('hr.deductionName') as string}
                      className="flex-1 h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100" />
                    <input value={newDeductionAmount} onChange={e => setNewDeductionAmount(e.target.value)} type="number" placeholder={t('hr.amount') as string}
                      className="w-24 h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100" />
                    <Button size="sm" variant="secondary" onClick={() => {
                      addDeductionLine(newDeductionName, Number(newDeductionAmount) || 0)
                      setNewDeductionName(''); setNewDeductionAmount('')
                    }}>{t('hr.addDeduction')}</Button>
                  </div>
                )}
                {selected.status === 'DRAFT' && (
                  <p className="text-xs text-slate-400 mt-2">{t('hr.payslipDeductionDisclaimer')}</p>
                )}
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-300">{t('hr.totalDeductions')}</span><span className="font-medium">₹{draftDeductions.reduce((s, d) => s + d.amount, 0).toLocaleString()}</span></div>
                <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2 text-base"><span className="font-semibold">{t('hr.netPay')}</span><span className="font-bold text-dark dark:text-slate-100">₹{netDelta.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span></div>
              </div>

              {selected.status === 'DRAFT' ? (
                <div className="space-y-3">
                  <Button size="sm" variant="secondary" onClick={handleSaveDeductions} disabled={saving} className="w-full">
                    {saving ? '…' : t('common.save')}
                  </Button>
                  {canManage && (
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
                      <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                        className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100">
                        <option value="CASH">Cash</option>
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                        <option value="CHEQUE">Cheque</option>
                        <option value="UPI">UPI</option>
                      </select>
                      <Button onClick={handleMarkPaid} disabled={markingPaid} className="w-full">
                        <CheckCircle2 size={16} className="mr-1.5" /> {markingPaid ? '…' : t('hr.markAsPaid')}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-success bg-success/10 rounded-lg p-3">
                  {t('hr.paid')} — {selected.paidDate ? new Date(selected.paidDate).toLocaleDateString() : ''} {selected.paymentMethod ? `(${selected.paymentMethod})` : ''}
                </div>
              )}

              <Button variant="outline" onClick={() => handlePrint(selected.id)} className="w-full">
                <Printer size={16} className="mr-1.5" /> {t('hr.printPayslip')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
