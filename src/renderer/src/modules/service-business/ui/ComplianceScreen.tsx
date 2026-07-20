import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ClipboardList, Plus, X, Search, RefreshCw } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { cn } from '@shared/utils/cn'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { useNotificationStore } from '@app/store/notification.store'
import { DocumentPanel } from '@modules/documents/ui/DocumentPanel'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ComplianceEvent {
  id: string
  title: string
  category: string
  frequency: string
  applicableTo: string
  description: string | null
}

interface ComplianceTask {
  id: string
  complianceEventId: string | null
  clientId: string
  staffId: string | null
  title: string
  category: string
  dueDate: string
  status: string
  priority: string
  notes: string | null
  filedOn: string | null
  acknowledgmentNo: string | null
  client: { id: string; customerName: string; phone: string | null }
  staff: { id: string; fullName: string } | null
  event: { id: string; title: string; category: string; frequency: string } | null
}

interface Customer {
  id: string
  customerName: string
  phone: string | null
  lastAgmDate?: string | null
}

interface Employee {
  id: string
  fullName: string
}

interface ChecklistItem {
  id: string
  clientId: string
  documentType: string
  label: string | null
  status: string
  collectedDate: string | null
  notes: string | null
}

const CHECKLIST_DOCUMENT_TYPES = ['PAN', 'AADHAAR', 'BANK_STATEMENT', 'GST_CERTIFICATE', 'OTHER']
const CHECKLIST_TYPE_LABELS: Record<string, string> = {
  PAN: 'PAN Card', AADHAAR: 'Aadhaar Card', BANK_STATEMENT: 'Bank Statement', GST_CERTIFICATE: 'GST Certificate', OTHER: 'Other',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function localToday(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function daysUntil(iso: string): number {
  const due = new Date(iso)
  due.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((due.getTime() - today.getTime()) / 86400000)
}

function urgencyClass(iso: string, status: string): string {
  if (status === 'FILED' || status === 'DONE') return ''
  const d = daysUntil(iso)
  if (d < 0) return 'text-red-600 dark:text-red-400 font-semibold'
  if (d === 0) return 'text-red-600 dark:text-red-400 font-semibold'
  if (d <= 7) return 'text-amber-600 dark:text-amber-400 font-semibold'
  return ''
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending', IN_PROGRESS: 'In Progress', FILED: 'Filed', DONE: 'Done', OVERDUE: 'Overdue',
}
// Verified exhaustive against ComplianceTask.status in prisma/schema.prisma
// ("PENDING|IN_PROGRESS|FILED|DONE|OVERDUE") and src/main/services/compliance-task.service.ts,
// which only ever writes 'PENDING' on create and otherwise passes through the
// screen-constrained STATUSES list on update.
const STATUS_VARIANT: Record<string, 'neutral' | 'info' | 'success' | 'danger'> = {
  PENDING: 'neutral',
  IN_PROGRESS: 'info',
  FILED: 'success',
  DONE: 'success',
  OVERDUE: 'danger',
}
// Verified exhaustive against ComplianceTask.priority in prisma/schema.prisma ("LOW|NORMAL|HIGH|URGENT").
const PRIORITY_VARIANT: Record<string, 'neutral' | 'info' | 'warning' | 'danger'> = {
  LOW: 'neutral',
  NORMAL: 'info',
  HIGH: 'warning',
  URGENT: 'danger',
}
const CATEGORIES = ['INCOME_TAX', 'GST', 'TDS', 'ROC', 'MCA', 'AUDIT', 'OTHER']
const STATUSES = ['PENDING', 'IN_PROGRESS', 'FILED', 'DONE', 'OVERDUE']
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT']

// ── Component ─────────────────────────────────────────────────────────────────

export default function ComplianceScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const { error: toastError } = useNotificationStore()
  const [tasks, setTasks] = useState<ComplianceTask[]>([])
  const [kpiTasks, setKpiTasks] = useState<ComplianceTask[]>([])
  const [clients, setClients] = useState<Customer[]>([])
  const [staff, setStaff] = useState<Employee[]>([])
  const [events, setEvents] = useState<ComplianceEvent[]>([])
  const [loading, setLoading] = useState(false)

  // filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [clientFilter, setClientFilter] = useState('')

  // add/edit form
  const [showForm, setShowForm] = useState(false)
  const [editTask, setEditTask] = useState<ComplianceTask | null>(null)
  const [formClientId, setFormClientId] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formCategory, setFormCategory] = useState('INCOME_TAX')
  const [formDueDate, setFormDueDate] = useState('')
  const [formPriority, setFormPriority] = useState('NORMAL')
  const [formStaffId, setFormStaffId] = useState('')
  const [formEventId, setFormEventId] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formSaving, setFormSaving] = useState(false)

  // update status modal
  const [updateTask, setUpdateTask] = useState<ComplianceTask | null>(null)
  const [updateStatus, setUpdateStatus] = useState('')
  const [updateFiledOn, setUpdateFiledOn] = useState('')
  const [updateAckNo, setUpdateAckNo] = useState('')
  const [updateSaving, setUpdateSaving] = useState(false)

  // Clients modal (Phase 58 §2) — AGM date capture (feeds AGM-relative ROC
  // event auto-generation) + per-client document checklist.
  const [showClientsModal, setShowClientsModal] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null)
  const [agmDateInput, setAgmDateInput] = useState('')
  const [agmSaving, setAgmSaving] = useState(false)
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([])
  const [checklistLoading, setChecklistLoading] = useState(false)
  const [newChecklistType, setNewChecklistType] = useState('PAN')
  const [checklistSaving, setChecklistSaving] = useState(false)
  const [checklistError, setChecklistError] = useState('')

  const loadTasks = useCallback(async () => {
    setLoading(true)
    try {
      const filters: Record<string, unknown> = {}
      if (statusFilter) filters.status = statusFilter
      if (categoryFilter) filters.category = categoryFilter
      if (clientFilter) filters.clientId = clientFilter
      const [res, kpiRes] = await Promise.all([
        api.complianceTask.list(filters),
        api.complianceTask.list({}),
      ])
      if (res.success) setTasks(res.data as ComplianceTask[])
      else toastError('Error', res.error?.message ?? 'Could not load compliance tasks.')
      if (kpiRes.success) setKpiTasks(kpiRes.data as ComplianceTask[])
    } catch {
      toastError('Error', 'Could not load compliance tasks.')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, categoryFilter, clientFilter, toastError])

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

  const loadEvents = useCallback(async () => {
    try {
      const res = await api.complianceEvent.list({ isActive: true })
      if (res.success) setEvents(res.data as ComplianceEvent[])
    } catch { /* form-dropdown data is supplementary */ }
  }, [])

  useEffect(() => {
    void loadTasks()
    void loadClients()
    void loadStaff()
    void loadEvents()
  }, [loadTasks, loadClients, loadStaff, loadEvents])

  function openAddForm(): void {
    setEditTask(null)
    setFormClientId('')
    setFormTitle('')
    setFormCategory('INCOME_TAX')
    setFormDueDate('')
    setFormPriority('NORMAL')
    setFormStaffId('')
    setFormEventId('')
    setFormNotes('')
    setShowForm(true)
  }

  function openEditForm(t: ComplianceTask): void {
    setEditTask(t)
    setFormClientId(t.clientId)
    setFormTitle(t.title)
    setFormCategory(t.category)
    setFormDueDate(t.dueDate.slice(0, 10))
    setFormPriority(t.priority)
    setFormStaffId(t.staffId ?? '')
    setFormEventId(t.complianceEventId ?? '')
    setFormNotes(t.notes ?? '')
    setShowForm(true)
  }

  function fillFromEvent(evId: string): void {
    setFormEventId(evId)
    const ev = events.find((e) => e.id === evId)
    if (ev) {
      setFormTitle(ev.title)
      setFormCategory(ev.category)
    }
  }

  async function handleSaveTask(): Promise<void> {
    if (!formClientId || !formTitle.trim() || !formDueDate) return
    setFormSaving(true)
    try {
      let res
      if (editTask) {
        res = await api.complianceTask.update({
          id: editTask.id,
          title: formTitle.trim(),
          category: formCategory,
          dueDate: formDueDate,
          priority: formPriority,
          staffId: formStaffId || null,
          notes: formNotes || null,
        })
      } else {
        res = await api.complianceTask.create({
          clientId: formClientId,
          complianceEventId: formEventId || undefined,
          title: formTitle.trim(),
          category: formCategory,
          dueDate: formDueDate,
          priority: formPriority,
          staffId: formStaffId || undefined,
          notes: formNotes || undefined,
        })
      }
      if (res.success) {
        setShowForm(false)
        await loadTasks()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setFormSaving(false)
    }
  }

  async function handleDeleteTask(id: string): Promise<void> {
    try {
      const res = await api.complianceTask.delete({ id })
      if (res.success) await loadTasks()
      else toastError(t('common.error'), res.error?.message ?? t('common.error'))
    } catch {
      toastError(t('common.error'), t('common.error'))
    }
  }

  function openUpdateModal(t: ComplianceTask): void {
    setUpdateTask(t)
    setUpdateStatus(t.status)
    setUpdateFiledOn(t.filedOn ? t.filedOn.slice(0, 10) : '')
    setUpdateAckNo(t.acknowledgmentNo ?? '')
  }

  async function handleUpdateStatus(): Promise<void> {
    if (!updateTask) return
    setUpdateSaving(true)
    try {
      const isClosed = updateStatus === 'FILED' || updateStatus === 'DONE'
      const res = await api.complianceTask.update({
        id: updateTask.id,
        status: updateStatus,
        filedOn: isClosed ? (updateFiledOn || null) : null,
        acknowledgmentNo: isClosed ? (updateAckNo || null) : null,
      })
      if (res.success) {
        setUpdateTask(null)
        await loadTasks()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setUpdateSaving(false)
    }
  }

  // ── Clients modal handlers (Phase 58 §2) ────────────────────────────────

  async function loadChecklist(clientId: string): Promise<void> {
    setChecklistLoading(true)
    try {
      const res = await api.clientDocumentChecklist.list({ clientId })
      if (res.success) setChecklistItems(res.data as ChecklistItem[])
      else toastError('Error', res.error?.message ?? 'Could not load checklist.')
    } catch {
      toastError('Error', 'Could not load checklist.')
    } finally {
      setChecklistLoading(false)
    }
  }

  function toggleClientExpanded(c: Customer): void {
    if (expandedClientId === c.id) {
      setExpandedClientId(null)
      return
    }
    setExpandedClientId(c.id)
    setAgmDateInput(c.lastAgmDate ? c.lastAgmDate.slice(0, 10) : '')
    setChecklistError('')
    void loadChecklist(c.id)
  }

  async function handleSaveAgmDate(clientId: string): Promise<void> {
    setAgmSaving(true)
    try {
      const res = await api.complianceEvent.setClientAgmDate({ clientId, agmDate: agmDateInput || null })
      if (res.success) {
        await loadClients()
      } else {
        toastError('Error', res.error?.message ?? 'Could not save AGM date.')
      }
    } catch {
      toastError('Error', 'Could not save AGM date.')
    } finally {
      setAgmSaving(false)
    }
  }

  async function handleAddChecklistItem(clientId: string): Promise<void> {
    setChecklistSaving(true)
    setChecklistError('')
    try {
      const res = await api.clientDocumentChecklist.add({ clientId, documentType: newChecklistType })
      if (res.success) await loadChecklist(clientId)
      else setChecklistError(res.error?.message ?? 'Could not add checklist item.')
    } catch {
      setChecklistError('Could not add checklist item.')
    } finally {
      setChecklistSaving(false)
    }
  }

  async function handleSeedStandardChecklist(clientId: string): Promise<void> {
    setChecklistSaving(true)
    setChecklistError('')
    try {
      const res = await api.clientDocumentChecklist.seedStandard({ clientId })
      if (res.success) await loadChecklist(clientId)
      else setChecklistError(res.error?.message ?? 'Could not seed checklist.')
    } catch {
      setChecklistError('Could not seed checklist.')
    } finally {
      setChecklistSaving(false)
    }
  }

  async function handleToggleChecklistStatus(item: ChecklistItem): Promise<void> {
    const res = await api.clientDocumentChecklist.update({ id: item.id, status: item.status === 'COLLECTED' ? 'PENDING' : 'COLLECTED' })
    if (res.success) await loadChecklist(item.clientId)
    else toastError('Error', res.error?.message ?? 'Could not update checklist item.')
  }

  async function handleRemoveChecklistItem(item: ChecklistItem): Promise<void> {
    const res = await api.clientDocumentChecklist.remove({ id: item.id })
    if (res.success) await loadChecklist(item.clientId)
    else toastError('Error', res.error?.message ?? 'Could not remove checklist item.')
  }

  const filtered = tasks.filter((t) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      t.title.toLowerCase().includes(q) ||
      t.client.customerName.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
    )
  })

  // KPIs — always draw from unfiltered kpiTasks so counts stay stable when display filters are applied
  const today = localToday()
  const overdueCount = kpiTasks.filter((t) => !['FILED', 'DONE'].includes(t.status) && t.dueDate.slice(0, 10) < today).length
  const dueTodayCount = kpiTasks.filter((t) => !['FILED', 'DONE'].includes(t.status) && t.dueDate.slice(0, 10) === today).length
  const dueWeekCount = kpiTasks.filter((t) => { const d = daysUntil(t.dueDate); return !['FILED', 'DONE'].includes(t.status) && d > 0 && d <= 7 }).length
  const doneCount = kpiTasks.filter((t) => t.status === 'FILED' || t.status === 'DONE').length

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 px-6 py-4 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Compliance Tasks</h1>
              <p className="text-sm text-gray-500 dark:text-slate-400">Deadline tracker across all clients</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => void loadTasks()} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => { setShowClientsModal(true); setExpandedClientId(null); setClientSearch('') }} className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" style={{ minHeight: 44 }}>
              Clients &amp; Checklists
            </button>
            <button onClick={openAddForm} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors" style={{ minHeight: 44 }}>
              <Plus className="w-4 h-4" />
              Add Task
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          <KpiCard label="Overdue" value={overdueCount} color="danger" />
          <KpiCard label="Due Today" value={dueTodayCount} color="warning" />
          <KpiCard label="Due in 7 Days" value={dueWeekCount} color="info" />
          <KpiCard label="Filed / Done" value={doneCount} color="success" />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 px-6 py-3 flex items-center gap-3 flex-wrap dark:border-slate-700">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search tasks, clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
            style={{ minHeight: 48 }}
          />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </Select>
        <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
        </Select>
        <Select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
          <option value="">All Clients</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.customerName}</option>)}
        </Select>
      </div>

      {/* Task Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm dark:text-slate-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 dark:text-slate-500">
            <ClipboardList className="w-12 h-12 opacity-30" />
            <p className="text-sm">No compliance tasks found.</p>
            <button onClick={openAddForm} className="text-sm text-indigo-600 hover:underline">Add your first task</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-white dark:bg-slate-900 border-b border-gray-200 sticky top-0 dark:border-slate-700">
              <tr>
                {['Due Date', 'Client', 'Task', 'Category', 'Priority', 'Assigned To', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap dark:text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {filtered.map((task) => {
                const days = daysUntil(task.dueDate)
                const isOpen = !['FILED', 'DONE'].includes(task.status)
                return (
                <tr key={task.id} className="hover:bg-gray-50 transition-colors dark:hover:bg-slate-800">
                  <td className={cn('px-4 py-3 whitespace-nowrap', urgencyClass(task.dueDate, task.status))}>
                    {fmtDate(task.dueDate)}
                    {isOpen && days < 0 && (
                      <span className="ml-1 text-xs text-red-500">({Math.abs(days)}d overdue)</span>
                    )}
                    {isOpen && days >= 0 && days <= 7 && (
                      <span className="ml-1 text-xs text-amber-500">({days}d left)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-slate-100">{task.client.customerName}</td>
                  <td className="px-4 py-3 text-gray-800 max-w-xs dark:text-slate-200">
                    <div>{task.title}</div>
                    {task.acknowledgmentNo && <div className="text-xs text-gray-400 dark:text-slate-500">Ack: {task.acknowledgmentNo}</div>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant="neutral" size="sm">{task.category.replace('_', ' ')}</Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant={PRIORITY_VARIANT[task.priority] ?? 'neutral'} size="sm">{task.priority}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap dark:text-slate-400">{task.staff?.fullName ?? <span className="text-gray-400 dark:text-slate-500">—</span>}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant={STATUS_VARIANT[task.status] ?? 'neutral'} size="sm">
                      {STATUS_LABELS[task.status] ?? task.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openUpdateModal(task)} className="px-2 py-1 text-xs bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100 transition-colors" style={{ minHeight: 28 }}>
                        Update
                      </button>
                      <button onClick={() => openEditForm(task)} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-600" style={{ minHeight: 28 }}>
                        Edit
                      </button>
                      <button onClick={() => void handleDeleteTask(task.id)} className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors" style={{ minHeight: 28 }}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        )}
      </div>

      {/* Section 1.6 — Compliance dates disclaimer */}
      <div className="px-6 py-3 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
        <strong>{t('compliance.disclaimerLabel')}</strong> {t('compliance.disclaimerText')}
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">{editTask ? 'Edit Task' : 'Add Compliance Task'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"><X className="w-4 h-4" /></button>
            </div>

            {/* From Template */}
            {!editTask && events.length > 0 && (
              <div className="mb-4">
                <Select label="From Compliance Library (optional)" value={formEventId} onChange={(e) => fillFromEvent(e.target.value)}>
                  <option value="">— Select to auto-fill title & category —</option>
                  {CATEGORIES.map((cat) => {
                    const catEvents = events.filter((e) => e.category === cat)
                    if (!catEvents.length) return null
                    return (
                      <optgroup key={cat} label={cat.replace('_', ' ')}>
                        {catEvents.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                      </optgroup>
                    )
                  })}
                </Select>
              </div>
            )}

            <div className="space-y-3">
              {!editTask && (
                <Select label="Client *" required value={formClientId} onChange={(e) => setFormClientId(e.target.value)}>
                  <option value="">Select client...</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.customerName}</option>)}
                </Select>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Task Title *</label>
                <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="e.g. GSTR-3B Filing — July 2026" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Select label="Category" value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                </Select>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Due Date *</label>
                  <input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Select label="Priority" value={formPriority} onChange={(e) => setFormPriority(e.target.value)}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </Select>
                <Select label="Assign To" value={formStaffId} onChange={(e) => setFormStaffId(e.target.value)}>
                  <option value="">— Unassigned —</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Notes</label>
                <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2} placeholder="Optional notes..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800" style={{ minHeight: 44 }}>Cancel</button>
              <button onClick={() => void handleSaveTask()} disabled={formSaving || !formClientId || !formTitle.trim() || !formDueDate} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" style={{ minHeight: 44 }}>
                {formSaving ? 'Saving...' : editTask ? 'Save Changes' : 'Add Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {updateTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Update Status</h2>
              <button onClick={() => setUpdateTask(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-gray-600 mb-4 dark:text-slate-400">{updateTask.title} — {updateTask.client.customerName}</p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setUpdateStatus(s)}
                      className={cn('px-3 py-2 rounded-lg text-xs font-medium border transition-colors', updateStatus === s ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}
                      style={{ minHeight: 40 }}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              {(updateStatus === 'FILED' || updateStatus === 'DONE') && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Filed On</label>
                    <input type="date" value={updateFiledOn} onChange={(e) => setUpdateFiledOn(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Acknowledgment No.</label>
                    <input type="text" value={updateAckNo} onChange={(e) => setUpdateAckNo(e.target.value)} placeholder="e.g. ACK-2026-XXXXXXXXX" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
                  </div>
                </>
              )}

              <DocumentPanel entityType="COMPLIANCE_TASK" entityId={updateTask.id} compact />
            </div>

            <div className="flex items-center justify-end gap-3 mt-5">
              <button onClick={() => setUpdateTask(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800" style={{ minHeight: 44 }}>Cancel</button>
              <button onClick={() => void handleUpdateStatus()} disabled={updateSaving} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors" style={{ minHeight: 44 }}>
                {updateSaving ? 'Saving...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Clients & Checklists modal (Phase 58 §2) ─────────────────────── */}
      {showClientsModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Clients & Checklists</h2>
                <p className="text-xs text-gray-500 dark:text-slate-400">Capture each company client's AGM date to auto-generate MGT-7/AOC-4/ADT-1 tasks, and track document collection.</p>
              </div>
              <button onClick={() => setShowClientsModal(false)} className="text-gray-400 hover:text-gray-700 dark:text-slate-500 dark:hover:text-slate-200"><X size={18} /></button>
            </div>
            <div className="px-6 py-3 border-b border-gray-200 dark:border-slate-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Search clients..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                  style={{ minHeight: 44 }}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
              {clients
                .filter((c) => !clientSearch.trim() || c.customerName.toLowerCase().includes(clientSearch.toLowerCase()))
                .map((c) => (
                  <div key={c.id} className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleClientExpanded(c)}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-slate-800"
                    >
                      <div>
                        <span className="text-sm font-medium text-gray-900 dark:text-slate-100">{c.customerName}</span>
                        {c.lastAgmDate && <span className="ml-2 text-xs text-gray-400 dark:text-slate-500">AGM: {fmtDate(c.lastAgmDate)}</span>}
                      </div>
                      <span className="text-xs text-indigo-600">{expandedClientId === c.id ? 'Hide' : 'Manage'}</span>
                    </button>

                    {expandedClientId === c.id && (
                      <div className="px-3 py-3 border-t border-gray-100 dark:border-slate-800 space-y-4 bg-gray-50/50 dark:bg-slate-950/40">
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">Last AGM Date</label>
                          <div className="flex items-center gap-2">
                            <input type="date" value={agmDateInput} onChange={(e) => setAgmDateInput(e.target.value)} className="flex-1 h-9 px-2 border border-gray-300 rounded-lg text-xs dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                            <button onClick={() => void handleSaveAgmDate(c.id)} disabled={agmSaving} className="h-9 px-3 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50">
                              {agmSaving ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">MGT-7 (+60d), AOC-4 (+30d), and ADT-1 (+15d) tasks are auto-generated from this date.</p>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Document Checklist</label>
                            <button onClick={() => void handleSeedStandardChecklist(c.id)} disabled={checklistSaving} className="text-xs text-indigo-600 hover:underline disabled:opacity-50">Add Standard Checklist</button>
                          </div>
                          {checklistError && <div className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-1.5 mb-2">{checklistError}</div>}
                          {checklistLoading ? (
                            <div className="text-xs text-gray-400 dark:text-slate-500">Loading...</div>
                          ) : checklistItems.length === 0 ? (
                            <div className="text-xs text-gray-400 dark:text-slate-500">No checklist items yet.</div>
                          ) : (
                            <div className="space-y-1">
                              {checklistItems.map((item) => (
                                <div key={item.id} className="flex items-center justify-between text-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded px-2.5 py-1.5">
                                  <span className="text-gray-800 dark:text-slate-200">{CHECKLIST_TYPE_LABELS[item.documentType] ?? item.documentType}{item.label ? ` — ${item.label}` : ''}</span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => void handleToggleChecklistStatus(item)}
                                      className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', item.status === 'COLLECTED' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800')}
                                    >
                                      {item.status === 'COLLECTED' ? 'Collected' : 'Pending'}
                                    </button>
                                    <button onClick={() => void handleRemoveChecklistItem(item)} className="text-gray-400 hover:text-red-600"><X size={12} /></button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Select value={newChecklistType} onChange={(e) => setNewChecklistType(e.target.value)} className="flex-1 h-9 text-xs">
                              {CHECKLIST_DOCUMENT_TYPES.map((dt) => <option key={dt} value={dt}>{CHECKLIST_TYPE_LABELS[dt]}</option>)}
                            </Select>
                            <button onClick={() => void handleAddChecklistItem(c.id)} disabled={checklistSaving} className="h-9 px-3 rounded-lg border border-gray-300 dark:border-slate-600 text-xs font-medium hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-50">
                              {checklistSaving ? 'Adding...' : 'Add'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
