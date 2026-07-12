import { useState, useEffect, useCallback } from 'react'
import { Plus, X, LogIn, LogOut, Ban, Receipt, Trash2, Hotel as HotelIcon, UserX } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { Card } from '@shared/ui/molecules/Card'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { Badge } from '@shared/ui/atoms/Badge'
import { CustomerPicker, type CustomerLite } from '@shared/ui/molecules/CustomerPicker'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { useAuthStore } from '@app/store/auth.store'
import { useBusinessStore } from '@app/store/business.store'
import { useNotificationStore } from '@app/store/notification.store'
import { formatCurrency } from '@shared/utils/currency.util'

// Hotel/Lodge is a languageLock: 'en' business type — plain English strings
// here render identically to t()-wrapped ones would for this vertical (see
// HotelRoomsScreen.tsx's header comment for the full reasoning).

interface HotelGuest { id: string; guestName: string; idType: string; idNumber: string; nationality: string; address: string | null; isPrimary: boolean }
interface HotelCharge { id: string; description: string; quantity: number; unitPrice: number; amount: number }
interface HotelBooking {
  id: string
  bookingNumber: string
  roomId: string
  roomNumber: string
  roomType: string
  customerId: string | null
  guestName: string
  guestPhone: string | null
  guestEmail: string | null
  numberOfGuests: number
  checkInDate: string
  checkOutDate: string
  actualCheckInAt: string | null
  actualCheckOutAt: string | null
  ratePerNight: number
  nights: number
  roomCharge: number
  extraChargesTotal: number
  estimatedTotal: number
  status: 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW'
  advanceAmount: number
  advancePaymentMethod: string
  cancelReason: string | null
  invoiceId: string | null
  guests: HotelGuest[]
  charges: HotelCharge[]
}
interface HotelRoom { id: string; roomNumber: string; roomType: string; baseRate: number; maxOccupancy: number; status: string }

// Only Aadhaar is India-specific here; every other document (Passport,
// Driving License) is genuinely valid ID in most countries, so it's kept in
// both lists rather than only the "default" one.
const ID_TYPES_INDIA = [
  { value: 'AADHAAR', label: 'Aadhaar Card' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'DRIVING_LICENSE', label: 'Driving License' },
  { value: 'VOTER_ID', label: 'Voter ID' },
  { value: 'PAN', label: 'PAN Card' },
]
const ID_TYPES_DEFAULT = [
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'NATIONAL_ID', label: 'National ID Card' },
  { value: 'DRIVING_LICENSE', label: 'Driving License' },
  { value: 'OTHER', label: 'Other Government ID' },
]

// BusinessProfile.country is stored as whatever free text the setup wizard's
// country field was typed as (see SetupWizard.tsx's handleCountryBlur —
// there's no ISO-code normalization on save), so this matches loosely
// rather than against a strict 'IN' code.
function getIdTypesForCountry(country?: string | null) {
  return (country ?? '').toLowerCase().includes('india') ? ID_TYPES_INDIA : ID_TYPES_DEFAULT
}

