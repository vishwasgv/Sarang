import React, { useEffect, useState, useCallback } from 'react'
import { api } from '@renderer/services/ipc-client'
import { Camera, Plus, X, ChevronDown, ChevronRight, Check, Pencil, UserCheck, Receipt } from 'lucide-react'
import { Card } from '@shared/ui/molecules/Card'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { CustomerPicker } from '@shared/ui/molecules/CustomerPicker'
import { useNotificationStore } from '@app/store/notification.store'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Client { id: string; customerName: string; phone: string }
interface Employee { id: string; fullName: string }
interface DeliveryTracker {
  id: string
  shootBookingId: string
  proofsSentDate: string | null
  selectionReceivedDate: string | null
  editingStartedDate: string | null
  albumProofSentDate: string | null
  finalDeliveredDate: string | null
  deliveryFormat: string | null
  notes: string | null
}
interface ShootBooking {
  id: string
  clientId: string
  shootType: string
  shootDate: string
  shootTime: string | null
  shootLocation: string
  estimatedDurationHours: number
  deliverableType: string
  expectedPhotosCount: number | null
  deliveryDeadline: string | null
  photographerIds: string
  editorAssignedId: string | null
  status: string
  finalAmount: number | null
  invoiceId: string | null
  notes: string | null
  client: Client
  editor: Employee | null
  delivery: DeliveryTracker | null
}
interface ShootKPIs { thisMonth: number; deliveriesPending: number; upcoming: number }
interface Customer { id: string; customerName: string; phone: string | null }

// ─── Constants ────────────────────────────────────────────────────────────────

const SHOOT_TYPES = ['WEDDING', 'MATERNITY', 'NEWBORN', 'BIRTHDAY', 'CORPORATE', 'PRODUCT', 'PORTFOLIO', 'REAL_ESTATE', 'OTHER']
const DELIVERABLE_TYPES = ['DIGITAL_ONLY', 'PRINT_ALBUM', 'PRINTS', 'MIXED']
const STATUS_LIST = ['INQUIRY', 'CONFIRMED', 'SHOT', 'EDITING', 'DELIVERED', 'CANCELLED']
const STATUS_NEXT: Record<string, string> = {
  INQUIRY: 'CONFIRMED', CONFIRMED: 'SHOT', SHOT: 'EDITING', EDITING: 'DELIVERED',
}

// ShootBooking.status — INQUIRY|CONFIRMED|SHOT|EDITING|DELIVERED|CANCELLED (prisma/schema.prisma)
const STATUS_VARIANT: Record<string, 'neutral' | 'info' | 'brand' | 'warning' | 'success' | 'danger'> = {
  INQUIRY: 'neutral',
  CONFIRMED: 'info',
  SHOT: 'brand',
  EDITING: 'warning',
  DELIVERED: 'success',
  CANCELLED: 'danger',
}

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN') : '-'
const fmtLabel = (s: string) => s.replace(/_/g, ' ')
const toDateInput = (d: string | null) => d ? new Date(d).toISOString().split('T')[0] : ''

// ─── Delivery Milestone Row ───────────────────────────────────────────────────

