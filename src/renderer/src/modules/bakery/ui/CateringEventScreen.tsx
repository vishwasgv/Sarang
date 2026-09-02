import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { PartyPopper, Plus, RefreshCw, Trash2, Search, Receipt, DollarSign, X } from 'lucide-react'
import { Card } from '@shared/ui/molecules/Card'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { Badge } from '@shared/ui/atoms/Badge'
import { CustomerPicker, type CustomerLite } from '@shared/ui/molecules/CustomerPicker'
import { useAuthStore } from '@app/store/auth.store'
import { useBusinessStore } from '@app/store/business.store'
import { useNotificationStore } from '@app/store/notification.store'
import { cn } from '@shared/utils/cn'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDate } from '@shared/utils/locale.util'

interface Product { id: string; productName: string; sku?: string | null; sellingPrice: number }

interface CateringEventMenuItem { id: string; productId: string; quantity: number; unitPrice: number; product: { id: string; productName: string } }
interface CateringEventDay { id: string; serviceDate: string; mealsCount: number; snacksCount: number }
interface CateringEventStaff { id: string; role: string; workerCount: number; ratePerWorker: number; amount: number; serviceDate: string | null }

interface CateringEvent {
  id: string
  eventNumber: string
  customerId: string
  eventStartDate: string
  eventEndDate: string | null
  venueAddress: string | null
  attendeeCount: number
  pricePerPlate: number
  finalNegotiatedPrice: number | null
  advanceAmount: number
  advancePaymentMethod: string
  status: string
  invoiceId: string | null
  createdAt: string
  customer: { id: string; customerName: string; phone: string | null }
  menuItems: CateringEventMenuItem[]
  days: CateringEventDay[]
  staff: CateringEventStaff[]
}

interface MenuItemDraft { productId: string; productName: string; quantity: string; unitPrice: string }
interface DayDraft { serviceDate: string; mealsCount: string; snacksCount: string }
interface StaffDraft { role: 'COOK' | 'SERVER' | 'CLEANER' | 'OTHER'; workerCount: string; ratePerWorker: string }

const EMPTY_MENU_DRAFT: MenuItemDraft = { productId: '', productName: '', quantity: '1', unitPrice: '' }
const EMPTY_DAY_DRAFT: DayDraft = { serviceDate: '', mealsCount: '0', snacksCount: '0' }
const EMPTY_STAFF_DRAFT: StaffDraft = { role: 'COOK', workerCount: '1', ratePerWorker: '' }

