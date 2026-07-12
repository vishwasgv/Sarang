import React, { useEffect, useState, useCallback } from 'react'
import { RefreshCw as RefreshCwIcon, Plus, X, Search, RefreshCw, Edit2, Trash2, Receipt } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { cn } from '@shared/utils/cn'
import { Card } from '@shared/ui/molecules/Card'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { CustomerPicker } from '@shared/ui/molecules/CustomerPicker'
import { useNotificationStore } from '@app/store/notification.store'

interface RetainerAgreement {
  id: string
  clientId: string
  assignedToId: string | null
  title: string
  retainerType: string
  monthlyAmount: number
  billingDay: number
  hoursPerMonth: number | null
  deliverables: string | null
  status: string
  startDate: string
  endDate: string | null
  notes: string | null
  lastInvoicedPeriod: string | null
  client: { id: string; customerName: string; phone: string | null }
  assignedTo: { id: string; fullName: string } | null
}

interface Customer { id: string; customerName: string; phone: string | null }
interface Employee { id: string; fullName: string }

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtAmount(n: number): string {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7)
}

// Exhaustive against RetainerAgreement.status in prisma/schema.prisma (ACTIVE|PAUSED|EXPIRED)
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'neutral'> = {
  ACTIVE:  'success',
  PAUSED:  'warning',
  EXPIRED: 'neutral',
}

const TYPE_LABELS: Record<string, string> = {
  FIXED_FEE:          'Fixed Fee',
  HOURLY_BUCKET:      'Hourly Bucket',
  DELIVERABLE_BASED:  'Deliverable-Based',
}

const RETAINER_TYPES   = ['FIXED_FEE', 'HOURLY_BUCKET', 'DELIVERABLE_BASED']
const RETAINER_STATUSES = ['ACTIVE', 'PAUSED', 'EXPIRED']

