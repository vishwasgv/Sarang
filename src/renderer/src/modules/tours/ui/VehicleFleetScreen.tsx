import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Bus, Plus, RefreshCw, Wrench, CalendarCheck } from 'lucide-react'
import { Card } from '@shared/ui/molecules/Card'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { Badge } from '@shared/ui/atoms/Badge'
import { useAuthStore } from '@app/store/auth.store'
import { useNotificationStore } from '@app/store/notification.store'
import { formatDate } from '@shared/utils/locale.util'

interface Vehicle {
  id: string; registrationNumber: string; vehicleType: string; seatingCapacity: number
  currentOdometer: number; status: string
}
interface ServiceLog {
  id: string; vehicleId: string; serviceDate: string; serviceType: string; odometerAtService: number
  cost: number; nextServiceDueKm: number | null; vendorName: string | null
}
interface VehicleAvailabilityRow { vehicleId: string; registrationNumber: string; vehicleType: string; bookedDateRanges: Array<{ from: string; to: string; bookingNumber: string }> }
interface DepartureAvailabilityRow { departureId: string; packageName: string; departureDate: string; totalSeats: number; seatsBooked: number; seatsRemaining: number }

const VEHICLE_TYPES = ['SEDAN', 'SUV', 'TEMPO_TRAVELLER', 'MINI_BUS', 'BUS'] as const

