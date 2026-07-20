import React, { useEffect, useState, useCallback } from 'react'
import { Clock, Plus, X, Search, RefreshCw, Edit2, Trash2, CheckCircle, Receipt } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { cn } from '@shared/utils/cn'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { useNotificationStore } from '@app/store/notification.store'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TimeEntry {
  id: string
  employeeId: string | null
  caseId: string | null
  projectId: string | null
  retainerId: string | null
  date: string
  description: string
  hours: number
  ratePerHour: number
  amount: number
  isBilled: boolean
  employee: { id: string; fullName: string } | null
  case: { id: string; caseNumber: string; caseTitle: string } | null
  project: { id: string; projectName: string } | null
  retainer: { id: string; title: string } | null
}

interface Employee {
  id: string
  fullName: string
}

interface ServiceProject {
  id: string
  projectName: string
}

// Phase 58 §1 — only HOURLY_BUCKET retainers are relevant here; FIXED_FEE/
// DELIVERABLE_BASED retainers have nothing for a logged hour to count against.
interface HourlyRetainer {
  id: string
  title: string
  retainerType: string
  client: { customerName: string }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtAmt(n: number): string {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function currentMonthRange(): { from: string; to: string } {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth()
  const from = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const lastDay = new Date(y, m + 1, 0).getDate()
  const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { from, to }
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TimeEntryScreen(): React.JSX.Element {
  const { error: toastError } = useNotificationStore()
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [kpiEntries, setKpiEntries] = useState<TimeEntry[]>([])
  const [staff, setStaff] = useState<Employee[]>([])
  const [projects, setProjects] = useState<ServiceProject[]>([])
  const [hourlyRetainers, setHourlyRetainers] = useState<HourlyRetainer[]>([])
  const [loading, setLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Invoice generation
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [invoiceError, setInvoiceError] = useState('')
  const [invoiceSuccess, setInvoiceSuccess] = useState('')
  const [generating, setGenerating] = useState(false)

  // Filters — default to current month
  const [search, setSearch] = useState('')
  const [staffFilter, setStaffFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [billedFilter, setBilledFilter] = useState('')
  const [fromDate, setFromDate] = useState(() => currentMonthRange().from)
  const [toDate, setToDate] = useState(() => currentMonthRange().to)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null)
  const [formDate, setFormDate] = useState('')
  const [formStaffId, setFormStaffId] = useState('')
  const [formProjectId, setFormProjectId] = useState('')
  const [formRetainerId, setFormRetainerId] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formHours, setFormHours] = useState('')
  const [formRate, setFormRate] = useState('')
  const [formSaving, setFormSaving] = useState(false)

  const loadEntries = useCallback(async () => {
    setLoading(true)
    try {
      const filters: Record<string, unknown> = {}
      if (staffFilter) filters.employeeId = staffFilter
      if (projectFilter) filters.projectId = projectFilter
      if (billedFilter !== '') filters.isBilled = billedFilter === 'true'
      if (fromDate) filters.fromDate = fromDate
      if (toDate) filters.toDate = toDate
      const { from: kpiFrom, to: kpiTo } = currentMonthRange()
      const [res, kpiRes] = await Promise.all([
        api.timeEntry.list(filters),
        api.timeEntry.list({ fromDate: kpiFrom, toDate: kpiTo }),
      ])
      if (res.success) setEntries(res.data as TimeEntry[])
      else toastError('Error', res.error?.message ?? 'Could not load time entries.')
      if (kpiRes.success) setKpiEntries(kpiRes.data as TimeEntry[])
    } catch {
      toastError('Error', 'Could not load time entries.')
    } finally {
      setLoading(false)
    }
  }, [staffFilter, projectFilter, billedFilter, fromDate, toDate, toastError])

  const loadStaticData = useCallback(async () => {
    try {
      const [staffRes, projRes, retainerRes] = await Promise.all([
        api.hr.listEmployees({ isActive: true }),
        api.serviceProject.list({}),
        api.retainer.list({ status: 'ACTIVE' }),
      ])
      if (staffRes.success) setStaff((staffRes.data as { employees: Employee[] }).employees ?? [])
      if (projRes.success) {
        const raw = projRes.data as ServiceProject[] | { projects?: ServiceProject[] }
        setProjects(Array.isArray(raw) ? raw : (raw.projects ?? []))
      }
      if (retainerRes.success) {
        const all = retainerRes.data as HourlyRetainer[]
        setHourlyRetainers(all.filter((r) => r.retainerType === 'HOURLY_BUCKET'))
      }
    } catch { /* staff/project/retainer pickers are supplementary — entries list itself already surfaces errors */ }
  }, [])

  useEffect(() => {
    void loadEntries()
    void loadStaticData()
  }, [loadEntries, loadStaticData])

  // Keep the selection in sync with reality: whenever the entry list is
  // reloaded (a hard filter changed, or an entry got marked billed via its
  // own row action), drop any selected id that's no longer a selectable
  // (unbilled, still-present) entry — otherwise "Generate Invoice (N)" could
  // silently include an entry the user can no longer see or that's already
  // billed.
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev
      const stillSelectable = new Set(entries.filter((e) => !e.isBilled).map((e) => e.id))
      const next = new Set([...prev].filter((id) => stillSelectable.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [entries])

  function openAddForm(): void {
    setEditEntry(null)
    setFormDate(todayStr())
    setFormStaffId('')
    setFormProjectId('')
    setFormRetainerId('')
    setFormDesc('')
    setFormHours('')
    setFormRate('')
    setDeleteError('')
    setShowForm(true)
  }

  function openEditForm(e: TimeEntry): void {
    setEditEntry(e)
    setFormDate(e.date.slice(0, 10))
    setFormStaffId(e.employeeId ?? '')
    setFormProjectId(e.projectId ?? '')
    setFormRetainerId(e.retainerId ?? '')
    setFormDesc(e.description)
    setFormHours(String(e.hours))
    setFormRate(String(e.ratePerHour))
    setDeleteError('')
    setShowForm(true)
  }

  async function handleSave(): Promise<void> {
    if (!formDate || !formDesc.trim() || !formHours) return
    setFormSaving(true)
    try {
      const hours = Number(formHours)
      const rate = formRate ? Number(formRate) : 0
      let res
      if (editEntry) {
        res = await api.timeEntry.update({
          id: editEntry.id,
          date: formDate,
          description: formDesc.trim(),
          hours,
          ratePerHour: rate,
        })
      } else {
        res = await api.timeEntry.create({
          employeeId: formStaffId || undefined,
          projectId: formProjectId || undefined,
          retainerId: formRetainerId || undefined,
          date: formDate,
          description: formDesc.trim(),
          hours,
          ratePerHour: rate,
        })
      }
      if (res.success) { setShowForm(false); await loadEntries() }
      else toastError('Error', res.error?.message ?? 'Could not save time entry.')
    } catch {
      toastError('Error', 'Could not save time entry.')
    } finally {
      setFormSaving(false)
    }
  }

  async function handleDelete(e: TimeEntry): Promise<void> {
    setDeleteError('')
    try {
      const res = await api.timeEntry.delete({ id: e.id })
      if (res.success) {
        await loadEntries()
      } else {
        setDeleteError(res.error?.message ?? 'Could not delete entry.')
      }
    } catch {
      setDeleteError('Could not delete entry.')
    }
  }

  async function handleMarkBilled(e: TimeEntry): Promise<void> {
    try {
      const res = await api.timeEntry.markBilled({ ids: [e.id] })
      if (res.success) await loadEntries()
      else toastError('Error', res.error?.message ?? 'Could not mark entry as billed.')
    } catch {
      toastError('Error', 'Could not mark entry as billed.')
    }
  }

  function toggleSelected(id: string): void {
    setInvoiceError('')
    setInvoiceSuccess('')
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleGenerateInvoice(): Promise<void> {
    if (selectedIds.size === 0) return
    setGenerating(true)
    setInvoiceError('')
    setInvoiceSuccess('')
    try {
      const res = await api.timeEntry.generateInvoice({ ids: [...selectedIds] })
      if (res.success) {
        setInvoiceSuccess('Invoice generated successfully.')
        setSelectedIds(new Set())
        await loadEntries()
      } else {
        setInvoiceError(res.error?.message ?? 'Could not generate invoice.')
      }
    } catch {
      setInvoiceError('Could not generate invoice.')
    } finally {
      setGenerating(false)
    }
  }

  const filtered = entries.filter((e) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      e.description.toLowerCase().includes(q) ||
      (e.employee?.fullName ?? '').toLowerCase().includes(q) ||
      (e.project?.projectName ?? '').toLowerCase().includes(q)
    )
  })

  // KPIs always from current month (kpiEntries), not affected by display filters
  const totalHours  = kpiEntries.reduce((s, e) => s + Number(e.hours), 0)
  const unbilledHrs = kpiEntries.filter((e) => !e.isBilled).reduce((s, e) => s + Number(e.hours), 0)
  const unbilledAmt = kpiEntries.filter((e) => !e.isBilled).reduce((s, e) => s + Number(e.amount), 0)

  const previewAmt = formHours && formRate
    ? Math.round(Number(formHours) * Number(formRate) * 100) / 100
    : null

  const hasProjects = projects.length > 0

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 px-6 py-4 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
              <Clock className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Time Tracking</h1>
              <p className="text-sm text-gray-500 dark:text-slate-400">Log and track billable hours for staff</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <button
                onClick={() => void handleGenerateInvoice()}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{ minHeight: 44 }}
              >
                <Receipt className="w-4 h-4" />
                {generating ? 'Generating...' : `Generate Invoice (${selectedIds.size})`}
              </button>
            )}
            <button onClick={() => void loadEntries()} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={openAddForm} className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors" style={{ minHeight: 44 }}>
              <Plus className="w-4 h-4" />
              Log Hours
            </button>
          </div>
        </div>

