import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Ticket, Plus, RefreshCw, Receipt, PlayCircle, StopCircle } from 'lucide-react'
import { Card } from '@shared/ui/molecules/Card'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { Badge } from '@shared/ui/atoms/Badge'
import { useAuthStore } from '@app/store/auth.store'
import { useNotificationStore } from '@app/store/notification.store'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDate } from '@shared/utils/locale.util'
import { CustomerPicker, type CustomerLite } from '@shared/ui/molecules/CustomerPicker'

interface Vehicle { id: string; registrationNumber: string; vehicleType: string; status: string }
interface EmployeeLite { id: string; fullName: string }
interface DutyLog {
  id: string; driverId: string; dutyDate: string; startOdometer: number; endOdometer: number | null
  kmDriven: number | null; drivingHours: number | null; excessKm: number | null; excessKmCharge: number | null
  excessHours: number | null; excessHourCharge: number | null; driver?: { fullName: string }
}
interface TripBooking {
  id: string; bookingNumber: string; bookingType: 'CHARTER' | 'SEAT'; status: string; invoiceId: string | null
  customer: { customerName: string }; vehicle?: { registrationNumber: string } | null
  tourDeparture?: { tourPackage: { packageName: string } } | null
  tripStartDate: string; packageRate: number; advanceAmount: number
  referringAgentName: string | null; dutyLogs: DutyLog[]
}

