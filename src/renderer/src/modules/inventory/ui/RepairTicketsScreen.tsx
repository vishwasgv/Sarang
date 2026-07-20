import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, Wrench, Clock, Truck, PackageCheck, RotateCcw, XCircle, History, ArrowRight } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@shared/ui/organisms/DataTable'
import { Button } from '@shared/ui/atoms/Button'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { CustomerPicker, type CustomerLite } from '@shared/ui/molecules/CustomerPicker'
import { useNotificationStore } from '@app/store/notification.store'
import { formatDate } from '@shared/utils/locale.util'

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
  repairCost: number | null
  notes: string | null
  createdAt: string
  serial: SerialLite
  replacementSerial: SerialLite | null
  product: { id: string; productName: string }
  customer: { id: string; customerName: string; phone: string | null } | null
  vendor: { id: string; supplierName: string } | null
}

const STATUS_LABELS: Record<RepairStatus, string> = {
  RECEIVED: 'Received',
  DIAGNOSED: 'Diagnosed',
  SENT_TO_VENDOR: 'Sent to Vendor',
  AWAITING_PARTS: 'Awaiting Parts',
  REPAIRED: 'Repaired',
  REPLACED: 'Replaced',
  RETURNED_TO_CUSTOMER: 'Returned to Customer',
  CANCELLED: 'Cancelled',
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
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<SerialLite & { productId: string; productName: string }>>([])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      const res = await window.api.serials.list({ serialNumber: query.trim(), status: 'SOLD', limit: 10 })
      if (res.success && res.data) {
        const d = res.data as { serials: Array<SerialLite & { productId: string; productName: string }> }
        setResults(d.serials ?? [])
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-900">
        <div className="min-w-0">
          <p className="text-sm font-medium text-dark dark:text-slate-100 truncate">{value.productName}</p>
          <p className="text-sm font-mono text-slate-400">{value.serialNumber}{value.imeiNumber ? ` · IMEI ${value.imeiNumber}` : ''}</p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="text-slate-400 hover:text-danger shrink-0 text-sm">Change</button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search serial number or IMEI of a sold unit…"
          className="w-full h-11 pl-10 pr-4 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
      </div>
      {results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full border border-slate-100 dark:border-slate-700 rounded-lg overflow-hidden divide-y divide-slate-50 dark:divide-slate-800 bg-white dark:bg-slate-900 shadow-lg max-h-56 overflow-y-auto">
          {results.map(s => (
            <button key={s.id} type="button"
              onClick={() => { onChange(s); setQuery(''); setResults([]) }}
              className="w-full px-3 py-2 text-left hover:bg-brand/5 transition-colors">
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
  const [options, setOptions] = useState<SerialLite[]>([])
  useEffect(() => {
    window.api.serials.list({ productId, status: 'AVAILABLE', limit: 50 }).then(res => {
      if (res.success && res.data) setOptions((res.data as { serials: SerialLite[] }).serials ?? [])
    })
  }, [productId])

  if (options.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No in-stock unit of this product is available to use as a replacement — add stock/serials first.</p>
  }
  return (
    <Select value={value} onChange={e => {
      const s = options.find(o => o.id === e.target.value)
      onChange(e.target.value, s ? `${s.serialNumber}${s.imeiNumber ? ` (IMEI ${s.imeiNumber})` : ''}` : '')
    }}>
      <option value="">Select a replacement unit…</option>
      {options.map(o => <option key={o.id} value={o.id}>{o.serialNumber}{o.imeiNumber ? ` · IMEI ${o.imeiNumber}` : ''}</option>)}
    </Select>
  )
}

export function RepairTicketsScreen() {
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const serialFilter = searchParams.get('serialId')

  const [tickets, setTickets] = useState<TicketRow[]>([])
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

  const [selected, setSelected] = useState<TicketRow | null>(null)
  const [updating, setUpdating] = useState(false)
  const [nextStatus, setNextStatus] = useState<RepairStatus | null>(null)
  const [vendorId, setVendorId] = useState('')
  const [vendorRmaNumber, setVendorRmaNumber] = useState('')
  const [replacementSerialId, setReplacementSerialId] = useState('')
  const [repairCost, setRepairCost] = useState('')
  const [notes, setNotes] = useState('')

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
        toastError('Error', res.error?.message ?? 'Could not load repair tickets.')
      }
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search, toastError])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    window.api.suppliers.list({ limit: 200 }).then(res => {
      if (res.success && res.data) {
        const d = res.data as { suppliers?: Array<{ id: string; supplierName: string }> } | Array<{ id: string; supplierName: string }>
        setVendors(Array.isArray(d) ? d : (d.suppliers ?? []))
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
    setShowCreate(true)
  }

  async function handleCreate() {
    if (!pickedSerial) { toastError('Missing Fields', 'Select the sold unit this ticket is for.'); return }
    if (!issueDescription.trim()) { toastError('Missing Fields', 'Describe the issue.'); return }
    setCreating(true)
    try {
      const res = await window.api.repairTickets.create({
        serialId: pickedSerial.id,
        customerId: pickedCustomer?.id,
        issueDescription: issueDescription.trim(),
        vendorId: createVendorId || undefined,
      })
      if (res.success) {
        const d = res.data as { claimNumber: string }
        toastSuccess('Ticket Created', `Claim ${d.claimNumber} opened.`)
        setShowCreate(false)
        loadData()
        if (serialFilter) {
          window.api.repairTickets.serviceHistory({ serialId: serialFilter }).then(r => {
            if (r.success && r.data) setHistory((r.data as { tickets: TicketRow[] }).tickets)
          })
        }
      } else {
        toastError('Failed', res.error?.message ?? 'Could not create repair ticket.')
      }
    } finally {
      setCreating(false)
    }
  }

  function openDetail(t: TicketRow) {
    setSelected(t)
    setNextStatus(null)
    setVendorId(t.vendor?.id ?? '')
    setVendorRmaNumber(t.vendorRmaNumber ?? '')
    setReplacementSerialId('')
    setRepairCost(t.repairCost != null ? String(t.repairCost) : '')
    setNotes(t.notes ?? '')
  }

  async function handleUpdateStatus() {
    if (!selected || !nextStatus) return
    if (nextStatus === 'REPLACED' && !replacementSerialId) {
      toastError('Missing Fields', 'Select a replacement unit.')
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
        toastSuccess('Updated', `${selected.claimNumber} → ${STATUS_LABELS[nextStatus]}`)
        setSelected(null)
        loadData()
        if (serialFilter) {
          window.api.repairTickets.serviceHistory({ serialId: serialFilter }).then(r => {
            if (r.success && r.data) setHistory((r.data as { tickets: TicketRow[] }).tickets)
          })
        }
      } else {
        toastError('Failed', res.error?.message ?? 'Could not update ticket.')
      }
    } finally {
      setUpdating(false)
    }
  }

  const columns: ColumnDef<TicketRow, unknown>[] = [
    {
      id: 'claim',
      header: () => 'Claim',
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
      header: () => 'Customer',
      cell: ({ row }) => row.original.customer
        ? <div><p className="text-base text-dark dark:text-slate-100">{row.original.customer.customerName}</p>{row.original.customer.phone && <p className="text-sm text-slate-400">{row.original.customer.phone}</p>}</div>
        : <span className="text-sm text-slate-400">—</span>
    },
    {
      id: 'status',
      header: () => 'Status',
      cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{STATUS_LABELS[row.original.status]}</Badge>
    },
    {
      id: 'turnaround',
      header: () => 'Turnaround',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-base text-slate-600 dark:text-slate-300">
          <Clock size={13} className="text-slate-400" /> {row.original.turnaroundDays}d {row.original.deliveredDate ? '' : '(open)'}
        </div>
      )
    },
    {
      id: 'vendor',
      header: () => 'Vendor RMA',
      cell: ({ row }) => row.original.vendor
        ? <div><p className="text-base text-dark dark:text-slate-100">{row.original.vendor.supplierName}</p>{row.original.vendorRmaNumber && <p className="text-sm font-mono text-slate-400">{row.original.vendorRmaNumber}</p>}</div>
        : <span className="text-sm text-slate-400">—</span>
    },
    {
      accessorKey: 'receivedDate',
      header: () => 'Received',
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
          View <ArrowRight size={12} />
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
            <h1 className="text-xl font-bold text-dark dark:text-slate-100">Repair Tickets</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{total} ticket(s)</p>
          </div>
        </div>
        <Button size="md" onClick={() => openCreateForSerial()}>
          <Plus size={16} className="mr-1.5" /> New Repair Ticket
        </Button>
      </div>

      {historyFor && history && (
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-base font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <History size={16} /> Service history for this unit ({history.length})
            </p>
            <div className="flex gap-2">
              {historySerial && (
                <Button size="sm" onClick={() => openCreateForSerial(historySerial)}>
                  <Plus size={14} className="mr-1" /> New Ticket for This Unit
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setSearchParams({})}>Clear filter</Button>
            </div>
          </div>
          {history.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">No repair tickets yet for this unit.</p>}
          {history.map(h => (
            <button key={h.id} onClick={() => openDetail(h)} className="w-full flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2 text-left hover:border-brand transition-colors">
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
            {s === 'ALL' ? 'All' : STATUS_LABELS[s as RepairStatus]}
          </button>
        ))}
        <div className="relative ml-auto w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search claim, RMA, serial, customer…"
            className="w-full h-10 pl-9 pr-3 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
      </div>

      <DataTable
        data={tickets}
        columns={columns}
        loading={loading}
        emptyMessage="No repair tickets yet."
      />

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-dark dark:text-slate-100">New Repair Ticket</h2>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sold Unit</label>
              <SoldSerialPicker value={pickedSerial} onChange={setPickedSerial} />
            </div>
            <CustomerPicker value={pickedCustomer} onChange={setPickedCustomer} label="Customer (optional)" />
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Issue Description</label>
              <textarea value={issueDescription} onChange={e => setIssueDescription(e.target.value)}
                rows={3} placeholder="What's wrong with the device?"
                className="w-full px-4 py-3 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand resize-none" />
            </div>
            <Select label="Vendor (optional)" value={createVendorId} onChange={e => setCreateVendorId(e.target.value)}>
              <option value="">— None yet —</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.supplierName}</option>)}
            </Select>
            <div className="flex gap-3 pt-2">
              <Button size="md" className="flex-1" onClick={handleCreate} disabled={creating}>{creating ? 'Saving…' : 'Create Ticket'}</Button>
              <Button size="md" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
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
              <p className="flex items-center gap-1.5 text-sm text-slate-400"><Clock size={13} /> {selected.turnaroundDays} day(s) {selected.deliveredDate ? `(delivered ${formatDate(new Date(selected.deliveredDate))})` : 'open'}</p>
              {selected.replacementSerial && <p className="flex items-center gap-1.5 text-sm text-brand"><PackageCheck size={13} /> Replaced with {selected.replacementSerial.serialNumber}</p>}
            </div>

            {NEXT_STATUSES[selected.status].length > 0 && (
              <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Advance status</p>
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
                    <Select label="Vendor" value={vendorId} onChange={e => setVendorId(e.target.value)}>
                      <option value="">Select vendor…</option>
                      {vendors.map(v => <option key={v.id} value={v.id}>{v.supplierName}</option>)}
                    </Select>
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Vendor RMA #</label>
                      <input value={vendorRmaNumber} onChange={e => setVendorRmaNumber(e.target.value)}
                        placeholder="RMA-12345"
                        className="w-full h-11 px-4 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
                    </div>
                  </div>
                )}

                {nextStatus === 'REPLACED' && (
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Replacement Unit (same product, in-stock)</label>
                    <ReplacementSerialPicker productId={selected.product.id} value={replacementSerialId} onChange={id => setReplacementSerialId(id)} />
                  </div>
                )}

                {(nextStatus === 'REPAIRED' || nextStatus === 'REPLACED') && (
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Repair Cost (optional)</label>
                    <input type="number" value={repairCost} onChange={e => setRepairCost(e.target.value)}
                      placeholder="0.00" min="0" step="0.01"
                      className="w-full h-11 px-4 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Notes (optional)</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                    className="w-full px-4 py-3 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand resize-none" />
                </div>

                <div className="flex gap-3 pt-1">
                  <Button size="md" className="flex-1" onClick={handleUpdateStatus} disabled={updating || !nextStatus}>{updating ? 'Saving…' : 'Update Status'}</Button>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button size="md" variant="outline" className="flex-1" onClick={() => setSelected(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
