import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, X, Wrench, Car, FileText, ChevronDown, ChevronUp, Receipt, Search, History, Bell, Gauge } from 'lucide-react'
import { Card } from '@shared/ui/molecules/Card'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { CustomerPicker } from '@shared/ui/molecules/CustomerPicker'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { cn } from '@shared/utils/cn'
import { useNotificationStore } from '@app/store/notification.store'

const api = window.api

interface ServiceItem { name: string; quantity: number; unitPrice: number }
// productId links this line to a real catalog Product — set only when the
// part was added via the "Search inventory" picker below, never by typing.
// Job cards with a linked part get billed as a real STANDARD invoice line
// (car-job-card.service.ts's generateCarJobInvoice), which is what makes
// billing.service.ts actually deduct it from Inventory. A part typed in
// free-text (no productId) keeps working exactly as before — it's just not
// tracked against stock.
interface PartItem { name: string; partNumber?: string; quantity: number; unitPrice: number; productId?: string }
interface InventoryProduct { id: string; productName: string; sku?: string | null; sellingPrice: number; inventory?: { quantity: number } | null }

interface CarJobCard {
  id: string
  jobNumber: string
  clientId: string
  client: { id: string; customerName: string; phone?: string | null }
  vehicleNumber: string
  vehicleMake: string
  vehicleModel: string
  vehicleYear?: number | null
  vehicleType: string
  kmIn?: number | null
  kmOut?: number | null
  serviceAdvisorId?: string | null
  serviceAdvisor?: { id: string; fullName: string } | null
  technicianIds: string
  serviceItems: string
  partsItems: string
  laborTotal: number
  partsTotal: number
  estimatedDelivery?: string | null
  deliveredDate?: string | null
  status: string
  invoiceId?: string | null
  notes?: string | null
  internalNotes?: string | null
  nextServiceDueDate?: string | null
  nextServiceDueKm?: number | null
  createdAt: string
}

interface DueVehicle {
  vehicleNumber: string
  vehicleMake: string
  vehicleModel: string
  client: { id: string; customerName: string; phone: string | null }
  latestJobCardId: string
  latestJobNumber: string
  lastKmOut: number | null
  nextServiceDueDate: string | null
  nextServiceDueKm: number | null
  dueForService: boolean
  overdue: boolean
}

interface Customer { id: string; customerName: string; phone: string | null }
interface Employee { id: string; fullName: string }

const STATUS_STEPS = ['RECEIVED', 'INSPECTION', 'IN_PROGRESS', 'WAITING_PARTS', 'READY', 'DELIVERED']
const STATUS_NEXT: Record<string, string> = {
  RECEIVED: 'INSPECTION',
  INSPECTION: 'IN_PROGRESS',
  IN_PROGRESS: 'READY',        // direct — WAITING_PARTS set manually when needed
  WAITING_PARTS: 'READY',      // if parts were needed, advance to READY when done
  READY: 'DELIVERED',
}
const STATUS_LABELS: Record<string, string> = {
  RECEIVED: 'Received', INSPECTION: 'Inspection', IN_PROGRESS: 'In Progress',
  WAITING_PARTS: 'Waiting Parts', READY: 'Ready', DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
}
// Verified exhaustive against CarJobCard.status in prisma/schema.prisma
// ("RECEIVED|INSPECTION|IN_PROGRESS|WAITING_PARTS|READY|DELIVERED|CANCELLED")
// and src/main/services/car-job-card.service.ts (only ever sets 'READY' via
// generateInvoice, plus whatever caller passes through update/create).
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  RECEIVED: 'neutral',
  INSPECTION: 'info',
  IN_PROGRESS: 'warning',
  WAITING_PARTS: 'warning',
  READY: 'success',
  DELIVERED: 'success',
  CANCELLED: 'danger',
}
const VEHICLE_TYPES = ['2W', '4W', 'COMMERCIAL', 'OTHER']

const parseSafe = <T,>(raw: unknown, fallback: T): T => {
  if (typeof raw === 'string') { try { return JSON.parse(raw) as T } catch { return fallback } }
  return fallback
}

// Prisma DateTime fields survive Electron's IPC structured clone as real
// Date instances, not strings — calling .slice() directly on one throws
// "d.slice is not a function". Handles both shapes so it's safe regardless
// of how the value arrived.
const dateSlice = (d: unknown): string => {
  if (!d) return ''
  return (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10)
}

function emptyForm() {
  return {
    vehicleNumber: '', vehicleMake: '', vehicleModel: '',
    vehicleYear: '', vehicleType: '4W', kmIn: '',
    serviceAdvisorId: '', technicianIds: [] as string[],
    serviceItems: [] as ServiceItem[], partsItems: [] as PartItem[],
    estimatedDelivery: '', notes: '', internalNotes: '', status: 'RECEIVED',
    kmOut: '', deliveredDate: '',
    nextServiceDueDate: '', nextServiceDueKm: '',
  }
}

