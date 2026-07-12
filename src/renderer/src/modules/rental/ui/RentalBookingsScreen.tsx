import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X, CheckCircle2, RotateCcw, Clock, Printer, Ban, CalendarClock } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { Card } from '@shared/ui/molecules/Card'
import { Button } from '@shared/ui/atoms/Button'
import { CustomerPicker, type CustomerLite } from '@shared/ui/molecules/CustomerPicker'
import { useAuthStore } from '@app/store/auth.store'
import { useNotificationStore } from '@app/store/notification.store'

interface RentalBookingItem {
  id: string
  productId: string
  productName: string
  rentalUnitId: string | null
  rentalUnitLabel: string | null
  quantity: number
  rateBasis: string
  rateAmount: number
  lineTotal: number
  conditionOut: string | null
  conditionIn: string | null
}

interface RentalBooking {
  id: string
  bookingNumber: string
  customerId: string
  customerName: string
  status: 'RESERVED' | 'CHECKED_OUT' | 'RETURNED' | 'CANCELLED'
  isOverdue: boolean
  startDateTime: string
  endDateTime: string
  securityDepositCollected: number
  securityDepositRefunded: number | null
  lateFeeAmount: number
  damageChargeAmount: number
  invoiceId: string | null
  items: RentalBookingItem[]
}

interface RentalProduct {
  id: string
  productName: string
  isRentable: boolean
  rentalTrackingType: 'UNIT' | 'BULK' | null
  rentalRates: Array<{ basis: string; amount: number }>
  rentalSecurityDeposit: number | null
}

const STATUS_COLORS: Record<string, string> = {
  RESERVED: 'bg-warning/10 text-warning',
  CHECKED_OUT: 'bg-brand/10 text-brand',
  RETURNED: 'bg-success/10 text-success',
  CANCELLED: 'bg-slate-200 text-slate-500',
}

