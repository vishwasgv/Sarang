import React, { useEffect, useState, useCallback } from 'react'
import { Target, Plus, X, Search, RefreshCw, Edit2, Trash2 } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { cn } from '@shared/utils/cn'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { Select } from '@shared/ui/atoms/Select'
import { useNotificationStore } from '@app/store/notification.store'

interface Lead {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  companyName: string | null
  source: string
  status: string
  estimatedValue: number | null
  assignedToId: string | null
  convertedClientId: string | null
  notes: string | null
  createdAt: string
  assignedTo: { id: string; fullName: string } | null
}

interface Employee { id: string; fullName: string }

function fmtAmount(n: number | null): string {
  if (n == null) return '—'
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const STATUS_COLORS: Record<string, string> = {
  OPEN:      'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20',
  CONTACTED: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20',
  PROPOSAL:  'border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/20',
  WON:       'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20',
  LOST:      'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20',
}

const STATUS_HEADER_COLORS: Record<string, string> = {
  OPEN:      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  CONTACTED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  PROPOSAL:  'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  WON:       'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  LOST:      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const SOURCE_LABELS: Record<string, string> = {
  REFERRAL: 'Referral', WEBSITE: 'Website', WALK_IN: 'Walk-In',
  SOCIAL: 'Social', COLD_CALL: 'Cold Call', OTHER: 'Other',
}

const LEAD_STATUSES = ['OPEN', 'CONTACTED', 'PROPOSAL', 'WON', 'LOST']
const LEAD_SOURCES  = ['REFERRAL', 'WEBSITE', 'WALK_IN', 'SOCIAL', 'COLD_CALL', 'OTHER']

export default function LeadsScreen(): React.ReactElement {
  const { error: toastError } = useNotificationStore()
  const [leads, setLeads]         = useState<Lead[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading]     = useState(false)
  const [search, setSearch]       = useState('')
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({})

  // KPI
  const [kpiLeads, setKpiLeads] = useState<Lead[]>([])

  // Drag state
  const [draggingId, setDraggingId]     = useState<string | null>(null)
  const [dragOverCol, setDragOverCol]   = useState<string | null>(null)

  // Form
  const [showForm, setShowForm]   = useState(false)
  const [editLead, setEditLead]   = useState<Lead | null>(null)
  const [saving, setSaving]       = useState(false)

  const [fFullName, setFFullName]         = useState('')
  const [fEmail, setFEmail]               = useState('')
  const [fPhone, setFPhone]               = useState('')
  const [fCompany, setFCompany]           = useState('')
  const [fSource, setFSource]             = useState('REFERRAL')
  const [fStatus, setFStatus]             = useState('OPEN')
  const [fEstValue, setFEstValue]         = useState('')
  const [fAssignedToId, setFAssignedToId] = useState('')
  const [fNotes, setFNotes]               = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [leadsRes, empRes] = await Promise.all([
        api.lead.list(),
        api.hr.listEmployees(),
      ])
      if (leadsRes.success && leadsRes.data) {
        const all = leadsRes.data as Lead[]
        setLeads(all)
        setKpiLeads(all)
      } else {
        toastError('Error', leadsRes.error?.message ?? 'Failed to load leads.')
      }
      if (empRes.success && empRes.data) setEmployees((empRes.data as { employees: Employee[] }).employees ?? empRes.data as Employee[])
    } catch {
      toastError('Error', 'Failed to load leads.')
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => { loadAll() }, [loadAll])

  function resetForm(): void {
    setFFullName(''); setFEmail(''); setFPhone(''); setFCompany('')
    setFSource('REFERRAL'); setFStatus('OPEN'); setFEstValue('')
    setFAssignedToId(''); setFNotes('')
  }

  function openNew(defaultStatus = 'OPEN'): void {
    setEditLead(null); resetForm(); setFStatus(defaultStatus); setShowForm(true)
  }

  function openEdit(lead: Lead): void {
    setEditLead(lead)
    setFFullName(lead.fullName)
    setFEmail(lead.email ?? '')
    setFPhone(lead.phone ?? '')
    setFCompany(lead.companyName ?? '')
    setFSource(lead.source)
    setFStatus(lead.status)
    setFEstValue(lead.estimatedValue != null ? String(lead.estimatedValue) : '')
    setFAssignedToId(lead.assignedToId ?? '')
    setFNotes(lead.notes ?? '')
    setShowForm(true)
  }

  async function handleSave(): Promise<void> {
    if (!fFullName.trim()) return
    setSaving(true)
    let res
    if (editLead) {
      res = await api.lead.update({
        id: editLead.id,
        fullName:       fFullName.trim(),
        email:          fEmail || null,
        phone:          fPhone || null,
        companyName:    fCompany || null,
        source:         fSource,
        status:         fStatus,
        estimatedValue: fEstValue ? Number(fEstValue) : null,
        assignedToId:   fAssignedToId || null,
        notes:          fNotes || null,
      })
    } else {
      res = await api.lead.create({
        fullName:       fFullName.trim(),
        email:          fEmail || undefined,
        phone:          fPhone || undefined,
        companyName:    fCompany || undefined,
        source:         fSource,
        status:         fStatus,
        estimatedValue: fEstValue ? Number(fEstValue) : undefined,
        assignedToId:   fAssignedToId || undefined,
        notes:          fNotes || undefined,
      })
    }
    if (res.success) { setShowForm(false); resetForm(); void loadAll() }
    setSaving(false)
  }

  async function handleDelete(id: string): Promise<void> {
    if (!window.confirm('Delete this lead?')) return
    setDeleteErrors((prev) => { const n = { ...prev }; delete n[id]; return n })
    const res = await api.lead.delete({ id })
    if (res.success) {
      void loadAll()
    } else {
      setDeleteErrors((prev) => ({ ...prev, [id]: res.error?.message ?? 'Could not delete.' }))
    }
  }

  // Move a lead to a new status column via drag-and-drop
  async function handleDrop(newStatus: string): Promise<void> {
    if (!draggingId) return
    const lead = leads.find((l) => l.id === draggingId)
    if (!lead || lead.status === newStatus) { setDraggingId(null); setDragOverCol(null); return }
    setDraggingId(null); setDragOverCol(null)
    await api.lead.update({ id: draggingId, status: newStatus })
    void loadAll()
  }

  const q = search.toLowerCase()
  const filtered = leads.filter((l) =>
    !q ||
    l.fullName.toLowerCase().includes(q) ||
    (l.companyName ?? '').toLowerCase().includes(q) ||
    (l.email ?? '').toLowerCase().includes(q) ||
    (l.phone ?? '').toLowerCase().includes(q)
  )

  // KPI
  const kpiOpen     = kpiLeads.filter((l) => l.status === 'OPEN').length
  const kpiWon      = kpiLeads.filter((l) => l.status === 'WON').length
  const kpiPipeline = kpiLeads.filter((l) => !['WON', 'LOST'].includes(l.status)).reduce((s, l) => s + Number(l.estimatedValue ?? 0), 0)

  const colLeads = (status: string) => filtered.filter((l) => l.status === status)

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 px-6 py-4 flex items-center justify-between dark:border-slate-700">
        <div className="flex items-center gap-3">
          <Target className="w-6 h-6 text-indigo-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Leads</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">Drag cards between columns to move the pipeline</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void loadAll()} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
          <button onClick={() => openNew()} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm" style={{ minHeight: 44 }}>
            <Plus className="w-4 h-4" /> Add Lead
          </button>
        </div>
      </div>

      {/* KPI Bar */}
      <div className="grid grid-cols-4 gap-4 px-6 py-4">
        <KpiCard label="Total Leads" value={kpiLeads.length} />
        <KpiCard label="Open" value={kpiOpen} color="info" />
        <KpiCard label="Won" value={kpiWon} color="success" />
        <KpiCard label="Pipeline Value" value={fmtAmount(kpiPipeline)} color="brand" />
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 px-6 py-3 flex items-center gap-3 dark:border-slate-700">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, company, email or phone..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-500 text-sm dark:text-slate-400">Loading...</div>
        ) : (
          <div className="flex gap-3 h-full min-w-max">
            {LEAD_STATUSES.map((status) => {
              const cards = colLeads(status)
              const isDragOver = dragOverCol === status
              return (
                <div
                  key={status}
                  className={cn('flex flex-col w-64 rounded-xl border-2 transition-colors', isDragOver ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 bg-gray-100 dark:border-slate-700 dark:bg-slate-800')}
                  onDragOver={(e) => { e.preventDefault(); setDragOverCol(status) }}
                  onDragLeave={() => setDragOverCol(null)}
                  onDrop={() => void handleDrop(status)}
                >
                  {/* Column header */}
                  <div className={cn('flex items-center justify-between px-3 py-2 rounded-t-xl', STATUS_HEADER_COLORS[status])}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wide">{status.replace('_', ' ')}</span>
                      <span className="text-xs font-semibold px-1.5 py-0.5 bg-white/60 rounded-full">{cards.length}</span>
                    </div>
                    <button onClick={() => openNew(status)} className="p-0.5 hover:bg-white/40 rounded transition-colors" title={`Add lead as ${status}`}>
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px]">
                    {cards.length === 0 && (
                      <div className="text-xs text-gray-400 text-center py-4 dark:text-slate-500">Drop here</div>
                    )}
                    {cards.map((lead) => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={() => setDraggingId(lead.id)}
                        onDragEnd={() => { setDraggingId(null); setDragOverCol(null) }}
                        className={cn(
                          'bg-white dark:bg-slate-900 rounded-lg border-2 p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-all',
                          STATUS_COLORS[lead.status],
                          draggingId === lead.id && 'opacity-40'
                        )}
                      >
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <span className="font-medium text-gray-900 text-sm leading-tight break-words dark:text-slate-100">{lead.fullName}</span>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button onClick={() => openEdit(lead)} className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded dark:text-slate-500" style={{ minHeight: 28, minWidth: 28 }}>
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button onClick={() => void handleDelete(lead.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded dark:text-slate-500" style={{ minHeight: 28, minWidth: 28 }}>
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        {lead.companyName && <div className="text-xs text-gray-500 mb-1 dark:text-slate-400">{lead.companyName}</div>}
                        {lead.email && <div className="text-xs text-gray-400 truncate dark:text-slate-500">{lead.email}</div>}
                        <div className="flex items-center justify-between mt-2 gap-1">
                          <span className="text-xs text-gray-400 dark:text-slate-500">{SOURCE_LABELS[lead.source] ?? lead.source}</span>
                          {lead.estimatedValue != null && (
                            <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">{fmtAmount(lead.estimatedValue)}</span>
                          )}
                        </div>
                        {lead.assignedTo && (
                          <div className="text-xs text-gray-400 mt-1 truncate dark:text-slate-500">{lead.assignedTo.fullName}</div>
                        )}
                        {deleteErrors[lead.id] && (
                          <div className="text-xs text-red-600 mt-1">{deleteErrors[lead.id]}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="font-semibold text-gray-900 dark:text-slate-100">{editLead ? 'Edit Lead' : 'New Lead'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Full Name *</label>
                <input value={fFullName} onChange={(e) => setFFullName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }}
                  placeholder="Contact full name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Email</label>
                  <input type="email" value={fEmail} onChange={(e) => setFEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Phone</label>
                  <input value={fPhone} onChange={(e) => setFPhone(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Company Name</label>
                <input value={fCompany} onChange={(e) => setFCompany(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Source" value={fSource} onChange={(e) => setFSource(e.target.value)}>
                  {LEAD_SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
                </Select>
                <Select label="Status" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                  {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Estimated Value (₹)</label>
                  <input type="number" min="0" value={fEstValue} onChange={(e) => setFEstValue(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" style={{ minHeight: 48 }} />
                </div>
                <Select label="Assigned To" value={fAssignedToId} onChange={(e) => setFAssignedToId(e.target.value)}>
                  <option value="">Unassigned</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Notes</label>
                <textarea value={fNotes} onChange={(e) => setFNotes(e.target.value)} rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-slate-700">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800" style={{ minHeight: 44 }}>Cancel</button>
              <button onClick={() => void handleSave()} disabled={saving || !fFullName.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50" style={{ minHeight: 44 }}>
                {saving ? 'Saving...' : editLead ? 'Update Lead' : 'Create Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
