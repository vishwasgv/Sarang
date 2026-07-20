import { Fragment, useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, X, Scissors, Ruler, Receipt, FileText, Search, CalendarClock, Shirt } from 'lucide-react'
import { Card } from '@shared/ui/molecules/Card'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { CustomerPicker } from '@shared/ui/molecules/CustomerPicker'
import { Tabs } from '@shared/ui/molecules/Tabs'
import { formatCurrency } from '@shared/utils/currency.util'
import { useBusinessStore } from '@app/store/business.store'
import { useNotificationStore } from '@app/store/notification.store'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'

const api = window.api

interface MeasurementRecord {
  id: string
  clientId: string
  chest?: number | null
  waist?: number | null
  hips?: number | null
  shoulder?: number | null
  neck?: number | null
  sleeve?: number | null
  inseam?: number | null
  outseam?: number | null
  thigh?: number | null
  height?: number | null
  armhole?: number | null
  frontNeckDepth?: number | null
  backNeckDepth?: number | null
  garmentLength?: number | null
  cuff?: number | null
  notes?: string | null
  takenById?: string | null
  takenBy?: { id: string; fullName: string } | null
  recordDate: string
}

interface TailoringOrder {
  id: string
  orderNumber: string
  clientId: string
  client: { id: string; customerName: string; phone: string | null }
  measurementRecordId?: string | null
  measurement?: { id: string; recordDate: string } | null
  garmentType: string
  gender?: string | null
  styleRegion?: string | null
  fabricDescription?: string | null
  fabricSupplied: string
  quantity: number
  unitPrice: number
  totalAmount: number
  advancePaid: number
  trialDate?: string | null
  deliveryDate?: string | null
  deliveredDate?: string | null
  status: string
  assignedToId?: string | null
  assignedTo?: { id: string; fullName: string } | null
  invoiceId?: string | null
  specialInstructions?: string | null
  notes?: string | null
  trialAppointmentId?: string | null
  fabricProductId?: string | null
  fabricQuantity?: number | null
  createdAt: string
}

interface Customer { id: string; customerName: string; phone: string | null }
interface Employee { id: string; fullName: string }
interface FabricProduct { id: string; productName: string; sellingPrice: number; inventory?: { quantity: number } | null }

const GARMENT_TYPES = ['SHIRT', 'PANT', 'SUIT', 'KURTA', 'SALWAR_KAMEEZ', 'BLOUSE', 'LEHENGA', 'SAREE_BLOUSE', 'JACKET', 'OTHER']
const STATUS_STEPS = ['RECEIVED', 'IN_CUTTING', 'IN_STITCHING', 'TRIAL_SCHEDULED', 'ALTERATIONS', 'READY', 'DELIVERED']
const STATUS_NEXT: Record<string, string> = {
  RECEIVED: 'IN_CUTTING', IN_CUTTING: 'IN_STITCHING', IN_STITCHING: 'TRIAL_SCHEDULED',
  TRIAL_SCHEDULED: 'READY',   // direct — ALTERATIONS set manually when needed
  ALTERATIONS: 'READY',       // if alterations were needed, advance to READY
  READY: 'DELIVERED',
}
// TailoringOrder.status — RECEIVED|IN_CUTTING|IN_STITCHING|TRIAL_SCHEDULED|ALTERATIONS|READY|DELIVERED|CANCELLED (prisma/schema.prisma)
const STATUS_VARIANT: Record<string, 'neutral' | 'info' | 'brand' | 'warning' | 'success' | 'danger'> = {
  RECEIVED: 'neutral',
  IN_CUTTING: 'info',
  IN_STITCHING: 'brand',
  TRIAL_SCHEDULED: 'warning',
  ALTERATIONS: 'warning',
  READY: 'success',
  DELIVERED: 'success',
  CANCELLED: 'danger',
}

const MEASUREMENT_FIELDS: { key: keyof MeasurementRecord }[] = [
  { key: 'chest' }, { key: 'waist' }, { key: 'hips' },
  { key: 'shoulder' }, { key: 'neck' }, { key: 'sleeve' },
  { key: 'inseam' }, { key: 'outseam' }, { key: 'thigh' },
  { key: 'height' }, { key: 'armhole' }, { key: 'frontNeckDepth' },
  { key: 'backNeckDepth' }, { key: 'garmentLength' }, { key: 'cuff' },
]

// Prisma DateTime fields survive Electron's IPC structured clone as real
// Date instances, not strings — calling .slice() directly on one throws
// "d.slice is not a function". Handles both shapes so it's safe regardless
// of how the value arrived.
const dateSlice = (d: unknown): string => {
  if (!d) return ''
  return (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10)
}

function emptyOrderForm() {
  return {
    measurementRecordId: '', garmentType: 'SHIRT', gender: '', styleRegion: '', fabricDescription: '',
    fabricSupplied: 'CLIENT', quantity: '1', unitPrice: '', advancePaid: '0',
    trialDate: '', deliveryDate: '', assignedToId: '', specialInstructions: '', notes: '', status: 'RECEIVED',
  }
}
function emptyMeasForm() {
  return {
    chest: '', waist: '', hips: '', shoulder: '', neck: '', sleeve: '', inseam: '', outseam: '', thigh: '', height: '',
    armhole: '', frontNeckDepth: '', backNeckDepth: '', garmentLength: '', cuff: '', notes: '', takenById: '',
  }
}