export function RentalBookingsScreen() {
  const { t } = useTranslation()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const { error: toastError } = useNotificationStore()
  const canManage = hasPermission('rental.manage')

  const [bookings, setBookings] = useState<RentalBooking[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<RentalBooking | null>(null)
  const [showNewBooking, setShowNewBooking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.rental.listBookings(statusFilter ? { status: statusFilter } : undefined)
      if (res.success && res.data) setBookings((res.data as { bookings: RentalBooking[] }).bookings)
      else toastError(t('common.error'), res.error?.message ?? t('common.error'))
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [statusFilter, toastError, t])

  useEffect(() => { load() }, [load])

  async function refreshSelected(id: string) {
    const res = await api.rental.getBooking({ id })
    if (res.success && res.data) setSelected(res.data as RentalBooking)
    await load()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-slate-100">{t('rental.bookings')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t('rental.bookingsDesc')}</p>
        </div>
        {canManage && (
          <Button onClick={() => setShowNewBooking(true)}>
            <Plus size={16} className="mr-1.5" /> {t('rental.newBooking')}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {['', 'RESERVED', 'CHECKED_OUT', 'RETURNED', 'CANCELLED'].map((s) => (
          <button key={s || 'all'} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${statusFilter === s ? 'bg-brand text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
            {s ? t(`rental.status.${s}`) : t('common.all')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="w-7 h-7 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-12">
          <CalendarClock size={36} className="mx-auto text-slate-300 mb-2" />
          <p className="text-slate-500 dark:text-slate-400">{t('rental.noBookings')}</p>
        </div>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">{t('rental.col.booking')}</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">{t('rental.col.customer')}</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">{t('rental.col.items')}</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">{t('rental.col.period')}</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600 dark:text-slate-300">{t('common.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {bookings.map((b) => (
                <tr key={b.id} onClick={() => setSelected(b)} className="hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors">
                  <td className="px-4 py-3 font-medium text-dark dark:text-slate-100">{b.bookingNumber}</td>
                  <td className="px-4 py-3">{b.customerName}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{b.items.map((i) => i.productName).join(', ')}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{new Date(b.startDateTime).toLocaleDateString()} → {new Date(b.endDateTime).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[b.status]}`}>
                      {b.isOverdue ? t('rental.status.OVERDUE') : t(`rental.status.${b.status}`)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {selected && (
        <BookingDetailModal booking={selected} canManage={canManage} onClose={() => setSelected(null)} onChanged={() => refreshSelected(selected.id)} />
      )}

      {showNewBooking && (
        <NewBookingModal onClose={() => setShowNewBooking(false)} onCreated={() => { setShowNewBooking(false); load() }} />
      )}
    </div>
  )
}

function BookingDetailModal({ booking, canManage, onClose, onChanged }: { booking: RentalBooking; canManage: boolean; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation()
  const { error: toastError } = useNotificationStore()
  const [busy, setBusy] = useState(false)
  const [checkoutNotes, setCheckoutNotes] = useState('')
  const [returnNotes, setReturnNotes] = useState('')
  const [damageCharge, setDamageCharge] = useState('0')
  const [depositRefund, setDepositRefund] = useState(String(booking.securityDepositCollected))

  async function handleCheckout() {
    setBusy(true)
    try {
      const res = await api.rental.checkoutBooking({ id: booking.id, checkoutNotes })
      if (res.success) onChanged()
      else toastError(t('common.error'), res.error?.message ?? t('common.error'))
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  async function handleReturn() {
    setBusy(true)
    try {
      const res = await api.rental.returnBooking({
        id: booking.id, returnNotes,
        damageChargeAmount: Number(damageCharge) || 0,
        securityDepositRefunded: Number(depositRefund) || 0,
      })
      if (res.success) onChanged()
      else toastError(t('common.error'), res.error?.message ?? t('common.error'))
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  async function handleCancel() {
    if (!window.confirm(t('rental.confirmCancel'))) return
    setBusy(true)
    try {
      const res = await api.rental.cancelBooking({ id: booking.id })
      if (res.success) onChanged()
      else toastError(t('common.error'), res.error?.message ?? t('common.error'))
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  async function handleInvoice() {
    setBusy(true)
    try {
      const res = await api.rental.generateInvoice({ bookingId: booking.id })
      if (res.success) onChanged()
      else toastError(t('common.error'), res.error?.message ?? t('common.error'))
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <p className="font-semibold text-dark dark:text-slate-100">{booking.bookingNumber}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{booking.customerName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-dark dark:hover:text-slate-100"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-2 text-sm">
            {booking.items.map((i) => (
              <div key={i.id} className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-300">{i.productName}{i.rentalUnitLabel ? ` (${i.rentalUnitLabel})` : ''} × {i.quantity}</span>
                <span className="font-medium">₹{i.lineTotal.toLocaleString()}</span>
              </div>
            ))}
            {booking.lateFeeAmount > 0 && <div className="flex justify-between text-danger"><span>{t('rental.lateFee')}</span><span>₹{booking.lateFeeAmount.toLocaleString()}</span></div>}
            {booking.damageChargeAmount > 0 && <div className="flex justify-between text-danger"><span>{t('rental.damageCharge')}</span><span>₹{booking.damageChargeAmount.toLocaleString()}</span></div>}
            <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2 text-xs text-slate-400">
              <span>{t('rental.deposit')}</span><span>₹{booking.securityDepositCollected.toLocaleString()}{booking.securityDepositRefunded != null ? ` (₹${booking.securityDepositRefunded.toLocaleString()} ${t('rental.refunded')})` : ''}</span>
            </div>
          </div>

          {booking.status === 'RESERVED' && canManage && (
            <div className="space-y-2">
              <textarea value={checkoutNotes} onChange={(e) => setCheckoutNotes(e.target.value)} placeholder={t('rental.checkoutNotesPlaceholder') as string}
                className="w-full h-20 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 resize-none" />
              <div className="flex gap-2">
                <Button onClick={handleCheckout} disabled={busy} className="flex-1"><Clock size={16} className="mr-1.5" /> {t('rental.checkOut')}</Button>
                <Button variant="outline" onClick={handleCancel} disabled={busy}><Ban size={16} /></Button>
              </div>
            </div>
          )}

          {booking.status === 'CHECKED_OUT' && canManage && (
            <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('rental.processReturn')}</p>
              <textarea value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} placeholder={t('rental.returnNotesPlaceholder') as string}
                className="w-full h-16 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 resize-none" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t('rental.damageCharge')}</label>
                  <input type="number" value={damageCharge} onChange={(e) => setDamageCharge(e.target.value)} className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t('rental.refundDeposit')}</label>
                  <input type="number" value={depositRefund} onChange={(e) => setDepositRefund(e.target.value)} className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100" />
                </div>
              </div>
              <Button onClick={handleReturn} disabled={busy} className="w-full"><RotateCcw size={16} className="mr-1.5" /> {t('rental.confirmReturn')}</Button>
            </div>
          )}

          {(booking.status === 'RETURNED' || booking.status === 'CHECKED_OUT') && canManage && !booking.invoiceId && (
            <Button variant="secondary" onClick={handleInvoice} disabled={busy} className="w-full">
              <CheckCircle2 size={16} className="mr-1.5" /> {t('rental.generateInvoice')}
            </Button>
          )}
          {booking.invoiceId && (
            <div className="text-xs text-success bg-success/10 rounded-lg p-3">{t('rental.invoiceGenerated')}</div>
          )}

          <Button variant="outline" className="w-full" onClick={() => window.print()}>
            <Printer size={16} className="mr-1.5" /> {t('common.print')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function NewBookingModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation()
  const [customer, setCustomer] = useState<CustomerLite | null>(null)
  const [products, setProducts] = useState<RentalProduct[]>([])
  const [productId, setProductId] = useState('')
  const [rateBasis, setRateBasis] = useState('DAY')
  const [quantity, setQuantity] = useState('1')
  const [startDateTime, setStartDateTime] = useState('')
  const [endDateTime, setEndDateTime] = useState('')
  const [deposit, setDeposit] = useState('0')
  const [availability, setAvailability] = useState<{ available: boolean; availableQuantity?: number } | null>(null)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.products.list({ limit: 200 }).then((res) => {
      if (res.success) {
        const list = (res.data as { products?: RentalProduct[] } | RentalProduct[])
        const arr = Array.isArray(list) ? list : list.products ?? []
        setProducts(arr.filter((p) => p.isRentable))
      }
    })
  }, [])

  const selectedProduct = products.find((p) => p.id === productId)

  useEffect(() => {
    if (selectedProduct && selectedProduct.rentalRates.length > 0 && !selectedProduct.rentalRates.some((r) => r.basis === rateBasis)) {
      setRateBasis(selectedProduct.rentalRates[0].basis)
    }
    if (selectedProduct?.rentalSecurityDeposit) setDeposit(String(selectedProduct.rentalSecurityDeposit))
  }, [selectedProduct, rateBasis])

  async function handleCheckAvailability() {
    if (!productId || !startDateTime || !endDateTime) return
    setChecking(true)
    const res = await api.rental.checkAvailability({ productId, startDateTime, endDateTime, quantity: Number(quantity) || 1 })
    setChecking(false)
    if (res.success) setAvailability(res.data as { available: boolean; availableQuantity?: number })
  }

  async function handleCreate() {
    if (!customer || !productId || !startDateTime || !endDateTime) {
      setError(t('rental.fillAllFields') as string)
      return
    }
    setSaving(true)
    setError(null)
    const res = await api.rental.createBooking({
      customerId: customer.id, startDateTime, endDateTime,
      securityDepositCollected: Number(deposit) || 0,
      items: [{ productId, rateBasis, quantity: Number(quantity) || 1 }],
    })
    setSaving(false)
    if (res.success) onCreated()
    else setError(res.error?.message ?? t('rental.bookingFailed') as string)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <p className="font-semibold text-dark dark:text-slate-100">{t('rental.newBooking')}</p>
          <button onClick={onClose} className="text-slate-400 hover:text-dark dark:hover:text-slate-100"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="bg-danger/10 text-danger text-sm rounded-lg px-3 py-2">{error}</div>}

          <CustomerPicker value={customer} onChange={setCustomer} label={t('rental.col.customer') as string} />

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('rental.item')}</label>
            <select value={productId} onChange={(e) => { setProductId(e.target.value); setAvailability(null) }}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100">
              <option value="">{t('common.select')}</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.productName}</option>)}
            </select>
          </div>

          {selectedProduct && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('rental.rateBasis')}</label>
                <select value={rateBasis} onChange={(e) => { setRateBasis(e.target.value); setAvailability(null) }}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100">
                  {selectedProduct.rentalRates.map((r) => <option key={r.basis} value={r.basis}>{t(`rental.basis.${r.basis}`)} — ₹{r.amount}</option>)}
                </select>
              </div>
              {selectedProduct.rentalTrackingType === 'BULK' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('common.quantity')}</label>
                  <input type="number" min="1" value={quantity} onChange={(e) => { setQuantity(e.target.value); setAvailability(null) }}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100" />
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('rental.startDateTime')}</label>
              <input type="datetime-local" value={startDateTime} onChange={(e) => { setStartDateTime(e.target.value); setAvailability(null) }}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('rental.endDateTime')}</label>
              <input type="datetime-local" value={endDateTime} onChange={(e) => { setEndDateTime(e.target.value); setAvailability(null) }}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('rental.deposit')}</label>
            <input type="number" min="0" value={deposit} onChange={(e) => setDeposit(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100" />
          </div>

          <Button variant="secondary" onClick={handleCheckAvailability} disabled={checking || !productId || !startDateTime || !endDateTime} className="w-full">
            {checking ? '…' : t('rental.checkAvailability')}
          </Button>
          {availability && (
            <div className={`text-sm rounded-lg px-3 py-2 ${availability.available ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
              {availability.available ? t('rental.available') : t('rental.notAvailable')}
              {availability.availableQuantity != null ? ` (${availability.availableQuantity} ${t('rental.unitsFree')})` : ''}
            </div>
          )}

          <Button onClick={handleCreate} disabled={saving || (availability != null && !availability.available)} className="w-full">
            {saving ? '…' : t('rental.createBooking')}
          </Button>
        </div>
      </div>
    </div>
  )
}