export default function CarJobCardsScreen() {
  const { error: toastError } = useNotificationStore()
  const [cards, setCards] = useState<CarJobCard[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState({ active: 0, readyForPickup: 0, deliveredThisMonth: 0 })
  const [showForm, setShowForm] = useState(false)
  const [editCard, setEditCard] = useState<CarJobCard | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [formError, setFormError] = useState('')
  const [formSaving, setFormSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [invoiceBanners, setInvoiceBanners] = useState<Record<string, { ok: boolean; msg: string }>>({})
  const [invoiceLoading, setInvoiceLoading] = useState<string | null>(null)
  const [pickedClient, setPickedClient] = useState<Customer | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [partQuery, setPartQuery] = useState('')
  const [partResults, setPartResults] = useState<InventoryProduct[]>([])
  const [deleteTarget, setDeleteTarget] = useState<CarJobCard | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Vehicles view (Phase 58 §2)
  const [view, setView] = useState<'jobs' | 'vehicles'>('jobs')
  const [dueVehicles, setDueVehicles] = useState<DueVehicle[]>([])
  const [dueVehiclesLoading, setDueVehiclesLoading] = useState(false)
  const [historyVehicle, setHistoryVehicle] = useState<string | null>(null)
  const [vehicleHistory, setVehicleHistory] = useState<CarJobCard[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [reminderBanners, setReminderBanners] = useState<Record<string, { ok: boolean; msg: string }>>({})
  const [reminderSending, setReminderSending] = useState<string | null>(null)

  const loadDueVehicles = useCallback(async () => {
    setDueVehiclesLoading(true)
    try {
      const res = await api.carJobCard.vehiclesDueForService({ dueSoonDays: 14 })
      if (res.success) setDueVehicles(res.data as DueVehicle[])
    } finally {
      setDueVehiclesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (view === 'vehicles') loadDueVehicles()
  }, [view, loadDueVehicles])

  async function openVehicleHistory(vehicleNumber: string) {
    setHistoryVehicle(vehicleNumber)
    setHistoryLoading(true)
    try {
      const res = await api.carJobCard.vehicleHistory({ vehicleNumber })
      if (res.success) setVehicleHistory(res.data as CarJobCard[])
      else setVehicleHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  async function handleSendReminder(jobCardId: string) {
    setReminderSending(jobCardId)
    setReminderBanners(prev => { const n = { ...prev }; delete n[jobCardId]; return n })
    const res = await api.carJobCard.scheduleServiceReminder({ jobCardId })
    setReminderSending(null)
    if (res.success) {
      setReminderBanners(prev => ({ ...prev, [jobCardId]: { ok: true, msg: 'Reminder scheduled.' } }))
    } else {
      setReminderBanners(prev => ({ ...prev, [jobCardId]: { ok: false, msg: res.error?.message ?? 'Could not schedule reminder.' } }))
    }
  }

  // Debounced inventory search for linking a part to a real Product, same
  // pattern BulkOrderScreen uses for its product picker.
  useEffect(() => {
    if (!partQuery.trim()) { setPartResults([]); return }
    const t = setTimeout(async () => {
      const res = await api.products.search(partQuery.trim())
      if (res.success && res.data) setPartResults(res.data as InventoryProduct[])
    }, 250)
    return () => clearTimeout(t)
  }, [partQuery])

  const loadKpis = useCallback(() => {
    api.carJobCard.kpis().then(r => { if (r.success) setKpis(r.data as typeof kpis) }).catch(() => {})
  }, [])

  const loadCards = useCallback(async (status?: string, q?: string) => {
    try {
      const filters: { status?: string; search?: string } = {}
      if (status) filters.status = status
      if (q) filters.search = q
      const res = await api.carJobCard.list(filters)
      if (res.success) setCards(res.data as CarJobCard[])
      else toastError('Error', res.error?.message ?? 'Could not load job cards.')
    } catch {
      toastError('Error', 'Could not load job cards.')
    }
  }, [toastError])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      loadCards(statusFilter || undefined, search || undefined),
      loadKpis(),
      api.hr.listEmployees({ isActive: true }).then((r: { success: boolean; data?: unknown }) => {
        if (!r.success) return
        const d = r.data as { employees?: Employee[] } | Employee[]
        setEmployees(Array.isArray(d) ? d : (d.employees ?? []))
      }),
    ]).finally(() => setLoading(false))
  }, [])

  function handleFilterChange(s: string) {
    setStatusFilter(s)
    loadCards(s || undefined, search || undefined)
  }

  function handleSearch(q: string) {
    setSearch(q)
    loadCards(statusFilter || undefined, q || undefined)
  }

  function openCreate() {
    setEditCard(null)
    setForm(emptyForm())
    setPickedClient(null)
    setFormError('')
    setShowForm(true)
  }

  function openEdit(card: CarJobCard) {
    setEditCard(card)
    setForm({
      vehicleNumber: card.vehicleNumber,
      vehicleMake: card.vehicleMake,
      vehicleModel: card.vehicleModel,
      vehicleYear: card.vehicleYear != null ? String(card.vehicleYear) : '',
      vehicleType: card.vehicleType,
      kmIn: card.kmIn != null ? String(card.kmIn) : '',
      kmOut: card.kmOut != null ? String(card.kmOut) : '',
      serviceAdvisorId: card.serviceAdvisorId ?? '',
      technicianIds: parseSafe<string[]>(card.technicianIds, []),
      serviceItems: parseSafe<ServiceItem[]>(card.serviceItems, []),
      partsItems: parseSafe<PartItem[]>(card.partsItems, []),
      estimatedDelivery: dateSlice(card.estimatedDelivery),
      deliveredDate: dateSlice(card.deliveredDate),
      notes: card.notes ?? '',
      internalNotes: card.internalNotes ?? '',
      status: card.status,
      nextServiceDueDate: dateSlice(card.nextServiceDueDate),
      nextServiceDueKm: card.nextServiceDueKm != null ? String(card.nextServiceDueKm) : '',
    })
    setFormError('')
    setShowForm(true)
  }

  async function handleSave() {
    if (!editCard && !pickedClient) { setFormError('Client is required.'); return }
    if (!form.vehicleNumber.trim()) { setFormError('Vehicle number is required.'); return }
    if (!form.vehicleMake.trim()) { setFormError('Vehicle make is required.'); return }
    if (!form.vehicleModel.trim()) { setFormError('Vehicle model is required.'); return }
    setFormSaving(true)
    setFormError('')
    const payload = {
      clientId: editCard ? editCard.clientId : pickedClient!.id,
      vehicleNumber: form.vehicleNumber,
      vehicleMake: form.vehicleMake,
      vehicleModel: form.vehicleModel,
      vehicleYear: form.vehicleYear ? parseInt(form.vehicleYear) : undefined,
      vehicleType: form.vehicleType,
      kmIn: form.kmIn ? parseInt(form.kmIn) : undefined,
      kmOut: form.kmOut ? parseInt(form.kmOut) : undefined,
      serviceAdvisorId: form.serviceAdvisorId || undefined,
      technicianIds: form.technicianIds,
      serviceItems: form.serviceItems,
      partsItems: form.partsItems,
      estimatedDelivery: form.estimatedDelivery || undefined,
      deliveredDate: form.deliveredDate || undefined,
      notes: form.notes || undefined,
      internalNotes: form.internalNotes || undefined,
      status: form.status,
      nextServiceDueDate: form.nextServiceDueDate || undefined,
      nextServiceDueKm: form.nextServiceDueKm ? parseInt(form.nextServiceDueKm) : undefined,
    }
    const res = editCard
      ? await api.carJobCard.update({ id: editCard.id, ...payload })
      : await api.carJobCard.create(payload)
    setFormSaving(false)
    if (res.success) {
      setShowForm(false)
      await loadCards(statusFilter || undefined, search || undefined)
      loadKpis()
    } else {
      setFormError(res.error?.message ?? 'Save failed.')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setActionError(null)
    const res = await api.carJobCard.delete(deleteTarget.id)
    if (res.success) { setDeleteTarget(null); await loadCards(statusFilter || undefined, search || undefined); loadKpis() }
    else setActionError(res.error?.message ?? 'Failed to delete job card.')
    setDeleting(false)
  }

  async function handleAdvanceStatus(card: CarJobCard) {
    const next = STATUS_NEXT[card.status]
    if (!next) return
    setActionError(null)
    const res = await api.carJobCard.update({ id: card.id, status: next, ...(next === 'DELIVERED' ? { deliveredDate: new Date().toISOString().slice(0, 10) } : {}) })
    if (res.success) { await loadCards(statusFilter || undefined, search || undefined); loadKpis() }
    else setActionError(res.error?.message ?? 'Failed to update status.')
  }

  async function handleGenerateInvoice(card: CarJobCard) {
    setInvoiceLoading(card.id)
    setInvoiceBanners(prev => { const n = { ...prev }; delete n[card.id]; return n })
    const res = await api.carJobCard.generateInvoice(card.id)
    setInvoiceLoading(null)
    if (res.success) {
      setInvoiceBanners(prev => ({ ...prev, [card.id]: { ok: true, msg: 'Invoice generated successfully.' } }))
      await loadCards(statusFilter || undefined, search || undefined)
    } else {
      setInvoiceBanners(prev => ({ ...prev, [card.id]: { ok: false, msg: res.error?.message ?? 'Invoice generation failed.' } }))
    }
  }

  const laborTotal = form.serviceItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const partsTotal = form.partsItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0)

  function addServiceItem() { setForm(f => ({ ...f, serviceItems: [...f.serviceItems, { name: '', quantity: 1, unitPrice: 0 }] })) }
  function updateServiceItem(idx: number, field: keyof ServiceItem, val: string) {
    setForm(f => ({ ...f, serviceItems: f.serviceItems.map((it, i) => i === idx ? { ...it, [field]: field === 'name' ? val : parseFloat(val) || 0 } : it) }))
  }
  function removeServiceItem(idx: number) { setForm(f => ({ ...f, serviceItems: f.serviceItems.filter((_, i) => i !== idx) })) }

  function addPartItem() { setForm(f => ({ ...f, partsItems: [...f.partsItems, { name: '', partNumber: '', quantity: 1, unitPrice: 0 }] })) }
  function addLinkedPart(p: InventoryProduct) {
    setForm(f => {
      const existing = f.partsItems.find(i => i.productId === p.id)
      if (existing) {
        return { ...f, partsItems: f.partsItems.map(i => i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i) }
      }
      return { ...f, partsItems: [...f.partsItems, { name: p.productName, partNumber: p.sku ?? '', quantity: 1, unitPrice: p.sellingPrice, productId: p.id }] }
    })
    setPartQuery(''); setPartResults([])
  }
  function updatePartItem(idx: number, field: keyof PartItem, val: string) {
    setForm(f => ({ ...f, partsItems: f.partsItems.map((it, i) => i === idx ? { ...it, [field]: field === 'name' || field === 'partNumber' ? val : parseFloat(val) || 0 } : it) }))
  }
  function removePartItem(idx: number) { setForm(f => ({ ...f, partsItems: f.partsItems.filter((_, i) => i !== idx) })) }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 px-6 py-4 flex items-center justify-between dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
            <Car size={18} className="text-orange-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Job Cards</h1>
            <p className="text-xs text-gray-500 dark:text-slate-400">Vehicle service tracking</p>
          </div>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
          <Plus size={16} /> New Job Card
        </button>
      </div>

      {/* View switcher (Phase 58 §2) */}
      <div className="px-6 pt-4 flex gap-2">
        <button
          onClick={() => setView('jobs')}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${view === 'jobs' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 border-gray-300 dark:border-slate-600 hover:border-orange-400'}`}
        >
          Job Cards
        </button>
        <button
          onClick={() => setView('vehicles')}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center gap-1.5 ${view === 'vehicles' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 border-gray-300 dark:border-slate-600 hover:border-orange-400'}`}
        >
          <Gauge size={14} /> Vehicles
        </button>
      </div>

      {view === 'jobs' ? (
        <>
      {/* KPI bar */}
      <div className="grid grid-cols-3 gap-4 px-6 py-4">
        <KpiCard label="Active Jobs" value={kpis.active} color="warning" />
        <KpiCard label="Ready for Pickup" value={kpis.readyForPickup} color="success" />
        <KpiCard label="Delivered This Month" value={kpis.deliveredThisMonth} color="info" />
      </div>

      {/* Filter tabs + search */}
      <div className="px-6 flex items-center gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {['', ...STATUS_STEPS, 'CANCELLED'].map(s => (
            <button
              key={s}
              onClick={() => handleFilterChange(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${statusFilter === s ? 'bg-orange-600 text-white border-orange-600' : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 border-gray-300 dark:border-slate-600 hover:border-orange-400'}`}
            >
              {s ? STATUS_LABELS[s] : 'All'}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Vehicle No, Make, Client…"
            className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs w-52 focus:ring-2 focus:ring-orange-400 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Error banner */}
      {actionError && (
        <div className="mx-6 mt-3 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2 flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-400"><X size={14} /></button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="text-center py-20 text-gray-400 dark:text-slate-500">Loading...</div>
        ) : cards.length === 0 ? (
          <div className="text-center py-20 text-gray-400 dark:text-slate-500">
            <Car size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No job cards found. Create one to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cards.map(card => {
              const svcItems = parseSafe<ServiceItem[]>(card.serviceItems, [])
              const prtItems = parseSafe<PartItem[]>(card.partsItems, [])
              const labor = Number(card.laborTotal)
              const parts = Number(card.partsTotal)
              const total = labor + parts
              const isExpanded = expandedId === card.id
              const banner = invoiceBanners[card.id]
              const nextStatus = STATUS_NEXT[card.status]

              return (
                <Card key={card.id} padding="none" className="overflow-hidden">
                  {/* Main row */}
                  <div className="px-5 py-4 flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm dark:text-slate-100">{card.jobNumber}</span>
                        <Badge variant={STATUS_VARIANT[card.status] ?? 'neutral'} size="sm">{STATUS_LABELS[card.status]}</Badge>
                        <Badge variant="neutral" size="sm">{card.vehicleType}</Badge>
                      </div>
                      <div className="text-sm font-medium text-gray-800 mt-1 dark:text-slate-200">
                        {card.vehicleNumber} — {card.vehicleMake} {card.vehicleModel}{card.vehicleYear ? ` (${card.vehicleYear})` : ''}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap dark:text-slate-400">
                        <span>{card.client.customerName}{card.client.phone ? ` · ${card.client.phone}` : ''}</span>
                        {card.kmIn != null && <span>KM In: {card.kmIn}</span>}
                        {card.kmOut != null && <span>KM Out: {card.kmOut}</span>}
                        {card.serviceAdvisor && <span>Advisor: {card.serviceAdvisor.fullName}</span>}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap dark:text-slate-400">
                        {svcItems.length > 0 && <span>{svcItems.length} service item(s)</span>}
                        {prtItems.length > 0 && <span>{prtItems.length} part(s)</span>}
                        {total > 0 && <span className="font-medium text-gray-700 dark:text-slate-300">Total: ₹{total.toFixed(2)}</span>}
                        {card.estimatedDelivery && <span>Est. delivery: {dateSlice(card.estimatedDelivery)}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {nextStatus && card.status !== 'DELIVERED' && card.status !== 'CANCELLED' && (
                        <button onClick={() => handleAdvanceStatus(card)} className="text-xs px-3 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/40 font-medium">
                          → {STATUS_LABELS[nextStatus]}
                        </button>
                      )}
                      {card.status === 'READY' && !card.invoiceId && (
                        <button
                          onClick={() => handleGenerateInvoice(card)}
                          disabled={invoiceLoading === card.id}
                          className="text-xs px-3 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/40 font-medium flex items-center gap-1 disabled:opacity-50"
                        >
                          <Receipt size={12} />{invoiceLoading === card.id ? 'Generating...' : 'Invoice'}
                        </button>
                      )}
                      {card.invoiceId && (
                        <span className="text-xs px-2 py-1 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 font-medium flex items-center gap-1">
                          <FileText size={12} /> Invoiced
                        </span>
                      )}
                      <button onClick={() => openVehicleHistory(card.vehicleNumber)} title="Vehicle service history" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"><History size={15} /></button>
                      <button onClick={() => openEdit(card)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"><Pencil size={15} /></button>
                      <button onClick={() => setDeleteTarget(card)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg dark:text-slate-500"><X size={15} /></button>
                      <button onClick={() => setExpandedId(isExpanded ? null : card.id)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200">
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Invoice banner */}
                  {banner && (
                    <div className={`mx-5 mb-3 text-xs rounded-lg px-3 py-2 flex items-center justify-between ${banner.ok ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'}`}>
                      <span>{banner.msg}</span>
                      <button onClick={() => setInvoiceBanners(prev => { const n = { ...prev }; delete n[card.id]; return n })} className="opacity-60 hover:opacity-100"><X size={12} /></button>
                    </div>
                  )}

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-5 py-4 grid grid-cols-2 gap-6 dark:border-slate-800">
                      <div>
                        <div className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1 dark:text-slate-400"><Wrench size={12} /> Service Items</div>
                        {svcItems.length === 0 ? <p className="text-xs text-gray-400 dark:text-slate-500">No service items</p> : (
                          <table className="w-full text-xs">
                            <thead><tr className="text-gray-500 dark:text-slate-400"><th className="text-left py-1">Item</th><th className="text-right py-1">Qty</th><th className="text-right py-1">Rate</th><th className="text-right py-1">Amount</th></tr></thead>
                            <tbody>
                              {svcItems.map((si, i) => (
                                <tr key={i} className="border-t border-gray-50">
                                  <td className="py-1">{si.name}</td>
                                  <td className="text-right py-1">{si.quantity}</td>
                                  <td className="text-right py-1">₹{si.unitPrice.toFixed(2)}</td>
                                  <td className="text-right py-1 font-medium">₹{(si.quantity * si.unitPrice).toFixed(2)}</td>
                                </tr>
                              ))}
                              <tr className="border-t border-gray-200 font-semibold dark:border-slate-700">
                                <td colSpan={3} className="py-1 text-right text-gray-600 dark:text-slate-400">Labor Total</td>
                                <td className="text-right py-1">₹{labor.toFixed(2)}</td>
                              </tr>
                            </tbody>
                          </table>
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-600 mb-2 dark:text-slate-400">Parts</div>
                        {prtItems.length === 0 ? <p className="text-xs text-gray-400 dark:text-slate-500">No parts</p> : (
                          <table className="w-full text-xs">
                            <thead><tr className="text-gray-500 dark:text-slate-400"><th className="text-left py-1">Part</th><th className="text-left py-1">Part #</th><th className="text-right py-1">Qty</th><th className="text-right py-1">Rate</th><th className="text-right py-1">Amount</th></tr></thead>
                            <tbody>
                              {prtItems.map((pi, i) => (
                                <tr key={i} className="border-t border-gray-50">
                                  <td className="py-1">{pi.name}</td>
                                  <td className="py-1 text-gray-400 dark:text-slate-500">{pi.partNumber || '—'}</td>
                                  <td className="text-right py-1">{pi.quantity}</td>
                                  <td className="text-right py-1">₹{pi.unitPrice.toFixed(2)}</td>
                                  <td className="text-right py-1 font-medium">₹{(pi.quantity * pi.unitPrice).toFixed(2)}</td>
                                </tr>
                              ))}
                              <tr className="border-t border-gray-200 font-semibold dark:border-slate-700">
                                <td colSpan={4} className="py-1 text-right text-gray-600 dark:text-slate-400">Parts Total</td>
                                <td className="text-right py-1">₹{parts.toFixed(2)}</td>
                              </tr>
                            </tbody>
                          </table>
                        )}
                      </div>
                      {(card.notes || card.internalNotes) && (
                        <div className="col-span-2 text-xs text-gray-500 space-y-1 dark:text-slate-400">
                          {card.notes && <p><span className="font-medium text-gray-600 dark:text-slate-400">Notes:</span> {card.notes}</p>}
                          {card.internalNotes && <p><span className="font-medium text-gray-600 dark:text-slate-400">Internal:</span> {card.internalNotes}</p>}
                        </div>
                      )}
                      <div className="col-span-2 text-right text-sm font-semibold text-gray-800 dark:text-slate-200">
                        Grand Total: ₹{total.toFixed(2)} (excl. GST)
                      </div>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>
        </>
      ) : (
        <div className="flex-1 overflow-auto px-6 py-4">
          {/* Vehicles view (Phase 58 §2) — grouped by registration number,
              not a flat search. Each row is that vehicle's MOST RECENT job
              card, flagged due-for-service by date or odometer. */}
          {dueVehiclesLoading ? (
            <div className="text-center py-20 text-gray-400 dark:text-slate-500">Loading...</div>
          ) : dueVehicles.length === 0 ? (
            <div className="text-center py-20 text-gray-400 dark:text-slate-500">
              <Gauge size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No vehicles have a next-service-due date or odometer set yet.</p>
              <p className="text-xs mt-1">Set one when delivering a job card to start tracking.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {dueVehicles.map(v => {
                const banner = reminderBanners[v.latestJobCardId]
                return (
                  <Card key={v.vehicleNumber} padding="none" className="overflow-hidden">
                    <div className="px-5 py-4 flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-semibold text-gray-900 dark:text-slate-100">{v.vehicleNumber}</span>
                          {v.overdue && <Badge variant="danger" size="sm">Overdue</Badge>}
                          {!v.overdue && v.dueForService && <Badge variant="warning" size="sm">Due Soon</Badge>}
                        </div>
                        <div className="text-sm text-gray-700 dark:text-slate-300 mt-1">{v.vehicleMake} {v.vehicleModel}</div>
                        <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap dark:text-slate-400">
                          <span>{v.client.customerName}{v.client.phone ? ` · ${v.client.phone}` : ''}</span>
                          {v.lastKmOut != null && <span>Last KM Out: {v.lastKmOut}</span>}
                          {v.nextServiceDueDate && <span>Due: {dateSlice(v.nextServiceDueDate)}</span>}
                          {v.nextServiceDueKm != null && <span>Due at: {v.nextServiceDueKm} KM</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleSendReminder(v.latestJobCardId)}
                          disabled={reminderSending === v.latestJobCardId || !v.nextServiceDueDate}
                          title={v.nextServiceDueDate ? 'Schedule a WhatsApp reminder' : 'Set a next-service-due date first'}
                          className="text-xs px-3 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/40 font-medium flex items-center gap-1 disabled:opacity-50"
                        >
                          <Bell size={12} /> {reminderSending === v.latestJobCardId ? 'Scheduling...' : 'Remind'}
                        </button>
                        <button
                          onClick={() => openVehicleHistory(v.vehicleNumber)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 font-medium flex items-center gap-1"
                        >
                          <History size={12} /> History
                        </button>
                      </div>
                    </div>
                    {banner && (
                      <div className={`mx-5 mb-3 text-xs rounded-lg px-3 py-2 flex items-center justify-between ${banner.ok ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'}`}>
                        <span>{banner.msg}</span>
                        <button onClick={() => setReminderBanners(prev => { const n = { ...prev }; delete n[v.latestJobCardId]; return n })} className="opacity-60 hover:opacity-100"><X size={12} /></button>
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Vehicle Service History Modal (Phase 58 §2) */}
      {historyVehicle && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 font-mono">{historyVehicle}</h2>
                <p className="text-xs text-gray-500 dark:text-slate-400">Full service history for this vehicle</p>
              </div>
              <button onClick={() => { setHistoryVehicle(null); setVehicleHistory([]) }} className="text-gray-400 hover:text-gray-700 dark:text-slate-500 dark:hover:text-slate-200"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {historyLoading ? (
                <p className="text-center text-sm text-gray-400 dark:text-slate-500 py-8">Loading...</p>
              ) : vehicleHistory.length === 0 ? (
                <p className="text-center text-sm text-gray-400 dark:text-slate-500 py-8">No service history found.</p>
              ) : (
                <div className="space-y-2">
                  {vehicleHistory.map(job => {
                    const total = Number(job.laborTotal) + Number(job.partsTotal)
                    return (
                      <div key={job.id} className="border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">{job.jobNumber}</span>
                          <Badge variant={STATUS_VARIANT[job.status] ?? 'neutral'} size="sm">{STATUS_LABELS[job.status]}</Badge>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                          <span>{dateSlice(job.createdAt)}</span>
                          {job.kmIn != null && <span>KM In: {job.kmIn}</span>}
                          {job.kmOut != null && <span>KM Out: {job.kmOut}</span>}
                          {total > 0 && <span className="font-medium text-gray-700 dark:text-slate-300">Total: ₹{total.toFixed(2)}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">{editCard ? `Edit Job Card — ${editCard.jobNumber}` : 'New Job Card'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700 dark:text-slate-500 dark:hover:text-slate-200"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {formError && <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">{formError}</div>}

              {/* Basic info */}
              <div className="grid grid-cols-2 gap-4">
                {editCard ? (
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">Client</label>
                    <div className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 dark:border-slate-700 dark:bg-slate-800 text-gray-500 dark:text-slate-400">
                      {editCard.client.customerName}
                    </div>
                  </div>
                ) : (
                  <CustomerPicker label="Client *" value={pickedClient} onChange={setPickedClient} placeholder="Search by name or phone..." />
                )}
                <Select label="Vehicle Type" value={form.vehicleType} onChange={e => setForm(f => ({ ...f, vehicleType: e.target.value }))}>
                  {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">Vehicle Number *</label>
                  <input value={form.vehicleNumber} onChange={e => setForm(f => ({ ...f, vehicleNumber: e.target.value.toUpperCase() }))} placeholder="KA 01 AB 1234" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent font-mono dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">Make *</label>
                  <input value={form.vehicleMake} onChange={e => setForm(f => ({ ...f, vehicleMake: e.target.value }))} placeholder="Toyota" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">Model *</label>
                  <input value={form.vehicleModel} onChange={e => setForm(f => ({ ...f, vehicleModel: e.target.value }))} placeholder="Innova Crysta" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">Year</label>
                  <input type="number" value={form.vehicleYear} onChange={e => setForm(f => ({ ...f, vehicleYear: e.target.value }))} placeholder="2022" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">KM In</label>
                  <input type="number" value={form.kmIn} onChange={e => setForm(f => ({ ...f, kmIn: e.target.value }))} placeholder="45000" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                {editCard && (
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">KM Out</label>
                    <input type="number" value={form.kmOut} onChange={e => setForm(f => ({ ...f, kmOut: e.target.value }))} placeholder="45050" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                  </div>
                )}
                <Select label="Service Advisor" value={form.serviceAdvisorId} onChange={e => setForm(f => ({ ...f, serviceAdvisorId: e.target.value }))}>
                  <option value="">None</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                </Select>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">Estimated Delivery</label>
                  <input type="date" value={form.estimatedDelivery} onChange={e => setForm(f => ({ ...f, estimatedDelivery: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                {editCard && (
                  <Select label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {[...STATUS_STEPS, 'CANCELLED'].map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </Select>
                )}
                {editCard && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">Next Service Due (Date)</label>
                      <input type="date" value={form.nextServiceDueDate} onChange={e => setForm(f => ({ ...f, nextServiceDueDate: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">Next Service Due (KM)</label>
                      <input type="number" value={form.nextServiceDueKm} onChange={e => setForm(f => ({ ...f, nextServiceDueKm: e.target.value }))} placeholder="50000" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                    </div>
                  </>
                )}
              </div>

              {/* Technicians */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block dark:text-slate-400">Technicians ({form.technicianIds.length} selected)</label>
                <div className="grid grid-cols-3 gap-2 max-h-28 overflow-y-auto border border-gray-200 rounded-lg p-2 dark:border-slate-700">
                  {employees.map(e => (
                    <label key={e.id} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input type="checkbox" checked={form.technicianIds.includes(e.id)} onChange={ev => setForm(f => ({ ...f, technicianIds: ev.target.checked ? [...f.technicianIds, e.id] : f.technicianIds.filter(x => x !== e.id) }))} className="rounded" />
                      {e.fullName}
                    </label>
                  ))}
                </div>
              </div>

              {/* Service Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">Service Items / Labor</label>
                  <button type="button" onClick={addServiceItem} className="text-xs text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 flex items-center gap-1"><Plus size={12} /> Add</button>
                </div>
                {form.serviceItems.length === 0 ? <p className="text-xs text-gray-400 dark:text-slate-500">No service items yet.</p> : (
                  <div className="space-y-2">
                    {form.serviceItems.map((si, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_80px_100px_32px] gap-2 items-center">
                        <input value={si.name} onChange={e => updateServiceItem(idx, 'name', e.target.value)} placeholder="Service name" className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-orange-400 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                        <input type="number" value={si.quantity} onChange={e => updateServiceItem(idx, 'quantity', e.target.value)} min="1" className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-right focus:ring-2 focus:ring-orange-400 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                        <input type="number" value={si.unitPrice} onChange={e => updateServiceItem(idx, 'unitPrice', e.target.value)} min="0" placeholder="₹ Rate" className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-right focus:ring-2 focus:ring-orange-400 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                        <button onClick={() => removeServiceItem(idx)} className="text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-400"><X size={14} /></button>
                      </div>
                    ))}
                    <div className="text-right text-xs font-medium text-gray-700 dark:text-slate-300">Labor Total: ₹{laborTotal.toFixed(2)}</div>
                  </div>
                )}
              </div>

              {/* Parts */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">Parts / Materials</label>
                  <button type="button" onClick={addPartItem} className="text-xs text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 flex items-center gap-1"><Plus size={12} /> Add free-text part</button>
                </div>

                {/* Search inventory — a part added this way is linked to the real
                    Product/Inventory catalog, so it's actually deducted from stock
                    when this job card is billed. Free-text parts (added above) are
                    not tracked against inventory, matching a one-off sourced part. */}
                <div className="relative mb-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
                    <input
                      value={partQuery}
                      onChange={e => setPartQuery(e.target.value)}
                      placeholder="Search inventory to add a tracked part…"
                      className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:ring-2 focus:ring-orange-400 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                    />
                  </div>
                  {partResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {partResults.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => addLinkedPart(p)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-orange-50 dark:hover:bg-slate-700 flex items-center justify-between gap-2"
                        >
                          <span className="text-gray-800 dark:text-slate-200">{p.productName}{p.sku ? ` (${p.sku})` : ''}</span>
                          <span className="text-gray-500 dark:text-slate-400 whitespace-nowrap">₹{p.sellingPrice.toFixed(2)} · stock {p.inventory?.quantity ?? 0}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {form.partsItems.length === 0 ? <p className="text-xs text-gray-400 dark:text-slate-500">No parts yet.</p> : (
                  <div className="space-y-2">
                    {form.partsItems.map((pi, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_100px_80px_100px_32px] gap-2 items-center">
                        <div className="relative">
                          <input
                            value={pi.name}
                            onChange={e => updatePartItem(idx, 'name', e.target.value)}
                            placeholder="Part name"
                            title={pi.productId ? 'Linked to inventory — deducted from stock when billed' : 'Free text — not tracked against inventory'}
                            className={cn(
                              'w-full border rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-orange-400 focus:border-transparent dark:bg-slate-900 text-gray-900 dark:text-slate-100',
                              pi.productId ? 'border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30 pr-6' : 'border-gray-300 dark:border-slate-600 bg-white'
                            )}
                          />
                          {pi.productId && <Search size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-orange-500 dark:text-orange-400" />}
                        </div>
                        <input value={pi.partNumber ?? ''} onChange={e => updatePartItem(idx, 'partNumber', e.target.value)} placeholder="Part #" className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-orange-400 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                        <input type="number" value={pi.quantity} onChange={e => updatePartItem(idx, 'quantity', e.target.value)} min="1" className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-right focus:ring-2 focus:ring-orange-400 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                        <input type="number" value={pi.unitPrice} onChange={e => updatePartItem(idx, 'unitPrice', e.target.value)} min="0" placeholder="₹ Rate" className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-right focus:ring-2 focus:ring-orange-400 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                        <button onClick={() => removePartItem(idx)} className="text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-400"><X size={14} /></button>
                      </div>
                    ))}
                    <div className="text-right text-xs font-medium text-gray-700 dark:text-slate-300">Parts Total: ₹{partsTotal.toFixed(2)}</div>
                  </div>
                )}
              </div>
              {(form.serviceItems.length > 0 || form.partsItems.length > 0) && (
                <div className="text-right text-sm font-semibold text-gray-800 border-t border-gray-100 pt-2 dark:border-slate-800 dark:text-slate-200">
                  Grand Total: ₹{(laborTotal + partsTotal).toFixed(2)} (excl. GST)
                </div>
              )}

              {/* Notes */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">Customer Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">Internal Notes</label>
                  <textarea value={form.internalNotes} onChange={e => setForm(f => ({ ...f, internalNotes: e.target.value }))} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 dark:border-slate-700">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800">Cancel</button>
              <button onClick={handleSave} disabled={formSaving} className="px-5 py-2 text-sm font-medium bg-orange-600 hover:bg-orange-700 text-white rounded-lg disabled:opacity-50">
                {formSaving ? 'Saving...' : editCard ? 'Update' : 'Create Job Card'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Job Card"
        message={`Delete job card "${deleteTarget?.jobNumber}"?`}
        confirmLabel="Delete"
      />
    </div>
  )
}