export function HotelBookingsScreen() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const { error: toastError } = useNotificationStore()
  const canManage = hasPermission('hotel.manage')

  const [bookings, setBookings] = useState<HotelBooking[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<HotelBooking | null>(null)
  const [showNewBooking, setShowNewBooking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.hotel.listBookings(statusFilter ? { status: statusFilter } : undefined)
      if (res.success && res.data) setBookings((res.data as { bookings: HotelBooking[] }).bookings)
      else toastError('Error', res.error?.message ?? 'Could not load bookings.')
    } catch {
      toastError('Error', 'Could not load bookings.')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, toastError])

  useEffect(() => { load() }, [load])

  async function refreshSelected(id: string) {
    const res = await api.hotel.getBooking({ id })
    if (res.success && res.data) setSelected(res.data as HotelBooking)
    await load()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-slate-100">Hotel Bookings</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Reservations, check-in/out, and guest folios</p>
        </div>
        {canManage && (
          <Button onClick={() => setShowNewBooking(true)}>
            <Plus size={16} className="mr-1.5" /> New Booking
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {['', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW'].map((s) => (
          <button key={s || 'all'} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${statusFilter === s ? 'bg-brand text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
            {s ? s.replace(/_/g, ' ') : 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="w-7 h-7 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-12">
          <HotelIcon size={36} className="mx-auto text-slate-300 mb-2" />
          <p className="text-slate-500 dark:text-slate-400">No bookings yet.</p>
        </div>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Booking</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Guest</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Room</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Stay</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Est. Total</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {bookings.map((b) => (
                <tr key={b.id} onClick={() => setSelected(b)} className="hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors">
                  <td className="px-4 py-3 font-medium text-dark dark:text-slate-100">{b.bookingNumber}</td>
                  <td className="px-4 py-3">{b.guestName}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{b.roomNumber} · {b.roomType}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{new Date(b.checkInDate).toLocaleDateString()} → {new Date(b.checkOutDate).toLocaleDateString()} ({b.nights}n)</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(b.estimatedTotal)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={b.status === 'CHECKED_IN' ? 'brand' : b.status === 'CHECKED_OUT' ? 'success' : b.status === 'CANCELLED' || b.status === 'NO_SHOW' ? 'neutral' : 'warning'}>
                      {b.status.replace(/_/g, ' ')}
                    </Badge>
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

function BookingDetailModal({ booking, canManage, onClose, onChanged }: { booking: HotelBooking; canManage: boolean; onClose: () => void; onChanged: () => void }) {
  const profile = useBusinessStore((s) => s.profile)
  const { error: toastError, success: toastSuccess } = useNotificationStore()
  const [busy, setBusy] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [guestForms, setGuestForms] = useState<Array<{ guestName: string; idType: string; idNumber: string; nationality: string; address: string }>>([
    { guestName: booking.guestName, idType: '', idNumber: '', nationality: 'IN', address: '' },
  ])
  const [chargeDesc, setChargeDesc] = useState('')
  const [chargeQty, setChargeQty] = useState('1')
  const [chargePrice, setChargePrice] = useState('')

  const idTypes = getIdTypesForCountry(profile?.country)

  function addGuestForm() {
    setGuestForms((prev) => [...prev, { guestName: '', idType: '', idNumber: '', nationality: 'IN', address: '' }])
  }
  function updateGuestForm(idx: number, patch: Partial<{ guestName: string; idType: string; idNumber: string; nationality: string; address: string }>) {
    setGuestForms((prev) => prev.map((g, i) => (i === idx ? { ...g, ...patch } : g)))
  }
  function removeGuestForm(idx: number) {
    setGuestForms((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleCheckIn() {
    const cleaned = guestForms.filter((g) => g.guestName.trim() && g.idType && g.idNumber.trim())
    if (cleaned.length === 0) {
      toastError('Guest ID required', 'Enter at least one guest name, ID type, and ID number to check in.')
      return
    }
    setBusy(true)
    try {
      const res = await api.hotel.checkIn({
        id: booking.id,
        guests: cleaned.map((g, i) => ({ ...g, isPrimary: i === 0 })),
      })
      if (res.success) { toastSuccess('Checked in', booking.guestName); onChanged() }
      else toastError('Error', res.error?.message ?? 'Could not check in.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCheckOut() {
    setBusy(true)
    try {
      const res = await api.hotel.checkOut({ id: booking.id })
      if (res.success) { toastSuccess('Checked out', booking.guestName); onChanged() }
      else toastError('Error', res.error?.message ?? 'Could not check out.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCancel() {
    setBusy(true)
    try {
      const res = await api.hotel.cancelBooking({ id: booking.id })
      setShowCancelConfirm(false)
      if (res.success) onChanged()
      else toastError('Error', res.error?.message ?? 'Could not cancel booking.')
    } finally {
      setBusy(false)
    }
  }

  async function handleNoShow() {
    setBusy(true)
    try {
      const res = await api.hotel.markNoShow({ id: booking.id })
      if (res.success) onChanged()
      else toastError('Error', res.error?.message ?? 'Could not mark as no-show.')
    } finally {
      setBusy(false)
    }
  }

  async function handleInvoice() {
    setBusy(true)
    try {
      const res = await api.hotel.generateInvoice({ bookingId: booking.id })
      if (res.success) { toastSuccess('Bill generated', ''); onChanged() }
      else toastError('Error', res.error?.message ?? 'Could not generate invoice.')
    } finally {
      setBusy(false)
    }
  }

  async function handleAddCharge() {
    if (!chargeDesc.trim() || !chargePrice) { toastError('Missing details', 'Description and price are required.'); return }
    setBusy(true)
    try {
      const res = await api.hotel.addExtraCharge({
        bookingId: booking.id, description: chargeDesc.trim(),
        quantity: Number(chargeQty) || 1, unitPrice: Number(chargePrice) || 0,
      })
      if (res.success) { setChargeDesc(''); setChargeQty('1'); setChargePrice(''); onChanged() }
      else toastError('Error', res.error?.message ?? 'Could not add charge.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemoveCharge(chargeId: string) {
    const res = await api.hotel.removeExtraCharge({ chargeId })
    if (res.success) onChanged()
    else toastError('Error', res.error?.message ?? 'Could not remove charge.')
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <p className="font-semibold text-dark dark:text-slate-100">{booking.bookingNumber} · Room {booking.roomNumber}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{booking.guestName} · {booking.numberOfGuests} guest(s)</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-dark dark:hover:text-slate-100"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-300">Room charge ({booking.nights} night(s) × {formatCurrency(booking.ratePerNight)})</span>
              <span className="font-medium">{formatCurrency(booking.roomCharge)}</span>
            </div>
            {booking.charges.map((c) => (
              <div key={c.id} className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-300">{c.description} × {c.quantity}</span>
                <span className="flex items-center gap-2">
                  {formatCurrency(c.amount)}
                  {booking.status === 'CHECKED_IN' && canManage && (
                    <button onClick={() => handleRemoveCharge(c.id)} className="text-slate-300 hover:text-danger"><Trash2 size={12} /></button>
                  )}
                </span>
              </div>
            ))}
            {booking.advanceAmount > 0 && (
              <div className="flex justify-between text-xs text-slate-400">
                <span>Advance paid ({booking.advancePaymentMethod})</span><span>{formatCurrency(booking.advanceAmount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2 font-semibold">
              <span>Estimated Total</span><span>{formatCurrency(booking.estimatedTotal)}</span>
            </div>
          </div>

          {booking.status === 'CHECKED_IN' && booking.guests.length > 0 && (
            <div className="text-xs text-slate-500 bg-brand/5 rounded-lg p-3 space-y-1">
              <p className="font-semibold text-slate-600 dark:text-slate-300">Registered Guests</p>
              {booking.guests.map((g) => <p key={g.id}>{g.guestName} — {g.idType} {g.idNumber}{g.isPrimary ? ' (primary)' : ''}</p>)}
            </div>
          )}

          {booking.status === 'CONFIRMED' && canManage && (
            <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Check In — Guest ID Registration</p>
              {guestForms.map((g, idx) => (
                <div key={idx} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Guest {idx + 1}{idx === 0 ? ' (primary)' : ''}</span>
                    {idx > 0 && <button onClick={() => removeGuestForm(idx)} className="text-slate-300 hover:text-danger"><Trash2 size={12} /></button>}
                  </div>
                  <Input placeholder="Guest name" value={g.guestName} onChange={(e) => updateGuestForm(idx, { guestName: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={g.idType} onChange={(e) => updateGuestForm(idx, { idType: e.target.value })}>
                      <option value="">ID Type</option>
                      {idTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </Select>
                    <Input placeholder="ID number" value={g.idNumber} onChange={(e) => updateGuestForm(idx, { idNumber: e.target.value })} />
                  </div>
                  <Input placeholder="Address (optional)" value={g.address} onChange={(e) => updateGuestForm(idx, { address: e.target.value })} />
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addGuestForm}><Plus size={14} className="mr-1" /> Add Another Guest</Button>
              <div className="flex gap-2">
                <Button onClick={handleCheckIn} disabled={busy} className="flex-1"><LogIn size={16} className="mr-1.5" /> Check In</Button>
                <Button variant="outline" onClick={handleNoShow} disabled={busy}><UserX size={16} /></Button>
                <Button variant="outline" onClick={() => setShowCancelConfirm(true)} disabled={busy}><Ban size={16} /></Button>
              </div>
            </div>
          )}

          {booking.status === 'CHECKED_IN' && canManage && (
            <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add Charge (Room Service, Laundry, etc.)</p>
              <div className="grid grid-cols-3 gap-2">
                <Input placeholder="Description" value={chargeDesc} onChange={(e) => setChargeDesc(e.target.value)} className="col-span-3" />
                <Input placeholder="Qty" type="number" value={chargeQty} onChange={(e) => setChargeQty(e.target.value)} />
                <Input placeholder="Unit Price" type="number" value={chargePrice} onChange={(e) => setChargePrice(e.target.value)} className="col-span-2" />
              </div>
              <Button variant="outline" size="sm" onClick={handleAddCharge} disabled={busy}>Add Charge</Button>
              <Button onClick={handleCheckOut} disabled={busy} className="w-full"><LogOut size={16} className="mr-1.5" /> Check Out</Button>
            </div>
          )}

          {booking.status === 'CHECKED_OUT' && canManage && !booking.invoiceId && (
            <Button variant="secondary" onClick={handleInvoice} disabled={busy} className="w-full">
              <Receipt size={16} className="mr-1.5" /> Generate Bill
            </Button>
          )}
          {booking.invoiceId && (
            <div className="text-xs text-success bg-success/10 rounded-lg p-3">Invoice generated for this stay.</div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={handleCancel}
        loading={busy}
        title="Cancel Booking"
        message={`Cancel booking ${booking.bookingNumber} for ${booking.guestName}?`}
        confirmLabel="Cancel Booking"
      />
    </div>
  )
}

function NewBookingModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { error: toastError } = useNotificationStore()
  const [customer, setCustomer] = useState<CustomerLite | null>(null)
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [numberOfGuests, setNumberOfGuests] = useState('1')
  const [checkInDate, setCheckInDate] = useState('')
  const [checkOutDate, setCheckOutDate] = useState('')
  const [roomId, setRoomId] = useState('')
  const [availableRooms, setAvailableRooms] = useState<HotelRoom[]>([])
  const [checking, setChecking] = useState(false)
  const [ratePerNight, setRatePerNight] = useState('')
  const [advanceAmount, setAdvanceAmount] = useState('0')
  const [advanceMethod, setAdvanceMethod] = useState('CASH')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedRoom = availableRooms.find((r) => r.id === roomId)

  async function handleCheckAvailability() {
    if (!checkInDate || !checkOutDate) return
    setChecking(true)
    setRoomId('')
    try {
      const res = await api.hotel.listAvailableRooms({ checkInDate, checkOutDate })
      if (res.success && res.data) setAvailableRooms((res.data as { rooms: HotelRoom[] }).rooms)
      else toastError('Error', res.error?.message ?? 'Could not check availability.')
    } finally {
      setChecking(false)
    }
  }

  function selectRoom(id: string) {
    setRoomId(id)
    const room = availableRooms.find((r) => r.id === id)
    if (room) setRatePerNight(String(room.baseRate))
  }

  async function handleCreate() {
    if (!guestName.trim() || !roomId || !checkInDate || !checkOutDate) {
      setError('Guest name, room, and dates are required.')
      return
    }
    setSaving(true)
    setError(null)
    const res = await api.hotel.createBooking({
      roomId, customerId: customer?.id, guestName: guestName.trim(),
      guestPhone: guestPhone.trim() || undefined, guestEmail: guestEmail.trim() || undefined,
      numberOfGuests: Number(numberOfGuests) || 1,
      checkInDate, checkOutDate,
      ratePerNight: ratePerNight ? Number(ratePerNight) : undefined,
      advanceAmount: Number(advanceAmount) || 0,
      advancePaymentMethod: advanceMethod as 'CASH' | 'UPI' | 'CARD' | 'WALLET',
    })
    setSaving(false)
    if (res.success) onCreated()
    else setError(res.error?.message ?? 'Could not create booking.')
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <p className="font-semibold text-dark dark:text-slate-100">New Booking</p>
          <button onClick={onClose} className="text-slate-400 hover:text-dark dark:hover:text-slate-100"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="bg-danger/10 text-danger text-sm rounded-lg px-3 py-2">{error}</div>}

          <CustomerPicker value={customer} onChange={(c) => { setCustomer(c); if (c && !guestName) setGuestName(c.customerName) }} label="Customer (optional, for billing)" />
          <Input label="Guest Name" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Guest Phone" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
            <Input label="Number of Guests" type="number" min="1" value={numberOfGuests} onChange={(e) => setNumberOfGuests(e.target.value)} />
          </div>
          <Input label="Guest Email" type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Check-In Date" type="date" value={checkInDate} onChange={(e) => { setCheckInDate(e.target.value); setAvailableRooms([]) }} />
            <Input label="Check-Out Date" type="date" value={checkOutDate} onChange={(e) => { setCheckOutDate(e.target.value); setAvailableRooms([]) }} />
          </div>
          <Button variant="secondary" onClick={handleCheckAvailability} disabled={checking || !checkInDate || !checkOutDate} className="w-full">
            {checking ? '…' : 'Check Available Rooms'}
          </Button>

          {availableRooms.length > 0 && (
            <Select label="Room" value={roomId} onChange={(e) => selectRoom(e.target.value)}>
              <option value="">Select a room</option>
              {availableRooms.map((r) => <option key={r.id} value={r.id}>{r.roomNumber} — {r.roomType} ({formatCurrency(r.baseRate)}/night, max {r.maxOccupancy})</option>)}
            </Select>
          )}
          {availableRooms.length === 0 && checkInDate && checkOutDate && !checking && (
            <p className="text-xs text-slate-400">Click "Check Available Rooms" to see rooms free for these dates.</p>
          )}

          {selectedRoom && (
            <>
              <Input label="Rate per Night (override)" type="number" value={ratePerNight} onChange={(e) => setRatePerNight(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Advance Amount" type="number" min="0" value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} />
                <Select label="Advance Method" value={advanceMethod} onChange={(e) => setAdvanceMethod(e.target.value)}>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="CARD">Card</option>
                  <option value="WALLET">Wallet</option>
                </Select>
              </div>
            </>
          )}

          <Button onClick={handleCreate} disabled={saving || !roomId} className="w-full">
            {saving ? '…' : 'Create Booking'}
          </Button>
        </div>
      </div>
    </div>
  )
}
