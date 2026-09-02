import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, Plus, RefreshCw, CalendarPlus, Ticket } from 'lucide-react'
import { Card } from '@shared/ui/molecules/Card'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Badge } from '@shared/ui/atoms/Badge'
import { useAuthStore } from '@app/store/auth.store'
import { useNotificationStore } from '@app/store/notification.store'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDate } from '@shared/utils/locale.util'
import { CustomerPicker, type CustomerLite } from '@shared/ui/molecules/CustomerPicker'

interface TourPackage {
  id: string; packageName: string; itineraryDescription: string | null
  durationDays: number; defaultTotalSeats: number; farePerSeat: number; isActive: boolean
}
interface TourDeparture {
  id: string; tourPackageId: string; departureDate: string; totalSeats: number; seatsBooked: number; status: string
}

// 2026-09 §12 — Tours & Travels: package/departure management + seat booking.
// Fully i18n'd (all new-vertical screens this session carry translations,
// unlike Phase 69's English-only precedent).
export function TourPackageScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const canManage = hasPermission('tourPackage.manage')
  const canBook = hasPermission('tripBooking.manage')

  const [packages, setPackages] = useState<TourPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [packageName, setPackageName] = useState('')
  const [itinerary, setItinerary] = useState('')
  const [durationDays, setDurationDays] = useState('1')
  const [defaultTotalSeats, setDefaultTotalSeats] = useState('20')
  const [farePerSeat, setFarePerSeat] = useState('0')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [expandedPackageId, setExpandedPackageId] = useState<string | null>(null)
  const [departures, setDepartures] = useState<TourDeparture[]>([])
  const [showDepartureForm, setShowDepartureForm] = useState(false)
  const [departureDate, setDepartureDate] = useState('')
  const [departureSeats, setDepartureSeats] = useState('20')
  const [savingDeparture, setSavingDeparture] = useState(false)

  const [packageStatusUpdatingId, setPackageStatusUpdatingId] = useState<string | null>(null)
  const [departureStatusUpdatingId, setDepartureStatusUpdatingId] = useState<string | null>(null)

  async function handleTogglePackageActive(pkg: TourPackage) {
    setPackageStatusUpdatingId(pkg.id)
    try {
      const res = await window.api.tourPackage.updateStatus({ id: pkg.id, isActive: !pkg.isActive })
      if (res.success) {
        toastSuccess(t('tours.packages.packageStatusUpdated'), '')
        await load()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('tours.packages.packageStatusUpdateFailed'))
      }
    } finally {
      setPackageStatusUpdatingId(null)
    }
  }

  async function handleDepartureStatusChange(departureId: string, status: 'COMPLETED' | 'CANCELLED') {
    if (!expandedPackageId) return
    setDepartureStatusUpdatingId(departureId)
    try {
      const res = await window.api.tourPackage.updateDepartureStatus({ id: departureId, status })
      if (res.success) {
        toastSuccess(t('tours.packages.departureStatusUpdated'), '')
        const dres = await window.api.tourPackage.listDepartures({ tourPackageId: expandedPackageId })
        if (dres.success) setDepartures((dres.data as TourDeparture[]) ?? [])
      } else {
        toastError(t('common.error'), res.error?.message ?? t('tours.packages.departureStatusUpdateFailed'))
      }
    } finally {
      setDepartureStatusUpdatingId(null)
    }
  }

  const [bookingDepartureId, setBookingDepartureId] = useState<string | null>(null)
  const [bookingCustomer, setBookingCustomer] = useState<CustomerLite | null>(null)
  const [bookingSeats, setBookingSeats] = useState('1')
  const [bookingAdvance, setBookingAdvance] = useState('0')
  const [booking, setBooking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.tourPackage.list()
      if (res.success) setPackages((res.data as TourPackage[]) ?? [])
      else toastError(t('common.error'), res.error?.message ?? t('tours.packages.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  useEffect(() => { void load() }, [load])

  async function handleCreatePackage() {
    setError('')
    if (!packageName.trim()) { setError(t('tours.packages.nameRequired')); return }
    setSaving(true)
    try {
      const res = await window.api.tourPackage.create({
        packageName: packageName.trim(), itineraryDescription: itinerary.trim() || undefined,
        durationDays: Number(durationDays) || 1, defaultTotalSeats: Number(defaultTotalSeats) || 1, farePerSeat: Number(farePerSeat) || 0,
      })
      if (res.success) {
        toastSuccess(t('tours.packages.packageAdded'), packageName.trim())
        setShowForm(false); setPackageName(''); setItinerary(''); setDurationDays('1'); setDefaultTotalSeats('20'); setFarePerSeat('0')
        await load()
      } else {
        setError(res.error?.message ?? t('tours.packages.packageAddFailed'))
      }
    } finally {
      setSaving(false)
    }
  }

  async function toggleExpand(pkg: TourPackage) {
    if (expandedPackageId === pkg.id) { setExpandedPackageId(null); return }
    setExpandedPackageId(pkg.id)
    setDepartureSeats(String(pkg.defaultTotalSeats))
    const res = await window.api.tourPackage.listDepartures({ tourPackageId: pkg.id })
    if (res.success) setDepartures((res.data as TourDeparture[]) ?? [])
  }

  async function handleCreateDeparture() {
    if (!expandedPackageId || !departureDate) return
    setSavingDeparture(true)
    try {
      const res = await window.api.tourPackage.createDeparture({ tourPackageId: expandedPackageId, departureDate, totalSeats: Number(departureSeats) || 1 })
      if (res.success) {
        toastSuccess(t('tours.packages.departureAdded'), '')
        setShowDepartureForm(false); setDepartureDate('')
        const dres = await window.api.tourPackage.listDepartures({ tourPackageId: expandedPackageId })
        if (dres.success) setDepartures((dres.data as TourDeparture[]) ?? [])
      } else {
        toastError(t('common.error'), res.error?.message ?? t('tours.packages.departureAddFailed'))
      }
    } finally {
      setSavingDeparture(false)
    }
  }

  async function handleBookSeats() {
    if (!bookingDepartureId || !bookingCustomer) return
    setBooking(true)
    try {
      const res = await window.api.tripBooking.createSeat({
        customerId: bookingCustomer.id, tourDepartureId: bookingDepartureId,
        seatsBooked: Number(bookingSeats) || 1, advanceAmount: Number(bookingAdvance) || 0,
      })
      if (res.success) {
        toastSuccess(t('tours.packages.seatsBooked'), '')
        setBookingDepartureId(null); setBookingCustomer(null); setBookingSeats('1'); setBookingAdvance('0')
        if (expandedPackageId) {
          const dres = await window.api.tourPackage.listDepartures({ tourPackageId: expandedPackageId })
          if (dres.success) setDepartures((dres.data as TourDeparture[]) ?? [])
        }
      } else {
        toastError(t('common.error'), res.error?.message ?? t('tours.packages.bookingFailed'))
      }
    } finally {
      setBooking(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-dark flex items-center gap-2"><MapPin size={20} /> {t('tours.packages.title')}</h2>
          <p className="text-sm text-slate-400">{t('tours.packages.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void load()} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:border-slate-300 transition-colors">
            <RefreshCw size={14} /> {t('tours.packages.refresh')}
          </button>
          {canManage && <Button size="sm" onClick={() => setShowForm((s) => !s)} icon={<Plus size={14} />}>{t('tours.packages.newPackage')}</Button>}
        </div>
      </div>

      {showForm && canManage && (
        <Card padding="md" className="space-y-3">
          <Input label={t('tours.packages.packageName')} value={packageName} onChange={(e) => setPackageName(e.target.value)} />
          <Input label={t('tours.packages.itinerary')} value={itinerary} onChange={(e) => setItinerary(e.target.value)} />
          <div className="grid grid-cols-3 gap-3">
            <Input label={t('tours.packages.durationDays')} type="number" min="1" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
            <Input label={t('tours.packages.defaultSeats')} type="number" min="1" value={defaultTotalSeats} onChange={(e) => setDefaultTotalSeats(e.target.value)} />
            <Input label={t('tours.packages.farePerSeat')} type="number" min="0" value={farePerSeat} onChange={(e) => setFarePerSeat(e.target.value)} />
          </div>
          {error && <p className="text-xs text-danger bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>{t('tours.packages.cancel')}</Button>
            <Button size="sm" onClick={() => void handleCreatePackage()} loading={saving}>{t('tours.packages.add')}</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400">{t('tours.packages.loading')}</div>
      ) : packages.length === 0 ? (
        <Card padding="lg" className="text-center py-12">
          <MapPin size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('tours.packages.noPackagesYet')}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {packages.map((pkg) => (
            <Card key={pkg.id} padding="none" className="overflow-hidden">
              <button onClick={() => void toggleExpand(pkg)} className="w-full px-5 py-4 flex items-start gap-4 text-left hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm dark:text-slate-100">{pkg.packageName}</span>
                    <Badge variant={pkg.isActive ? 'success' : 'neutral'} size="sm">{t(`tours.packages.status.${pkg.isActive ? 'ACTIVE' : 'INACTIVE'}`)}</Badge>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap dark:text-slate-400">
                    <span>{t('tours.packages.durationLabel', { days: pkg.durationDays })}</span>
                    <span>{t('tours.packages.seatsLabel', { count: pkg.defaultTotalSeats })}</span>
                    <span>{formatCurrency(pkg.farePerSeat)}{t('tours.packages.perSeat')}</span>
                  </div>
                </div>
              </button>
              {expandedPackageId === pkg.id && (
                <div className="px-5 pb-4 border-t border-slate-100 dark:border-slate-800 pt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('tours.packages.departures')}</p>
                    {canManage && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => void handleTogglePackageActive(pkg)}
                          disabled={packageStatusUpdatingId === pkg.id}
                          className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 disabled:opacity-50"
                        >
                          {pkg.isActive ? t('tours.packages.deactivate') : t('tours.packages.activate')}
                        </button>
                        <button onClick={() => setShowDepartureForm((s) => !s)} className="text-xs px-3 py-1.5 rounded-lg bg-brand/5 text-brand border border-brand/20 hover:bg-brand/10 flex items-center gap-1 font-medium">
                          <CalendarPlus size={12} /> {t('tours.packages.addDeparture')}
                        </button>
                      </div>
                    )}
                  </div>
                  {showDepartureForm && (
                    <div className="grid grid-cols-3 gap-3 items-end">
                      <Input label={t('tours.packages.departureDate')} type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} />
                      <Input label={t('tours.packages.totalSeats')} type="number" min="1" value={departureSeats} onChange={(e) => setDepartureSeats(e.target.value)} />
                      <Button size="sm" onClick={() => void handleCreateDeparture()} loading={savingDeparture} disabled={!departureDate}>{t('tours.packages.save')}</Button>
                    </div>
                  )}
                  {departures.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2">{t('tours.packages.noDeparturesYet')}</p>
                  ) : (
                    <div className="divide-y divide-slate-50 dark:divide-slate-800">
                      {departures.map((dep) => (
                        <div key={dep.id} className="py-2.5 flex items-center justify-between gap-3">
                          <div>
                            <span className="text-sm text-dark dark:text-slate-200">{formatDate(new Date(dep.departureDate))}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                              {t('tours.packages.seatsRemainingOf', { remaining: dep.totalSeats - dep.seatsBooked, total: dep.totalSeats })}
                            </span>
                            {dep.status !== 'SCHEDULED' && (
                              <Badge variant={dep.status === 'CANCELLED' ? 'danger' : 'neutral'} size="sm" className="ms-2">{t(`tours.packages.departureStatus.${dep.status}`)}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {canBook && dep.status === 'SCHEDULED' && dep.seatsBooked < dep.totalSeats && (
                              <button onClick={() => setBookingDepartureId(dep.id)} className="text-xs px-3 py-1.5 rounded-lg bg-brand text-white flex items-center gap-1 font-medium">
                                <Ticket size={12} /> {t('tours.packages.bookSeats')}
                              </button>
                            )}
                            {canManage && dep.status === 'SCHEDULED' && (
                              <>
                                <button
                                  onClick={() => void handleDepartureStatusChange(dep.id, 'COMPLETED')}
                                  disabled={departureStatusUpdatingId === dep.id}
                                  className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 disabled:opacity-50"
                                >
                                  {t('tours.packages.markComplete')}
                                </button>
                                <button
                                  onClick={() => void handleDepartureStatusChange(dep.id, 'CANCELLED')}
                                  disabled={departureStatusUpdatingId === dep.id}
                                  className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-danger hover:bg-red-50 disabled:opacity-50"
                                >
                                  {t('tours.packages.cancelDeparture')}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {bookingDepartureId && (
        <Card padding="md" className="space-y-3">
          <p className="text-sm font-semibold text-dark dark:text-slate-100">{t('tours.packages.bookSeatsTitle')}</p>
          <CustomerPicker value={bookingCustomer} onChange={setBookingCustomer} label={t('tours.packages.customer')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('tours.packages.seatsToBook')} type="number" min="1" value={bookingSeats} onChange={(e) => setBookingSeats(e.target.value)} />
            <Input label={t('tours.packages.advanceAmount')} type="number" min="0" value={bookingAdvance} onChange={(e) => setBookingAdvance(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setBookingDepartureId(null)}>{t('tours.packages.cancel')}</Button>
            <Button size="sm" onClick={() => void handleBookSeats()} loading={booking} disabled={!bookingCustomer}>{t('tours.packages.confirmBooking')}</Button>
          </div>
        </Card>
      )}
    </div>
  )
}
