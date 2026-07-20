import React, { useEffect, useState, useCallback } from 'react'
import { Briefcase, Plus, X, Search, RefreshCw, Edit2, Trash2, Receipt } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { useNotificationStore } from '@app/store/notification.store'
import { DocumentPanel } from '@modules/documents/ui/DocumentPanel'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Engagement {
  id: string
  clientId: string
  staffId: string | null
  title: string
  engagementType: string
  status: string
  startDate: string | null
  endDate: string | null
  feeType: string
  feeAmount: number | null
  billingDay: number | null
  invoiceId: string | null
  lastInvoicedPeriod: string | null
  notes: string | null
  client: { id: string; customerName: string; phone: string | null }
  staff: { id: string; fullName: string } | null
}

interface Customer {
  id: string
  customerName: string
  phone: string | null
}

interface Employee {
  id: string
  fullName: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtAmount(n: number | null): string {
  if (n == null) return '—'
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// Exhaustive against Engagement.status in prisma/schema.prisma (ACTIVE|COMPLETED|PAUSED|TERMINATED)
const STATUS_VARIANT: Record<string, 'success' | 'neutral' | 'warning' | 'danger'> = {
  ACTIVE:     'success',
  COMPLETED:  'neutral',
  PAUSED:     'warning',
  TERMINATED: 'danger',
}
const TYPE_LABELS: Record<string, string> = {
  RETAINER: 'Retainer', ONE_TIME: 'One-Time', AUDIT: 'Audit', ADVISORY: 'Advisory', TAX: 'Tax Filing',
}
const FEE_LABELS: Record<string, string> = {
  FIXED: 'Fixed', HOURLY: 'Hourly', RETAINER_MONTHLY: 'Monthly Retainer',
}

const ENGAGEMENT_TYPES = ['RETAINER', 'ONE_TIME', 'AUDIT', 'ADVISORY', 'TAX']
const STATUSES        = ['ACTIVE', 'COMPLETED', 'PAUSED', 'TERMINATED']
const FEE_TYPES       = ['FIXED', 'HOURLY', 'RETAINER_MONTHLY']

// Matches the backend's default period key (engagement.service.ts's
// generateEngagementInvoice defaults to the same "YYYY-MM" of `new Date()`
// when no explicit period is passed) — re-invoicing is gated per calendar
// month, not a one-shot invoiceId, so a retainer can be billed every month.
const currentPeriod = new Date().toISOString().slice(0, 7)

// ── Component ─────────────────────────────────────────────────────────────────

export default function EngagementsScreen(): React.JSX.Element {
  const { error: toastError } = useNotificationStore()
  const [engagements, setEngagements] = useState<Engagement[]>([])
  const [kpiEngagements, setKpiEngagements] = useState<Engagement[]>([])
  const [clients, setClients] = useState<Customer[]>([])
  const [staff, setStaff] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ACTIVE')
  const [typeFilter, setTypeFilter] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editEng, setEditEng] = useState<Engagement | null>(null)
  const [formClientId, setFormClientId] = useState('')
  const [formStaffId, setFormStaffId] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formType, setFormType] = useState('RETAINER')
  const [formFeeType, setFormFeeType] = useState('FIXED')
  const [formFeeAmount, setFormFeeAmount] = useState('')
  const [formBillingDay, setFormBillingDay] = useState('')
  const [formStartDate, setFormStartDate] = useState('')
  const [formEndDate, setFormEndDate] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formStatus, setFormStatus] = useState('ACTIVE')
  const [formSaving, setFormSaving] = useState(false)

  const [generatingInvoiceId, setGeneratingInvoiceId] = useState<string | null>(null)
  const [invoiceError, setInvoiceError] = useState('')

  const loadEngagements = useCallback(async () => {
    setLoading(true)
    try {
      const filters: Record<string, unknown> = {}
      if (statusFilter) filters.status = statusFilter
      if (typeFilter) filters.engagementType = typeFilter
      const [res, kpiRes] = await Promise.all([
        api.engagement.list(filters),
        api.engagement.list({}),
      ])
      if (res.success) setEngagements(res.data as Engagement[])
      else toastError('Error', res.error?.message ?? 'Could not load engagements.')
      if (kpiRes.success) setKpiEngagements(kpiRes.data as Engagement[])
    } catch {
      toastError('Error', 'Could not load engagements.')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, typeFilter, toastError])

  const loadClients = useCallback(async () => {
    try {
      const res = await api.customers.list({ limit: 1000 })
      if (res.success) setClients((res.data as { customers: Customer[] }).customers ?? [])
      else toastError('Error', res.error?.message ?? 'Could not load clients.')
    } catch { toastError('Error', 'Could not load clients.') }
  }, [toastError])

  const loadStaff = useCallback(async () => {
    try {
      const res = await api.hr.listEmployees({ isActive: true })
      if (res.success) setStaff((res.data as { employees: Employee[] }).employees ?? [])
      else toastError('Error', res.error?.message ?? 'Could not load staff.')
    } catch { toastError('Error', 'Could not load staff.') }
  }, [toastError])

  useEffect(() => {
    void loadEngagements()
    void loadClients()
    void loadStaff()
  }, [loadEngagements, loadClients, loadStaff])

  function openAddForm(): void {
    setEditEng(null)
    setFormClientId('')
    setFormStaffId('')
    setFormTitle('')
    setFormType('RETAINER')
    setFormFeeType('FIXED')
    setFormFeeAmount('')
    setFormBillingDay('')
    setFormStartDate('')
    setFormEndDate('')
    setFormNotes('')
    setFormStatus('ACTIVE')
    setShowForm(true)
  }

  function openEditForm(e: Engagement): void {
    setEditEng(e)
    setFormClientId(e.clientId)
    setFormStaffId(e.staffId ?? '')
    setFormTitle(e.title)
    setFormType(e.engagementType)
    setFormFeeType(e.feeType)
    setFormFeeAmount(e.feeAmount != null ? String(e.feeAmount) : '')
    setFormBillingDay(e.billingDay != null ? String(e.billingDay) : '')
    setFormStartDate(e.startDate ? e.startDate.slice(0, 10) : '')
    setFormEndDate(e.endDate ? e.endDate.slice(0, 10) : '')
    setFormNotes(e.notes ?? '')
    setFormStatus(e.status)
    setShowForm(true)
  }

  async function handleSave(): Promise<void> {
    if (!formClientId || !formTitle.trim()) return
    setFormSaving(true)
    try {
      const feeAmount = formFeeAmount ? Number(formFeeAmount) : undefined
      const billingDay = formBillingDay ? Number(formBillingDay) : undefined

      let res
      if (editEng) {
        res = await api.engagement.update({
          id: editEng.id,
          staffId: formStaffId || null,
          title: formTitle.trim(),
          engagementType: formType,
          status: formStatus,
          feeType: formFeeType,
          feeAmount: feeAmount ?? null,
          billingDay: billingDay ?? null,
          startDate: formStartDate || null,
          endDate: formEndDate || null,
          notes: formNotes || null,
        })
      } else {
        res = await api.engagement.create({
          clientId: formClientId,
          staffId: formStaffId || undefined,
          title: formTitle.trim(),
          engagementType: formType,
          feeType: formFeeType,
          feeAmount: feeAmount,
          billingDay: billingDay,
          startDate: formStartDate || undefined,
          endDate: formEndDate || undefined,
          notes: formNotes || undefined,
        })
      }
      if (res.success) {
        setShowForm(false)
        await loadEngagements()
      } else {
        toastError('Error', res.error?.message ?? 'Could not save engagement.')
      }
    } catch {
      toastError('Error', 'Could not save engagement.')
    } finally {
      setFormSaving(false)
    }
  }

  async function handleDelete(id: string): Promise<void> {
    try {
      const res = await api.engagement.delete({ id })
      if (res.success) await loadEngagements()
      else toastError('Error', res.error?.message ?? 'Could not delete engagement.')
    } catch {
      toastError('Error', 'Could not delete engagement.')
    }
  }

  async function handleGenerateInvoice(id: string): Promise<void> {
    setInvoiceError('')
    setGeneratingInvoiceId(id)
    const res = await api.engagement.generateInvoice({ id })
    if (res.success) {
      await loadEngagements()
    } else {
      setInvoiceError(res.error?.message ?? 'Could not generate invoice.')
    }
    setGeneratingInvoiceId(null)
  }

  const filtered = engagements.filter((e) => {
    if (!search) return true
    const q = search.toLowerCase()
    return e.title.toLowerCase().includes(q) || e.client.customerName.toLowerCase().includes(q)
  })

  const active = kpiEngagements.filter((e) => e.status === 'ACTIVE').length
  const monthly = kpiEngagements
    .filter((e) => e.status === 'ACTIVE' && e.feeType === 'RETAINER_MONTHLY' && e.feeAmount)
    .reduce((sum, e) => sum + Number(e.feeAmount), 0)
  const fixedActive = kpiEngagements
    .filter((e) => e.status === 'ACTIVE' && e.feeType === 'FIXED' && e.feeAmount)
    .reduce((sum, e) => sum + Number(e.feeAmount), 0)

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 px-6 py-4 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Engagements</h1>
              <p className="text-sm text-gray-500 dark:text-slate-400">Client retainers, audits, and advisory work</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => void loadEngagements()} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={openAddForm} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors" style={{ minHeight: 44 }}>
              <Plus className="w-4 h-4" />
              New Engagement
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <KpiCard label="Active Engagements" value={active} color="brand" />
          <KpiCard label="Monthly Retainer Revenue" value={`${fmtAmount(monthly)}/mo`} color="success" />
          <KpiCard label="Fixed Fee Pipeline" value={fmtAmount(fixedActive)} color="info" />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 px-6 py-3 flex items-center gap-3 flex-wrap dark:border-slate-700">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
          <input type="text" placeholder="Search engagements, clients..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
        </Select>
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {ENGAGEMENT_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
        </Select>
      </div>

      {invoiceError && (
        <div className="px-6 py-2 bg-red-50 border-b border-red-100 text-sm text-red-600">{invoiceError}</div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm dark:text-slate-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 dark:text-slate-500">
            <Briefcase className="w-12 h-12 opacity-30" />
            <p className="text-sm">No engagements found.</p>
            <button onClick={openAddForm} className="text-sm text-violet-600 hover:underline">Add your first engagement</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-white dark:bg-slate-900 border-b border-gray-200 sticky top-0 dark:border-slate-700">
              <tr>
                {['Client', 'Engagement', 'Type', 'Fee', 'Assigned CA', 'Period', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap dark:text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {filtered.map((eng) => (
                <tr key={eng.id} className="hover:bg-gray-50 transition-colors dark:hover:bg-slate-800">
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap dark:text-slate-100">{eng.client.customerName}</td>
                  <td className="px-4 py-3 text-gray-800 max-w-xs dark:text-slate-200">
                    <div className="font-medium">{eng.title}</div>
                    {eng.notes && <div className="text-xs text-gray-400 truncate max-w-48 dark:text-slate-500">{eng.notes}</div>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded text-xs bg-violet-50 text-violet-700 font-medium">{TYPE_LABELS[eng.engagementType] ?? eng.engagementType}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-slate-300">
                    <div>{eng.feeAmount != null ? fmtAmount(eng.feeAmount) : '—'}</div>
                    <div className="text-xs text-gray-400 dark:text-slate-500">{FEE_LABELS[eng.feeType]}</div>
                    {eng.billingDay && <div className="text-xs text-gray-400 dark:text-slate-500">Bill day: {eng.billingDay}</div>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-slate-400">{eng.staff?.fullName ?? <span className="text-gray-400 dark:text-slate-500">—</span>}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500 dark:text-slate-400">
                    <div>{fmtDate(eng.startDate)}</div>
                    {eng.endDate && <div>→ {fmtDate(eng.endDate)}</div>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant={STATUS_VARIANT[eng.status] ?? 'neutral'} size="sm">{eng.status.charAt(0) + eng.status.slice(1).toLowerCase()}</Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {eng.lastInvoicedPeriod !== currentPeriod && eng.feeAmount != null && eng.feeAmount > 0 && (
                        <button
                          onClick={() => void handleGenerateInvoice(eng.id)}
                          disabled={generatingInvoiceId === eng.id}
                          className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50 transition-colors disabled:opacity-50 dark:text-slate-500"
                          title={eng.lastInvoicedPeriod ? `Generate invoice for ${currentPeriod}` : 'Generate Invoice'}
                          style={{ minHeight: 32, minWidth: 32 }}
                        >
                          <Receipt className="w-4 h-4" />
                        </button>
                      )}
                      {eng.lastInvoicedPeriod === currentPeriod && (
                        <span className="text-xs text-green-600 font-medium px-1">Invoiced ({currentPeriod})</span>
                      )}
                      <button onClick={() => openEditForm(eng)} className="p-1.5 text-gray-400 hover:text-violet-600 rounded hover:bg-violet-50 transition-colors dark:text-slate-500" title="Edit" style={{ minHeight: 32, minWidth: 32 }}>
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => void handleDelete(eng.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors dark:text-slate-500" title="Delete" style={{ minHeight: 32, minWidth: 32 }}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">{editEng ? 'Edit Engagement' : 'New Engagement'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-3">
              {!editEng && (
                <Select label="Client" required value={formClientId} onChange={(e) => setFormClientId(e.target.value)}>
                  <option value="">Select client...</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.customerName}</option>)}
                </Select>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Engagement Title *</label>
                <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="e.g. GST Filing & Advisory Retainer FY 2026-27" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Select label="Engagement Type" value={formType} onChange={(e) => setFormType(e.target.value)}>
                  {ENGAGEMENT_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                </Select>
                <Select label="Assigned CA" value={formStaffId} onChange={(e) => setFormStaffId(e.target.value)}>
                  <option value="">— Unassigned —</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Select label="Fee Type" value={formFeeType} onChange={(e) => { setFormFeeType(e.target.value); if (e.target.value !== 'RETAINER_MONTHLY') setFormBillingDay('') }}>
                  {FEE_TYPES.map((t) => <option key={t} value={t}>{FEE_LABELS[t]}</option>)}
                </Select>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Fee Amount (₹)</label>
                  <input type="number" min="0.01" step="0.01" value={formFeeAmount} onChange={(e) => setFormFeeAmount(e.target.value)} placeholder="e.g. 12000" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
                </div>
              </div>

              {formFeeType === 'RETAINER_MONTHLY' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Billing Day of Month (1–28)</label>
                  <input type="number" min={1} max={28} value={formBillingDay} onChange={(e) => setFormBillingDay(e.target.value)} placeholder="e.g. 1 for 1st of month" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Start Date</label>
                  <input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">End Date</label>
                  <input type="date" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
                </div>
              </div>

              {editEng && (
                <Select label="Status" value={formStatus} onChange={(e) => setFormStatus(e.target.value)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
                </Select>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Notes</label>
                <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2} placeholder="Scope of work, special conditions..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
              </div>

              {editEng && <DocumentPanel entityType="ENGAGEMENT" entityId={editEng.id} compact />}
            </div>

            <div className="flex items-center justify-end gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800" style={{ minHeight: 44 }}>Cancel</button>
              <button onClick={() => void handleSave()} disabled={formSaving || !formClientId || !formTitle.trim()} className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" style={{ minHeight: 44 }}>
                {formSaving ? 'Saving...' : editEng ? 'Save Changes' : 'Create Engagement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
