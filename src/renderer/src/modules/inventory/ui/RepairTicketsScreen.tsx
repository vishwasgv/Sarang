import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, Wrench, Clock, Truck, PackageCheck, RotateCcw, XCircle, History, ArrowRight, DollarSign } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@shared/ui/organisms/DataTable'
import { Button } from '@shared/ui/atoms/Button'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { CustomerPicker, type CustomerLite } from '@shared/ui/molecules/CustomerPicker'
import { useNotificationStore } from '@app/store/notification.store'
import { formatDate } from '@shared/utils/locale.util'
import { formatCurrency } from '@shared/utils/currency.util'

type RepairStatus =
  | 'RECEIVED' | 'DIAGNOSED' | 'SENT_TO_VENDOR' | 'AWAITING_PARTS'
  | 'REPAIRED' | 'REPLACED' | 'RETURNED_TO_CUSTOMER' | 'CANCELLED'

interface SerialLite { id: string; serialNumber: string; imeiNumber: string | null; status: string; warrantyExpiryDate: string | null }
interface TicketRow {
  id: string
  claimNumber: string
  status: RepairStatus
  issueDescription: string
  receivedDate: string
  deliveredDate: string | null
  turnaroundDays: number
  vendorRmaNumber: string | null
  sentToVendorDate: string | null
  vendorResponseDate: string | null
  vendorSlaDueDate: string | null
  daysWithVendor: number | null
  isOverdue: boolean
  repairCost: number | null
  vendorClaimAmount: number | null
  vendorRecoveredAmount: number
  vendorClaimClosedAt: string | null
  vendorClaimOutstanding: number | null
  notes: string | null
  createdAt: string
  serial: SerialLite
  replacementSerial: SerialLite | null
  product: { id: string; productName: string }
  customer: { id: string; customerName: string; phone: string | null } | null
  vendor: { id: string; supplierName: string } | null
  technician: { id: string; fullName: string } | null
}

// Translation keys for each status label — the map itself has to live inside
// the component (STATUS_LABELS below) since t() isn't available at module
// scope, but the RepairStatus -> key mapping is pure structure, not text.
const STATUS_LABEL_KEYS: Record<RepairStatus, string> = {
  RECEIVED: 'inventory.repairTickets.status.received',
  DIAGNOSED: 'inventory.repairTickets.status.diagnosed',
  SENT_TO_VENDOR: 'inventory.repairTickets.status.sentToVendor',
  AWAITING_PARTS: 'inventory.repairTickets.status.awaitingParts',
  REPAIRED: 'inventory.repairTickets.status.repaired',
  REPLACED: 'inventory.repairTickets.status.replaced',
  RETURNED_TO_CUSTOMER: 'inventory.repairTickets.status.returnedToCustomer',
  CANCELLED: 'inventory.repairTickets.status.cancelled',
}
const STATUS_VARIANT: Record<RepairStatus, 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand'> = {
  RECEIVED: 'neutral',
  DIAGNOSED: 'info',
  SENT_TO_VENDOR: 'warning',
  AWAITING_PARTS: 'warning',
  REPAIRED: 'success',
  REPLACED: 'brand',
  RETURNED_TO_CUSTOMER: 'success',
  CANCELLED: 'danger',
}
// Client-side mirror of repair-ticket.service.ts's ALLOWED_TRANSITIONS —
// purely for which buttons to show; the server enforces the real rule and
// rejects anything not actually allowed.
const NEXT_STATUSES: Record<RepairStatus, RepairStatus[]> = {
  RECEIVED: ['DIAGNOSED', 'SENT_TO_VENDOR', 'REPAIRED', 'REPLACED', 'CANCELLED'],
  DIAGNOSED: ['SENT_TO_VENDOR', 'REPAIRED', 'REPLACED', 'CANCELLED'],
  SENT_TO_VENDOR: ['AWAITING_PARTS', 'REPAIRED', 'REPLACED', 'CANCELLED'],
  AWAITING_PARTS: ['REPAIRED', 'REPLACED', 'CANCELLED'],
  REPAIRED: ['RETURNED_TO_CUSTOMER'],
  REPLACED: ['RETURNED_TO_CUSTOMER'],
  RETURNED_TO_CUSTOMER: [],
  CANCELLED: [],
}
const ALL_STATUSES: RepairStatus[] = ['RECEIVED', 'DIAGNOSED', 'SENT_TO_VENDOR', 'AWAITING_PARTS', 'REPAIRED', 'REPLACED', 'RETURNED_TO_CUSTOMER', 'CANCELLED']