// 2026-09 §12 — Tours & Travels vertical: fleet + service log + the Fleet &
// Seat Availability Calendar signature feature. Fully i18n'd, unlike Phase
// 69's English-only booking screens.
export function VehicleFleetScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const canManage = hasPermission('vehicle.manage')

  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [regNumber, setRegNumber] = useState('')
  const [vehicleType, setVehicleType] = useState<typeof VEHICLE_TYPES[number]>('SEDAN')
  const [seatingCapacity, setSeatingCapacity] = useState('4')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [serviceVehicleId, setServiceVehicleId] = useState<string | null>(null)
  const [serviceLogs, setServiceLogs] = useState<ServiceLog[]>([])
  const [serviceDate, setServiceDate] = useState('')
  const [serviceType, setServiceType] = useState('SERVICE')
  const [odometerAtService, setOdometerAtService] = useState('')
  const [serviceCost, setServiceCost] = useState('0')
  const [loggingService, setLoggingService] = useState(false)

  const [availability, setAvailability] = useState<{ vehicles: VehicleAvailabilityRow[]; departures: DepartureAvailabilityRow[] } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.vehicle.list()
      if (res.success) setVehicles((res.data as Vehicle[]) ?? [])
      else toastError(t('common.error'), res.error?.message ?? t('tours.fleet.loadFailed'))
    } catch {
      toastError(t('common.error'), t('tours.fleet.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    void (async () => {
      const from = new Date(); const to = new Date(Date.now() + 30 * 86400000)
      const res = await window.api.vehicle.fleetAvailability({ dateFrom: from.toISOString().slice(0, 10), dateTo: to.toISOString().slice(0, 10) })
      if (res.success) setAvailability(res.data as { vehicles: VehicleAvailabilityRow[]; departures: DepartureAvailabilityRow[] })
    })()
  }, [vehicles])

  async function handleCreate() {
    setError('')
    if (!regNumber.trim()) { setError(t('tours.fleet.regNumberRequired')); return }
    const capacity = Number(seatingCapacity)
    if (!Number.isFinite(capacity) || capacity <= 0) { setError(t('tours.fleet.capacityRequired')); return }
    setSaving(true)
    try {
      const res = await window.api.vehicle.create({ registrationNumber: regNumber.trim(), vehicleType, seatingCapacity: capacity })
      if (res.success) {
        toastSuccess(t('tours.fleet.vehicleAdded'), regNumber.trim())
        setShowForm(false); setRegNumber(''); setVehicleType('SEDAN'); setSeatingCapacity('4')
        await load()
      } else {
        setError(res.error?.message ?? t('tours.fleet.vehicleAddFailed'))
      }
    } finally {
      setSaving(false)
    }
  }

  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null)

  async function handleStatusChange(vehicleId: string, status: 'ACTIVE' | 'IN_SERVICE' | 'INACTIVE') {
    setStatusUpdatingId(vehicleId)
    try {
      const res = await window.api.vehicle.updateStatus({ id: vehicleId, status })
      if (res.success) {
        toastSuccess(t('tours.fleet.statusUpdated'), '')
        await load()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('tours.fleet.statusUpdateFailed'))
      }
    } finally {
      setStatusUpdatingId(null)
    }
  }

  async function openServiceLog(vehicleId: string) {
    setServiceVehicleId(vehicleId)
    setServiceDate(''); setServiceType('SERVICE'); setOdometerAtService(''); setServiceCost('0')
    const res = await window.api.vehicle.listServiceLogs({ vehicleId })
    if (res.success) setServiceLogs((res.data as ServiceLog[]) ?? [])
  }

  async function handleLogService() {
    if (!serviceVehicleId || !serviceDate || !odometerAtService) return
    setLoggingService(true)
    try {
      const res = await window.api.vehicle.createServiceLog({
        vehicleId: serviceVehicleId, serviceDate, serviceType: serviceType as 'SERVICE' | 'REPAIR' | 'MAINTENANCE',
        odometerAtService: Number(odometerAtService), cost: Number(serviceCost) || 0,
      })
      if (res.success) {
        toastSuccess(t('tours.fleet.serviceLogged'), '')
        await openServiceLog(serviceVehicleId)
        await load()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('tours.fleet.serviceLogFailed'))
      }
    } finally {
      setLoggingService(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-dark flex items-center gap-2"><Bus size={20} /> {t('tours.fleet.title')}</h2>
          <p className="text-sm text-slate-400">{t('tours.fleet.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void load()} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:border-slate-300 transition-colors">
            <RefreshCw size={14} /> {t('tours.fleet.refresh')}
          </button>
          {canManage && (
            <Button size="sm" onClick={() => setShowForm((s) => !s)} icon={<Plus size={14} />}>{t('tours.fleet.newVehicle')}</Button>
          )}
        </div>
      </div>

      {showForm && canManage && (
        <Card padding="md" className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Input label={t('tours.fleet.regNumber')} value={regNumber} onChange={(e) => setRegNumber(e.target.value)} />
            <Select label={t('tours.fleet.vehicleType')} value={vehicleType} onChange={(e) => setVehicleType(e.target.value as typeof VEHICLE_TYPES[number])}>
              {VEHICLE_TYPES.map(vt => <option key={vt} value={vt}>{t(`tours.fleet.vehicleTypes.${vt}`)}</option>)}
            </Select>
            <Input label={t('tours.fleet.seatingCapacity')} type="number" min="1" value={seatingCapacity} onChange={(e) => setSeatingCapacity(e.target.value)} />
          </div>
          {error && <p className="text-xs text-danger bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>{t('tours.fleet.cancel')}</Button>
            <Button size="sm" onClick={() => void handleCreate()} loading={saving}>{t('tours.fleet.add')}</Button>
          </div>
        </Card>
      )}

      {availability && (availability.vehicles.length > 0 || availability.departures.length > 0) && (
        <Card padding="md" className="space-y-3">
          <p className="text-sm font-semibold text-dark dark:text-slate-100 flex items-center gap-2"><CalendarCheck size={16} className="text-brand" /> {t('tours.fleet.availabilityNext30Days')}</p>
          <div className="space-y-1.5">
            {availability.vehicles.map(v => (
              <div key={v.vehicleId} className="flex items-center justify-between text-sm">
                <span className="text-dark dark:text-slate-200">{v.registrationNumber}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {v.bookedDateRanges.length === 0 ? t('tours.fleet.free') : t('tours.fleet.bookedCount', { count: v.bookedDateRanges.length })}
                </span>
              </div>
            ))}
          </div>
          {availability.departures.length > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
              {availability.departures.map(d => (
                <div key={d.departureId} className="flex items-center justify-between text-sm">
                  <span className="text-dark dark:text-slate-200">{d.packageName} — {formatDate(new Date(d.departureDate))}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{t('tours.fleet.seatsRemaining', { count: d.seatsRemaining })}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400">{t('tours.fleet.loading')}</div>
      ) : vehicles.length === 0 ? (
        <Card padding="lg" className="text-center py-12">
          <Bus size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('tours.fleet.noVehiclesYet')}</p>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {vehicles.map((v) => (
              <div key={v.id} className="px-5 py-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm dark:text-slate-100">{v.registrationNumber}</span>
                    <Badge variant={v.status === 'ACTIVE' ? 'success' : v.status === 'IN_SERVICE' ? 'warning' : 'neutral'} size="sm">{t(`tours.fleet.status.${v.status}`)}</Badge>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap dark:text-slate-400">
                    <span>{t(`tours.fleet.vehicleTypes.${v.vehicleType}`)}</span>
                    <span>{t('tours.fleet.seats', { count: v.seatingCapacity })}</span>
                    <span>{t('tours.fleet.odometer', { km: v.currentOdometer })}</span>
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <select
                      value={v.status}
                      disabled={statusUpdatingId === v.id}
                      onChange={(e) => void handleStatusChange(v.id, e.target.value as 'ACTIVE' | 'IN_SERVICE' | 'INACTIVE')}
                      aria-label={t('tours.fleet.changeStatus')}
                      className="text-xs h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-slate-700 dark:text-slate-200 disabled:opacity-50"
                    >
                      <option value="ACTIVE">{t('tours.fleet.status.ACTIVE')}</option>
                      <option value="IN_SERVICE">{t('tours.fleet.status.IN_SERVICE')}</option>
                      <option value="INACTIVE">{t('tours.fleet.status.INACTIVE')}</option>
                    </select>
                    <button onClick={() => void openServiceLog(v.id)} className="text-xs px-3 py-1.5 rounded-lg bg-brand/5 text-brand border border-brand/20 hover:bg-brand/10 flex items-center gap-1 font-medium">
                      <Wrench size={12} /> {t('tours.fleet.serviceLog')}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {serviceVehicleId && (
        <Card padding="md" className="space-y-3">
          <p className="text-sm font-semibold text-dark dark:text-slate-100">{t('tours.fleet.serviceLogFor', { reg: vehicles.find(v => v.id === serviceVehicleId)?.registrationNumber ?? '' })}</p>
          <div className="grid grid-cols-4 gap-3">
            <Input label={t('tours.fleet.serviceDate')} type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
            <Select label={t('tours.fleet.serviceType')} value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
              <option value="SERVICE">{t('tours.fleet.serviceTypes.SERVICE')}</option>
              <option value="REPAIR">{t('tours.fleet.serviceTypes.REPAIR')}</option>
              <option value="MAINTENANCE">{t('tours.fleet.serviceTypes.MAINTENANCE')}</option>
            </Select>
            <Input label={t('tours.fleet.odometerReading')} type="number" min="0" value={odometerAtService} onChange={(e) => setOdometerAtService(e.target.value)} />
            <Input label={t('tours.fleet.cost')} type="number" min="0" value={serviceCost} onChange={(e) => setServiceCost(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setServiceVehicleId(null)}>{t('tours.fleet.close')}</Button>
            <Button size="sm" onClick={() => void handleLogService()} loading={loggingService} disabled={!serviceDate || !odometerAtService}>{t('tours.fleet.logService')}</Button>
          </div>
          {serviceLogs.length > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800">
              {serviceLogs.map(log => (
                <div key={log.id} className="py-2 text-sm flex items-center justify-between">
                  <span className="text-dark dark:text-slate-200">{formatDate(new Date(log.serviceDate))} — {t(`tours.fleet.serviceTypes.${log.serviceType}`)}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{t('tours.fleet.odometer', { km: log.odometerAtService })}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