export default function TailoringScreen() {
  const { t } = useTranslation()
  const { error: toastError } = useNotificationStore()
  const currSym = useBusinessStore(s => s.profile?.currencySymbol ?? '₹')
  const [tab, setTab] = useState<'orders' | 'measurements'>('orders')
  const [orders, setOrders] = useState<TailoringOrder[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState({ activeOrders: 0, readyForPickup: 0, deliveredThisMonth: 0 })
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [editOrder, setEditOrder] = useState<TailoringOrder | null>(null)
  const [orderForm, setOrderForm] = useState(emptyOrderForm())
  const [orderFormError, setOrderFormError] = useState('')
  const [orderSaving, setOrderSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [invoiceBanners, setInvoiceBanners] = useState<Record<string, { ok: boolean; msg: string }>>({})
  const [invoiceLoading, setInvoiceLoading] = useState<string | null>(null)
  const [pickedOrderClient, setPickedOrderClient] = useState<Customer | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  // Measurements tab state
  const [pickedMeasClient, setPickedMeasClient] = useState<Customer | null>(null)
  const measClientId = pickedMeasClient?.id ?? ''
  const [measurements, setMeasurements] = useState<MeasurementRecord[]>([])
  const [editMeas, setEditMeas] = useState<MeasurementRecord | null>(null)
  const [showMeasForm, setShowMeasForm] = useState(false)
  const [measForm, setMeasForm] = useState(emptyMeasForm())
  const [measSaving, setMeasSaving] = useState(false)
  const [measError, setMeasError] = useState('')
  const [clientMeasurements, setClientMeasurements] = useState<Record<string, MeasurementRecord[]>>({})
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null)
  const [deletingOrder, setDeletingOrder] = useState(false)
  const [deleteMeasId, setDeleteMeasId] = useState<string | null>(null)
  const [deletingMeas, setDeletingMeas] = useState(false)

  // Trial appointment (Phase 58 §2)
  const [trialOrderId, setTrialOrderId] = useState<string | null>(null)
  const [trialForm, setTrialForm] = useState({ scheduledDate: '', scheduledTime: '10:00', providerId: '' })
  const [trialSaving, setTrialSaving] = useState(false)
  const [trialError, setTrialError] = useState('')

  // Fabric-stock deduction (Phase 58 §2)
  const [fabricOrderId, setFabricOrderId] = useState<string | null>(null)
  const [fabricSearch, setFabricSearch] = useState('')
  const [fabricResults, setFabricResults] = useState<FabricProduct[]>([])
  const [pickedFabric, setPickedFabric] = useState<FabricProduct | null>(null)
  const [fabricQty, setFabricQty] = useState('1')
  const [fabricSaving, setFabricSaving] = useState(false)
  const [fabricError, setFabricError] = useState('')

  useEffect(() => {
    if (!fabricSearch.trim()) { setFabricResults([]); return }
    const timer = setTimeout(async () => {
      const res = await api.products.search(fabricSearch.trim())
      if (res.success && res.data) setFabricResults(res.data as FabricProduct[])
    }, 250)
    return () => clearTimeout(timer)
  }, [fabricSearch])

  function openTrialModal(orderId: string) {
    setTrialOrderId(orderId)
    setTrialForm({ scheduledDate: '', scheduledTime: '10:00', providerId: '' })
    setTrialError('')
  }

  async function handleScheduleTrial() {
    if (!trialOrderId) return
    if (!trialForm.scheduledDate) { setTrialError(t('tailoring.errors.trialDateRequired')); return }
    setTrialSaving(true)
    setTrialError('')
    const res = await api.tailoringOrder.scheduleTrialAppointment({
      orderId: trialOrderId,
      scheduledDate: trialForm.scheduledDate,
      scheduledTime: trialForm.scheduledTime,
      providerId: trialForm.providerId || undefined,
    })
    setTrialSaving(false)
    if (res.success) {
      setTrialOrderId(null)
      await loadOrders(statusFilter || undefined, search || undefined)
    } else {
      setTrialError(res.error?.message ?? t('tailoring.errors.saveFailed'))
    }
  }

  function openFabricModal(orderId: string) {
    setFabricOrderId(orderId)
    setFabricSearch('')
    setFabricResults([])
    setPickedFabric(null)
    setFabricQty('1')
    setFabricError('')
  }

  async function handleSetFabric() {
    if (!fabricOrderId || !pickedFabric) return
    const qty = parseFloat(fabricQty)
    if (!qty || qty <= 0) { setFabricError(t('tailoring.errors.fabricQuantityInvalid')); return }
    setFabricSaving(true)
    setFabricError('')
    const res = await api.tailoringOrder.setFabric({ orderId: fabricOrderId, fabricProductId: pickedFabric.id, fabricQuantity: qty })
    setFabricSaving(false)
    if (res.success) {
      setFabricOrderId(null)
      await loadOrders(statusFilter || undefined, search || undefined)
    } else {
      setFabricError(res.error?.message ?? t('tailoring.errors.saveFailed'))
    }
  }

  async function handleClearFabric(orderId: string) {
    setActionError(null)
    const res = await api.tailoringOrder.clearFabric(orderId)
    if (res.success) await loadOrders(statusFilter || undefined, search || undefined)
    else setActionError(res.error?.message ?? t('tailoring.errors.saveFailed'))
  }

  const statusLabel = (s: string) => t(`tailoring.status.${s}`, STATUS_LABELS_FALLBACK[s] ?? s)
  const garmentLabel = (g: string) => t(`tailoring.garmentTypes.${g}`, g.replace(/_/g, ' '))
  const measFieldLabel = (key: string) => t(`tailoring.measurements.fields.${key}`, key)

  const loadKpis = useCallback(() => {
    api.tailoringOrder.kpis().then(r => { if (r.success) setKpis(r.data as typeof kpis) })
  }, [])

  const loadOrders = useCallback(async (status?: string, q?: string) => {
    try {
      const filters: { status?: string; search?: string } = {}
      if (status) filters.status = status
      if (q) filters.search = q
      const res = await api.tailoringOrder.list(filters)
      if (res.success) setOrders(res.data as TailoringOrder[])
      else toastError(t('common.error'), res.error?.message ?? t('common.error'))
    } catch {
      toastError(t('common.error'), t('common.error'))
    }
  }, [toastError, t])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      loadOrders(statusFilter || undefined, search || undefined),
      loadKpis(),
      api.hr.listEmployees({ isActive: true }).then((r: { success: boolean; data?: unknown }) => {
        if (!r.success) return
        const d = r.data as { employees?: Employee[] } | Employee[]
        setEmployees(Array.isArray(d) ? d : (d.employees ?? []))
      }),
    ]).finally(() => setLoading(false))
  }, [])

  async function loadMeasurementsForClient(cid: string) {
    if (!cid) return
    const res = await api.measurementRecord.list(cid)
    if (res.success) {
      const recs = res.data as MeasurementRecord[]
      setMeasurements(recs)
      setClientMeasurements(prev => ({ ...prev, [cid]: recs }))
    }
  }

  useEffect(() => {
    if (measClientId) loadMeasurementsForClient(measClientId)
    else setMeasurements([])
  }, [measClientId])

  function handleFilterChange(s: string) {
    setStatusFilter(s)
    loadOrders(s || undefined, search || undefined)
  }

  function handleSearch(q: string) {
    setSearch(q)
    loadOrders(statusFilter || undefined, q || undefined)
  }

  function openCreateOrder() {
    setEditOrder(null)
    setOrderForm(emptyOrderForm())
    setPickedOrderClient(null)
    setOrderFormError('')
    setShowOrderForm(true)
  }

  function openEditOrder(order: TailoringOrder) {
    setEditOrder(order)
    setPickedOrderClient(order.client)
    setOrderForm({
      measurementRecordId: order.measurementRecordId ?? '',
      garmentType: order.garmentType,
      gender: order.gender ?? '',
      styleRegion: order.styleRegion ?? '',
      fabricDescription: order.fabricDescription ?? '',
      fabricSupplied: order.fabricSupplied,
      quantity: String(order.quantity),
      unitPrice: String(order.unitPrice),
      advancePaid: String(order.advancePaid),
      trialDate: dateSlice(order.trialDate),
      deliveryDate: dateSlice(order.deliveryDate),
      assignedToId: order.assignedToId ?? '',
      specialInstructions: order.specialInstructions ?? '',
      notes: order.notes ?? '',
      status: order.status,
    })
    setOrderFormError('')
    setShowOrderForm(true)
  }

  async function handleSaveOrder() {
    if (!editOrder && !pickedOrderClient) { setOrderFormError(t('tailoring.errors.clientRequired')); return }
    if (!orderForm.garmentType) { setOrderFormError(t('tailoring.errors.garmentTypeRequired')); return }
    const unitPrice = parseFloat(orderForm.unitPrice)
    if (isNaN(unitPrice) || unitPrice < 0) { setOrderFormError(t('tailoring.errors.unitPriceInvalid')); return }
    setOrderSaving(true)
    setOrderFormError('')
    const payload = {
      clientId: editOrder ? editOrder.clientId : pickedOrderClient!.id,
      measurementRecordId: orderForm.measurementRecordId || undefined,
      garmentType: orderForm.garmentType,
      gender: orderForm.gender || undefined,
      styleRegion: orderForm.styleRegion || undefined,
      fabricDescription: orderForm.fabricDescription || undefined,
      fabricSupplied: orderForm.fabricSupplied,
      quantity: parseInt(orderForm.quantity) || 1,
      unitPrice,
      advancePaid: parseFloat(orderForm.advancePaid) || 0,
      trialDate: orderForm.trialDate || undefined,
      deliveryDate: orderForm.deliveryDate || undefined,
      assignedToId: orderForm.assignedToId || undefined,
      specialInstructions: orderForm.specialInstructions || undefined,
      notes: orderForm.notes || undefined,
      status: orderForm.status,
    }
    const res = editOrder
      ? await api.tailoringOrder.update({ id: editOrder.id, ...payload })
      : await api.tailoringOrder.create(payload)
    setOrderSaving(false)
    if (res.success) { setShowOrderForm(false); await loadOrders(statusFilter || undefined, search || undefined); loadKpis() }
    else setOrderFormError(res.error?.message ?? t('tailoring.errors.saveFailed'))
  }

  async function handleDeleteOrder(id: string) {
    setActionError(null)
    setDeletingOrder(true)
    const res = await api.tailoringOrder.delete(id)
    setDeletingOrder(false)
    if (res.success) { setDeleteOrderId(null); await loadOrders(statusFilter || undefined, search || undefined); loadKpis() }
    else setActionError(res.error?.message ?? t('tailoring.errors.deleteOrderFailed'))
  }

  async function handleAdvanceStatus(order: TailoringOrder) {
    const next = STATUS_NEXT[order.status]
    if (!next) return
    setActionError(null)
    const payload = { id: order.id, status: next, ...(next === 'DELIVERED' ? { deliveredDate: new Date().toISOString().slice(0, 10) } : {}) }
    const res = await api.tailoringOrder.update(payload)
    if (res.success) { await loadOrders(statusFilter || undefined, search || undefined); loadKpis() }
    else setActionError(res.error?.message ?? t('tailoring.errors.updateStatusFailed'))
  }

  async function handleGenerateInvoice(order: TailoringOrder) {
    setInvoiceLoading(order.id)
    setInvoiceBanners(prev => { const n = { ...prev }; delete n[order.id]; return n })
    const res = await api.tailoringOrder.generateInvoice(order.id)
    setInvoiceLoading(null)
    if (res.success) {
      setInvoiceBanners(prev => ({ ...prev, [order.id]: { ok: true, msg: t('tailoring.invoiceBanner.success') } }))
      await loadOrders(statusFilter || undefined, search || undefined)
    } else {
      setInvoiceBanners(prev => ({ ...prev, [order.id]: { ok: false, msg: res.error?.message ?? t('tailoring.invoiceBanner.failure') } }))
    }
  }

  // Measurements
  function openCreateMeas() {
    if (!measClientId) return
    setEditMeas(null)
    setMeasForm(emptyMeasForm())
    setMeasError('')
    setShowMeasForm(true)
  }

  function openEditMeas(m: MeasurementRecord) {
    setEditMeas(m)
    setMeasForm({
      chest: m.chest != null ? String(m.chest) : '',
      waist: m.waist != null ? String(m.waist) : '',
      hips: m.hips != null ? String(m.hips) : '',
      shoulder: m.shoulder != null ? String(m.shoulder) : '',
      neck: m.neck != null ? String(m.neck) : '',
      sleeve: m.sleeve != null ? String(m.sleeve) : '',
      inseam: m.inseam != null ? String(m.inseam) : '',
      outseam: m.outseam != null ? String(m.outseam) : '',
      thigh: m.thigh != null ? String(m.thigh) : '',
      height: m.height != null ? String(m.height) : '',
      armhole: m.armhole != null ? String(m.armhole) : '',
      frontNeckDepth: m.frontNeckDepth != null ? String(m.frontNeckDepth) : '',
      backNeckDepth: m.backNeckDepth != null ? String(m.backNeckDepth) : '',
      garmentLength: m.garmentLength != null ? String(m.garmentLength) : '',
      cuff: m.cuff != null ? String(m.cuff) : '',
      notes: m.notes ?? '',
      takenById: m.takenById ?? '',
    })
    setMeasError('')
    setShowMeasForm(true)
  }

  async function handleSaveMeas() {
    setMeasSaving(true)
    setMeasError('')
    const toNumOpt = (s: string) => { const n = parseFloat(s); return isNaN(n) ? undefined : n }
    const payload = {
      clientId: measClientId,
      chest: toNumOpt(measForm.chest), waist: toNumOpt(measForm.waist), hips: toNumOpt(measForm.hips),
      shoulder: toNumOpt(measForm.shoulder), neck: toNumOpt(measForm.neck), sleeve: toNumOpt(measForm.sleeve),
      inseam: toNumOpt(measForm.inseam), outseam: toNumOpt(measForm.outseam), thigh: toNumOpt(measForm.thigh),
      height: toNumOpt(measForm.height),
      armhole: toNumOpt(measForm.armhole), frontNeckDepth: toNumOpt(measForm.frontNeckDepth),
      backNeckDepth: toNumOpt(measForm.backNeckDepth), garmentLength: toNumOpt(measForm.garmentLength),
      cuff: toNumOpt(measForm.cuff),
      notes: measForm.notes || undefined,
      takenById: measForm.takenById || undefined,
    }
    const res = editMeas
      ? await api.measurementRecord.update({ id: editMeas.id, ...payload })
      : await api.measurementRecord.create(payload)
    setMeasSaving(false)
    if (res.success) { setShowMeasForm(false); loadMeasurementsForClient(measClientId) }
    else setMeasError(res.error?.message ?? t('tailoring.errors.saveFailed'))
  }

  async function handleDeleteMeas(id: string) {
    setDeletingMeas(true)
    const res = await api.measurementRecord.delete(id)
    setDeletingMeas(false)
    if (res.success) { setDeleteMeasId(null); setMeasurements(ms => ms.filter(m => m.id !== id)) }
    else setActionError(res.error?.message ?? t('tailoring.errors.deleteMeasurementFailed'))
  }

  // For measurement selector in order form: load measurements when clientId changes
  const orderClientId = editOrder ? editOrder.clientId : (pickedOrderClient?.id ?? '')
  useEffect(() => {
    if (orderClientId) {
      api.measurementRecord.list(orderClientId).then(r => {
        if (r.success) setClientMeasurements(prev => ({ ...prev, [orderClientId]: r.data as MeasurementRecord[] }))
      })
    }
  }, [orderClientId])

  const orderClientMeasurements = clientMeasurements[orderClientId] ?? []
  const orderTotal = (parseInt(orderForm.quantity) || 1) * (parseFloat(orderForm.unitPrice) || 0)
  const orderBalance = orderTotal - (parseFloat(orderForm.advancePaid) || 0)

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 px-6 py-4 flex items-center justify-between dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center">
            <Scissors size={18} className="text-violet-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{t('tailoring.title')}</h1>
            <p className="text-xs text-gray-500 dark:text-slate-400">{t('tailoring.subtitle')}</p>
          </div>
        </div>
        <button onClick={tab === 'orders' ? openCreateOrder : openCreateMeas} disabled={tab === 'measurements' && !measClientId} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
          <Plus size={16} />{tab === 'orders' ? t('tailoring.newOrder') : t('tailoring.addMeasurement')}
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 py-3">
        <Tabs
          tabs={[
            { id: 'orders', label: t('tailoring.tabs.orders') },
            { id: 'measurements', label: t('tailoring.tabs.measurements') },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {actionError && (
        <div className="mx-6 mt-3 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2 flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-400"><X size={14} /></button>
        </div>
      )}

      {tab === 'orders' && (
        <>
          {/* KPI bar */}
          <div className="grid grid-cols-3 gap-4 px-6 py-4">
            <KpiCard label={t('tailoring.kpi.activeOrders')} value={kpis.activeOrders} color="brand" />
            <KpiCard label={t('tailoring.kpi.readyForPickup')} value={kpis.readyForPickup} color="success" />
            <KpiCard label={t('tailoring.kpi.deliveredThisMonth')} value={kpis.deliveredThisMonth} color="info" />
          </div>

          {/* Filter + search */}
          <div className="px-6 flex items-center gap-3 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              {['', ...STATUS_STEPS, 'CANCELLED'].map(s => (
                <button key={s} onClick={() => handleFilterChange(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${statusFilter === s ? 'bg-violet-600 text-white border-violet-600' : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 border-gray-300 dark:border-slate-600 hover:border-violet-400'}`}>
                  {s ? statusLabel(s) : t('tailoring.filters.all')}
                </button>
              ))}
            </div>
            <div className="relative ml-auto">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
              <input
                value={search}
                onChange={e => handleSearch(e.target.value)}
                placeholder={t('tailoring.searchPlaceholder')}
                className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs w-52 focus:ring-2 focus:ring-violet-400 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto px-6 py-4">
            {loading ? (
              <div className="text-center py-20 text-gray-400 dark:text-slate-500">{t('common.loading')}</div>
            ) : orders.length === 0 ? (
              <div className="text-center py-20 text-gray-400 dark:text-slate-500">
                <Scissors size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">{t('tailoring.empty.noOrders')}</p>
              </div>
            ) : (
              <Card padding="none" className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 dark:bg-slate-950 dark:border-slate-700">
                    <tr>
                      {[
                        t('tailoring.table.orderNumber'), t('tailoring.table.client'), t('tailoring.table.garment'),
                        t('tailoring.table.qtyPrice'), t('tailoring.table.advance'), t('tailoring.table.delivery'),
                        t('tailoring.table.status'), t('tailoring.table.actions'),
                      ].map(h => (
                        <th key={h} className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3 dark:text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {orders.map(order => {
                      const total = Number(order.totalAmount)
                      const balance = total - Number(order.advancePaid)
                      const nextStatus = STATUS_NEXT[order.status]
                      const banner = invoiceBanners[order.id]
                      return (
                        <Fragment key={order.id}>
                          <tr className="hover:bg-gray-50 dark:hover:bg-slate-800">
                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-slate-100">{order.orderNumber}</td>
                            <td className="px-4 py-3">
                              <div className="text-gray-800 dark:text-slate-200">{order.client.customerName}</div>
                              {order.client.phone && <div className="text-xs text-gray-400 dark:text-slate-500">{order.client.phone}</div>}
                            </td>
                            <td className="px-4 py-3">
                              <div>{garmentLabel(order.garmentType)}</div>
                              <div className="text-xs text-gray-400 dark:text-slate-500">{t('tailoring.table.fabricSuffix', { fabric: order.fabricSupplied })}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div>{order.quantity} × {formatCurrency(Number(order.unitPrice))}</div>
                              <div className="text-xs text-gray-500 font-medium dark:text-slate-400">= {formatCurrency(total)}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div>{formatCurrency(Number(order.advancePaid))}</div>
                              {balance > 0 && <div className="text-xs text-orange-600 dark:text-orange-400">{t('tailoring.table.balance', { amount: formatCurrency(balance) })}</div>}
                            </td>
                            <td className="px-4 py-3">
                              {order.deliveryDate ? <div className={`text-xs ${new Date(order.deliveryDate) < new Date() && order.status !== 'DELIVERED' ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-600 dark:text-slate-400'}`}>{dateSlice(order.deliveryDate)}</div> : <span className="text-gray-400 dark:text-slate-500">—</span>}
                              {order.trialDate && <div className="text-xs text-blue-500 dark:text-blue-400">{t('tailoring.table.trial', { date: dateSlice(order.trialDate) })}</div>}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={STATUS_VARIANT[order.status] ?? 'neutral'} size="sm">{statusLabel(order.status)}</Badge>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 flex-wrap">
                                {nextStatus && order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
                                  <button onClick={() => handleAdvanceStatus(order)} className="text-xs px-2 py-1 rounded bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/40">{t('tailoring.actions.advanceTo', { status: statusLabel(nextStatus) })}</button>
                                )}
                                {order.status === 'READY' && !order.invoiceId && (
                                  <button onClick={() => handleGenerateInvoice(order)} disabled={invoiceLoading === order.id} className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 flex items-center gap-1 disabled:opacity-50">
                                    <Receipt size={10} />{invoiceLoading === order.id ? t('tailoring.actions.invoicing') : t('tailoring.actions.invoice')}
                                  </button>
                                )}
                                {order.invoiceId && <span className="text-xs px-2 py-1 rounded bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 flex items-center gap-1"><FileText size={10} /> {t('tailoring.actions.invoiced')}</span>}
                                {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
                                  order.trialAppointmentId ? (
                                    <span title={t('tailoring.actions.trialScheduled')} className="text-xs px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                                      <CalendarClock size={10} /> {t('tailoring.actions.trial')}
                                    </span>
                                  ) : (
                                    <button onClick={() => openTrialModal(order.id)} className="text-xs px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 flex items-center gap-1">
                                      <CalendarClock size={10} /> {t('tailoring.actions.scheduleTrial')}
                                    </button>
                                  )
                                )}
                                {order.fabricSupplied === 'SHOP' && (
                                  order.fabricProductId ? (
                                    <button onClick={() => handleClearFabric(order.id)} title={t('tailoring.actions.clearFabric')} className="text-xs px-2 py-1 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 flex items-center gap-1">
                                      <Shirt size={10} /> {t('tailoring.actions.fabricLinked')}
                                    </button>
                                  ) : (
                                    <button onClick={() => openFabricModal(order.id)} className="text-xs px-2 py-1 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 flex items-center gap-1">
                                      <Shirt size={10} /> {t('tailoring.actions.setFabric')}
                                    </button>
                                  )
                                )}
                                <button onClick={() => openEditOrder(order)} className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"><Pencil size={13} /></button>
                                <button onClick={() => setDeleteOrderId(order.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded dark:text-slate-500"><X size={13} /></button>
                              </div>
                            </td>
                          </tr>
                          {banner && (
                            <tr>
                              <td colSpan={8} className="px-4 pb-2">
                                <div className={`text-xs rounded-lg px-3 py-1.5 flex items-center justify-between ${banner.ok ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'}`}>
                                  <span>{banner.msg}</span>
                                  <button onClick={() => setInvoiceBanners(prev => { const n = { ...prev }; delete n[order.id]; return n })}><X size={11} /></button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        </>
      )}

      {tab === 'measurements' && (
        <div className="flex-1 overflow-auto px-6 py-4">
          <div className="mb-4 max-w-xs">
            <CustomerPicker label={t('tailoring.measurements.selectClient')} value={pickedMeasClient} onChange={setPickedMeasClient} placeholder="Search by name or phone..." />
          </div>

          {measClientId && measurements.length === 0 && (
            <div className="text-center py-16 text-gray-400 dark:text-slate-500">
              <Ruler size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">{t('tailoring.empty.noMeasurements')}</p>
            </div>
          )}

          {measurements.length > 0 && (
            <div className="space-y-4">
              {measurements.map(m => (
                <Card key={m.id} padding="lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-medium text-gray-700 dark:text-slate-300">
                      {m.takenBy
                        ? t('tailoring.measurements.recordedBy', { date: dateSlice(m.recordDate), name: m.takenBy.fullName })
                        : t('tailoring.measurements.recorded', { date: dateSlice(m.recordDate) })}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEditMeas(m)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"><Pencil size={14} /></button>
                      <button onClick={() => setDeleteMeasId(m.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg dark:text-slate-500"><X size={14} /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                    {MEASUREMENT_FIELDS.map(f => {
                      const val = m[f.key]
                      return (
                        <div key={f.key} className={`text-center rounded-lg py-2 px-3 ${val != null ? 'bg-violet-50 dark:bg-violet-900/20' : 'bg-gray-50 dark:bg-slate-800'}`}>
                          <div className="text-xs text-gray-500 dark:text-slate-400">{measFieldLabel(f.key)}</div>
                          <div className={`text-sm font-semibold ${val != null ? 'text-violet-700 dark:text-violet-400' : 'text-gray-300 dark:text-slate-600'}`}>{val != null ? `${val}"` : '—'}</div>
                        </div>
                      )
                    })}
                  </div>
                  {m.notes && <p className="text-xs text-gray-500 mt-2 dark:text-slate-400">{m.notes}</p>}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Order form modal */}
      {showOrderForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-base font-semibold">{editOrder ? t('tailoring.form.editOrderTitle', { orderNumber: editOrder.orderNumber }) : t('tailoring.form.newOrderTitle')}</h2>
              <button onClick={() => setShowOrderForm(false)} className="text-gray-400 hover:text-gray-700 dark:text-slate-500 dark:hover:text-slate-200"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {orderFormError && <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">{orderFormError}</div>}
              <div className="grid grid-cols-2 gap-4">
                {editOrder ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">{t('tailoring.form.client')}</label>
                    <div className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 dark:border-slate-700 dark:bg-slate-800 text-gray-500 dark:text-slate-400">
                      {editOrder.client.customerName}
                    </div>
                  </div>
                ) : (
                  <CustomerPicker
                    label={`${t('tailoring.form.client')} *`}
                    value={pickedOrderClient}
                    onChange={(c) => { setPickedOrderClient(c); setOrderForm(f => ({ ...f, measurementRecordId: '' })) }}
                    placeholder="Search by name or phone..."
                  />
                )}
                <Select label={t('tailoring.form.garmentType')} required value={orderForm.garmentType} onChange={e => setOrderForm(f => ({ ...f, garmentType: e.target.value }))}>
                  {GARMENT_TYPES.map(g => <option key={g} value={g}>{garmentLabel(g)}</option>)}
                </Select>
                <Select label={t('tailoring.form.gender')} value={orderForm.gender} onChange={e => setOrderForm(f => ({ ...f, gender: e.target.value }))}>
                  <option value="">{t('tailoring.form.genderNotSpecified')}</option>
                  <option value="MENS">{t('tailoring.form.genderMens')}</option>
                  <option value="WOMENS">{t('tailoring.form.genderWomens')}</option>
                </Select>
                <Select label={t('tailoring.form.styleRegion')} value={orderForm.styleRegion} onChange={e => setOrderForm(f => ({ ...f, styleRegion: e.target.value }))}>
                  <option value="">{t('tailoring.form.styleNotSpecified')}</option>
                  <option value="INDIAN">{t('tailoring.form.styleIndian')}</option>
                  <option value="WESTERN">{t('tailoring.form.styleWestern')}</option>
                </Select>
                <Select label={t('tailoring.form.measurementRecord')} value={orderForm.measurementRecordId} onChange={e => setOrderForm(f => ({ ...f, measurementRecordId: e.target.value }))}>
                  <option value="">{t('tailoring.form.noneSelected')}</option>
                  {orderClientMeasurements.map(m => <option key={m.id} value={m.id}>{t('tailoring.form.measurementRecordedOn', { date: dateSlice(m.recordDate) })}</option>)}
                </Select>
                <Select label={t('tailoring.form.fabricSuppliedBy')} value={orderForm.fabricSupplied} onChange={e => setOrderForm(f => ({ ...f, fabricSupplied: e.target.value }))}>
                  <option value="CLIENT">{t('tailoring.form.fabricClient')}</option>
                  <option value="SHOP">{t('tailoring.form.fabricShop')}</option>
                </Select>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">{t('tailoring.form.fabricDescription')}</label>
                  <input value={orderForm.fabricDescription} onChange={e => setOrderForm(f => ({ ...f, fabricDescription: e.target.value }))} placeholder={t('tailoring.form.fabricPlaceholder')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">{t('tailoring.form.quantity')}</label>
                  <input type="number" min="1" value={orderForm.quantity} onChange={e => setOrderForm(f => ({ ...f, quantity: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">{t('tailoring.form.unitPrice', { symbol: currSym })}</label>
                  <input type="number" min="0" value={orderForm.unitPrice} onChange={e => setOrderForm(f => ({ ...f, unitPrice: e.target.value }))} placeholder="0.00" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">{t('tailoring.form.advancePaid', { symbol: currSym })}</label>
                  <input type="number" min="0" value={orderForm.advancePaid} onChange={e => setOrderForm(f => ({ ...f, advancePaid: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                {orderTotal > 0 && (
                  <div className="col-span-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 dark:bg-slate-950 dark:text-slate-400">
                    {t('tailoring.form.totalSummary', { total: formatCurrency(orderTotal), balance: formatCurrency(Math.max(0, orderBalance)) })}
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">{t('tailoring.form.trialDate')}</label>
                  <input type="date" value={orderForm.trialDate} onChange={e => setOrderForm(f => ({ ...f, trialDate: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">{t('tailoring.form.deliveryDate')}</label>
                  <input type="date" value={orderForm.deliveryDate} onChange={e => setOrderForm(f => ({ ...f, deliveryDate: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <Select label={t('tailoring.form.assignedTailor')} value={orderForm.assignedToId} onChange={e => setOrderForm(f => ({ ...f, assignedToId: e.target.value }))}>
                  <option value="">{t('tailoring.form.unassigned')}</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                </Select>
                {editOrder && (
                  <Select label={t('tailoring.form.status')} value={orderForm.status} onChange={e => setOrderForm(f => ({ ...f, status: e.target.value }))}>
                    {[...STATUS_STEPS, 'CANCELLED'].map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                  </Select>
                )}
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">{t('tailoring.form.specialInstructions')}</label>
                  <textarea value={orderForm.specialInstructions} onChange={e => setOrderForm(f => ({ ...f, specialInstructions: e.target.value }))} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400 focus:border-transparent resize-none dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">{t('tailoring.form.notes')}</label>
                  <textarea value={orderForm.notes} onChange={e => setOrderForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400 focus:border-transparent resize-none dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 dark:border-slate-700">
              <button onClick={() => setShowOrderForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800">{t('tailoring.form.cancel')}</button>
              <button onClick={handleSaveOrder} disabled={orderSaving} className="px-5 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg disabled:opacity-50">
                {orderSaving ? t('tailoring.form.saving') : editOrder ? t('tailoring.form.updateOrder') : t('tailoring.form.createOrder')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Measurement form modal */}
      {showMeasForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-base font-semibold">{editMeas ? t('tailoring.measurements.editRecord') : t('tailoring.measurements.newRecord')}</h2>
              <button onClick={() => setShowMeasForm(false)} className="text-gray-400 hover:text-gray-700 dark:text-slate-500 dark:hover:text-slate-200"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {measError && <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2 mb-4">{measError}</div>}
              <p className="text-xs text-gray-400 mb-3 dark:text-slate-500">{t('tailoring.measurements.unitHint')}</p>
              <div className="grid grid-cols-2 gap-3">
                {MEASUREMENT_FIELDS.map(f => (
                  <div key={f.key}>
                    <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">{measFieldLabel(f.key)}</label>
                    <input type="number" min="0" step="0.25" value={measForm[f.key as keyof typeof measForm]} onChange={e => setMeasForm(m => ({ ...m, [f.key]: e.target.value }))} placeholder={t('tailoring.measurements.placeholderExample')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                  </div>
                ))}
                <Select label={t('tailoring.measurements.takenBy')} value={measForm.takenById} onChange={e => setMeasForm(m => ({ ...m, takenById: e.target.value }))}>
                  <option value="">{t('tailoring.measurements.none')}</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                </Select>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">{t('tailoring.measurements.notes')}</label>
                  <textarea value={measForm.notes} onChange={e => setMeasForm(m => ({ ...m, notes: e.target.value }))} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400 focus:border-transparent resize-none dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 dark:border-slate-700">
              <button onClick={() => setShowMeasForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800">{t('tailoring.form.cancel')}</button>
              <button onClick={handleSaveMeas} disabled={measSaving} className="px-5 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg disabled:opacity-50">
                {measSaving ? t('tailoring.form.saving') : editMeas ? t('tailoring.measurements.update') : t('tailoring.measurements.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Trial Appointment modal (Phase 58 §2) */}
      {trialOrderId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">{t('tailoring.trial.title')}</h2>
              <button onClick={() => setTrialOrderId(null)} className="text-gray-400 hover:text-gray-700 dark:text-slate-500 dark:hover:text-slate-200"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-3">
              {trialError && <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">{trialError}</div>}
              <p className="text-xs text-gray-500 dark:text-slate-400">{t('tailoring.trial.hint')}</p>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">{t('tailoring.trial.date')}</label>
                <input type="date" value={trialForm.scheduledDate} onChange={e => setTrialForm(f => ({ ...f, scheduledDate: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">{t('tailoring.trial.time')}</label>
                <input type="time" value={trialForm.scheduledTime} onChange={e => setTrialForm(f => ({ ...f, scheduledTime: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
              </div>
              <Select label={t('tailoring.form.assignedTailor')} value={trialForm.providerId} onChange={e => setTrialForm(f => ({ ...f, providerId: e.target.value }))}>
                <option value="">{t('tailoring.form.unassigned')}</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
              </Select>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 dark:border-slate-700">
              <button onClick={() => setTrialOrderId(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800">{t('tailoring.form.cancel')}</button>
              <button onClick={handleScheduleTrial} disabled={trialSaving} className="px-5 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg disabled:opacity-50">
                {trialSaving ? t('tailoring.form.saving') : t('tailoring.trial.schedule')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Fabric modal (Phase 58 §2) */}
      {fabricOrderId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">{t('tailoring.fabric.title')}</h2>
              <button onClick={() => setFabricOrderId(null)} className="text-gray-400 hover:text-gray-700 dark:text-slate-500 dark:hover:text-slate-200"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-3">
              {fabricError && <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">{fabricError}</div>}
              <p className="text-xs text-gray-500 dark:text-slate-400">{t('tailoring.fabric.hint')}</p>
              <div className="relative">
                <input
                  value={pickedFabric ? pickedFabric.productName : fabricSearch}
                  onChange={e => { setPickedFabric(null); setFabricSearch(e.target.value) }}
                  placeholder={t('tailoring.fabric.searchPlaceholder')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                />
                {!pickedFabric && fabricResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {fabricResults.map(p => (
                      <button key={p.id} type="button" onClick={() => { setPickedFabric(p); setFabricResults([]) }} className="w-full text-left px-3 py-2 text-xs hover:bg-violet-50 dark:hover:bg-slate-700 flex items-center justify-between gap-2">
                        <span className="text-gray-800 dark:text-slate-200">{p.productName}</span>
                        <span className="text-gray-500 dark:text-slate-400 whitespace-nowrap">{formatCurrency(p.sellingPrice)} · stock {p.inventory?.quantity ?? 0}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block dark:text-slate-400">{t('tailoring.fabric.quantity')}</label>
                <input type="number" min="0" step="0.25" value={fabricQty} onChange={e => setFabricQty(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400 focus:border-transparent dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 dark:border-slate-700">
              <button onClick={() => setFabricOrderId(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800">{t('tailoring.form.cancel')}</button>
              <button onClick={handleSetFabric} disabled={fabricSaving || !pickedFabric} className="px-5 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg disabled:opacity-50">
                {fabricSaving ? t('tailoring.form.saving') : t('tailoring.fabric.set')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteOrderId}
        onClose={() => setDeleteOrderId(null)}
        onConfirm={() => deleteOrderId && handleDeleteOrder(deleteOrderId)}
        loading={deletingOrder}
        title="Delete Order"
        message={t('tailoring.confirm.deleteOrder')}
        confirmLabel={t('common.delete')}
      />

      <ConfirmDialog
        open={!!deleteMeasId}
        onClose={() => setDeleteMeasId(null)}
        onConfirm={() => deleteMeasId && handleDeleteMeas(deleteMeasId)}
        loading={deletingMeas}
        title="Delete Measurement"
        message={t('tailoring.confirm.deleteMeasurement')}
        confirmLabel={t('common.delete')}
      />
    </div>
  )
}

const STATUS_LABELS_FALLBACK: Record<string, string> = {
  RECEIVED: 'Received', IN_CUTTING: 'In Cutting', IN_STITCHING: 'In Stitching',
  TRIAL_SCHEDULED: 'Trial', ALTERATIONS: 'Alterations', READY: 'Ready',
  DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
}
