import React, { useEffect, useState, useCallback } from 'react'
import { api } from '@renderer/services/ipc-client'
import { PartyPopper, Plus, X, ChevronDown, ChevronRight, Pencil, Receipt, List, Calendar as CalendarIcon, Clock, Trash2, ChevronLeft } from 'lucide-react'
import { Card } from '@shared/ui/molecules/Card'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { CustomerPicker } from '@shared/ui/molecules/CustomerPicker'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { useNotificationStore } from '@app/store/notification.store'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Client { id: string; customerName: string }
interface Supplier { id: string; supplierName: string }
interface EventVendorBooking {
  id: string
  eventId: string
  vendorId: string
  vendorCategory: string
  pricingType: string
  perHeadRate: number | null
  quotedAmount: number
  advancePaid: number
  status: string
  notes: string | null
  vendor: Supplier
}
interface EventRunOfShowItem {
  id: string
  eventId: string
  scheduledTime: string
  activity: string
  responsibleParty: string | null
  isDone: boolean
  notes: string | null
}
interface EventBooking {
  id: string
  clientId: string
  eventName: string
  eventType: string
  eventDate: string
  eventEndDate: string | null
  venueName: string
  venueAddress: string | null
  expectedGuestCount: number | null
  clientBudget: number | null
  finalAmount: number | null
  status: string
  invoiceId: string | null
  notes: string | null
  client: Client
  vendorBookings: EventVendorBooking[]
}
interface EventKPIs { thisMonth: number; vendorsPending: number; upcoming: number; leadsCount: number }
interface Customer { id: string; customerName: string; phone: string | null }

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_TYPES = ['WEDDING', 'CORPORATE', 'BIRTHDAY', 'CONFERENCE', 'SOCIAL', 'POOJA', 'OTHER']
const STATUS_LIST = ['INQUIRY', 'QUOTED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
const VENDOR_CATEGORIES = ['CATERING', 'DECORATION', 'PHOTOGRAPHY', 'AV_SOUND', 'VENUE', 'ENTERTAINMENT', 'TRANSPORT', 'FLOWERS', 'OTHER']
const VENDOR_STATUSES = ['ENQUIRED', 'BOOKED', 'CONFIRMED', 'COMPLETED']

// Verified exhaustive against EventBooking.status in prisma/schema.prisma
// ("INQUIRY|QUOTED|CONFIRMED|IN_PROGRESS|COMPLETED|CANCELLED") and
// src/main/services/event-booking.service.ts (create defaults to 'INQUIRY',
// update passes through caller-supplied status; kpis() only ever counts
// these same 6 values).
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand'> = {
  INQUIRY: 'warning',
  QUOTED: 'info',
  CONFIRMED: 'brand',
  IN_PROGRESS: 'neutral',
  COMPLETED: 'success',
  CANCELLED: 'danger',
}
const vendorStatusColor: Record<string, string> = {
  ENQUIRED: 'text-yellow-700 dark:text-yellow-400',
  BOOKED: 'text-blue-700 dark:text-blue-400',
  CONFIRMED: 'text-indigo-700 dark:text-indigo-400',
  COMPLETED: 'text-green-700 dark:text-green-400',
}

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN') : '-'
const fmtLabel = (s: string) => s.replace(/_/g, ' ')
const toDateInput = (d: string | null) => d ? new Date(d).toISOString().split('T')[0] : ''
const fmtCurrency = (n: number | null) => n == null ? '-' : `₹${Number(n).toLocaleString('en-IN')}`

// ─── Event Form (shared Add + Edit) ─────────────────────────────────────────

function EventForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: EventBooking
  onSave: () => void
  onClose: () => void
}) {
  const isEdit = !!initial
  const [pickedClient, setPickedClient] = useState<Customer | null>(null)
  const [form, setForm] = useState({
    eventName: initial?.eventName ?? '',
    eventType: initial?.eventType ?? 'WEDDING',
    eventDate: initial ? toDateInput(initial.eventDate) : '',
    eventEndDate: initial ? toDateInput(initial.eventEndDate) : '',
    venueName: initial?.venueName ?? '',
    venueAddress: initial?.venueAddress ?? '',
    expectedGuestCount: initial?.expectedGuestCount ? String(initial.expectedGuestCount) : '',
    clientBudget: initial?.clientBudget ? String(initial.clientBudget) : '',
    finalAmount: initial?.finalAmount != null ? String(initial.finalAmount) : '',
    notes: initial?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!isEdit && !pickedClient) return setError('Client is required.')
    if (!form.eventName.trim()) return setError('Event name is required.')
    if (!form.eventDate) return setError('Event date is required.')
    if (!form.venueName.trim()) return setError('Venue name is required.')
    setSaving(true); setError('')

    let res
    if (isEdit) {
      res = await api.eventBooking.update({
        id: initial!.id,
        eventName: form.eventName,
        eventType: form.eventType,
        eventDate: form.eventDate,
        eventEndDate: form.eventEndDate || null,
        venueName: form.venueName,
        venueAddress: form.venueAddress || null,
        expectedGuestCount: form.expectedGuestCount ? parseInt(form.expectedGuestCount) : null,
        clientBudget: form.clientBudget ? parseFloat(form.clientBudget) : null,
        finalAmount: form.finalAmount ? parseFloat(form.finalAmount) : null,
        notes: form.notes || null,
      })
    } else {
      res = await api.eventBooking.create({
        clientId: pickedClient!.id,
        eventName: form.eventName,
        eventType: form.eventType,
        eventDate: form.eventDate,
        eventEndDate: form.eventEndDate || undefined,
        venueName: form.venueName,
        venueAddress: form.venueAddress || undefined,
        expectedGuestCount: form.expectedGuestCount ? parseInt(form.expectedGuestCount) : undefined,
        clientBudget: form.clientBudget ? parseFloat(form.clientBudget) : undefined,
        notes: form.notes || undefined,
      })
    }
    setSaving(false)
    if (res.success) { onSave() } else { setError(res.error?.message ?? 'Failed to save event.') }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{isEdit ? 'Edit Event' : 'New Event Booking'}</h2>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Event Name *</label>
            <input type="text" className="w-full h-12 border border-gray-300 rounded-lg px-3 text-base dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" placeholder="e.g. Sharma Wedding" value={form.eventName} onChange={e => set('eventName', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Event Type" required value={form.eventType} onChange={e => set('eventType', e.target.value)}>
              {EVENT_TYPES.map(t => <option key={t} value={t}>{fmtLabel(t)}</option>)}
            </Select>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Event Date *</label>
              <input type="date" className="w-full h-12 border border-gray-300 rounded-lg px-3 text-base dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" value={form.eventDate} onChange={e => set('eventDate', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">End Date</label>
              <input type="date" className="w-full h-12 border border-gray-300 rounded-lg px-3 text-base dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" value={form.eventEndDate} onChange={e => set('eventEndDate', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Expected Guests</label>
              <input type="number" min="0" className="w-full h-12 border border-gray-300 rounded-lg px-3 text-base dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" placeholder="200" value={form.expectedGuestCount} onChange={e => set('expectedGuestCount', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Venue Name *</label>
            <input type="text" className="w-full h-12 border border-gray-300 rounded-lg px-3 text-base dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" placeholder="e.g. The Grand Ballroom" value={form.venueName} onChange={e => set('venueName', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Venue Address</label>
            <input type="text" className="w-full h-12 border border-gray-300 rounded-lg px-3 text-base dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" placeholder="Full address" value={form.venueAddress} onChange={e => set('venueAddress', e.target.value)} />
          </div>
          <div className={isEdit ? 'grid grid-cols-2 gap-3' : ''}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Client Budget</label>
              <input type="number" min="0" className="w-full h-12 border border-gray-300 rounded-lg px-3 text-base dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" placeholder="500000" value={form.clientBudget} onChange={e => set('clientBudget', e.target.value)} />
            </div>
            {isEdit && (
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
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">Notes</label>
            <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t">
          <button onClick={onClose} className="flex-1 h-12 border border-gray-300 rounded-lg text-base font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 h-12 bg-purple-600 text-white rounded-lg text-base font-medium hover:bg-purple-700 disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Event'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Vendor Form ──────────────────────────────────────────────────────────

function AddVendorForm({
  eventId,
  expectedGuestCount,
  suppliers,
  onSave,
  onClose,
}: {
  eventId: string
  expectedGuestCount: number | null
  suppliers: Supplier[]
  onSave: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState({ vendorId: '', vendorCategory: 'CATERING', pricingType: 'FLAT', quotedAmount: '', perHeadRate: '', advancePaid: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const perHeadPreview = form.pricingType === 'PER_HEAD' && form.perHeadRate && expectedGuestCount
    ? parseFloat(form.perHeadRate) * expectedGuestCount
    : null

  async function handleSave() {
    if (!form.vendorId) return setError('Select a vendor.')
    if (form.pricingType === 'PER_HEAD') {
      if (!form.perHeadRate || isNaN(parseFloat(form.perHeadRate))) return setError('Per-head rate is required.')
      if (!expectedGuestCount) return setError("Set the event's expected guest count first.")
    } else if (!form.quotedAmount || isNaN(parseFloat(form.quotedAmount))) {
      return setError('Quoted amount is required.')
    }
    setSaving(true); setError('')
    const res = await api.eventVendorBooking.create({
      eventId,
      vendorId: form.vendorId,
      vendorCategory: form.vendorCategory,
      pricingType: form.pricingType,
      quotedAmount: form.pricingType === 'FLAT' ? parseFloat(form.quotedAmount) : undefined,
      perHeadRate: form.pricingType === 'PER_HEAD' ? parseFloat(form.perHeadRate) : undefined,
      advancePaid: form.advancePaid ? parseFloat(form.advancePaid) : undefined,
      notes: form.notes || undefined,
    })
    setSaving(false)
    if (res.success) { onSave() } else { setError(res.error?.message ?? 'Failed to add vendor.') }
  }

  return (
    <div className="border-t dark:border-slate-700 bg-purple-50 dark:bg-purple-900/20 p-4 space-y-3">
      <p className="text-xs font-semibold text-purple-800 dark:text-purple-400">Add Vendor</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Select value={form.vendorId} onChange={e => set('vendorId', e.target.value)}>
          <option value="">Select vendor...</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplierName}</option>)}
        </Select>
        <Select value={form.vendorCategory} onChange={e => set('vendorCategory', e.target.value)}>
          {VENDOR_CATEGORIES.map(r => <option key={r} value={r}>{fmtLabel(r)}</option>)}
        </Select>
        <Select value={form.pricingType} onChange={e => set('pricingType', e.target.value)}>
          <option value="FLAT">Flat amount</option>
          <option value="PER_HEAD">Per guest</option>
        </Select>
        {form.pricingType === 'PER_HEAD' ? (
          <input type="number" min="0" className="h-10 border border-gray-300 rounded-lg px-2 text-sm dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" placeholder="₹ per guest *" value={form.perHeadRate} onChange={e => set('perHeadRate', e.target.value)} />
        ) : (
          <input type="number" min="0" className="h-10 border border-gray-300 rounded-lg px-2 text-sm dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" placeholder="Quoted amount *" value={form.quotedAmount} onChange={e => set('quotedAmount', e.target.value)} />
        )}
        <input type="number" min="0" className="h-10 border border-gray-300 rounded-lg px-2 text-sm dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" placeholder="Advance paid" value={form.advancePaid} onChange={e => set('advancePaid', e.target.value)} />
        <input type="text" className="h-10 border border-gray-300 rounded-lg px-2 text-sm dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" placeholder="Notes" value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>
      {form.pricingType === 'PER_HEAD' && (
        <p className="text-xs text-purple-700 dark:text-purple-400">
          {expectedGuestCount
            ? `= ₹${(perHeadPreview ?? 0).toLocaleString('en-IN')} for ${expectedGuestCount} guests`
            : "Set the event's expected guest count first to use per-guest pricing."}
        </p>
      )}
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 h-9 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-white dark:hover:bg-slate-900 dark:border-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="flex-1 h-9 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
          {saving ? '...' : 'Add Vendor'}
        </button>
      </div>
    </div>
  )
}

// ─── Run of Show Panel ────────────────────────────────────────────────────────

function RunOfShowPanel({ eventId, eventDate }: { eventId: string; eventDate: string }) {
  const [items, setItems] = useState<EventRunOfShowItem[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ scheduledTime: '', activity: '', responsibleParty: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await api.eventRunOfShow.list({ eventId })
    if (res.success) setItems((res.data as EventRunOfShowItem[]) ?? [])
    setLoading(false)
  }, [eventId])

  useEffect(() => { load() }, [load])

  async function handleAdd() {
    if (!form.scheduledTime || !form.activity.trim()) return setError('Time and activity are required.')
    setSaving(true); setError('')
    // Combine the event's own calendar date with the picked time-of-day —
    // a bare "HH:MM" string from a <input type="time"> is not a parseable
    // Date on its own.
    const combined = `${toDateInput(eventDate)}T${form.scheduledTime}:00`
    const res = await api.eventRunOfShow.create({
      eventId, scheduledTime: combined, activity: form.activity.trim(),
      responsibleParty: form.responsibleParty || undefined,
    })
    setSaving(false)
    if (res.success) { setForm({ scheduledTime: '', activity: '', responsibleParty: '' }); load() }
    else setError(res.error?.message ?? 'Could not add item.')
  }

  async function handleToggle(item: EventRunOfShowItem) {
    const res = await api.eventRunOfShow.update({ id: item.id, isDone: !item.isDone })
    if (res.success) setItems(prev => prev.map(i => i.id === item.id ? { ...i, isDone: !i.isDone } : i))
  }

  async function handleDelete(id: string) {
    const res = await api.eventRunOfShow.delete({ id })
    if (res.success) setItems(prev => prev.filter(i => i.id !== id))
  }

  if (loading) return <p className="text-xs text-gray-400 dark:text-slate-500">Loading run-of-show...</p>

  return (
    <div>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      {items.length === 0 ? (
        <p className="text-xs text-gray-400 italic dark:text-slate-500 mb-2">No run-of-show items yet — the event-day execution timeline, distinct from vendor booking above.</p>
      ) : (
        <div className="space-y-1.5 mb-2">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-gray-100 rounded-lg px-3 py-2 dark:border-slate-800">
              <input type="checkbox" checked={item.isDone} onChange={() => handleToggle(item)} className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-mono text-gray-500 dark:text-slate-400 flex-shrink-0 w-16">
                {new Date(item.scheduledTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className={`flex-1 text-sm ${item.isDone ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-800 dark:text-slate-200'}`}>{item.activity}</span>
              {item.responsibleParty && <span className="text-xs text-gray-400 dark:text-slate-500">{item.responsibleParty}</span>}
              <button onClick={() => handleDelete(item.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-4 gap-2">
        <input type="time" className="h-9 border border-gray-300 rounded-lg px-2 text-xs dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" value={form.scheduledTime} onChange={e => setForm(f => ({ ...f, scheduledTime: e.target.value }))} />
        <input type="text" className="h-9 border border-gray-300 rounded-lg px-2 text-xs col-span-2 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" placeholder="Activity (e.g. Guests arrive)" value={form.activity} onChange={e => setForm(f => ({ ...f, activity: e.target.value }))} />
        <input type="text" className="h-9 border border-gray-300 rounded-lg px-2 text-xs dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" placeholder="Responsible" value={form.responsibleParty} onChange={e => setForm(f => ({ ...f, responsibleParty: e.target.value }))} />
      </div>
      <button onClick={handleAdd} disabled={saving || !form.scheduledTime || !form.activity.trim()} className="mt-2 text-xs px-3 h-8 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium flex items-center gap-1">
        <Plus size={13} /> Add to Timeline
      </button>
    </div>
  )
}

// ─── Calendar View — across concurrent events ────────────────────────────────

function CalendarView({
  events, month, onPrevMonth, onNextMonth, onSelectEvent,
}: {
  events: EventBooking[]
  month: Date
  onPrevMonth: () => void
  onNextMonth: () => void
  onSelectEvent: (ev: EventBooking) => void
}) {
  const year = month.getFullYear()
  const monthIdx = month.getMonth()
  const firstDay = new Date(year, monthIdx, 1)
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate()
  const startWeekday = firstDay.getDay() // 0=Sun

  function eventsOnDay(day: number): EventBooking[] {
    const cellStart = new Date(year, monthIdx, day)
    const cellEnd = new Date(year, monthIdx, day, 23, 59, 59, 999)
    return events.filter(ev => {
      const start = new Date(ev.eventDate)
      const end = ev.eventEndDate ? new Date(ev.eventEndDate) : start
      return start <= cellEnd && end >= cellStart
    })
  }

  const cells: Array<number | null> = [...Array(startWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const today = new Date()
  const isToday = (day: number) => today.getFullYear() === year && today.getMonth() === monthIdx && today.getDate() === day

  return (
    <div className="px-6 pb-6">
      <div className="flex items-center justify-between mb-3">
        <button onClick={onPrevMonth} title="Previous month" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400"><ChevronLeft size={16} /></button>
        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
        <button onClick={onNextMonth} title="Next month" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-400 dark:text-slate-500 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => (
          <div key={idx} className={`min-h-[80px] rounded-lg border p-1 ${day == null ? 'border-transparent' : 'border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
            {day != null && (
              <>
                <p className={`text-xs mb-1 ${isToday(day) ? 'font-bold text-purple-600' : 'text-gray-400 dark:text-slate-500'}`}>{day}</p>
                <div className="space-y-0.5">
                  {eventsOnDay(day).map(ev => (
                    <button
                      key={ev.id}
                      onClick={() => onSelectEvent(ev)}
                      title={`${ev.eventName} — ${ev.venueName}`}
                      className={`w-full text-left text-[10px] px-1 py-0.5 rounded truncate block ${STATUS_VARIANT[ev.status] === 'danger' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'}`}
                    >
                      {ev.eventName}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EventsScreen() {
  const { error: toastError } = useNotificationStore()
  const [events, setEvents] = useState<EventBooking[]>([])
  const [kpis, setKpis] = useState<EventKPIs>({ thisMonth: 0, vendorsPending: 0, upcoming: 0, leadsCount: 0 })
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAddVendorFor, setShowAddVendorFor] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editEvent, setEditEvent] = useState<EventBooking | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const [generatingInvoiceId, setGeneratingInvoiceId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<EventBooking | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteVendorTarget, setDeleteVendorTarget] = useState<{ vendorId: string; eventId: string; vendorName: string } | null>(null)
  const [deletingVendor, setDeletingVendor] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [calendarMonth, setCalendarMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })

  const loadEvents = useCallback(async (filter?: string) => {
    try {
      const res = await api.eventBooking.list(filter ? { status: filter } : {})
      if (res.success) setEvents((res.data as EventBooking[]) ?? [])
      else toastError('Error', res.error?.message ?? 'Could not load events.')
    } catch { toastError('Error', 'Could not load events.') }
  }, [toastError])

  const loadKpis = useCallback(async () => {
    try {
      const res = await api.eventBooking.kpis()
      if (res.success && res.data) setKpis(res.data as EventKPIs)
    } catch { /* KPI strip is supplementary */ }
  }, [])

  useEffect(() => {
    async function init() {
      setLoading(true)
      await Promise.all([
        loadEvents(),
        loadKpis(),
        api.suppliers.list({ limit: 500 }).then((r: { success: boolean; data?: unknown }) => {
          if (!r.success) return
          const d = r.data as { suppliers?: Supplier[] } | Supplier[]
          setSuppliers(Array.isArray(d) ? d : (d.suppliers ?? []))
        }),
      ])
      setLoading(false)
    }
    init()
  }, [])

  async function handleStatusFilter(s: string) {
    setStatusFilter(s)
    await loadEvents(s)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setErrorBanner(null)
    const res = await api.eventBooking.delete(deleteTarget.id)
    if (res.success) { setEvents(ev => ev.filter(e => e.id !== deleteTarget.id)); setDeleteTarget(null); loadKpis() }
    else setErrorBanner(res.error?.message ?? 'Failed to delete event.')
    setDeleting(false)
  }

  async function handleVendorStatusChange(vendorId: string, eventId: string, newStatus: string) {
    const res = await api.eventVendorBooking.update({ id: vendorId, status: newStatus })
    if (res.success) {
      setEvents(ev => ev.map(e => {
        if (e.id !== eventId) return e
        return { ...e, vendorBookings: e.vendorBookings.map(v => v.id === vendorId ? { ...v, status: newStatus } : v) }
      }))
      loadKpis()
    } else {
      setErrorBanner(res.error?.message ?? 'Failed to update vendor status.')
    }
  }

  async function handleDeleteVendor() {
    if (!deleteVendorTarget) return
    const { vendorId, eventId } = deleteVendorTarget
    setDeletingVendor(true)
    setErrorBanner(null)
    const res = await api.eventVendorBooking.delete(vendorId)
    if (res.success) {
      setEvents(ev => ev.map(e => {
        if (e.id !== eventId) return e
        return { ...e, vendorBookings: e.vendorBookings.filter(v => v.id !== vendorId) }
      }))
      setDeleteVendorTarget(null)
      loadKpis()
    } else {
      setErrorBanner(res.error?.message ?? 'Failed to remove vendor.')
    }
    setDeletingVendor(false)
  }

  async function handleVendorAdded(eventId: string) {
    setShowAddVendorFor(null)
    const res = await api.eventVendorBooking.list(eventId)
    if (res.success) {
      setEvents(ev => ev.map(e => e.id === eventId ? { ...e, vendorBookings: (res.data as EventVendorBooking[]) ?? [] } : e))
    }
    loadKpis()
  }

  async function handleGenerateInvoice(ev: EventBooking) {
    setErrorBanner(null)
    setGeneratingInvoiceId(ev.id)
    const res = await api.eventBooking.generateInvoice(ev.id)
    if (res.success) {
      await loadEvents(statusFilter)
    } else {
      setErrorBanner(res.error?.message ?? 'Failed to generate invoice.')
    }
    setGeneratingInvoiceId(null)
  }

  async function handleStatusUpdate(eventId: string, status: string) {
    const res = await api.eventBooking.update({ id: eventId, status })
    if (res.success) {
      await loadEvents(statusFilter)
      loadKpis()
    } else {
      setErrorBanner(res.error?.message ?? 'Failed to update event status.')
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PartyPopper size={22} className="text-purple-600" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Events</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden dark:border-slate-600">
            <button onClick={() => setViewMode('list')} title="List view"
              className={`p-2 ${viewMode === 'list' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}>
              <List size={16} />
            </button>
            <button onClick={() => setViewMode('calendar')} title="Calendar view — see concurrent events"
              className={`p-2 ${viewMode === 'calendar' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}>
              <CalendarIcon size={16} />
            </button>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 h-10 px-4 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
          >
            <Plus size={16} />
            New Event
          </button>
        </div>
      </div>

      {/* KPI Bar */}
      <div className="grid grid-cols-4 gap-4 px-6 py-4">
        <KpiCard label="Events This Month" value={kpis.thisMonth} />
        <KpiCard label="Vendors Pending" value={kpis.vendorsPending} color="warning" />
        <KpiCard label="Upcoming Events" value={kpis.upcoming} color="info" />
        <KpiCard label="New Inquiries (7d)" value={kpis.leadsCount} color="brand" />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 px-6 pb-3">
        {['', ...STATUS_LIST].map(s => (
          <button
            key={s}
            onClick={() => handleStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? 'bg-purple-600 text-white' : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 border dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
          >
            {s ? fmtLabel(s) : 'All'}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {errorBanner && (
        <div className="mx-6 mb-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2 flex items-center justify-between">
          <span>{errorBanner}</span>
          <button onClick={() => setErrorBanner(null)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
        </div>
      )}

      {viewMode === 'calendar' ? (
        <div className="flex-1 overflow-y-auto">
          <CalendarView
            events={events}
            month={calendarMonth}
            onPrevMonth={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            onNextMonth={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            onSelectEvent={ev => { setViewMode('list'); setExpandedId(ev.id) }}
          />
        </div>
      ) : (
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3">
        {loading && <p className="text-center text-gray-400 py-8 dark:text-slate-500">Loading...</p>}
        {!loading && events.length === 0 && (
          <div className="text-center py-16 text-gray-400 dark:text-slate-500">
            <PartyPopper size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">No events yet</p>
            <p className="text-sm mt-1">Create the first event using the button above</p>
          </div>
        )}
        {events.map(ev => {
          const expanded = expandedId === ev.id
          return (
            <Card key={ev.id} padding="none" className="overflow-hidden">
              {/* Event Row */}
              <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800"
                onClick={() => setExpandedId(expanded ? null : ev.id)}
              >
                <div className="flex-shrink-0">{expanded ? <ChevronDown size={16} className="text-gray-400 dark:text-slate-500" /> : <ChevronRight size={16} className="text-gray-400 dark:text-slate-500" />}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{ev.eventName}</p>
                    <Badge variant={STATUS_VARIANT[ev.status] ?? 'neutral'} size="sm">{fmtLabel(ev.status)}</Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 dark:text-slate-400">{ev.client.customerName} · {fmtLabel(ev.eventType)} · {fmtDate(ev.eventDate)}</p>
                </div>
                <div className="text-right flex-shrink-0 space-y-0.5">
                  <p className="text-xs text-gray-500 dark:text-slate-400">{ev.venueName}</p>
                  {ev.clientBudget && <p className="text-xs text-green-700 font-medium">{fmtCurrency(ev.clientBudget)}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <select
                    value={ev.status}
                    onClick={e => e.stopPropagation()}
                    onChange={e => { e.stopPropagation(); handleStatusUpdate(ev.id, e.target.value) }}
                    className="text-xs h-7 px-2 border border-gray-200 rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700"
                  >
                    {STATUS_LIST.map(s => <option key={s} value={s}>{fmtLabel(s)}</option>)}
                  </select>
                  <button onClick={e => { e.stopPropagation(); setEditEvent(ev) }} className="text-gray-400 hover:text-gray-700 p-1 dark:text-slate-500 dark:hover:text-slate-200">
                    <Pencil size={13} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); setDeleteTarget(ev) }} className="text-gray-300 hover:text-red-500 p-1">
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Expanded — Vendors Panel */}
              {expanded && (
                <div className="border-t bg-gray-50 dark:bg-slate-950">
                  <div className="px-6 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide dark:text-slate-400">Vendors ({ev.vendorBookings.length})</p>
                      <button
                        onClick={() => setShowAddVendorFor(showAddVendorFor === ev.id ? null : ev.id)}
                        className="text-xs text-purple-600 font-medium hover:underline"
                      >+ Add Vendor</button>
                    </div>
                    {ev.vendorBookings.length === 0 ? (
                      <p className="text-xs text-gray-400 italic dark:text-slate-500">No vendors added yet</p>
                    ) : (
                      <div className="space-y-2">
                        {ev.vendorBookings.map(v => (
                          <div key={v.id} className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-gray-100 rounded-lg px-3 py-2 dark:border-slate-800">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{v.vendor.supplierName}</p>
                              <p className="text-xs text-gray-500 dark:text-slate-400">
                                {fmtLabel(v.vendorCategory)} · Quoted: {fmtCurrency(v.quotedAmount)}
                                {v.pricingType === 'PER_HEAD' && v.perHeadRate != null && ` (₹${v.perHeadRate}/guest)`}
                                {v.advancePaid ? ` · Advance: ${fmtCurrency(v.advancePaid)}` : ''}
                              </p>
                            </div>
                            <select
                              value={v.status}
                              onChange={e => handleVendorStatusChange(v.id, ev.id, e.target.value)}
                              className={`text-xs h-7 px-2 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 font-medium ${vendorStatusColor[v.status] ?? 'text-gray-700 dark:text-slate-300'}`}
                            >
                              {VENDOR_STATUSES.map(s => <option key={s} value={s}>{fmtLabel(s)}</option>)}
                            </select>
                            <button onClick={() => setDeleteVendorTarget({ vendorId: v.id, eventId: ev.id, vendorName: v.vendor.supplierName })} className="text-gray-300 hover:text-red-500 p-1">
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {ev.vendorBookings.length > 0 && (
                      <p className="text-xs text-gray-500 mt-2 dark:text-slate-400">
                        Total vendor cost: <span className="font-semibold text-gray-700 dark:text-slate-300">{fmtCurrency(ev.vendorBookings.reduce((s, v) => s + v.quotedAmount, 0))}</span>
                        {ev.expectedGuestCount ? ` · ${fmtCurrency(Math.round(ev.vendorBookings.reduce((s, v) => s + v.quotedAmount, 0) / ev.expectedGuestCount))}/guest across ${ev.expectedGuestCount} guests` : ''}
                      </p>
                    )}
                    {ev.notes && <p className="text-xs text-gray-400 italic mt-3 dark:text-slate-500">{ev.notes}</p>}

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200 dark:border-slate-800">
                      <div className="text-xs text-gray-500 dark:text-slate-400">
                        {ev.finalAmount != null ? `Final Amount: ${fmtCurrency(ev.finalAmount)}` : 'Final amount not set'}
                        {ev.invoiceId && <span className="ml-2 text-green-600 font-medium">Invoiced</span>}
                      </div>
                      {!ev.invoiceId && ev.finalAmount != null && ev.finalAmount > 0 && (
                        <button
                          onClick={() => handleGenerateInvoice(ev)}
                          disabled={generatingInvoiceId === ev.id}
                          className="flex items-center gap-1.5 text-xs px-3 h-8 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                        >
                          <Receipt size={13} />
                          {generatingInvoiceId === ev.id ? 'Generating...' : 'Generate Invoice'}
                        </button>
                      )}
                    </div>
                  </div>
                  {showAddVendorFor === ev.id && (
                    <AddVendorForm
                      eventId={ev.id}
                      expectedGuestCount={ev.expectedGuestCount}
                      suppliers={suppliers}
                      onSave={() => handleVendorAdded(ev.id)}
                      onClose={() => setShowAddVendorFor(null)}
                    />
                  )}

                  {/* Phase 58 §2 — event-day run-of-show, distinct from the vendor procurement checklist above */}
                  <div className="border-t dark:border-slate-800 px-6 py-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 dark:text-slate-400 flex items-center gap-1.5">
                      <Clock size={12} /> Run of Show
                    </p>
                    <RunOfShowPanel eventId={ev.id} eventDate={ev.eventDate} />
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>
      )}

      {(showForm || editEvent) && (
        <EventForm
          initial={editEvent ?? undefined}
          onSave={() => { setShowForm(false); setEditEvent(null); loadEvents(statusFilter); loadKpis() }}
          onClose={() => { setShowForm(false); setEditEvent(null) }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Event"
        message={`Delete this event booking "${deleteTarget?.eventName}"?`}
        confirmLabel="Delete"
      />

      <ConfirmDialog
        open={!!deleteVendorTarget}
        onClose={() => setDeleteVendorTarget(null)}
        onConfirm={handleDeleteVendor}
        loading={deletingVendor}
        title="Remove Vendor"
        message={`Remove vendor "${deleteVendorTarget?.vendorName}" from this event?`}
        confirmLabel="Remove"
      />
    </div>
  )
}
