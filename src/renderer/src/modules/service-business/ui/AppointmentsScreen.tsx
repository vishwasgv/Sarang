import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { CalendarDays, Plus, ChevronLeft, ChevronRight, Clock, User, Tag, CheckCircle2, XCircle, AlertCircle, RefreshCw, FileText, Smile, Activity, Package, X, Receipt, Camera, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '@renderer/services/ipc-client'
import { useAuthStore } from '@app/store/auth.store'
import { useBusinessStore } from '@app/store/business.store'
import { useIndustryStore } from '@app/store/industry.store'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { Card } from '@shared/ui/molecules/Card'
import { CustomerPicker } from '@shared/ui/molecules/CustomerPicker'
import { cn } from '@shared/utils/cn'
import { useNotificationStore } from '@app/store/notification.store'
import { DocumentPanel } from '@modules/documents/ui/DocumentPanel'

type AppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'

interface Appointment {
  id: string
  appointmentNumber: string
  customerName: string | null
  serviceTitle: string
  scheduledDate: string
  scheduledTime: string
  durationMinutes: number
  status: AppointmentStatus
  totalAmount: number
  notes: string | null
  chairAssignment: string | null
  customer: { id: string; customerName: string; phone: string | null } | null
  provider: { id: string; fullName: string; providerColor: string | null } | null
  serviceCatalog: { id: string; serviceName: string } | null
  visitNote: { id: string; isFinalized: boolean } | null
  sessionLog: { id: string } | null
  invoiceId: string | null
}

// Verified exhaustive against src/main/services/appointment.service.ts (line ~288:
// `status: 'SCHEDULED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'`)
// and prisma/schema.prisma model Appointment (`SCHEDULED|CONFIRMED|IN_PROGRESS|COMPLETED|CANCELLED|NO_SHOW`).
const STATUS_LABEL: Record<AppointmentStatus, string> = {
  SCHEDULED: 'Scheduled',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No Show',
}

const STATUS_VARIANT: Record<AppointmentStatus, 'info' | 'brand' | 'warning' | 'success' | 'danger' | 'neutral'> = {
  SCHEDULED: 'info',
  CONFIRMED: 'brand',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  NO_SHOW: 'neutral',
}

const STATUS_ICON: Record<AppointmentStatus, React.ReactNode> = {
  SCHEDULED: <Clock size={11} />,
  CONFIRMED: <CheckCircle2 size={11} />,
  IN_PROGRESS: <AlertCircle size={11} />,
  COMPLETED: <CheckCircle2 size={11} />,
  CANCELLED: <XCircle size={11} />,
  NO_SHOW: <XCircle size={11} />,
}

const NEXT_STATUS: Partial<Record<AppointmentStatus, AppointmentStatus>> = {
  SCHEDULED: 'CONFIRMED',
  CONFIRMED: 'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d)
  result.setDate(result.getDate() + n)
  return result
}

export function AppointmentsScreen() {
  const { hasPermission } = useAuthStore()
  const canCreate = hasPermission('billing.createInvoice')
  const canSeeNotes = hasPermission('clinicalNotes.view')
  const hasVisitNotes = useIndustryStore((s) => s.isModuleEnabled('visit_notes'))
  const hasDentalChart = useIndustryStore((s) => s.isModuleEnabled('dental_chart'))
  const hasPhysioNotes = useIndustryStore((s) => s.isModuleEnabled('physio_notes'))
  const hasSessionPacks = useIndustryStore((s) => s.isModuleEnabled('session_packs'))
  const hasStaffCommission = useIndustryStore((s) => s.isModuleEnabled('staff_commission'))
  // Phase 58 §2 — Beauty Salon: before/after photo attachment per appointment.
  const hasMultiServiceBooking = useIndustryStore((s) => s.isModuleEnabled('multi_service_booking'))
  const currSym = useBusinessStore((s) => s.profile?.currencySymbol ?? '₹')
  const navigate = useNavigate()
  const { error: toastError } = useNotificationStore()

  const [selectedDate, setSelectedDate] = useState(new Date())
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [stats, setStats] = useState({ todayTotal: 0, todayCompleted: 0, pending: 0, totalRevenue: 0 })
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [showForm, setShowForm] = useState(false)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [invoiceError, setInvoiceError] = useState('')
  const [invoiceSuccess, setInvoiceSuccess] = useState('')
  const [generatingBatch, setGeneratingBatch] = useState(false)

  // Phase 58 §2 — real checkout modal (retail upsell + payment method),
  // replacing the old single-click "just invoice the service" action.
  const [checkoutAppt, setCheckoutAppt] = useState<Appointment | null>(null)
  // Phase 58 §2 — before/after photo attachment per appointment.
  const [photosAppt, setPhotosAppt] = useState<Appointment | null>(null)

  const loadAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const [apptRes, statsRes] = await Promise.all([
        api.appointments.getByDate({ date: formatDate(selectedDate) }),
        api.appointments.stats(),
      ])
      if (apptRes.success && apptRes.data) setAppointments(apptRes.data as Appointment[])
      else toastError('Error', apptRes.error?.message ?? 'Could not load appointments.')
      if (statsRes.success && statsRes.data) setStats(statsRes.data as typeof stats)
      else toastError('Error', statsRes.error?.message ?? 'Could not load appointment stats.')
    } catch {
      toastError('Error', 'Could not load appointments.')
    } finally {
      setLoading(false)
    }
  }, [selectedDate, toastError])

  useEffect(() => { loadAppointments() }, [loadAppointments])

  function isInvoiceable(a: Appointment): boolean {
    return a.status === 'COMPLETED' && !a.invoiceId && !a.sessionLog
  }

  // Keep the selection in sync with reality: whenever the appointment list
  // reloads (date change, status change elsewhere), drop any selected id
  // that's no longer invoiceable or present — mirrors the same fix applied
  // to TimeEntryScreen's multi-select.
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev
      const stillSelectable = new Set(appointments.filter(isInvoiceable).map((a) => a.id))
      const next = new Set([...prev].filter((id) => stillSelectable.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [appointments])

  function toggleSelected(id: string): void {
    setInvoiceError('')
    setInvoiceSuccess('')
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleGenerateBatchInvoice(): Promise<void> {
    if (selectedIds.size === 0) return
    setInvoiceError('')
    setInvoiceSuccess('')
    setGeneratingBatch(true)
    const res = await api.appointments.generateBatchInvoice({ ids: [...selectedIds] })
    if (res.success) {
      setInvoiceSuccess('Invoice generated successfully.')
      setSelectedIds(new Set())
      await loadAppointments()
    } else {
      setInvoiceError(res.error?.message ?? 'Could not generate invoice.')
    }
    setGeneratingBatch(false)
  }

  async function handleStatusChange(id: string, status: AppointmentStatus) {
    try {
      const statusRes = await api.appointments.updateStatus({ id, status })
      if (statusRes.success) {
        if (status === 'COMPLETED') {
          const appt = appointments.find((a) => a.id === id)
          // Deduct session pack if module is enabled
          if (hasSessionPacks && appt?.customer?.id) {
            await api.sessionPack.deduct({ customerId: appt.customer.id, appointmentId: id }).catch(() => {})
          }
          // Auto-calculate staff commission if module is enabled and provider has a commission rate
          if (hasStaffCommission && appt?.provider?.id && appt.totalAmount > 0) {
            await api.staffCommission.calculate({
              appointmentId: id,
              staffId: appt.provider.id,
              serviceRevenue: appt.totalAmount,
              commissionType: 'PERCENT',
              commissionRate: 10, // Default 10%; staff-specific rate is configurable in Employee settings
            }).catch(() => {})
          }
        }
      } else {
        toastError('Error', statusRes.error?.message ?? 'Could not update appointment status.')
      }
    } catch {
      toastError('Error', 'Could not update appointment status.')
    } finally {
      await loadAppointments()
    }
  }

  const filtered = appointments.filter((a) => {
    if (statusFilter !== 'ALL' && a.status !== statusFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const name = (a.customerName ?? a.customer?.customerName ?? '').toLowerCase()
      return name.includes(q) || a.serviceTitle.toLowerCase().includes(q)
    }
    return true
  })

  const dateLabel = selectedDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const isToday = formatDate(selectedDate) === formatDate(new Date())
  const dayTotal = appointments.length
  const dayCompleted = appointments.filter((a) => a.status === 'COMPLETED').length

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand flex items-center justify-center">
            <CalendarDays size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-dark dark:text-slate-100">Appointments</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{dateLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedDate((d) => addDays(d, -1))} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setSelectedDate(new Date())} className={cn('px-3 py-1.5 text-xs font-medium rounded-lg border', isToday ? 'border-brand text-brand bg-brand/5' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700')}>
            Today
          </button>
          <button onClick={() => setSelectedDate((d) => addDays(d, 1))} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
            <ChevronRight size={16} />
          </button>
          <button onClick={loadAppointments} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {canCreate && selectedIds.size > 0 && (
            <Button
              size="sm"
              variant="secondary"
              icon={<Receipt size={14} />}
              loading={generatingBatch}
              onClick={handleGenerateBatchInvoice}
            >
              Generate Invoice ({selectedIds.size})
            </Button>
          )}
          {canCreate && (
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowForm(true)}>
              New Appointment
            </Button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-6 shrink-0">
        {[
          { label: isToday ? "Today's Total" : 'Day Total', value: dayTotal, color: 'text-brand' },
          { label: 'Completed', value: dayCompleted, color: 'text-success' },
          { label: 'Pending (All)', value: stats.pending, color: 'text-warning' },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 shrink-0 flex-wrap">
        <div className="flex gap-1">
          {['ALL', 'SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn('px-2.5 py-1 text-xs font-medium rounded-full border transition-colors', statusFilter === s ? 'border-brand text-brand bg-brand/5' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300')}
            >
              {s === 'ALL' ? 'All' : STATUS_LABEL[s as AppointmentStatus] ?? s}
            </button>
          ))}
        </div>
        <div className="flex-1 max-w-xs">
          <Input
            placeholder="Search client or service..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {invoiceError && (
        <div className="px-6 py-2 bg-danger/5 border-b border-danger/20 text-sm text-danger shrink-0">{invoiceError}</div>
      )}
      {invoiceSuccess && (
        <div className="px-6 py-2 bg-success/5 border-b border-success/20 text-sm text-success shrink-0">{invoiceSuccess}</div>
      )}

      {/* Appointment list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarDays size={32} className="text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No appointments {isToday ? 'today' : 'on this day'}</p>
            <p className="text-xs text-slate-400 mt-1">
              {canCreate ? 'Click "New Appointment" to book one.' : 'Check a different date.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((appt) => {
              const nextStatus = NEXT_STATUS[appt.status]
              return (
                <motion.div
                  key={appt.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                <Card padding="md" hoverable className="flex items-start gap-4">
                  {/* Selection checkbox — only for invoiceable appointments */}
                  {canCreate && isInvoiceable(appt) && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(appt.id)}
                      onChange={() => toggleSelected(appt.id)}
                      className="mt-1 w-4 h-4 rounded border-slate-300 text-brand focus:ring-brand shrink-0"
                    />
                  )}

                  {/* Time column */}
                  <div className="shrink-0 w-14 text-center">
                    <p className="text-base font-bold text-dark dark:text-slate-100">{appt.scheduledTime}</p>
                    <p className="text-xs text-slate-400">{appt.durationMinutes}min</p>
                  </div>

                  {/* Provider colour strip */}
                  <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: appt.provider?.providerColor ?? '#00AEEF' }} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-dark dark:text-slate-100 truncate">
                          {appt.customerName ?? appt.customer?.customerName ?? 'Walk-in'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{appt.serviceTitle}</p>
                      </div>
                      <Badge variant={STATUS_VARIANT[appt.status]} icon={STATUS_ICON[appt.status]} size="sm" className="shrink-0">
                        {STATUS_LABEL[appt.status]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      {appt.provider && (
                        <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                          <User size={11} /> {appt.provider.fullName}
                        </span>
                      )}
                      {appt.chairAssignment && (
                        <span className="flex items-center gap-1 text-xs text-brand font-medium">
                          Chair {appt.chairAssignment}
                        </span>
                      )}
                      {appt.totalAmount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                          <Tag size={11} /> {currSym}{appt.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                        </span>
                      )}
                      {appt.notes && <span className="text-xs text-slate-400 truncate max-w-xs">{appt.notes}</span>}
                    </div>
                  </div>

                  {/* Clinical Notes button (GP + Specialist) */}
                  {hasVisitNotes && canSeeNotes && (
                    <button
                      onClick={() => navigate(`/clinical/visit/${appt.id}`)}
                      title={appt.visitNote ? (appt.visitNote.isFinalized ? 'View finalized note' : 'Continue note') : 'Start consultation note'}
                      className={cn(
                        'shrink-0 p-1.5 rounded-lg border transition-colors',
                        appt.visitNote
                          ? appt.visitNote.isFinalized
                            ? 'border-success/40 text-success bg-success/5 hover:bg-success/10'
                            : 'border-warning/40 text-warning bg-warning/5 hover:bg-warning/10'
                          : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:text-brand hover:border-brand/30 hover:bg-brand/5'
                      )}
                    >
                      <FileText size={14} />
                    </button>
                  )}

                  {/* Dental Chart button (Dental Clinic only — requires linked customer) */}
                  {hasDentalChart && canSeeNotes && appt.customer?.id && (
                    <button
                      onClick={() => navigate(`/dental/patient/${appt.customer!.id}`)}
                      title="Open dental chart"
                      className="shrink-0 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-brand hover:border-brand/30 hover:bg-brand/5 transition-colors"
                    >
                      <Smile size={14} />
                    </button>
                  )}

                  {/* Physio Patient button (Physio Clinic only — requires linked customer) */}
                  {hasPhysioNotes && canSeeNotes && appt.customer?.id && (
                    <button
                      onClick={() => navigate(`/physio/patient/${appt.customer!.id}`)}
                      title="Open physio record"
                      className="shrink-0 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-brand hover:border-brand/30 hover:bg-brand/5 transition-colors"
                    >
                      <Activity size={14} />
                    </button>
                  )}

                  {/* Session pack indicator — only when a SessionLog was actually created */}
                  {hasSessionPacks && appt.sessionLog !== null && (
                    <span title="Session deducted from pack" className="shrink-0 p-1.5 text-success">
                      <Package size={13} />
                    </span>
                  )}

                  {/* Invoice status / action */}
                  {appt.status === 'COMPLETED' && appt.sessionLog && (
                    <span title="Paid via session pack" className="shrink-0 text-xs text-slate-400 px-1">Pack</span>
                  )}
                  {appt.invoiceId && (
                    <span className="shrink-0 text-xs text-success font-medium px-1">Invoiced</span>
                  )}
                  {canCreate && isInvoiceable(appt) && (
                    <button
                      onClick={() => setCheckoutAppt(appt)}
                      title="Checkout"
                      className="shrink-0 p-1.5 text-slate-400 hover:text-success hover:bg-success/5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Receipt size={14} />
                    </button>
                  )}

                  {/* Phase 58 §2 — Beauty Salon before/after photos */}
                  {hasMultiServiceBooking && canCreate && (
                    <button
                      onClick={() => setPhotosAppt(appt)}
                      title="Before / After Photos"
                      className="shrink-0 p-1.5 text-slate-400 hover:text-brand hover:bg-brand/5 rounded-lg transition-colors"
                    >
                      <Camera size={14} />
                    </button>
                  )}

                  {/* Actions */}
                  {canCreate && nextStatus && (
                    <button
                      onClick={() => handleStatusChange(appt.id, nextStatus)}
                      className="shrink-0 px-2.5 py-1 text-xs font-medium text-brand border border-brand/30 rounded-lg hover:bg-brand/5 transition-colors"
                    >
                      Mark {STATUS_LABEL[nextStatus]}
                    </button>
                  )}
                  {canCreate && ['SCHEDULED', 'CONFIRMED'].includes(appt.status) && (
                    <>
                      <button
                        onClick={() => handleStatusChange(appt.id, 'NO_SHOW')}
                        className="shrink-0 px-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        title="Mark as no-show"
                      >
                        No Show
                      </button>
                      <button
                        onClick={() => handleStatusChange(appt.id, 'CANCELLED')}
                        className="shrink-0 p-1.5 text-slate-400 hover:text-danger hover:bg-danger/5 rounded-lg transition-colors"
                        title="Cancel appointment"
                      >
                        <XCircle size={14} />
                      </button>
                    </>
                  )}
                </Card>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* New Appointment Modal */}
      {showForm && (
        <NewAppointmentModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); loadAppointments() }} />
      )}

      {/* Phase 58 §2 — real checkout: service total + optional retail upsell + payment method, one invoice */}
      {checkoutAppt && (
        <CheckoutModal
          appt={checkoutAppt}
          currSym={currSym}
          onClose={() => setCheckoutAppt(null)}
          onDone={() => { setCheckoutAppt(null); loadAppointments() }}
        />
      )}

      {/* Phase 58 §2 — Beauty Salon before/after photos */}
      {photosAppt && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-auto">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-dark dark:text-slate-100">Before / After Photos</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{photosAppt.appointmentNumber} · {photosAppt.serviceTitle}</p>
              </div>
              <button onClick={() => setPhotosAppt(null)} className="text-slate-400 hover:text-dark dark:hover:text-slate-100"><X size={20} /></button>
            </div>
            <div className="p-6">
              <DocumentPanel entityType="APPOINTMENT" entityId={photosAppt.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── New Appointment Modal ────────────────────────────────────────────────────

interface Service { id: string; serviceName: string; durationMinutes: number; basePrice: number }
interface Provider { id: string; fullName: string }
interface Customer { id: string; customerName: string; phone: string | null }

function NewAppointmentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const isDental = useIndustryStore((s) => s.isModuleEnabled('dental_chart'))
  const isSalon = useIndustryStore((s) => s.isModuleEnabled('multi_service_booking'))
  // Phase 58 §2 — Vet Clinic: Appointment.petId has existed in the schema
  // since Phase 23 and getAppointment now returns the pet relation, but
  // nothing anywhere ever actually SET it — this booking form is the one
  // and only place an appointment is created, so without a pet picker here
  // a vet visit could never be linked to a patient at all.
  const isVet = useIndustryStore((s) => s.isModuleEnabled('vet_patients'))
  // Phase 58 §2 — Gym/Studio: a session pack's standing assignedTrainerId is
  // only ever used to PRE-FILL this picker on customer pick, never to force
  // it — a substitute session with a different trainer must always remain
  // possible, so this only fills providerId if it's still empty.
  const hasSessionPacks = useIndustryStore((s) => s.isModuleEnabled('session_packs'))
  const { error: toastError } = useNotificationStore()
  const [services, setServices] = useState<Service[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [pickedCustomer, setPickedCustomer] = useState<Customer | null>(null)
  const [pets, setPets] = useState<Array<{ id: string; petName: string; species: string }>>([])
  const [pickedPetId, setPickedPetId] = useState('')
  const [selectedServices, setSelectedServices] = useState<Service[]>([])
  const [form, setForm] = useState({
    customerName: '',
    providerId: '',
    serviceCatalogId: '',
    serviceTitle: '',
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledTime: '09:00',
    durationMinutes: 30,
    notes: '',
    totalAmount: 0,
    chairAssignment: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [slots, setSlots] = useState<{ time: string; isBooked: boolean }[] | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [availabilityMsg, setAvailabilityMsg] = useState<string | null>(null)
  // Phase 58 §2 — Beauty Salon stylist skill-matching. null = no restriction
  // configured for this service, so every provider stays selectable (the
  // pre-existing any-staff-any-service behavior) — this only narrows the
  // list once someone has actually gone and configured skills.
  const [qualifiedProviderIds, setQualifiedProviderIds] = useState<string[] | null>(null)

  useEffect(() => {
    Promise.all([
      api.serviceCatalog.list({ isActive: true }),
      api.hr.listEmployees({ isActive: true }),
    ]).then(([sRes, pRes]) => {
      if (sRes.success && sRes.data) setServices(sRes.data as Service[])
      else toastError('Error', sRes.error?.message ?? 'Could not load services.')
      if (pRes.success && pRes.data) setProviders((pRes.data as { employees: Provider[] }).employees ?? [])
      else toastError('Error', pRes.error?.message ?? 'Could not load providers.')
    }).catch(() => {
      toastError('Error', 'Could not load services or providers.')
    })
  }, [toastError])

  useEffect(() => {
    if (!form.providerId || !form.scheduledDate) {
      setSlots(null)
      setAvailabilityMsg(null)
      return
    }
    setSlotsLoading(true)
    api.providerSchedule.getAvailability({ providerId: form.providerId, date: form.scheduledDate, durationMinutes: form.durationMinutes }).then((res) => {
      if (res.success && res.data) {
        const d = res.data as { available: boolean; reason?: string; slots: { time: string; isBooked: boolean }[] }
        if (!d.available) {
          setSlots([])
          setAvailabilityMsg(d.reason ?? 'Provider not available on this day.')
        } else {
          setSlots(d.slots)
          setAvailabilityMsg(null)
          const firstFree = d.slots.find((s) => !s.isBooked)
          if (firstFree) setForm((f) => ({ ...f, scheduledTime: firstFree.time }))
        }
      } else {
        setSlots([])
        setAvailabilityMsg(res.error?.message ?? 'Could not check provider availability.')
      }
      setSlotsLoading(false)
    }).catch(() => {
      setSlots([])
      setAvailabilityMsg('Could not check provider availability.')
      setSlotsLoading(false)
    })
  }, [form.providerId, form.scheduledDate, form.durationMinutes])

  // Phase 58 §2 — Vet Clinic: load the owner's pets once a client is picked,
  // reset the pet selection whenever the client changes (a previously
  // selected pet can't belong to a newly picked different owner).
  useEffect(() => {
    if (!isVet || !pickedCustomer) { setPets([]); setPickedPetId(''); return }
    setPickedPetId('')
    api.pets.list({ customerId: pickedCustomer.id, isActive: true }).then((res) => {
      if (res.success && res.data) setPets(res.data as Array<{ id: string; petName: string; species: string }>)
    })
  }, [isVet, pickedCustomer])

  // Phase 58 §2 — Gym/Studio: pre-fill the provider picker from the client's
  // standing trainer assignment on their active session pack, only if a
  // provider hasn't already been picked/typed by staff.
  useEffect(() => {
    if (!hasSessionPacks || !pickedCustomer) return
    api.sessionPack.getActive({ customerId: pickedCustomer.id }).then((res) => {
      if (res.success && res.data) {
        const pack = res.data as { assignedTrainerId?: string | null }
        if (pack.assignedTrainerId) {
          setForm((f) => (f.providerId ? f : { ...f, providerId: pack.assignedTrainerId! }))
        }
      }
    })
  }, [hasSessionPacks, pickedCustomer])

  // Phase 58 §2 — Beauty Salon stylist skill-matching. Multi-service salon
  // bookings use the first selected service (same "primary service" convention
  // handleSave already uses for serviceCatalogId) — matching a stylist against
  // several simultaneous services at once is a materially harder problem than
  // this session's scope covers, so it's deliberately not attempted.
  const effectiveServiceId = isSalon ? selectedServices[0]?.id : form.serviceCatalogId
  useEffect(() => {
    if (!effectiveServiceId) { setQualifiedProviderIds(null); return }
    let cancelled = false
    api.providerSkills.listQualified({ serviceCatalogId: effectiveServiceId }).then((res) => {
      if (cancelled) return
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setQualifiedProviderIds(res.data as string[])
      else setQualifiedProviderIds(null)
    })
    return () => { cancelled = true }
  }, [effectiveServiceId])

  const visibleProviders = qualifiedProviderIds ? providers.filter((p) => qualifiedProviderIds.includes(p.id)) : providers

  function handleServiceChange(id: string) {
    const svc = services.find((s) => s.id === id)
    setForm((f) => ({
      ...f,
      serviceCatalogId: id,
      serviceTitle: svc?.serviceName ?? f.serviceTitle,
      durationMinutes: svc?.durationMinutes ?? f.durationMinutes,
      totalAmount: svc?.basePrice ?? f.totalAmount,
    }))
  }

  function addSalonService(id: string) {
    const svc = services.find((s) => s.id === id)
    if (!svc || selectedServices.some((s) => s.id === id)) return
    const updated = [...selectedServices, svc]
    setSelectedServices(updated)
    setForm((f) => ({
      ...f,
      serviceTitle: updated.map((s) => s.serviceName).join(' + '),
      durationMinutes: updated.reduce((sum, s) => sum + s.durationMinutes, 0),
      totalAmount: updated.reduce((sum, s) => sum + s.basePrice, 0),
    }))
  }

  function removeSalonService(id: string) {
    const updated = selectedServices.filter((s) => s.id !== id)
    setSelectedServices(updated)
    setForm((f) => ({
      ...f,
      serviceTitle: updated.map((s) => s.serviceName).join(' + '),
      durationMinutes: updated.length > 0 ? updated.reduce((sum, s) => sum + s.durationMinutes, 0) : 30,
      totalAmount: updated.reduce((sum, s) => sum + s.basePrice, 0),
    }))
  }

  async function handleSave() {
    if (isSalon && selectedServices.length === 0) { setError('Select at least one service.'); return }
    if (!isSalon && !form.serviceTitle) { setError('Service title is required.'); return }
    if (!form.scheduledDate || !form.scheduledTime) { setError('Date and time are required.'); return }
    setSaving(true)
    setError(null)
    const res = await api.appointments.create({
      customerId: pickedCustomer?.id || undefined,
      customerName: pickedCustomer ? undefined : (form.customerName || undefined),
      petId: isVet && pickedPetId ? pickedPetId : undefined,
      providerId: form.providerId || undefined,
      serviceCatalogId: isSalon ? (selectedServices[0]?.id || undefined) : (form.serviceCatalogId || undefined),
      serviceTitle: form.serviceTitle,
      scheduledDate: form.scheduledDate,
      scheduledTime: form.scheduledTime,
      durationMinutes: form.durationMinutes,
      notes: form.notes || undefined,
      totalAmount: form.totalAmount,
      chairAssignment: form.chairAssignment || undefined,
      services: isSalon && selectedServices.length > 0
        ? JSON.stringify(selectedServices.map((s) => ({ id: s.id, name: s.serviceName, price: s.basePrice, duration: s.durationMinutes })))
        : undefined,
    })
    if (res.success) {
      const newAppt = res.data as { id: string }
      if (newAppt?.id) {
        api.notificationQueue.createReminder({ appointmentId: newAppt.id }).catch(() => {})
      }
      setSaving(false)
      onSaved()
    } else {
      setError(res.error?.message ?? 'Could not create appointment.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base font-semibold text-dark dark:text-slate-100">New Appointment</h2>
        </div>
        <div className="p-5 space-y-4">
          {error && <p className="text-xs text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">{error}</p>}

          {/* Service — multi-service for salon, single for others */}
          {isSalon ? (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Services</label>
              {selectedServices.map((svc) => (
                <div key={svc.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-dark dark:text-slate-100">{svc.serviceName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">₹{svc.basePrice} · {svc.durationMinutes} min</p>
                  </div>
                  <button type="button" onClick={() => removeSalonService(svc.id)} className="text-slate-400 hover:text-danger transition-colors">
                    <X size={14} />
                  </button>
                </div>
              ))}
              <Select
                value=""
                onChange={(e) => { if (e.target.value) addSalonService(e.target.value) }}
              >
                <option value="">+ Add service...</option>
                {services.filter((s) => !selectedServices.some((sel) => sel.id === s.id)).map((s) => (
                  <option key={s.id} value={s.id}>{s.serviceName} — ₹{s.basePrice}</option>
                ))}
              </Select>
              {selectedServices.length > 0 && (
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
                  <span>Total: ₹{form.totalAmount}</span>
                  <span>{form.durationMinutes} min</span>
                </div>
              )}
            </div>
          ) : (
            <>
              <Select
                label="Service"
                value={form.serviceCatalogId}
                onChange={(e) => handleServiceChange(e.target.value)}
              >
                <option value="">Select service...</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.serviceName}</option>
                ))}
              </Select>
              <Input
                label="Service Title"
                placeholder="e.g. General Consultation"
                value={form.serviceTitle}
                onChange={(e) => setForm((f) => ({ ...f, serviceTitle: e.target.value }))}
                required
              />
            </>
          )}

          {/* Client */}
          <CustomerPicker
            label="Client"
            value={pickedCustomer}
            onChange={setPickedCustomer}
            placeholder="Search existing client by name or phone..."
          />
          {!pickedCustomer && (
            <Input
              label="Client Name (Walk-in — can't be invoiced later; pick/add a client above if you may need to bill this visit)"
              placeholder="Enter name"
              value={form.customerName}
              onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
            />
          )}

          {/* Phase 58 §2 — Vet Clinic: which of the owner's pets this visit is
              actually for — the consultation note (VisitNoteScreen) reads
              this back to know who the PATIENT is. */}
          {isVet && pickedCustomer && (
            <Select
              label="Patient (Pet)"
              value={pickedPetId}
              onChange={(e) => setPickedPetId(e.target.value)}
            >
              <option value="">{pets.length === 0 ? 'No pets on file for this client' : 'Select pet...'}</option>
              {pets.map((p) => (
                <option key={p.id} value={p.id}>{p.petName} ({p.species})</option>
              ))}
            </Select>
          )}

          {/* Provider — Phase 58 §2: narrowed to qualified stylists once
              skills have been configured for the selected service (see
              EmployeesScreen.tsx). Falls back to every provider otherwise. */}
          <Select
            label={qualifiedProviderIds ? 'Provider (qualified for this service)' : 'Provider (optional)'}
            value={form.providerId}
            onChange={(e) => setForm((f) => ({ ...f, providerId: e.target.value }))}
          >
            <option value="">Any provider</option>
            {visibleProviders.map((p) => (
              <option key={p.id} value={p.id}>{p.fullName}</option>
            ))}
          </Select>

          {/* Date */}
          <Input
            label="Date"
            type="date"
            value={form.scheduledDate}
            onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))}
            required
          />

          {/* Time — slot picker when provider is selected, free input otherwise */}
          {slots !== null ? (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Time Slot</label>
              {availabilityMsg ? (
                <p className="text-xs text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">{availabilityMsg}</p>
              ) : slotsLoading ? (
                <p className="text-xs text-slate-400 py-2">Loading available slots...</p>
              ) : slots.length === 0 ? (
                <p className="text-xs text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">No slots available on this date.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto py-1">
                  {slots.map((s) => (
                    <button
                      key={s.time}
                      type="button"
                      disabled={s.isBooked}
                      onClick={() => setForm((f) => ({ ...f, scheduledTime: s.time }))}
                      className={cn(
                        'px-2.5 py-1 text-xs rounded-lg border font-medium transition-colors',
                        s.isBooked
                          ? 'bg-slate-50 dark:bg-slate-800 text-slate-300 border-slate-100 dark:border-slate-800 cursor-not-allowed line-through'
                          : form.scheduledTime === s.time
                          ? 'bg-brand text-white border-brand'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand hover:text-brand'
                      )}
                    >
                      {s.time}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Input
              label="Time"
              type="time"
              value={form.scheduledTime}
              onChange={(e) => setForm((f) => ({ ...f, scheduledTime: e.target.value }))}
              required
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Duration (min)"
              type="number"
              value={form.durationMinutes}
              onChange={(e) => setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))}
            />
            <Input
              label="Amount"
              type="number"
              value={form.totalAmount}
              onChange={(e) => setForm((f) => ({ ...f, totalAmount: Number(e.target.value) }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-dark dark:text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="Any special instructions..."
            />
          </div>

          {isDental && (
            <Input
              label="Chair Assignment (optional)"
              placeholder="e.g. Chair 1, Chair A"
              value={form.chairAssignment}
              onChange={(e) => setForm((f) => ({ ...f, chairAssignment: e.target.value }))}
            />
          )}
        </div>
        <div className="px-5 pb-5 flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            loading={saving}
            disabled={availabilityMsg !== null || (slots !== null && slots.length === 0)}
            onClick={handleSave}
          >
            Book Appointment
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Checkout Modal (Phase 58 §2) ───────────────────────────────────────────
// Unifies a retail product upsell into the SAME invoice as the appointment
// service, instead of a separate Billing-screen transaction the cashier has
// to remember to ring up afterward. Price/tax for retail lines are resolved
// server-side from the real Product record (see resolveRetailInvoiceItems in
// appointment.service.ts) — this UI only ever sends productId+quantity.

interface RetailProduct { id: string; productName: string; sellingPrice: number }
interface RetailCartLine { productId: string; productName: string; quantity: number; unitPrice: number }

const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD', 'WALLET', 'CREDIT'] as const

function CheckoutModal({ appt, currSym, onClose, onDone }: {
  appt: Appointment
  currSym: string
  onClose: () => void
  onDone: () => void
}) {
  const { error: toastError, success: toastSuccess } = useNotificationStore()
  const [paymentMethod, setPaymentMethod] = useState<typeof PAYMENT_METHODS[number]>('CASH')
  const [retailQuery, setRetailQuery] = useState('')
  const [retailResults, setRetailResults] = useState<RetailProduct[]>([])
  const [cart, setCart] = useState<RetailCartLine[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!retailQuery.trim()) { setRetailResults([]); return }
    let cancelled = false
    api.products.search(retailQuery).then((res) => {
      if (cancelled) return
      if (res.success && Array.isArray(res.data)) setRetailResults(res.data as RetailProduct[])
    })
    return () => { cancelled = true }
  }, [retailQuery])

  function addProduct(p: RetailProduct) {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === p.id)
      if (existing) return prev.map((l) => (l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l))
      return [...prev, { productId: p.id, productName: p.productName, quantity: 1, unitPrice: p.sellingPrice }]
    })
    setRetailQuery('')
    setRetailResults([])
  }

  function updateQty(productId: string, qty: number) {
    setCart((prev) => prev.map((l) => (l.productId === productId ? { ...l, quantity: qty } : l)))
  }

  function removeLine(productId: string) {
    setCart((prev) => prev.filter((l) => l.productId !== productId))
  }

  const retailTotal = cart.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)
  const grandTotal = appt.totalAmount + retailTotal

  async function handleSubmit() {
    setSaving(true)
    setError('')
    const res = await api.appointments.generateInvoice({
      id: appt.id,
      paymentMethod,
      retailItems: cart.length > 0 ? cart.map((l) => ({ productId: l.productId, quantity: l.quantity })) : undefined,
    })
    setSaving(false)
    if (res.success) {
      toastSuccess('Checked Out', 'Invoice generated successfully.')
      onDone()
    } else {
      const msg = res.error?.message ?? 'Could not complete checkout.'
      setError(msg)
      toastError('Failed', msg)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] overflow-auto">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-dark dark:text-slate-100">Checkout</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{appt.appointmentNumber} · {appt.serviceTitle}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-dark dark:hover:text-slate-100"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="p-3 rounded-xl bg-danger/5 border border-danger/20 text-xs text-danger">{error}</div>}

          <div className="flex justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">Service</span>
            <span className="font-medium text-dark dark:text-slate-100">{currSym}{appt.totalAmount.toLocaleString('en-IN')}</span>
          </div>

          {/* Retail upsell */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Add Retail Product (optional)</label>
            <div className="relative">
              <input
                value={retailQuery}
                onChange={(e) => setRetailQuery(e.target.value)}
                placeholder="Search products to add..."
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 text-dark dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
              {retailResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-48 overflow-auto">
                  {retailResults.map((p) => (
                    <button key={p.id} onClick={() => addProduct(p)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between">
                      <span className="text-dark dark:text-slate-100">{p.productName}</span>
                      <span className="text-xs text-slate-400">{currSym}{p.sellingPrice.toLocaleString('en-IN')}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {cart.length > 0 && (
            <div className="space-y-2">
              {cart.map((l) => (
                <div key={l.productId} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 text-dark dark:text-slate-100 truncate">{l.productName}</span>
                  <input type="number" min={1} value={l.quantity}
                    onChange={(e) => updateQty(l.productId, Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-14 h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 text-center" />
                  <span className="w-16 text-right text-xs text-slate-500 dark:text-slate-400">{currSym}{(l.quantity * l.unitPrice).toLocaleString('en-IN')}</span>
                  <button onClick={() => removeLine(l.productId)} className="text-slate-400 hover:text-danger"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Payment Method</label>
            <div className="flex flex-wrap gap-1.5">
              {PAYMENT_METHODS.map((m) => (
                <button key={m} onClick={() => setPaymentMethod(m)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                    paymentMethod === m ? 'bg-brand text-white border-brand' : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-sm font-semibold">
            <span className="text-dark dark:text-slate-100">Total</span>
            <span className="text-dark dark:text-slate-100">{currSym}{grandTotal.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={handleSubmit}>Complete Checkout</Button>
        </div>
      </div>
    </div>
  )
}