function ProductPicker({ products, value, onChange, placeholder }: { products: Product[]; value: string; onChange: (id: string, name: string, price: number) => void; placeholder: string }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const selected = products.find(p => p.id === value)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const results = query.trim()
    ? products.filter(p => p.productName.toLowerCase().includes(query.toLowerCase()) || (p.sku ?? '').toLowerCase().includes(query.toLowerCase())).slice(0, 50)
    : products.slice(0, 50)

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <Search size={12} className="absolute start-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          value={open ? query : (selected ? selected.productName : '')}
          onChange={e => { setQuery(e.target.value); if (!open) setOpen(true) }}
          onFocus={() => { setQuery(''); setOpen(true) }}
          placeholder={placeholder}
          className="w-full h-8 ps-6 pe-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand text-slate-700 dark:text-slate-300"
        />
      </div>
      {open && (
        <div className="absolute start-0 end-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">—</p>
          ) : results.map(p => (
            <button key={p.id} type="button" onClick={() => { onChange(p.id, p.productName, p.sellingPrice); setQuery(''); setOpen(false) }}
              className={cn('w-full text-start px-3 py-2 text-sm hover:bg-brand/5 transition-colors', p.id === value && 'bg-brand/5')}>
              {p.productName}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// 2026-09-02 — Catering event booking (Bakery/Sweet Shop/Catering vertical).
// Structural mirror of CustomOrderBookingScreen — same create-form +
// list-with-generate-invoice shape — extended with two more sub-collections
// (per-day meal/snack counts, per-role staffing cost) and a distinct
// "record the final bargained price" action, since catering pricing is
// genuinely negotiated per event rather than fixed at booking time. Fully
// i18n'd, same as every other new-vertical screen this session.
export function CateringEventScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const sym = useBusinessStore((s) => s.profile?.currencySymbol ?? '₹')
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const canManage = hasPermission('cateringEvent.manage')

  const [events, setEvents] = useState<CateringEvent[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [customer, setCustomer] = useState<CustomerLite | null>(null)
  const [eventStartDate, setEventStartDate] = useState('')
  const [eventEndDate, setEventEndDate] = useState('')
  const [venueAddress, setVenueAddress] = useState('')
  const [attendeeCount, setAttendeeCount] = useState('')
  const [pricePerPlate, setPricePerPlate] = useState('')
  const [advanceAmount, setAdvanceAmount] = useState('0')
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState('CASH')
  const [notes, setNotes] = useState('')

  const [menuItems, setMenuItems] = useState<Array<MenuItemDraft & { key: string }>>([])
  const [menuDraft, setMenuDraft] = useState<MenuItemDraft>(EMPTY_MENU_DRAFT)
  const [days, setDays] = useState<Array<DayDraft & { key: string }>>([])
  const [dayDraft, setDayDraft] = useState<DayDraft>(EMPTY_DAY_DRAFT)
  const [staff, setStaff] = useState<Array<StaffDraft & { key: string }>>([])
  const [staffDraft, setStaffDraft] = useState<StaffDraft>(EMPTY_STAFF_DRAFT)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [invoicingId, setInvoicingId] = useState<string | null>(null)

  const [priceTarget, setPriceTarget] = useState<CateringEvent | null>(null)
  const [priceInput, setPriceInput] = useState('')
  const [recordingPrice, setRecordingPrice] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [eRes, pRes] = await Promise.all([
        window.api.cateringEvent.list(),
        window.api.products.list({ isActive: true, limit: 500 }),
      ])
      if (eRes.success) setEvents((eRes.data as CateringEvent[]) ?? [])
      else toastError(t('common.error'), eRes.error?.message ?? t('bakery.cateringEvents.loadFailed'))
      if (pRes.success) setProducts((pRes.data as { products?: Product[] })?.products ?? [])
    } catch {
      toastError(t('common.error'), t('bakery.cateringEvents.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  useEffect(() => { void load() }, [load])

  function resetForm() {
    setCustomer(null)
    setEventStartDate('')
    setEventEndDate('')
    setVenueAddress('')
    setAttendeeCount('')
    setPricePerPlate('')
    setAdvanceAmount('0')
    setAdvancePaymentMethod('CASH')
    setNotes('')
    setMenuItems([])
    setMenuDraft(EMPTY_MENU_DRAFT)
    setDays([])
    setDayDraft(EMPTY_DAY_DRAFT)
    setStaff([])
    setStaffDraft(EMPTY_STAFF_DRAFT)
    setError('')
  }

  function addMenuItem() {
    if (!menuDraft.productId) return
    const qty = Number(menuDraft.quantity)
    const price = Number(menuDraft.unitPrice)
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0) return
    setMenuItems(prev => [...prev, { ...menuDraft, key: `${menuDraft.productId}-${Date.now()}` }])
    setMenuDraft(EMPTY_MENU_DRAFT)
  }

  function addDay() {
    if (!dayDraft.serviceDate) return
    setDays(prev => [...prev, { ...dayDraft, key: `${dayDraft.serviceDate}-${Date.now()}` }])
    setDayDraft(EMPTY_DAY_DRAFT)
  }

  function addStaff() {
    const count = Number(staffDraft.workerCount)
    const rate = Number(staffDraft.ratePerWorker)
    if (!Number.isFinite(count) || count <= 0 || !Number.isFinite(rate) || rate < 0) return
    setStaff(prev => [...prev, { ...staffDraft, key: `${staffDraft.role}-${Date.now()}` }])
    setStaffDraft(EMPTY_STAFF_DRAFT)
  }

  const estimatedTotal = (Number(pricePerPlate) || 0) * (Number(attendeeCount) || 0)
  const staffCostTotal = staff.reduce((sum, s) => sum + Number(s.workerCount) * Number(s.ratePerWorker), 0)

  async function handleCreate() {
    setError('')
    if (!customer) { setError(t('bakery.cateringEvents.selectCustomerError')); return }
    if (!eventStartDate) { setError(t('bakery.cateringEvents.eventStartDateError')); return }
    const attendees = Number(attendeeCount)
    if (!Number.isFinite(attendees) || attendees <= 0) { setError(t('bakery.cateringEvents.attendeeCountError')); return }
    const perPlate = Number(pricePerPlate)
    if (!Number.isFinite(perPlate) || perPlate < 0) { setError(t('bakery.cateringEvents.pricePerPlateError')); return }
    const advance = Number(advanceAmount) || 0
    if (advance > estimatedTotal) { setError(t('bakery.cateringEvents.advanceExceedsError')); return }

    setSaving(true)
    try {
      const res = await window.api.cateringEvent.create({
        customerId: customer.id,
        eventStartDate,
        eventEndDate: eventEndDate || undefined,
        venueAddress: venueAddress.trim() || undefined,
        attendeeCount: attendees,
        pricePerPlate: perPlate,
        advanceAmount: advance,
        advancePaymentMethod: advancePaymentMethod as 'CASH' | 'UPI' | 'CARD' | 'WALLET',
        notes: notes.trim() || undefined,
        menuItems: menuItems.map(i => ({ productId: i.productId, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) })),
        days: days.map(d => ({ serviceDate: d.serviceDate, mealsCount: Number(d.mealsCount) || 0, snacksCount: Number(d.snacksCount) || 0 })),
        staff: staff.map(s => ({ role: s.role, workerCount: Number(s.workerCount), ratePerWorker: Number(s.ratePerWorker) })),
      })
      if (res.success) {
        const data = res.data as CateringEvent
        toastSuccess(t('bakery.cateringEvents.eventCreated'), data.eventNumber)
        setShowForm(false)
        resetForm()
        await load()
      } else {
        setError(res.error?.message ?? t('bakery.cateringEvents.eventCreateFailed'))
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleRecordPrice() {
    if (!priceTarget) return
    const price = Number(priceInput)
    if (!Number.isFinite(price) || price < 0) return
    setRecordingPrice(true)
    try {
      const res = await window.api.cateringEvent.recordFinalNegotiatedPrice({ id: priceTarget.id, finalNegotiatedPrice: price })
      if (res.success) {
        toastSuccess(t('bakery.cateringEvents.finalPriceRecorded'), formatCurrency(price))
        setPriceTarget(null)
        await load()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('bakery.cateringEvents.finalPriceRecordFailed'))
      }
    } finally {
      setRecordingPrice(false)
    }
  }

  async function handleGenerateInvoice(id: string) {
    setInvoicingId(id)
    try {
      const res = await window.api.cateringEvent.generateInvoice({ id })
      if (res.success) { toastSuccess(t('bakery.cateringEvents.invoiceGenerated'), t('bakery.cateringEvents.invoiceGeneratedDetail')); await load() }
      else toastError(t('common.error'), res.error?.message ?? t('bakery.cateringEvents.invoiceGenerateFailed'))
    } finally {
      setInvoicingId(null)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-dark flex items-center gap-2"><PartyPopper size={20} /> {t('bakery.cateringEvents.title')}</h2>
          <p className="text-sm text-slate-400">{t('bakery.cateringEvents.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void load()} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:border-slate-300 transition-colors">
            <RefreshCw size={14} /> {t('bakery.cateringEvents.refresh')}
          </button>
          {canManage && (
            <Button size="sm" onClick={() => setShowForm((s) => !s)} icon={<Plus size={14} />}>{t('bakery.cateringEvents.newEvent')}</Button>
          )}
        </div>
      </div>

      {showForm && canManage && (
        <Card padding="md" className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <CustomerPicker value={customer} onChange={setCustomer} label={t('bakery.cateringEvents.customer')} />
            <Input label={t('bakery.cateringEvents.venueAddress')} value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Input label={t('bakery.cateringEvents.eventStartDate')} type="date" value={eventStartDate} onChange={(e) => setEventStartDate(e.target.value)} />
            <Input label={t('bakery.cateringEvents.eventEndDate')} type="date" value={eventEndDate} onChange={(e) => setEventEndDate(e.target.value)} />
            <Input label={t('bakery.cateringEvents.attendeeCount')} type="number" min="1" step="1" value={attendeeCount} onChange={(e) => setAttendeeCount(e.target.value)} />
            <Input label={t('bakery.cateringEvents.pricePerPlate', { sym })} type="number" min="0" step="0.01" value={pricePerPlate} onChange={(e) => setPricePerPlate(e.target.value)} />
          </div>
          {estimatedTotal > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('bakery.cateringEvents.estimatedTotal')}: <span className="font-semibold text-dark dark:text-slate-100">{formatCurrency(estimatedTotal)}</span></p>
          )}

          {/* Menu */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-slate-500">{t('bakery.cateringEvents.menuSection')}</p>
            <div className="grid grid-cols-6 gap-2 items-end">
              <div className="col-span-3"><ProductPicker products={products} value={menuDraft.productId} placeholder={t('bakery.cateringEvents.searchProduct')} onChange={(id, name, price) => setMenuDraft(d => ({ ...d, productId: id, productName: name, unitPrice: String(price) }))} /></div>
              <Input label={t('bakery.cateringEvents.qty')} type="number" min="1" step="1" value={menuDraft.quantity} onChange={(e) => setMenuDraft(d => ({ ...d, quantity: e.target.value }))} />
              <Input label={t('bakery.cateringEvents.price')} type="number" min="0" step="0.01" value={menuDraft.unitPrice} onChange={(e) => setMenuDraft(d => ({ ...d, unitPrice: e.target.value }))} />
              <Button size="sm" variant="secondary" onClick={addMenuItem} disabled={!menuDraft.productId}>{t('bakery.cateringEvents.add')}</Button>
            </div>
            {menuItems.length > 0 && (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {menuItems.map((i, idx) => (
                  <div key={i.key} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-dark dark:text-slate-200">{i.productName} × {i.quantity} @ {formatCurrency(Number(i.unitPrice))}</span>
                    <button onClick={() => setMenuItems(prev => prev.filter((_, x) => x !== idx))} className="text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Per-day meals/snacks */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-slate-500">{t('bakery.cateringEvents.daysSection')}</p>
            <div className="grid grid-cols-4 gap-2 items-end">
              <Input label={t('bakery.cateringEvents.serviceDate')} type="date" value={dayDraft.serviceDate} onChange={(e) => setDayDraft(d => ({ ...d, serviceDate: e.target.value }))} />
              <Input label={t('bakery.cateringEvents.mealsCount')} type="number" min="0" step="1" value={dayDraft.mealsCount} onChange={(e) => setDayDraft(d => ({ ...d, mealsCount: e.target.value }))} />
              <Input label={t('bakery.cateringEvents.snacksCount')} type="number" min="0" step="1" value={dayDraft.snacksCount} onChange={(e) => setDayDraft(d => ({ ...d, snacksCount: e.target.value }))} />
              <Button size="sm" variant="secondary" onClick={addDay} disabled={!dayDraft.serviceDate}>{t('bakery.cateringEvents.addDay')}</Button>
            </div>
            {days.length > 0 && (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {days.map((d, idx) => (
                  <div key={d.key} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-dark dark:text-slate-200">{formatDate(new Date(d.serviceDate))} — {t('bakery.cateringEvents.mealsCount')}: {d.mealsCount}, {t('bakery.cateringEvents.snacksCount')}: {d.snacksCount}</span>
                    <button onClick={() => setDays(prev => prev.filter((_, x) => x !== idx))} className="text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Per-role staffing cost */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-slate-500">{t('bakery.cateringEvents.staffSection')}</p>
            <div className="grid grid-cols-4 gap-2 items-end">
              <Select label={t('bakery.cateringEvents.role')} value={staffDraft.role} onChange={(e) => setStaffDraft(d => ({ ...d, role: e.target.value as StaffDraft['role'] }))}>
                <option value="COOK">{t('bakery.cateringEvents.cook')}</option>
                <option value="SERVER">{t('bakery.cateringEvents.server')}</option>
                <option value="CLEANER">{t('bakery.cateringEvents.cleaner')}</option>
                <option value="OTHER">{t('bakery.cateringEvents.other')}</option>
              </Select>
              <Input label={t('bakery.cateringEvents.workerCount')} type="number" min="1" step="1" value={staffDraft.workerCount} onChange={(e) => setStaffDraft(d => ({ ...d, workerCount: e.target.value }))} />
              <Input label={t('bakery.cateringEvents.ratePerWorker', { sym })} type="number" min="0" step="0.01" value={staffDraft.ratePerWorker} onChange={(e) => setStaffDraft(d => ({ ...d, ratePerWorker: e.target.value }))} />
              <Button size="sm" variant="secondary" onClick={addStaff}>{t('bakery.cateringEvents.addStaff')}</Button>
            </div>
            {staff.length > 0 && (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {staff.map((s, idx) => (
                  <div key={s.key} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-dark dark:text-slate-200">{t(`bakery.cateringEvents.${s.role.toLowerCase()}`)} × {s.workerCount} @ {formatCurrency(Number(s.ratePerWorker))} = {formatCurrency(Number(s.workerCount) * Number(s.ratePerWorker))}</span>
                    <button onClick={() => setStaff(prev => prev.filter((_, x) => x !== idx))} className="text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                ))}
                <div className="pt-1.5 text-sm font-semibold text-dark dark:text-slate-100">{t('bakery.cateringEvents.staffCostTotal')}: {formatCurrency(staffCostTotal)}</div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label={t('bakery.cateringEvents.advanceAmount', { sym })} type="number" min="0" step="0.01" value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} />
            <Select label={t('bakery.cateringEvents.advancePaymentMethod')} value={advancePaymentMethod} onChange={(e) => setAdvancePaymentMethod(e.target.value)}>
              <option value="CASH">{t('bakery.cateringEvents.cash')}</option>
              <option value="UPI">{t('bakery.cateringEvents.upi')}</option>
              <option value="CARD">{t('bakery.cateringEvents.card')}</option>
              <option value="WALLET">{t('bakery.cateringEvents.wallet')}</option>
            </Select>
          </div>
          <Input label={t('bakery.cateringEvents.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
          {error && <p className="text-xs text-danger bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setShowForm(false); resetForm() }}>{t('bakery.cateringEvents.cancel')}</Button>
            <Button size="sm" onClick={() => void handleCreate()} loading={saving}>{t('bakery.cateringEvents.book')}</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400">{t('bakery.cateringEvents.loading')}</div>
      ) : events.length === 0 ? (
        <Card padding="lg" className="text-center py-12">
          <PartyPopper size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('bakery.cateringEvents.noEventsYet')}</p>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {events.map((ev) => {
              const finalTotal = ev.finalNegotiatedPrice ?? ev.pricePerPlate * ev.attendeeCount
              return (
                <div key={ev.id} className="px-5 py-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm dark:text-slate-100">{ev.eventNumber}</span>
                      <Badge variant={ev.status === 'COMPLETED' ? 'success' : ev.status === 'CANCELLED' ? 'neutral' : 'warning'} size="sm">{ev.status}</Badge>
                    </div>
                    <div className="text-sm text-gray-800 mt-1 dark:text-slate-200">{ev.customer.customerName} — {formatDate(new Date(ev.eventStartDate))}{ev.venueAddress ? ` · ${ev.venueAddress}` : ''}</div>
                    <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap dark:text-slate-400">
                      <span>{t('bakery.cateringEvents.attendeesLabel', { count: ev.attendeeCount })}</span>
                      <span className="font-semibold text-dark dark:text-slate-100">
                        {ev.finalNegotiatedPrice != null ? t('bakery.cateringEvents.finalPriceLabel', { amount: formatCurrency(finalTotal) }) : t('bakery.cateringEvents.quotedLabel', { amount: formatCurrency(finalTotal) })}
                      </span>
                      <span>{t('bakery.cateringEvents.advanceLabel', { amount: formatCurrency(ev.advanceAmount) })}</span>
                    </div>
                  </div>
                  {!ev.invoiceId && ev.status === 'BOOKED' && canManage && (
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <button onClick={() => { setPriceTarget(ev); setPriceInput(String(ev.finalNegotiatedPrice ?? finalTotal)) }} className="text-xs px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-brand hover:text-brand flex items-center gap-1 font-medium">
                        <DollarSign size={12} /> {t('bakery.cateringEvents.recordFinalPrice')}
                      </button>
                      <button onClick={() => void handleGenerateInvoice(ev.id)} disabled={invoicingId === ev.id} className="text-xs px-3 py-1.5 rounded-lg bg-brand/5 text-brand border border-brand/20 hover:bg-brand/10 flex items-center gap-1 font-medium">
                        <Receipt size={12} /> {invoicingId === ev.id ? t('bakery.cateringEvents.generatingInvoice') : t('bakery.cateringEvents.generateInvoice')}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {priceTarget && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-dark dark:text-slate-100">{t('bakery.cateringEvents.recordFinalPrice')}</h2>
              <button onClick={() => setPriceTarget(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <Input label={t('bakery.cateringEvents.finalPricePrompt', { sym })} type="number" min="0" step="0.01" value={priceInput} onChange={(e) => setPriceInput(e.target.value)} />
            <div className="flex gap-3">
              <button onClick={() => void handleRecordPrice()} disabled={recordingPrice}
                className="flex-1 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50">
                {recordingPrice ? t('bakery.cateringEvents.recordingPrice') : t('bakery.cateringEvents.save')}
              </button>
              <button onClick={() => setPriceTarget(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:border-slate-300 transition-colors">
                {t('bakery.cateringEvents.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