        {/* KPIs — always current month */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <KpiCard label="Hours This Month" value={`${totalHours.toFixed(1)}h`} color="neutral" />
          <KpiCard label="Unbilled Hours" value={`${unbilledHrs.toFixed(1)}h`} color="warning" />
          <KpiCard label="Unbilled Amount" value={fmtAmt(unbilledAmt)} color="success" />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 px-6 py-3 flex items-center gap-3 flex-wrap dark:border-slate-700">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
          <input type="text" placeholder="Search description, staff or project..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
        </div>
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
        <Select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
          <option value="">All Staff</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
        </Select>
        {hasProjects && (
          <Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
            <option value="">All Projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.projectName}</option>)}
          </Select>
        )}
        <Select value={billedFilter} onChange={(e) => setBilledFilter(e.target.value)}>
          <option value="">All Entries</option>
          <option value="false">Unbilled</option>
          <option value="true">Billed</option>
        </Select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm dark:text-slate-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 dark:text-slate-500">
            <Clock className="w-12 h-12 opacity-30" />
            <p className="text-sm">No time entries found.</p>
            <button onClick={openAddForm} className="text-sm text-slate-600 dark:text-slate-300 hover:underline">Log your first entry</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-white dark:bg-slate-900 border-b border-gray-200 sticky top-0 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3 w-10"></th>
                {['Date', 'Staff', 'Description', 'Hours', 'Rate/hr', 'Amount', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap dark:text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {filtered.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50 transition-colors dark:hover:bg-slate-800">
                  <td className="px-4 py-3">
                    {!entry.isBilled && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(entry.id)}
                        onChange={() => toggleSelected(entry.id)}
                        className="w-4 h-4 rounded border-gray-300 text-slate-700 focus:ring-slate-500"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-slate-300">{fmtDate(entry.date)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-slate-300">{entry.employee?.fullName ?? <span className="text-gray-400 dark:text-slate-500">—</span>}</td>
                  <td className="px-4 py-3 text-gray-800 max-w-xs dark:text-slate-200">
                    <div>{entry.description}</div>
                    {entry.case && <div className="text-xs text-gray-400 dark:text-slate-500">{entry.case.caseNumber} — {entry.case.caseTitle}</div>}
                    {entry.project && <div className="text-xs text-gray-400 dark:text-slate-500">{entry.project.projectName}</div>}
                    {entry.retainer && <div className="text-xs text-indigo-500 dark:text-indigo-400">Retainer: {entry.retainer.title}</div>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-slate-100">{Number(entry.hours).toFixed(1)}h</td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-slate-400">₹{Number(entry.ratePerHour).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-slate-100">{fmtAmt(Number(entry.amount))}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant={entry.isBilled ? 'success' : 'warning'} size="sm">
                      {entry.isBilled ? 'Billed' : 'Unbilled'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {!entry.isBilled && (
                        <button onClick={() => void handleMarkBilled(entry)} title="Mark as Billed" className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50 transition-colors dark:text-slate-500" style={{ minHeight: 32, minWidth: 32 }}>
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => { if (!entry.isBilled) openEditForm(entry) }}
                        title={entry.isBilled ? 'Cannot edit billed entry' : 'Edit'}
                        className={cn('p-1.5 rounded transition-colors', entry.isBilled ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700')}
                        style={{ minHeight: 32, minWidth: 32 }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { if (!entry.isBilled) void handleDelete(entry) }}
                        title={entry.isBilled ? 'Cannot delete billed entry' : 'Delete'}
                        className={cn('p-1.5 rounded transition-colors', entry.isBilled ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:text-red-600 hover:bg-red-50')}
                        style={{ minHeight: 32, minWidth: 32 }}
                      >
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

      {deleteError && (
        <div className="px-6 py-3 bg-red-50 border-t border-red-100 text-sm text-red-600">{deleteError}</div>
      )}
      {invoiceError && (
        <div className="px-6 py-3 bg-red-50 border-t border-red-100 text-sm text-red-600">{invoiceError}</div>
      )}
      {invoiceSuccess && (
        <div className="px-6 py-3 bg-green-50 border-t border-green-100 text-sm text-green-700">{invoiceSuccess}</div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">{editEntry ? 'Edit Time Entry' : 'Log Hours'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Date *</label>
                  <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
                </div>
                <div>
                  <Select label="Staff" value={formStaffId} onChange={(e) => setFormStaffId(e.target.value)}>
                    <option value="">— Unassigned —</option>
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                  </Select>
                </div>
              </div>

              {hasProjects && !editEntry && (
                <div>
                  <Select label="Project" value={formProjectId} onChange={(e) => setFormProjectId(e.target.value)}>
                    <option value="">— No Project —</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.projectName}</option>)}
                  </Select>
                </div>
              )}

              {hourlyRetainers.length > 0 && !editEntry && (
                <div>
                  <Select label="Retainer (Hourly Bucket)" value={formRetainerId} onChange={(e) => setFormRetainerId(e.target.value)}>
                    <option value="">— No Retainer —</option>
                    {hourlyRetainers.map((r) => <option key={r.id} value={r.id}>{r.title} — {r.client.customerName}</option>)}
                  </Select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Description *</label>
                <input type="text" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="e.g. Site visit — Phase 2 structural review" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Hours *</label>
                  <input type="number" min="0.1" step="0.1" max="24" value={formHours} onChange={(e) => setFormHours(e.target.value)} placeholder="e.g. 2.5" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Rate / hr (₹)</label>
                  <input type="number" min="0" value={formRate} onChange={(e) => setFormRate(e.target.value)} placeholder="e.g. 2000" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
                </div>
              </div>

              {previewAmt !== null && (
                <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-300 font-medium">
                  Amount: {fmtAmt(previewAmt)}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800" style={{ minHeight: 44 }}>Cancel</button>
              <button
                onClick={() => void handleSave()}
                disabled={formSaving || !formDate || !formDesc.trim() || !formHours || Number(formHours) <= 0}
                className="px-4 py-2 text-sm bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{ minHeight: 44 }}
              >
                {formSaving ? 'Saving...' : editEntry ? 'Save Changes' : 'Log Hours'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