// Debounced search over already-sold serials/IMEIs — a repair ticket can
// only be opened against a unit that's actually been sold to a customer
// (repair-ticket.service.ts enforces this server-side too).
function SoldSerialPicker({ value, onChange }: { value: SerialLite & { productId: string; productName: string } | null; onChange: (s: (SerialLite & { productId: string; productName: string }) | null) => void }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<SerialLite & { productId: string; productName: string }>>([])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const timer = setTimeout(async () => {
      const res = await window.api.serials.list({ serialNumber: query.trim(), status: 'SOLD', limit: 10 })
      if (res.success && res.data) {
        const d = res.data as { serials: Array<SerialLite & { productId: string; productName: string }> }
        setResults(d.serials ?? [])
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-900">
        <div className="min-w-0">
          <p className="text-sm font-medium text-dark dark:text-slate-100 truncate">{value.productName}</p>
          <p className="text-sm font-mono text-slate-400">{value.serialNumber}{value.imeiNumber ? ` · IMEI ${value.imeiNumber}` : ''}</p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="text-slate-400 hover:text-danger shrink-0 text-sm">{t('inventory.repairTickets.change')}</button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('inventory.repairTickets.searchSoldSerialPlaceholder')}
          className="w-full h-11 ps-10 pe-4 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
      </div>
      {results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full border border-slate-100 dark:border-slate-700 rounded-lg overflow-hidden divide-y divide-slate-50 dark:divide-slate-800 bg-white dark:bg-slate-900 shadow-lg max-h-56 overflow-y-auto">
          {results.map(s => (
            <button key={s.id} type="button"
              onClick={() => { onChange(s); setQuery(''); setResults([]) }}
              className="w-full px-3 py-2 text-start hover:bg-brand/5 transition-colors">
              <p className="text-sm font-medium text-dark dark:text-slate-100">{s.productName}</p>
              <p className="text-sm font-mono text-slate-400">{s.serialNumber}{s.imeiNumber ? ` · IMEI ${s.imeiNumber}` : ''}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Available-in-stock serial picker, scoped to one product — used only when
// marking a ticket REPLACED (the new unit must be the same product and
// currently AVAILABLE).
function ReplacementSerialPicker({ productId, value, onChange }: { productId: string; value: string; onChange: (id: string, label: string) => void }) {
  const { t } = useTranslation()
  const [options, setOptions] = useState<SerialLite[]>([])
  // Distinguishes "the lookup failed" from "there's genuinely no stock" —
  // previously both rendered the identical "no unit available" message,
  // which could send staff off to needlessly re-order/add stock instead of
  // just retrying a failed fetch.
  const [loadFailed, setLoadFailed] = useState(false)
  useEffect(() => {
    setLoadFailed(false)
    window.api.serials.list({ productId, status: 'AVAILABLE', limit: 50 }).then(res => {
      if (res.success && res.data) setOptions((res.data as { serials: SerialLite[] }).serials ?? [])
      else setLoadFailed(true)
    }).catch(() => setLoadFailed(true))
  }, [productId])

  if (loadFailed) {
    return <p className="text-sm text-danger">{t('inventory.repairTickets.loadUnitsFailed')}</p>
  }
  if (options.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">{t('inventory.repairTickets.noAvailableUnit')}</p>
  }
  return (
    <Select value={value} onChange={e => {
      const s = options.find(o => o.id === e.target.value)
      onChange(e.target.value, s ? `${s.serialNumber}${s.imeiNumber ? ` (IMEI ${s.imeiNumber})` : ''}` : '')
    }}>
      <option value="">{t('inventory.repairTickets.selectReplacementUnit')}</option>
      {options.map(o => <option key={o.id} value={o.id}>{o.serialNumber}{o.imeiNumber ? ` · IMEI ${o.imeiNumber}` : ''}</option>)}
    </Select>
  )
}

export function RepairTicketsScreen() {
  const { t } = useTranslation()
  const STATUS_LABELS = (Object.keys(STATUS_LABEL_KEYS) as RepairStatus[]).reduce((acc, k) => {
    acc[k] = t(STATUS_LABEL_KEYS[k])
    return acc
  }, {} as Record<RepairStatus, string>)
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const serialFilter = searchParams.get('serialId')

  const [tickets, setTickets] = useState<TicketRow[]>([])
  const overdueCount = tickets.filter(tkt => tkt.isOverdue).length
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<RepairStatus | 'ALL'>('ALL')
  const [search, setSearch] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [pickedSerial, setPickedSerial] = useState<(SerialLite & { productId: string; productName: string }) | null>(null)
  const [pickedCustomer, setPickedCustomer] = useState<CustomerLite | null>(null)
  const [issueDescription, setIssueDescription] = useState('')
  const [vendors, setVendors] = useState<Array<{ id: string; supplierName: string }>>([])
  const [createVendorId, setCreateVendorId] = useState('')
  const [technicians, setTechnicians] = useState<Array<{ id: string; fullName: string }>>([])
  const [createTechnicianId, setCreateTechnicianId] = useState('')

  const [selected, setSelected] = useState<TicketRow | null>(null)
  const [updating, setUpdating] = useState(false)
  const [nextStatus, setNextStatus] = useState<RepairStatus | null>(null)
  const [vendorId, setVendorId] = useState('')
  const [vendorRmaNumber, setVendorRmaNumber] = useState('')
  const [replacementSerialId, setReplacementSerialId] = useState('')
  const [repairCost, setRepairCost] = useState('')
  const [notes, setNotes] = useState('')

  // Phase 67 §9.1 — Electronics: vendor warranty-claim recovery ledger.
  const [claimAmountInput, setClaimAmountInput] = useState('')
  const [recoveryAmountInput, setRecoveryAmountInput] = useState('')
  const [savingClaim, setSavingClaim] = useState(false)

  // Phase 67 §9.1 — Electronics: repair turnaround by technician. Assignable
  // independently of the status-advance flow — a technician is often
  // decided at intake, before any status transition happens at all.
  const [assignedTechnicianId, setAssignedTechnicianId] = useState('')
  const [savingTechnician, setSavingTechnician] = useState(false)

  const [history, setHistory] = useState<TicketRow[] | null>(null)
  const [historyFor, setHistoryFor] = useState<string | null>(null)
  const [historySerial, setHistorySerial] = useState<(SerialLite & { productId: string; productName: string }) | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const payload: { status?: RepairStatus; search?: string; limit: number } = { limit: 200 }
      if (statusFilter !== 'ALL') payload.status = statusFilter
      if (search.trim()) payload.search = search.trim()
      const res = await window.api.repairTickets.list(payload)
      if (res.success && res.data) {
        const d = res.data as { tickets: TicketRow[]; total: number }
        setTickets(d.tickets ?? [])
        setTotal(d.total ?? 0)
      } else {
        toastError(t('inventory.repairTickets.errorTitle'), res.error?.message ?? t('inventory.repairTickets.loadFailedMessage'))
      }
    } catch {
      toastError(t('inventory.repairTickets.errorTitle'), t('inventory.repairTickets.loadFailedMessage'))
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search, toastError, t])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    window.api.suppliers.list({ limit: 200 }).then(res => {
      if (res.success && res.data) {
        const d = res.data as { suppliers?: Array<{ id: string; supplierName: string }> } | Array<{ id: string; supplierName: string }>
        setVendors(Array.isArray(d) ? d : (d.suppliers ?? []))
      }
    })
    window.api.hr.listEmployees({ isActive: true }).then(res => {
      if (res.success && res.data) {
        const d = res.data as { employees?: Array<{ id: string; fullName: string }> } | Array<{ id: string; fullName: string }>
        setTechnicians(Array.isArray(d) ? d : (d.employees ?? []))
      }
    })
  }, [])

  // Arrived via SerialTrackingScreen's "Repair" button (?serialId=...) — load
  // that unit's service history and offer a one-click "new ticket" for it.
  useEffect(() => {
    if (!serialFilter) { setHistory(null); setHistoryFor(null); setHistorySerial(null); return }
    window.api.repairTickets.serviceHistory({ serialId: serialFilter }).then(res => {
      if (res.success && res.data) {
        const d = res.data as { tickets: TicketRow[]; serial: (SerialLite & { productId: string; productName: string }) | null }
        setHistory(d.tickets)
        setHistoryFor(serialFilter)
        setHistorySerial(d.serial)
      }
    })
  }, [serialFilter])

  function openCreateForSerial(prefill?: (SerialLite & { productId: string; productName: string }) | null) {
    setPickedSerial(prefill ?? null)
    setPickedCustomer(null)
    setIssueDescription('')
    setCreateVendorId('')
    setCreateTechnicianId('')
    setShowCreate(true)
  }

  async function handleCreate() {
    if (!pickedSerial) { toastError(t('inventory.repairTickets.missingFieldsTitle'), t('inventory.repairTickets.selectSoldUnitMessage')); return }
    if (!issueDescription.trim()) { toastError(t('inventory.repairTickets.missingFieldsTitle'), t('inventory.repairTickets.describeIssueMessage')); return }
    setCreating(true)
    try {
      const res = await window.api.repairTickets.create({
        serialId: pickedSerial.id,
        customerId: pickedCustomer?.id,
        issueDescription: issueDescription.trim(),
        vendorId: createVendorId || undefined,
        technicianId: createTechnicianId || undefined,
      })
      if (res.success) {
        const d = res.data as { claimNumber: string }
        toastSuccess(t('inventory.repairTickets.ticketCreatedTitle'), t('inventory.repairTickets.claimOpenedMessage', { claimNumber: d.claimNumber }))
        setShowCreate(false)
        loadData()
        if (serialFilter) {
          window.api.repairTickets.serviceHistory({ serialId: serialFilter }).then(r => {
            if (r.success && r.data) setHistory((r.data as { tickets: TicketRow[] }).tickets)
          })
        }
      } else {
        toastError(t('inventory.repairTickets.failedTitle'), res.error?.message ?? t('inventory.repairTickets.createTicketFailedMessage'))
      }
    } catch {
      toastError(t('inventory.repairTickets.failedTitle'), t('inventory.repairTickets.createTicketFailedMessage'))
    } finally {
      setCreating(false)
    }
  }

  function openDetail(tkt: TicketRow) {
    setSelected(tkt)
    setNextStatus(null)
    setVendorId(tkt.vendor?.id ?? '')
    setVendorRmaNumber(tkt.vendorRmaNumber ?? '')
    setReplacementSerialId('')
    setRepairCost(tkt.repairCost != null ? String(tkt.repairCost) : '')
    setNotes(tkt.notes ?? '')
    setClaimAmountInput(tkt.vendorClaimAmount != null ? String(tkt.vendorClaimAmount) : '')
    setRecoveryAmountInput('')
    setAssignedTechnicianId(tkt.technician?.id ?? '')
  }

  async function handleAssignTechnician() {
    if (!selected) return
    setSavingTechnician(true)
    try {
      const res = await window.api.repairTickets.updateStatus({
        id: selected.id,
        status: selected.status,
        technicianId: assignedTechnicianId || undefined,
      })
      if (res.success) {
        toastSuccess(t('inventory.repairTickets.savedTitle'), t('inventory.repairTickets.technicianUpdatedMessage'))
        refreshSelected()
      } else {
        toastError(t('inventory.repairTickets.failedTitle'), res.error?.message ?? t('inventory.repairTickets.assignTechnicianFailedMessage'))
      }
    } catch {
      toastError(t('inventory.repairTickets.failedTitle'), t('inventory.repairTickets.assignTechnicianFailedMessage'))
    } finally {
      setSavingTechnician(false)
    }
  }

  // Phase 67 §9.1 — Electronics: vendor warranty-claim recovery ledger.
  async function refreshSelected() {
    if (!selected) return
    const res = await window.api.repairTickets.get({ id: selected.id })
    if (res.success && res.data) setSelected(res.data as TicketRow)
    loadData()
  }

  async function handleRecordClaim() {
    if (!selected || !claimAmountInput) return
    setSavingClaim(true)
    try {
      const res = await window.api.repairTickets.recordVendorClaim({ id: selected.id, amount: parseFloat(claimAmountInput) })
      if (res.success) { toastSuccess(t('inventory.repairTickets.claimRecordedTitle'), t('inventory.repairTickets.claimUpdatedMessage', { claimNumber: selected.claimNumber })); await refreshSelected() }
      else toastError(t('inventory.repairTickets.failedTitle'), res.error?.message ?? t('inventory.repairTickets.recordClaimFailedMessage'))
    } finally { setSavingClaim(false) }
  }

  async function handleRecordRecovery() {
    if (!selected || !recoveryAmountInput) return
    setSavingClaim(true)
    try {
      const res = await window.api.repairTickets.recordVendorRecovery({ id: selected.id, amount: parseFloat(recoveryAmountInput) })
      if (res.success) { toastSuccess(t('inventory.repairTickets.recoveryRecordedTitle'), t('inventory.repairTickets.paymentReceivedMessage', { claimNumber: selected.claimNumber })); setRecoveryAmountInput(''); await refreshSelected() }
      else toastError(t('inventory.repairTickets.failedTitle'), res.error?.message ?? t('inventory.repairTickets.recordRecoveryFailedMessage'))
    } finally { setSavingClaim(false) }
  }

  async function handleWriteOffClaim() {
    if (!selected) return
    setSavingClaim(true)
    try {
      const res = await window.api.repairTickets.writeOffVendorClaim({ id: selected.id })
      if (res.success) { toastSuccess(t('inventory.repairTickets.claimClosedTitle'), t('inventory.repairTickets.writtenOffMessage', { claimNumber: selected.claimNumber })); await refreshSelected() }
      else toastError(t('inventory.repairTickets.failedTitle'), res.error?.message ?? t('inventory.repairTickets.writeOffFailedMessage'))
    } finally { setSavingClaim(false) }
  }

  async function handleUpdateStatus() {
    if (!selected || !nextStatus) return
    if (nextStatus === 'REPLACED' && !replacementSerialId) {
      toastError(t('inventory.repairTickets.missingFieldsTitle'), t('inventory.repairTickets.selectReplacementUnitMessage'))
      return
    }
    setUpdating(true)
    try {
      const res = await window.api.repairTickets.updateStatus({
        id: selected.id,
        status: nextStatus,
        vendorId: vendorId || undefined,
        vendorRmaNumber: vendorRmaNumber || undefined,
        replacementSerialId: nextStatus === 'REPLACED' ? replacementSerialId : undefined,
        repairCost: repairCost ? parseFloat(repairCost) : undefined,
        notes: notes || undefined,
      })
      if (res.success) {
        toastSuccess(t('inventory.repairTickets.updatedTitle'), t('inventory.repairTickets.statusUpdatedMessage', { claimNumber: selected.claimNumber, status: STATUS_LABELS[nextStatus] }))
        setSelected(null)
        loadData()
        if (serialFilter) {
          window.api.repairTickets.serviceHistory({ serialId: serialFilter }).then(r => {
            if (r.success && r.data) setHistory((r.data as { tickets: TicketRow[] }).tickets)
          })
        }
      } else {
        toastError(t('inventory.repairTickets.failedTitle'), res.error?.message ?? t('inventory.repairTickets.updateTicketFailedMessage'))
      }
    } catch {
      toastError(t('inventory.repairTickets.failedTitle'), t('inventory.repairTickets.updateTicketFailedMessage'))
    } finally {
      setUpdating(false)
    }
  }

  const columns: ColumnDef<TicketRow, unknown>[] = [
    {
      id: 'claim',
      header: () => t('inventory.repairTickets.claimColumn'),
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-dark dark:text-slate-100">{row.original.claimNumber}</p>
          <p className="text-sm text-slate-400">{row.original.product.productName}</p>
          <p className="text-sm font-mono text-slate-400">{row.original.serial.serialNumber}{row.original.serial.imeiNumber ? ` · IMEI ${row.original.serial.imeiNumber}` : ''}</p>
        </div>
      )
    },
    {
      id: 'customer',
      header: () => t('billing.customer'),
      cell: ({ row }) => row.original.customer
        ? <div><p className="text-base text-dark dark:text-slate-100">{row.original.customer.customerName}</p>{row.original.customer.phone && <p className="text-sm text-slate-400">{row.original.customer.phone}</p>}</div>
        : <span className="text-sm text-slate-400">—</span>
    },
    {
      id: 'status',
      header: () => t('common.status'),
      cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{STATUS_LABELS[row.original.status]}</Badge>
    },
    {
      id: 'turnaround',
      header: () => t('inventory.repairTickets.turnaroundColumn'),
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-base text-slate-600 dark:text-slate-300">
          <Clock size={13} className="text-slate-400" /> {row.original.turnaroundDays}d {row.original.deliveredDate ? '' : t('inventory.repairTickets.openSuffix')}
        </div>
      )
    },
    {
      id: 'vendor',
      header: () => t('inventory.repairTickets.vendorRmaColumn'),
      // Phase 67 §9.1 — Electronics: RMA SLA tracker. Overdue only while the
      // unit is still genuinely with the vendor (isOverdue already encodes
      // that server-side) — a returned-late ticket doesn't keep flashing red.
      cell: ({ row }) => row.original.vendor
        ? (
          <div>
            <p className="text-base text-dark dark:text-slate-100">{row.original.vendor.supplierName}</p>
            {row.original.vendorRmaNumber && <p className="text-sm font-mono text-slate-400">{row.original.vendorRmaNumber}</p>}
            {row.original.isOverdue && (
              <Badge variant="danger" size="sm">{t('inventory.repairTickets.overdueWithVendor', { count: row.original.daysWithVendor })}</Badge>
            )}
          </div>
        )
        : <span className="text-sm text-slate-400">—</span>
    },
    {
      accessorKey: 'receivedDate',
      header: () => t('inventory.repairTickets.receivedColumn'),
      cell: ({ getValue }) => <span className="text-base text-slate-600 dark:text-slate-300">{formatDate(new Date(getValue() as string))}</span>
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <button
          onClick={() => openDetail(row.original)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-brand hover:text-brand transition-colors"
        >
          {t('common.view')} <ArrowRight size={12} />
        </button>
      )
    }
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-brand/10 flex items-center justify-center">
            <Wrench size={22} className="text-brand" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark dark:text-slate-100">{t('inventory.repairTickets.title')}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('inventory.repairTickets.ticketCount', { count: total })}
              {overdueCount > 0 && <span className="text-danger font-semibold"> · {t('inventory.repairTickets.overdueFromVendorRma', { count: overdueCount })}</span>}
            </p>
          </div>
        </div>
        <Button size="md" onClick={() => openCreateForSerial()}>
          <Plus size={16} className="me-1.5" /> {t('inventory.repairTickets.newTicket')}
        </Button>
      </div>

      {historyFor && history && (
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-base font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <History size={16} /> {t('inventory.repairTickets.serviceHistoryTitle', { count: history.length })}
            </p>
            <div className="flex gap-2">
              {historySerial && (
                <Button size="sm" onClick={() => openCreateForSerial(historySerial)}>
                  <Plus size={14} className="me-1" /> {t('inventory.repairTickets.newTicketForUnit')}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setSearchParams({})}>{t('inventory.repairTickets.clearFilter')}</Button>
            </div>
          </div>
          {history.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">{t('inventory.repairTickets.noHistoryForUnit')}</p>}
          {history.map(h => (
            <button key={h.id} onClick={() => openDetail(h)} className="w-full flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2 text-start hover:border-brand transition-colors">
              <span className="text-sm font-mono text-slate-500 dark:text-slate-400">{h.claimNumber}</span>
              <span className="text-sm text-slate-500 dark:text-slate-400">{h.issueDescription}</span>
              <Badge variant={STATUS_VARIANT[h.status]} size="sm">{STATUS_LABELS[h.status]}</Badge>
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        {(['ALL', ...ALL_STATUSES] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-lg text-base font-medium transition-colors ${statusFilter === s ? 'bg-brand text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}>
            {s === 'ALL' ? t('common.all') : STATUS_LABELS[s as RepairStatus]}
          </button>
        ))}
        <div className="relative ms-auto w-64">
          <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('inventory.repairTickets.searchPlaceholder')}
            className="w-full h-10 ps-9 pe-3 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
      </div>

      <DataTable
        data={tickets}
        columns={columns}
        loading={loading}
        emptyMessage={t('inventory.repairTickets.emptyMessage')}
      />

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-dark dark:text-slate-100">{t('inventory.repairTickets.newTicket')}</h2>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('inventory.repairTickets.soldUnitLabel')}</label>
              <SoldSerialPicker value={pickedSerial} onChange={setPickedSerial} />
            </div>
            <CustomerPicker value={pickedCustomer} onChange={setPickedCustomer} label={t('inventory.repairTickets.customerOptionalLabel')} />
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('inventory.repairTickets.issueDescriptionLabel')}</label>
              <textarea value={issueDescription} onChange={e => setIssueDescription(e.target.value)}
                rows={3} placeholder={t('inventory.repairTickets.issuePlaceholder')}
                className="w-full px-4 py-3 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand resize-none" />
            </div>
            <Select label={t('inventory.repairTickets.vendorOptionalLabel')} value={createVendorId} onChange={e => setCreateVendorId(e.target.value)}>
              <option value="">{t('inventory.repairTickets.noneYetOption')}</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.supplierName}</option>)}
            </Select>
            <Select label={t('inventory.repairTickets.technicianOptionalLabel')} value={createTechnicianId} onChange={e => setCreateTechnicianId(e.target.value)}>
              <option value="">{t('inventory.repairTickets.unassignedOption')}</option>
              {technicians.map(tech => <option key={tech.id} value={tech.id}>{tech.fullName}</option>)}
            </Select>
            <div className="flex gap-3 pt-2">
              <Button size="md" className="flex-1" onClick={handleCreate} disabled={creating}>{creating ? t('inventory.repairTickets.savingEllipsis') : t('inventory.repairTickets.createTicket')}</Button>
              <Button size="md" variant="outline" onClick={() => setShowCreate(false)}>{t('common.cancel')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Detail / status update modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-dark dark:text-slate-100">{selected.claimNumber}</h2>
              <Badge variant={STATUS_VARIANT[selected.status]}>{STATUS_LABELS[selected.status]}</Badge>
            </div>
            <div className="space-y-1 text-base text-slate-600 dark:text-slate-300">
              <p><span className="font-semibold text-dark dark:text-slate-100">{selected.product.productName}</span> — <span className="font-mono">{selected.serial.serialNumber}</span></p>
              {selected.customer && <p>{selected.customer.customerName} {selected.customer.phone && `· ${selected.customer.phone}`}</p>}
              <p className="text-slate-500 dark:text-slate-400">{selected.issueDescription}</p>
              <p className="flex items-center gap-1.5 text-sm text-slate-400"><Clock size={13} /> {selected.turnaroundDays} {t('inventory.repairTickets.daysSuffix')} {selected.deliveredDate ? t('inventory.repairTickets.deliveredOn', { date: formatDate(new Date(selected.deliveredDate)) }) : t('inventory.repairTickets.openStatus')}</p>
              {selected.replacementSerial && <p className="flex items-center gap-1.5 text-sm text-brand"><PackageCheck size={13} /> {t('inventory.repairTickets.replacedWith', { serial: selected.replacementSerial.serialNumber })}</p>}
            </div>

            {NEXT_STATUSES[selected.status].length > 0 && (
              <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('inventory.repairTickets.advanceStatus')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {NEXT_STATUSES[selected.status].map(s => (
                    <button key={s} onClick={() => setNextStatus(s)}
                      className={`flex items-center gap-2 px-3 py-3 rounded-xl border-2 text-sm font-medium transition-all ${nextStatus === s ? 'border-brand bg-brand/5 text-brand' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'}`}>
                      {s === 'CANCELLED' ? <XCircle size={14} /> : s === 'SENT_TO_VENDOR' ? <Truck size={14} /> : s === 'REPLACED' ? <PackageCheck size={14} /> : s === 'RETURNED_TO_CUSTOMER' ? <RotateCcw size={14} /> : <ArrowRight size={14} />}
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>

                {nextStatus === 'SENT_TO_VENDOR' && (
                  <div className="grid grid-cols-2 gap-3">
                    <Select label={t('inventory.repairTickets.vendorLabel')} value={vendorId} onChange={e => setVendorId(e.target.value)}>
                      <option value="">{t('inventory.repairTickets.selectVendorOption')}</option>
                      {vendors.map(v => <option key={v.id} value={v.id}>{v.supplierName}</option>)}
                    </Select>
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('inventory.repairTickets.vendorRmaLabel')}</label>
                      <input value={vendorRmaNumber} onChange={e => setVendorRmaNumber(e.target.value)}
                        placeholder={t('inventory.repairTickets.rmaPlaceholder')}
                        className="w-full h-11 px-4 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
                    </div>
                  </div>
                )}

                {nextStatus === 'REPLACED' && (
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('inventory.repairTickets.replacementUnitLabel')}</label>
                    <ReplacementSerialPicker productId={selected.product.id} value={replacementSerialId} onChange={id => setReplacementSerialId(id)} />
                  </div>
                )}

                {(nextStatus === 'REPAIRED' || nextStatus === 'REPLACED') && (
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('inventory.repairTickets.repairCostLabel')}</label>
                    <input type="number" value={repairCost} onChange={e => setRepairCost(e.target.value)}
                      placeholder="0.00" min="0" step="0.01"
                      className="w-full h-11 px-4 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('inventory.repairTickets.notesOptionalLabel')}</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                    className="w-full px-4 py-3 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand resize-none" />
                </div>

                <div className="flex gap-3 pt-1">
                  <Button size="md" className="flex-1" onClick={handleUpdateStatus} disabled={updating || !nextStatus}>{updating ? t('inventory.repairTickets.savingEllipsis') : t('inventory.repairTickets.updateStatusButton')}</Button>
                </div>
              </div>
            )}

            {/* Phase 67 §9.1 — Electronics: repair turnaround by technician.
                Independent of the status-advance flow above — who's doing
                the work is often decided at intake, before any transition. */}
            <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Select label={t('inventory.repairTickets.technicianLabel')} value={assignedTechnicianId} onChange={e => setAssignedTechnicianId(e.target.value)}>
                    <option value="">{t('inventory.repairTickets.unassignedOption')}</option>
                    {technicians.map(tech => <option key={tech.id} value={tech.id}>{tech.fullName}</option>)}
                  </Select>
                </div>
                <Button size="md" variant="outline" onClick={handleAssignTechnician} disabled={savingTechnician}>{t('common.save')}</Button>
              </div>
            </div>

            {/* Phase 67 §9.1 — Electronics: vendor warranty-claim recovery
                ledger. Independent of the status-advance flow above — a
                claim can be recorded/tracked at any point once the shop has
                already repaired or replaced the unit itself. */}
            <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"><DollarSign size={14} /> {t('inventory.repairTickets.vendorRecovery')}</p>
              {selected.vendorClaimAmount == null ? (
                <div className="flex gap-2">
                  <input type="number" value={claimAmountInput} onChange={e => setClaimAmountInput(e.target.value)}
                    placeholder={t('inventory.repairTickets.claimAmountPlaceholder')} min="0" step="0.01"
                    className="flex-1 h-11 px-4 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
                  <Button size="md" onClick={handleRecordClaim} disabled={savingClaim || !claimAmountInput}>{t('inventory.repairTickets.recordClaim')}</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                      <p className="text-xs text-slate-400">{t('inventory.repairTickets.claimedLabel')}</p>
                      <p className="text-sm font-semibold text-dark dark:text-slate-100">{formatCurrency(selected.vendorClaimAmount)}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                      <p className="text-xs text-slate-400">{t('inventory.repairTickets.recoveredLabel')}</p>
                      <p className="text-sm font-semibold text-success">{formatCurrency(selected.vendorRecoveredAmount)}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                      <p className="text-xs text-slate-400">{t('inventory.repairTickets.outstandingLabel')}</p>
                      <p className="text-sm font-semibold text-danger">{formatCurrency(selected.vendorClaimOutstanding ?? 0)}</p>
                    </div>
                  </div>
                  {selected.vendorClaimClosedAt ? (
                    <Badge variant="success">{t('inventory.repairTickets.closedOn', { date: formatDate(new Date(selected.vendorClaimClosedAt)) })}</Badge>
                  ) : (
                    <div className="flex gap-2">
                      <input type="number" value={recoveryAmountInput} onChange={e => setRecoveryAmountInput(e.target.value)}
                        placeholder={t('inventory.repairTickets.amountReceivedPlaceholder')} min="0" step="0.01"
                        className="flex-1 h-11 px-4 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
                      <Button size="md" onClick={handleRecordRecovery} disabled={savingClaim || !recoveryAmountInput}>{t('inventory.repairTickets.recordRecovery')}</Button>
                      <Button size="md" variant="outline" onClick={handleWriteOffClaim} disabled={savingClaim}>{t('inventory.repairTickets.writeOff')}</Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button size="md" variant="outline" className="flex-1" onClick={() => setSelected(null)}>{t('common.close')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