export default function RetainersScreen(): React.ReactElement {
  const { error: toastError } = useNotificationStore()
  const [retainers, setRetainers]   = useState<RetainerAgreement[]>([])
  const [employees, setEmployees]   = useState<Employee[]>([])
  const [loading, setLoading]       = useState(false)
  const [search, setSearch]         = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // KPI
  const [kpiRetainers, setKpiRetainers] = useState<RetainerAgreement[]>([])

  // Form
  const [showForm, setShowForm]     = useState(false)
  const [editRetainer, setEditRetainer] = useState<RetainerAgreement | null>(null)
  const [saving, setSaving]         = useState(false)

  const [fClient, setFClient]             = useState<Customer | null>(null)
  const [fAssignedToId, setFAssignedToId] = useState('')
  const [fTitle, setFTitle]               = useState('')
  const [fType, setFType]                 = useState('FIXED_FEE')
  const [fMonthlyAmount, setFMonthlyAmount] = useState('')
  const [fBillingDay, setFBillingDay]     = useState('1')
  const [fHoursPerMonth, setFHoursPerMonth] = useState('')
  const [fDeliverables, setFDeliverables] = useState('')
  const [fStatus, setFStatus]             = useState('ACTIVE')
  const [fStartDate, setFStartDate]       = useState('')
  const [fEndDate, setFEndDate]           = useState('')
  const [fNotes, setFNotes]               = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [retRes, kpiRes, empRes] = await Promise.all([
        api.retainer.list(filterStatus ? { status: filterStatus } : undefined),
        api.retainer.list(),
        api.hr.listEmployees(),
      ])
      if (retRes.success && retRes.data) setRetainers(retRes.data as RetainerAgreement[])
      else toastError('Error', retRes.error?.message ?? 'Failed to load retainers.')
      if (kpiRes.success && kpiRes.data) setKpiRetainers(kpiRes.data as RetainerAgreement[])
      if (empRes.success && empRes.data) {
        const d = empRes.data as { employees?: Employee[] } | Employee[]
        setEmployees(Array.isArray(d) ? d : (d.employees ?? []))
      }
    } catch {
      toastError('Error', 'Failed to load retainers.')
    } finally {
      setLoading(false)
    }
  }, [filterStatus, toastError])

  useEffect(() => { loadAll() }, [loadAll])

  function resetForm(): void {
    setFClient(null); setFAssignedToId(''); setFTitle(''); setFType('FIXED_FEE')
    setFMonthlyAmount(''); setFBillingDay('1'); setFHoursPerMonth('')
    setFDeliverables(''); setFStatus('ACTIVE'); setFStartDate(''); setFEndDate(''); setFNotes('')
  }

  function openNew(): void { setEditRetainer(null); resetForm(); setShowForm(true) }

  function openEdit(r: RetainerAgreement): void {
    setEditRetainer(r)
    setFClient(r.client); setFAssignedToId(r.assignedToId ?? '')
    setFTitle(r.title); setFType(r.retainerType)
    setFMonthlyAmount(String(r.monthlyAmount)); setFBillingDay(String(r.billingDay))
    setFHoursPerMonth(r.hoursPerMonth != null ? String(r.hoursPerMonth) : '')
    setFDeliverables(r.deliverables ?? ''); setFStatus(r.status)
    setFStartDate(r.startDate.slice(0, 10)); setFEndDate(r.endDate ? r.endDate.slice(0, 10) : '')
    setFNotes(r.notes ?? '')
    setShowForm(true)
  }

  async function handleSave(): Promise<void> {
    if (!fClient || !fTitle.trim() || !fMonthlyAmount || !fStartDate) return
    setSaving(true)
    try {
      let res
      if (editRetainer) {
        res = await api.retainer.update({
          id: editRetainer.id,
          assignedToId:  fAssignedToId || null,
          title:         fTitle.trim(),
          retainerType:  fType,
          monthlyAmount: Number(fMonthlyAmount),
          billingDay:    Number(fBillingDay) || 1,
          hoursPerMonth: fHoursPerMonth ? Number(fHoursPerMonth) : null,
          deliverables:  fDeliverables || null,
          status:        fStatus,
          startDate:     fStartDate,
          endDate:       fEndDate || null,
          notes:         fNotes || null,
        })
      } else {
        res = await api.retainer.create({
          clientId:      fClient.id,
          assignedToId:  fAssignedToId || undefined,
          title:         fTitle.trim(),
          retainerType:  fType,
          monthlyAmount: Number(fMonthlyAmount),
          billingDay:    Number(fBillingDay) || 1,
          hoursPerMonth: fHoursPerMonth ? Number(fHoursPerMonth) : undefined,
          deliverables:  fDeliverables || undefined,
          status:        fStatus,
          startDate:     fStartDate,
          endDate:       fEndDate || undefined,
          notes:         fNotes || undefined,
        })
      }
      if (res.success) { setShowForm(false); resetForm(); loadAll() }
      else toastError('Error', res.error?.message ?? 'Could not save retainer agreement.')
    } catch {
      toastError('Error', 'Could not save retainer agreement.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string): Promise<void> {
    if (!window.confirm('Delete this retainer agreement?')) return
    try {
      const res = await api.retainer.delete({ id })
      if (res.success) loadAll()
      else toastError('Error', res.error?.message ?? 'Could not delete retainer agreement.')
    } catch {
      toastError('Error', 'Could not delete retainer agreement.')
    }
  }

  const [generatingId, setGeneratingId] = useState<string | null>(null)

  async function handleGenerateInvoice(r: RetainerAgreement): Promise<void> {
    const period = currentPeriod()
    if (!window.confirm(`Generate a ₹${r.monthlyAmount} invoice for ${r.client.customerName} — ${period}?`)) return
    setGeneratingId(r.id)
    try {
      const res = await api.retainer.generateInvoice({ id: r.id, period })
      if (res.success) { loadAll() } else { window.alert(res.error?.message ?? 'Could not generate invoice.') }
    } catch {
      toastError('Error', 'Could not generate invoice.')
    } finally {
      setGeneratingId(null)
    }
  }

  const displayed = retainers.filter((r) => {
    const q = search.toLowerCase()
    return !q || r.title.toLowerCase().includes(q) || r.client.customerName.toLowerCase().includes(q)
  })

  // KPI
  const kpiActive   = kpiRetainers.filter((r) => r.status === 'ACTIVE').length
  const kpiMonthly  = kpiRetainers.filter((r) => r.status === 'ACTIVE').reduce((s, r) => s + Number(r.monthlyAmount), 0)
  const kpiAnnual   = kpiMonthly * 12

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 px-6 py-4 flex items-center justify-between dark:border-slate-700">
        <div className="flex items-center gap-3">
          <RefreshCwIcon className="w-6 h-6 text-indigo-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Retainers</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">Recurring client agreements</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadAll} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm">
            <Plus className="w-4 h-4" /> New Retainer
          </button>
        </div>
      </div>

      {/* KPI Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 px-6 py-3 grid grid-cols-4 gap-4 dark:border-slate-700">
        <KpiCard label="Total Agreements" value={kpiRetainers.length} color="neutral" />
        <KpiCard label="Active" value={kpiActive} color="success" />
        <KpiCard label="Monthly Recurring" value={fmtAmount(kpiMonthly)} color="brand" />
        <KpiCard label="Annual Run Rate" value={fmtAmount(kpiAnnual)} color="info" />
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 px-6 py-3 flex items-center gap-3 dark:border-slate-700">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or client..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
        </div>
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {RETAINER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-500 text-sm dark:text-slate-400">Loading...</div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400 dark:text-slate-500">
            <RefreshCwIcon className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">No retainer agreements found</p>
          </div>
        ) : (
          <Card padding="none" className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 dark:bg-slate-950 dark:border-slate-700">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Client</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Type</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Monthly</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Billing Day</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Period</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {displayed.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-slate-100">
                      {r.title}
                      {r.assignedTo && <div className="text-xs text-gray-400 dark:text-slate-500">{r.assignedTo.fullName}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{r.client.customerName}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{TYPE_LABELS[r.retainerType] ?? r.retainerType}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-slate-100">{fmtAmount(r.monthlyAmount)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-400">Day {r.billingDay}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[r.status] ?? 'neutral'} size="sm">{r.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">
                      {fmtDate(r.startDate)} – {fmtDate(r.endDate)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {r.status === 'ACTIVE' && (
                          r.lastInvoicedPeriod === currentPeriod() ? (
                            <span className="text-xs text-gray-400 dark:text-slate-500 px-1.5">Invoiced {currentPeriod()}</span>
                          ) : (
                            <button onClick={() => handleGenerateInvoice(r)} disabled={generatingId === r.id}
                              title="Generate this month's invoice"
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded dark:text-slate-500 disabled:opacity-50">
                              <Receipt className={cn('w-4 h-4', generatingId === r.id && 'animate-pulse')} />
                            </button>
                          )
                        )}
                        <button onClick={() => openEdit(r)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded dark:text-slate-500">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(r.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded dark:text-slate-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="font-semibold text-gray-900 dark:text-slate-100">{editRetainer ? 'Edit Retainer' : 'New Retainer Agreement'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <CustomerPicker label="Client *" value={fClient} onChange={setFClient} placeholder="Search by name or phone..." />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Title *</label>
                <input value={fTitle} onChange={(e) => setFTitle(e.target.value)}
                  placeholder="e.g. Monthly Marketing Retainer"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Type" value={fType} onChange={(e) => setFType(e.target.value)}>
                  {RETAINER_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                </Select>
                <Select label="Status" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                  {RETAINER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Monthly Amount (₹) *</label>
                  <input type="number" min="0" value={fMonthlyAmount} onChange={(e) => setFMonthlyAmount(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Billing Day (1–28)</label>
                  <input type="number" min="1" max="28" value={fBillingDay} onChange={(e) => setFBillingDay(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
              </div>
              {fType === 'HOURLY_BUCKET' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Hours / Month</label>
                  <input type="number" min="0" value={fHoursPerMonth} onChange={(e) => setFHoursPerMonth(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
              )}
              {fType === 'DELIVERABLE_BASED' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Deliverables</label>
                  <textarea value={fDeliverables} onChange={(e) => setFDeliverables(e.target.value)} rows={2}
                    placeholder="List deliverables included per month..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Start Date *</label>
                  <input type="date" value={fStartDate} onChange={(e) => setFStartDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">End Date</label>
                  <input type="date" value={fEndDate} onChange={(e) => setFEndDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
              </div>
              <Select label="Assigned To" value={fAssignedToId} onChange={(e) => setFAssignedToId(e.target.value)}>
                <option value="">Unassigned</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
              </Select>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Notes</label>
                <textarea value={fNotes} onChange={(e) => setFNotes(e.target.value)} rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-slate-700">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
              <button onClick={handleSave} disabled={saving || !fClient || !fTitle.trim() || !fMonthlyAmount || !fStartDate}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Saving...' : editRetainer ? 'Update Retainer' : 'Create Retainer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