// 2026-09 §12 — Tours & Travels: charter booking + driver duty log
// start/close + invoice generation. Fully i18n'd.
export function TripBookingScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const canManage = hasPermission('tripBooking.manage')
  const canManageDuty = hasPermission('driverDutyLog.manage')

  const [bookings, setBookings] = useState<TripBooking[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [drivers, setDrivers] = useState<EmployeeLite[]>([])
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [customer, setCustomer] = useState<CustomerLite | null>(null)
  const [vehicleId, setVehicleId] = useState('')
  const [tripStartDate, setTripStartDate] = useState('')
  const [tripEndDate, setTripEndDate] = useState('')
  const [pickupLocation, setPickupLocation] = useState('')
  const [dropLocation, setDropLocation] = useState('')
  const [route, setRoute] = useState('')
  const [packageRate, setPackageRate] = useState('0')
  const [includedKmPerDay, setIncludedKmPerDay] = useState('300')
  const [includedHoursPerDay, setIncludedHoursPerDay] = useState('12')
  const [advanceAmount, setAdvanceAmount] = useState('0')
  const [referringAgentName, setReferringAgentName] = useState('')
  const [commissionType, setCommissionType] = useState<'' | 'PERCENTAGE' | 'FIXED'>('')
  const [commissionValue, setCommissionValue] = useState('0')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [dutyBookingId, setDutyBookingId] = useState<string | null>(null)
  const [dutyDriverId, setDutyDriverId] = useState('')
  const [dutyStartOdometer, setDutyStartOdometer] = useState('')
  const [dutyStartTime, setDutyStartTime] = useState('')
  const [dutyBata, setDutyBata] = useState('0')
  const [dutyNightHalt, setDutyNightHalt] = useState('0')
  const [dutyNightDriving, setDutyNightDriving] = useState('0')
  const [startingDuty, setStartingDuty] = useState(false)

  const [closingLogId, setClosingLogId] = useState<string | null>(null)
  const [closeEndOdometer, setCloseEndOdometer] = useState('')
  const [closeEndTime, setCloseEndTime] = useState('')
  const [closingDuty, setClosingDuty] = useState(false)

  const [generatingInvoiceId, setGeneratingInvoiceId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [bRes, vRes, eRes] = await Promise.all([
        window.api.tripBooking.list(),
        window.api.vehicle.list({ status: 'ACTIVE' }),
        window.api.hr.listEmployees({ isActive: true }),
      ])
      if (bRes.success) setBookings((bRes.data as TripBooking[]) ?? [])
      if (vRes.success) setVehicles((vRes.data as Vehicle[]) ?? [])
      if (eRes.success) setDrivers(((eRes.data as { employees: EmployeeLite[] })?.employees) ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleCreateBooking() {
    setError('')
    if (!customer) { setError(t('tours.bookings.customerRequired')); return }
    if (!vehicleId) { setError(t('tours.bookings.vehicleRequired')); return }
    if (!tripStartDate) { setError(t('tours.bookings.tripStartDateRequired')); return }
    setSaving(true)
    try {
      const res = await window.api.tripBooking.createCharter({
        customerId: customer.id, vehicleId, tripStartDate,
        tripEndDate: tripEndDate || undefined,
        pickupLocation: pickupLocation.trim() || undefined, dropLocation: dropLocation.trim() || undefined, route: route.trim() || undefined,
        packageRate: Number(packageRate) || 0,
        includedKmPerDay: includedKmPerDay ? Number(includedKmPerDay) : undefined,
        includedHoursPerDay: includedHoursPerDay ? Number(includedHoursPerDay) : undefined,
        advanceAmount: Number(advanceAmount) || 0,
        referringAgentName: referringAgentName.trim() || undefined,
        commissionType: commissionType || undefined,
        commissionValue: commissionType ? Number(commissionValue) || 0 : undefined,
      })
      if (res.success) {
        toastSuccess(t('tours.bookings.bookingCreated'), '')
        setShowForm(false)
        setCustomer(null); setVehicleId(''); setTripStartDate(''); setTripEndDate('')
        setPickupLocation(''); setDropLocation(''); setRoute(''); setPackageRate('0')
        setIncludedKmPerDay('300'); setIncludedHoursPerDay('12'); setAdvanceAmount('0')
        setReferringAgentName(''); setCommissionType(''); setCommissionValue('0')
        await load()
      } else {
        setError(res.error?.message ?? t('tours.bookings.bookingCreateFailed'))
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleStartDuty() {
    if (!dutyBookingId || !dutyDriverId || !dutyStartOdometer || !dutyStartTime) return
    setStartingDuty(true)
    try {
      const res = await window.api.driverDutyLog.start({
        tripBookingId: dutyBookingId, driverId: dutyDriverId, dutyDate: dutyStartTime.slice(0, 10),
        startOdometer: Number(dutyStartOdometer), dutyStartTime,
        driverBataAmount: Number(dutyBata) || 0, nightHaltCharge: Number(dutyNightHalt) || 0, nightDrivingAllowance: Number(dutyNightDriving) || 0,
      })
      if (res.success) {
        toastSuccess(t('tours.bookings.dutyStarted'), '')
        setDutyBookingId(null); setDutyDriverId(''); setDutyStartOdometer(''); setDutyStartTime('')
        setDutyBata('0'); setDutyNightHalt('0'); setDutyNightDriving('0')
        await load()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('tours.bookings.dutyStartFailed'))
      }
    } finally {
      setStartingDuty(false)
    }
  }

  async function handleCloseDuty() {
    if (!closingLogId || !closeEndOdometer || !closeEndTime) return
    setClosingDuty(true)
    try {
      const res = await window.api.driverDutyLog.close({ id: closingLogId, endOdometer: Number(closeEndOdometer), dutyEndTime: closeEndTime })
      if (res.success) {
        toastSuccess(t('tours.bookings.dutyClosed'), '')
        setClosingLogId(null); setCloseEndOdometer(''); setCloseEndTime('')
        await load()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('tours.bookings.dutyCloseFailed'))
      }
    } finally {
      setClosingDuty(false)
    }
  }

  async function handleGenerateInvoice(bookingId: string) {
    setGeneratingInvoiceId(bookingId)
    try {
      const res = await window.api.tripBooking.generateInvoice({ id: bookingId })
      if (res.success) {
        toastSuccess(t('tours.bookings.invoiceGenerated'), '')
        await load()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('tours.bookings.invoiceGenerateFailed'))
      }
    } finally {
      setGeneratingInvoiceId(null)
    }
  }

  const [cancellingId, setCancellingId] = useState<string | null>(null)

  async function handleCancelBooking(bookingId: string) {
    setCancellingId(bookingId)
    try {
      const res = await window.api.tripBooking.updateStatus({ id: bookingId, status: 'CANCELLED' })
      if (res.success) {
        toastSuccess(t('tours.bookings.bookingCancelled'), '')
        await load()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('tours.bookings.bookingCancelFailed'))
      }
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-dark flex items-center gap-2"><Ticket size={20} /> {t('tours.bookings.title')}</h2>
          <p className="text-sm text-slate-400">{t('tours.bookings.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void load()} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:border-slate-300 transition-colors">
            <RefreshCw size={14} /> {t('tours.bookings.refresh')}
          </button>
          {canManage && <Button size="sm" onClick={() => setShowForm((s) => !s)} icon={<Plus size={14} />}>{t('tours.bookings.newCharterBooking')}</Button>}
        </div>
      </div>

      {showForm && canManage && (
        <Card padding="md" className="space-y-3">
          <CustomerPicker value={customer} onChange={setCustomer} label={t('tours.bookings.customer')} />
          <div className="grid grid-cols-3 gap-3">
            <Select label={t('tours.bookings.vehicle')} value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              <option value="">{t('tours.bookings.selectVehicle')}</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.registrationNumber} ({t(`tours.fleet.vehicleTypes.${v.vehicleType}`)})</option>)}
            </Select>
            <Input label={t('tours.bookings.tripStartDate')} type="date" value={tripStartDate} onChange={(e) => setTripStartDate(e.target.value)} />
            <Input label={t('tours.bookings.tripEndDate')} type="date" value={tripEndDate} onChange={(e) => setTripEndDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label={t('tours.bookings.pickupLocation')} value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} />
            <Input label={t('tours.bookings.dropLocation')} value={dropLocation} onChange={(e) => setDropLocation(e.target.value)} />
            <Input label={t('tours.bookings.route')} value={route} onChange={(e) => setRoute(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label={t('tours.bookings.packageRate')} type="number" min="0" value={packageRate} onChange={(e) => setPackageRate(e.target.value)} />
            <Input label={t('tours.bookings.includedKmPerDay')} type="number" min="0" value={includedKmPerDay} onChange={(e) => setIncludedKmPerDay(e.target.value)} />
            <Input label={t('tours.bookings.includedHoursPerDay')} type="number" min="0" value={includedHoursPerDay} onChange={(e) => setIncludedHoursPerDay(e.target.value)} />
          </div>
          <div className="grid grid-cols-4 gap-3 items-end">
            <Input label={t('tours.bookings.advanceAmount')} type="number" min="0" value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} />
            <Input label={t('tours.bookings.referringAgent')} value={referringAgentName} onChange={(e) => setReferringAgentName(e.target.value)} />
            <Select label={t('tours.bookings.commissionType')} value={commissionType} onChange={(e) => setCommissionType(e.target.value as '' | 'PERCENTAGE' | 'FIXED')}>
              <option value="">{t('tours.bookings.none')}</option>
              <option value="PERCENTAGE">{t('tours.bookings.percentage')}</option>
              <option value="FIXED">{t('tours.bookings.fixed')}</option>
            </Select>
            {commissionType && <Input label={t('tours.bookings.commissionValue')} type="number" min="0" value={commissionValue} onChange={(e) => setCommissionValue(e.target.value)} />}
          </div>
          {error && <p className="text-xs text-danger bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>{t('tours.bookings.cancel')}</Button>
            <Button size="sm" onClick={() => void handleCreateBooking()} loading={saving}>{t('tours.bookings.createBooking')}</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400">{t('tours.bookings.loading')}</div>
      ) : bookings.length === 0 ? (
        <Card padding="lg" className="text-center py-12">
          <Ticket size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('tours.bookings.noBookingsYet')}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const openDuty = b.dutyLogs.find(d => d.endOdometer == null)
            return (
              <Card key={b.id} padding="md" className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-dark dark:text-slate-100">{b.bookingNumber}</span>
                      <Badge variant={b.status === 'COMPLETED' ? 'success' : b.status === 'CANCELLED' ? 'danger' : 'neutral'} size="sm">{t(`tours.bookings.status.${b.status}`)}</Badge>
                      <Badge variant="info" size="sm">{t(`tours.bookings.type.${b.bookingType}`)}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {b.customer.customerName} · {b.vehicle?.registrationNumber ?? b.tourDeparture?.tourPackage.packageName} · {formatDate(new Date(b.tripStartDate))}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatCurrency(b.packageRate)} {t('tours.bookings.advanceOf', { amount: formatCurrency(b.advanceAmount) })}
                      {b.referringAgentName && ` · ${t('tours.bookings.agentLabel', { name: b.referringAgentName })}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {canManageDuty && b.bookingType === 'CHARTER' && !openDuty && b.status === 'BOOKED' && (
                      <button onClick={() => { setDutyBookingId(b.id); setDutyStartOdometer(''); setDutyStartTime('') }} className="text-xs px-3 py-1.5 rounded-lg bg-brand/5 text-brand border border-brand/20 hover:bg-brand/10 flex items-center gap-1 font-medium">
                        <PlayCircle size={12} /> {t('tours.bookings.startDuty')}
                      </button>
                    )}
                    {canManage && !b.invoiceId && (
                      <button onClick={() => void handleGenerateInvoice(b.id)} disabled={generatingInvoiceId === b.id} className="text-xs px-3 py-1.5 rounded-lg bg-brand text-white flex items-center gap-1 font-medium disabled:opacity-50">
                        <Receipt size={12} /> {t('tours.bookings.generateInvoice')}
                      </button>
                    )}
                    {canManage && b.status === 'BOOKED' && !b.invoiceId && (
                      <button onClick={() => void handleCancelBooking(b.id)} disabled={cancellingId === b.id} className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-danger hover:bg-red-50 font-medium disabled:opacity-50">
                        {t('tours.bookings.cancelBooking')}
                      </button>
                    )}
                  </div>
                </div>
                {b.dutyLogs.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                    {b.dutyLogs.map(d => (
                      <div key={d.id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 dark:text-slate-300">
                          {d.driver?.fullName} · {formatDate(new Date(d.dutyDate))}
                          {d.endOdometer != null ? ` · ${t('tours.bookings.kmDrivenLabel', { km: d.kmDriven })}` : ` · ${t('tours.bookings.dutyOpen')}`}
                          {(d.excessKmCharge ?? 0) > 0 || (d.excessHourCharge ?? 0) > 0
                            ? ` · ${t('tours.bookings.excessChargeLabel', { amount: formatCurrency((d.excessKmCharge ?? 0) + (d.excessHourCharge ?? 0)) })}`
                            : ''}
                        </span>
                        {canManageDuty && d.endOdometer == null && (
                          <button onClick={() => { setClosingLogId(d.id); setCloseEndOdometer(''); setCloseEndTime('') }} className="text-xs px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1 font-medium">
                            <StopCircle size={11} /> {t('tours.bookings.closeDuty')}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {dutyBookingId && (
        <Card padding="md" className="space-y-3">
          <p className="text-sm font-semibold text-dark dark:text-slate-100">{t('tours.bookings.startDutyTitle')}</p>
          <div className="grid grid-cols-2 gap-3">
            <Select label={t('tours.bookings.driver')} value={dutyDriverId} onChange={(e) => setDutyDriverId(e.target.value)}>
              <option value="">{t('tours.bookings.selectDriver')}</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.fullName}</option>)}
            </Select>
            <Input label={t('tours.bookings.startOdometer')} type="number" min="0" value={dutyStartOdometer} onChange={(e) => setDutyStartOdometer(e.target.value)} />
          </div>
          <Input label={t('tours.bookings.dutyStartTime')} type="datetime-local" value={dutyStartTime} onChange={(e) => setDutyStartTime(e.target.value)} />
          <div className="grid grid-cols-3 gap-3">
            <Input label={t('tours.bookings.driverBata')} type="number" min="0" value={dutyBata} onChange={(e) => setDutyBata(e.target.value)} />
            <Input label={t('tours.bookings.nightHaltCharge')} type="number" min="0" value={dutyNightHalt} onChange={(e) => setDutyNightHalt(e.target.value)} />
            <Input label={t('tours.bookings.nightDrivingAllowance')} type="number" min="0" value={dutyNightDriving} onChange={(e) => setDutyNightDriving(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDutyBookingId(null)}>{t('tours.bookings.cancel')}</Button>
            <Button size="sm" onClick={() => void handleStartDuty()} loading={startingDuty} disabled={!dutyDriverId || !dutyStartOdometer || !dutyStartTime}>{t('tours.bookings.startDuty')}</Button>
          </div>
        </Card>
      )}

      {closingLogId && (
        <Card padding="md" className="space-y-3">
          <p className="text-sm font-semibold text-dark dark:text-slate-100">{t('tours.bookings.closeDutyTitle')}</p>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('tours.bookings.endOdometer')} type="number" min="0" value={closeEndOdometer} onChange={(e) => setCloseEndOdometer(e.target.value)} />
            <Input label={t('tours.bookings.dutyEndTime')} type="datetime-local" value={closeEndTime} onChange={(e) => setCloseEndTime(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setClosingLogId(null)}>{t('tours.bookings.cancel')}</Button>
            <Button size="sm" onClick={() => void handleCloseDuty()} loading={closingDuty} disabled={!closeEndOdometer || !closeEndTime}>{t('tours.bookings.closeDuty')}</Button>
          </div>
        </Card>
      )}
    </div>
  )
}