function MilestoneRow({
  label, date, error, onToggle,
}: { label: string; date: string | null; error?: boolean; onToggle: (val: string | null) => void }) {
  const done = !!date
  return (
    <div className={`flex items-center gap-3 py-2 border-b border-gray-100 dark:border-slate-800 last:border-0 ${error ? 'bg-red-50 dark:bg-red-900/20 -mx-2 px-2 rounded' : ''}`}>
      <button
        onClick={() => onToggle(done ? null : new Date().toISOString())}
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${done ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-slate-600 hover:border-green-400'}`}
      >
        {done && <Check size={12} className="text-white" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${done ? 'text-gray-900 dark:text-slate-100 font-medium' : 'text-gray-500 dark:text-slate-400'}`}>{label}</p>
        {done && <p className="text-xs text-gray-400 dark:text-slate-500">{fmtDate(date)}</p>}
        {error && <p className="text-xs text-red-500 mt-0.5">Failed to save — please retry</p>}
      </div>
    </div>
  )
}

// ─── Shoot Form (shared Add + Edit) ──────────────────────────────────────────

function ShootForm({
  employees,
  initial,
  onSave,
  onClose,
}: {
  employees: Employee[]
  initial?: ShootBooking
  onSave: () => void
  onClose: () => void
}) {
  const isEdit = !!initial
  const [pickedClient, setPickedClient] = useState<Customer | null>(null)

  // Parse stored photographerIds JSON → array of IDs for the form
  const parsedPhotographerIds: string[] = (() => {
    try { return JSON.parse(initial?.photographerIds ?? '[]') as string[] }
    catch { return [] }
  })()

  const [form, setForm] = useState({
    shootType: initial?.shootType ?? 'WEDDING',
    shootDate: initial ? toDateInput(initial.shootDate) : '',
    shootTime: initial?.shootTime ?? '',
    shootLocation: initial?.shootLocation ?? '',
    estimatedDurationHours: initial ? String(initial.estimatedDurationHours) : '4',
    deliverableType: initial?.deliverableType ?? 'DIGITAL_ONLY',
    expectedPhotosCount: initial?.expectedPhotosCount ? String(initial.expectedPhotosCount) : '',
    deliveryDeadline: initial ? toDateInput(initial.deliveryDeadline) : '',
    editorAssignedId: initial?.editorAssignedId ?? '',
    status: initial?.status ?? 'INQUIRY',
    finalAmount: initial?.finalAmount != null ? String(initial.finalAmount) : '',
    notes: initial?.notes ?? '',
  })
  const [selectedPhotographers, setSelectedPhotographers] = useState<string[]>(parsedPhotographerIds)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  function togglePhotographer(empId: string) {
    setSelectedPhotographers(prev =>
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    )
  }

  async function handleSave() {
    if (!isEdit && !pickedClient) return setError('Client is required.')
    if (!form.shootDate) return setError('Shoot date is required.')
    if (!form.shootLocation.trim()) return setError('Location is required.')
    setSaving(true); setError('')

    let res
    if (isEdit) {
      res = await api.shootBooking.update({
        id: initial!.id,
        shootType: form.shootType,
        shootDate: form.shootDate,
        shootTime: form.shootTime || null,
        shootLocation: form.shootLocation,
        estimatedDurationHours: parseFloat(form.estimatedDurationHours) || 4,
        deliverableType: form.deliverableType,
        expectedPhotosCount: form.expectedPhotosCount ? parseInt(form.expectedPhotosCount) : null,
        deliveryDeadline: form.deliveryDeadline || null,
        photographerIds: selectedPhotographers,
        editorAssignedId: form.editorAssignedId || null,
        status: form.status,
        finalAmount: form.finalAmount ? parseFloat(form.finalAmount) : null,
        notes: form.notes || null,
      })
    } else {
      res = await api.shootBooking.create({
        clientId: pickedClient!.id,
        shootType: form.shootType,
        shootDate: form.shootDate,
        shootTime: form.shootTime || undefined,
        shootLocation: form.shootLocation,
        estimatedDurationHours: parseFloat(form.estimatedDurationHours) || 4,
        deliverableType: form.deliverableType,
        expectedPhotosCount: form.expectedPhotosCount ? parseInt(form.expectedPhotosCount) : undefined,
        deliveryDeadline: form.deliveryDeadline || undefined,
        photographerIds: selectedPhotographers.length > 0 ? selectedPhotographers : undefined,
        editorAssignedId: form.editorAssignedId || undefined,
        notes: form.notes || undefined,
      })
    }
    setSaving(false)
    if (res.success) { onSave() } else { setError(res.error?.message ?? 'Failed to save shoot booking.') }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{isEdit ? 'Edit Shoot Booking' : 'New Shoot Booking'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-200"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</div>}
          {isEdit ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Client</label>
              <div className="w-full h-12 flex items-center border border-gray-200 rounded-lg px-3 text-base bg-gray-50 dark:border-slate-700 dark:bg-slate-800 text-gray-500 dark:text-slate-400">
                {initial!.client.customerName}
              </div>
            </div>
          ) : (
            <CustomerPicker label="Client *" value={pickedClient} onChange={setPickedClient} placeholder="Search by name or phone..." />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Select label="Shoot Type *" value={form.shootType} onChange={e => set('shootType', e.target.value)}>
              {SHOOT_TYPES.map(t => <option key={t} value={t}>{fmtLabel(t)}</option>)}
            </Select>
            <Select label="Deliverable" value={form.deliverableType} onChange={e => set('deliverableType', e.target.value)}>
              {DELIVERABLE_TYPES.map(t => <option key={t} value={t}>{fmtLabel(t)}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Shoot Date *</label>
              <input type="date" className="w-full h-12 border border-gray-300 rounded-lg px-3 text-base dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" value={form.shootDate} onChange={e => set('shootDate', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Shoot Time</label>
              <input type="time" className="w-full h-12 border border-gray-300 rounded-lg px-3 text-base dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" value={form.shootTime} onChange={e => set('shootTime', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Location *</label>
            <input type="text" className="w-full h-12 border border-gray-300 rounded-lg px-3 text-base dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" placeholder="Venue / address" value={form.shootLocation} onChange={e => set('shootLocation', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Duration (hours)</label>
              <input type="number" min="0.5" step="0.5" className="w-full h-12 border border-gray-300 rounded-lg px-3 text-base dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" value={form.estimatedDurationHours} onChange={e => set('estimatedDurationHours', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Expected Photos</label>
              <input type="number" min="0" className="w-full h-12 border border-gray-300 rounded-lg px-3 text-base dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" placeholder="500" value={form.expectedPhotosCount} onChange={e => set('expectedPhotosCount', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Delivery Deadline</label>
            <input type="date" className="w-full h-12 border border-gray-300 rounded-lg px-3 text-base dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" value={form.deliveryDeadline} onChange={e => set('deliveryDeadline', e.target.value)} />
          </div>

          {/* Photographers */}
          {employees.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Photographers</label>
              <div className="border border-gray-300 rounded-lg p-3 max-h-32 overflow-y-auto space-y-1 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100">
                {employees.map(emp => (
                  <label key={emp.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                    <input
                      type="checkbox"
                      checked={selectedPhotographers.includes(emp.id)}
                      onChange={() => togglePhotographer(emp.id)}
                      className="w-4 h-4 rounded accent-blue-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-slate-300">{emp.fullName}</span>
                  </label>
                ))}
              </div>
              {selectedPhotographers.length > 0 && (
                <p className="text-xs text-blue-600 mt-1">{selectedPhotographers.length} photographer{selectedPhotographers.length > 1 ? 's' : ''} selected</p>
              )}
            </div>
          )}

          {/* Editor */}
          <Select label="Assigned Editor" value={form.editorAssignedId} onChange={e => set('editorAssignedId', e.target.value)}>
            <option value="">None — assign later</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
          </Select>

          {/* Status + Final Amount — edit only */}
          {isEdit && (
            <div className="grid grid-cols-2 gap-3">
              <Select label="Status" value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUS_LIST.map(s => <option key={s} value={s}>{fmtLabel(s)}</option>)}
              </Select>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Final Amount (₹)</label>
                <input
                  type="number" min="0.01" step="0.01"
                  className="w-full h-12 border border-gray-300 rounded-lg px-3 text-base dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                  placeholder="For invoicing"
                  value={form.finalAmount}
                  onChange={e => set('finalAmount', e.target.value)}
                  disabled={!!initial?.invoiceId}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Notes</label>
            <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" placeholder="Special requests, notes..." value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t">
          <button onClick={onClose} className="flex-1 h-12 border border-gray-300 rounded-lg text-base font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 h-12 bg-blue-600 text-white rounded-lg text-base font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Booking'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ShootsScreen() {
  const { error: toastError } = useNotificationStore()
  const [bookings, setBookings] = useState<ShootBooking[]>([])
  const [kpis, setKpis] = useState<ShootKPIs>({ thisMonth: 0, deliveriesPending: 0, upcoming: 0 })
  const [employees, setEmployees] = useState<Employee[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editBooking, setEditBooking] = useState<ShootBooking | null>(null)
  const [milestoneErrors, setMilestoneErrors] = useState<Record<string, string>>({})
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingInvoiceId, setGeneratingInvoiceId] = useState<string | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadBookings = useCallback(async (filter?: string) => {
    try {
      const res = await api.shootBooking.list(filter ? { status: filter } : {})
      if (res.success) setBookings((res.data as ShootBooking[]) ?? [])
      else toastError('Error', res.error?.message ?? 'Could not load bookings.')
    } catch { toastError('Error', 'Could not load bookings.') }
  }, [toastError])

  const loadKpis = useCallback(async () => {
    try {
      const res = await api.shootBooking.kpis()
      if (res.success && res.data) setKpis(res.data as ShootKPIs)
    } catch { /* KPI strip is supplementary */ }
  }, [])

  useEffect(() => {
    async function init() {
      setLoading(true)
      await Promise.all([
        loadBookings(statusFilter),
        loadKpis(),
        api.hr.listEmployees({ isActive: true }).then((r: { success: boolean; data?: unknown }) => {
          if (!r.success) return
          const d = r.data as { employees?: Employee[] } | Employee[]
          setEmployees(Array.isArray(d) ? d : (d.employees ?? []))
        }),
      ])
      setLoading(false)
    }
    init()
  }, [])

  async function handleStatusFilter(s: string) {
    setStatusFilter(s)
    await loadBookings(s)
  }

  async function handleAdvanceStatus(booking: ShootBooking) {
    const next = STATUS_NEXT[booking.status]
    if (!next) return
    setActionError(null)
    const res = await api.shootBooking.update({ id: booking.id, status: next })
    if (res.success) {
      await loadBookings(statusFilter)
      loadKpis()
    } else {
      setActionError(res.error?.message ?? 'Failed to advance status.')
    }
  }

  async function handleUpdateMilestone(shootBookingId: string, field: string, val: string | null) {
    const errorKey = `${shootBookingId}:${field}`
    setMilestoneErrors(prev => { const next = { ...prev }; delete next[errorKey]; return next })

    const res = await api.deliveryTracker.upsert({ shootBookingId, [field]: val })
    if (res.success) {
      setBookings(bs => bs.map(b => {
        if (b.id !== shootBookingId) return b
        return { ...b, delivery: (res.data as DeliveryTracker) }
      }))
    } else {
      setMilestoneErrors(prev => ({ ...prev, [errorKey]: 'failed' }))
    }
  }

  async function handleGenerateInvoice(booking: ShootBooking) {
    setActionError(null)
    setGeneratingInvoiceId(booking.id)
    const res = await api.shootBooking.generateInvoice(booking.id)
    if (res.success) {
      await loadBookings(statusFilter)
    } else {
      setActionError(res.error?.message ?? 'Failed to generate invoice.')
    }
    setGeneratingInvoiceId(null)
  }

  async function handleDelete(id: string) {
    setDeleteError(null)
    setDeleting(true)
    const res = await api.shootBooking.delete(id)
    setDeleting(false)
    if (res.success) {
      setDeleteTargetId(null)
      setBookings(bs => bs.filter(b => b.id !== id))
      loadKpis()
    } else {
      setDeleteError(res.error?.message ?? 'Failed to delete.')
    }
  }

  function getPhotographerNames(photographerIds: string): string {
    try {
      const ids = JSON.parse(photographerIds) as string[]
      if (ids.length === 0) return ''
      const names = ids.map(id => employees.find(e => e.id === id)?.fullName ?? '').filter(Boolean)
      return names.join(', ')
    } catch { return '' }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Camera size={22} className="text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Shoot Bookings</h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 h-10 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={16} />
          New Booking
        </button>
      </div>

      {/* KPI Bar */}
      <div className="grid grid-cols-3 gap-4 px-6 py-4">
        <KpiCard label="Shoots This Month" value={kpis.thisMonth} />
        <KpiCard label="Deliveries Pending" value={kpis.deliveriesPending} color="warning" />
        <KpiCard label="Upcoming Shoots" value={kpis.upcoming} color="info" />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 px-6 pb-3">
        {['', ...STATUS_LIST].map(s => (
          <button
            key={s}
            onClick={() => handleStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 border dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Error banners */}
      {actionError && (
        <div className="mx-6 mb-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2 flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
        </div>
      )}
      {deleteError && (
        <div className="mx-6 mb-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2 flex items-center justify-between">
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError(null)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3">
        {loading && <p className="text-center text-gray-400 py-8 dark:text-slate-500">Loading...</p>}
        {!loading && bookings.length === 0 && (
          <div className="text-center py-16 text-gray-400 dark:text-slate-500">
            <Camera size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">No shoot bookings yet</p>
            <p className="text-sm mt-1">Create the first booking using the button above</p>
          </div>
        )}
        {bookings.map(b => {
          const expanded = expandedId === b.id
          const photographerNames = getPhotographerNames(b.photographerIds)
          return (
            <Card key={b.id} padding="none" className="overflow-hidden">
              {/* Booking Row */}
              <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800"
                onClick={() => setExpandedId(expanded ? null : b.id)}
              >
                <div className="flex-shrink-0">{expanded ? <ChevronDown size={16} className="text-gray-400 dark:text-slate-500" /> : <ChevronRight size={16} className="text-gray-400 dark:text-slate-500" />}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{b.client.customerName}</p>
                    <Badge variant={STATUS_VARIANT[b.status] ?? 'neutral'} size="sm">{fmtLabel(b.status)}</Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 dark:text-slate-400">{fmtLabel(b.shootType)} · {fmtDate(b.shootDate)}{b.shootTime ? ` ${b.shootTime}` : ''} · {b.shootLocation}</p>
                  {(photographerNames || b.editor) && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <UserCheck size={10} className="text-gray-400 dark:text-slate-500" />
                      <p className="text-xs text-gray-400 dark:text-slate-500">
                        {photographerNames && <span>{photographerNames}</span>}
                        {photographerNames && b.editor && <span className="mx-1">·</span>}
                        {b.editor && <span>Editor: {b.editor.fullName}</span>}
                      </p>
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-500 dark:text-slate-400">{fmtLabel(b.deliverableType)}</p>
                  {b.deliveryDeadline && <p className="text-xs text-orange-600 font-medium">Due {fmtDate(b.deliveryDeadline)}</p>}
                </div>
                <div className="flex items-center gap-1">
                  {STATUS_NEXT[b.status] && (
                    <button
                      onClick={e => { e.stopPropagation(); handleAdvanceStatus(b) }}
                      className="text-xs px-3 h-7 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 font-medium whitespace-nowrap"
                    >
                      Mark {fmtLabel(STATUS_NEXT[b.status])}
                    </button>
                  )}
                  <button onClick={e => { e.stopPropagation(); setEditBooking(b) }} className="text-gray-400 hover:text-gray-700 p-1 dark:text-slate-500 dark:hover:text-slate-200">
                    <Pencil size={13} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); setDeleteTargetId(b.id) }} className="text-gray-300 hover:text-red-500 p-1">
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Expanded — Delivery Tracker */}
              {expanded && (
                <div className="border-t bg-gray-50 px-6 py-4 dark:bg-slate-950">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 dark:text-slate-400">Delivery Milestones</p>
                  {(['proofsSentDate', 'selectionReceivedDate', 'editingStartedDate', 'albumProofSentDate', 'finalDeliveredDate'] as const).map((field, i) => {
                    const labels = ['Proofs Sent to Client', 'Client Selection Received', 'Editing Started', 'Album Proof Sent', 'Final Delivery Done']
                    return (
                      <MilestoneRow
                        key={field}
                        label={labels[i]}
                        date={b.delivery?.[field] ?? null}
                        error={!!milestoneErrors[`${b.id}:${field}`]}
                        onToggle={v => handleUpdateMilestone(b.id, field, v)}
                      />
                    )
                  })}
                  {b.notes && <p className="text-xs text-gray-500 mt-3 italic dark:text-slate-400">{b.notes}</p>}

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200 dark:border-slate-800">
                    <div className="text-xs text-gray-500 dark:text-slate-400">
                      {b.finalAmount != null ? `Final Amount: ₹${Number(b.finalAmount).toLocaleString('en-IN')}` : 'Final amount not set'}
                      {b.invoiceId && <span className="ml-2 text-green-600 font-medium">Invoiced</span>}
                    </div>
                    {!b.invoiceId && b.finalAmount != null && b.finalAmount > 0 && (
                      <button
                        onClick={e => { e.stopPropagation(); handleGenerateInvoice(b) }}
                        disabled={generatingInvoiceId === b.id}
                        className="flex items-center gap-1.5 text-xs px-3 h-8 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                      >
                        <Receipt size={13} />
                        {generatingInvoiceId === b.id ? 'Generating...' : 'Generate Invoice'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {(showForm || editBooking) && (
        <ShootForm
          employees={employees}
          initial={editBooking ?? undefined}
          onSave={() => { setShowForm(false); setEditBooking(null); loadBookings(statusFilter); loadKpis() }}
          onClose={() => { setShowForm(false); setEditBooking(null) }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={() => deleteTargetId && handleDelete(deleteTargetId)}
        loading={deleting}
        title="Delete Shoot Booking"
        message="Delete this shoot booking?"
        confirmLabel="Delete"
      />
    </div>
  )
}
