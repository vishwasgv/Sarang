import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sprout, Wrench, AlertTriangle, PackageX, ShieldAlert, ArrowRight, Boxes, CalendarClock, Send } from 'lucide-react'
import { Card } from '@shared/ui/molecules/Card'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { Badge } from '@shared/ui/atoms/Badge'
import { formatDate } from '@shared/utils/locale.util'
import { useNotificationStore } from '@app/store/notification.store'

interface BatchAlertRow {
  id: string; productName: string; batchNumber: string; expiryDate: string; quantityRemaining: number; daysToExpiry: number
}
interface SerialRow {
  id: string; productName: string; serialNumber: string; status: string; warrantyExpiryDate: string | null
}
// Phase 67 §9.1 — Agri Inputs item 5: equipment AMC/service reminders.
interface EquipmentDueForServiceRow {
  serialId: string; productName: string; serialNumber: string
  nextServiceDueDate: string; lastServicedDate: string | null
  dueForService: boolean; overdue: boolean
}

// Phase 58 §2 — Agri Inputs' combined consumables (batch/expiry) + equipment
// (serial/warranty) view. This vertical is the only one with both
// batch_tracking AND serial_tracking on by default — a fertilizer/seed shop
// that also sells sprayers/tractors had to check two completely unrelated
// screens (Batch Tracking, Serial Tracking) with no single "what needs my
// attention today" view across both product families.
export function AgriInputsDashboardScreen() {
  const navigate = useNavigate()
  const { error: toastError } = useNotificationStore()
  const [loading, setLoading] = useState(true)
  const [expiring, setExpiring] = useState<BatchAlertRow[]>([])
  const [expired, setExpired] = useState<BatchAlertRow[]>([])
  const [lowStockCount, setLowStockCount] = useState(0)
  const [serials, setSerials] = useState<SerialRow[]>([])
  const [serviceDue, setServiceDue] = useState<EquipmentDueForServiceRow[]>([])
  const [setServiceForId, setSetServiceForId] = useState('')
  const [setServiceDate, setSetServiceDate] = useState('')

  async function loadServiceDue() {
    const res = await window.api.serials.dueForService()
    if (res.success) setServiceDue((res.data as EquipmentDueForServiceRow[]) ?? [])
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      window.api.batches.expiryAlerts({ withinDays: 30 }),
      window.api.inventory.list({ lowStockOnly: true, limit: 1 }),
      window.api.serials.list({ limit: 500 }),
      window.api.serials.dueForService()
    ]).then(([alertsRes, lowStockRes, serialsRes, dueRes]) => {
      if (alertsRes.success && alertsRes.data) {
        const d = alertsRes.data as { expiring: BatchAlertRow[]; expired: BatchAlertRow[] }
        setExpiring(d.expiring ?? [])
        setExpired(d.expired ?? [])
      } else if (!alertsRes.success) {
        toastError('Error', alertsRes.error?.message ?? 'Could not load expiry alerts.')
      }
      if (lowStockRes.success && lowStockRes.data) {
        setLowStockCount((lowStockRes.data as { total: number }).total ?? 0)
      } else if (!lowStockRes.success) {
        toastError('Error', lowStockRes.error?.message ?? 'Could not load low-stock count.')
      }
      if (serialsRes.success && serialsRes.data) {
        setSerials((serialsRes.data as { serials: SerialRow[] }).serials ?? [])
      } else if (!serialsRes.success) {
        toastError('Error', serialsRes.error?.message ?? 'Could not load equipment records.')
      }
      if (dueRes.success) setServiceDue((dueRes.data as EquipmentDueForServiceRow[]) ?? [])
    }).catch(() => {
      // This is an alerting dashboard (expiring stock/warranties) — a thrown
      // IPC/connection error must not silently render as "nothing needs your
      // attention" (all-zero KPIs), which is what happened before this catch existed.
      toastError('Error', 'Could not load the dashboard. Check your connection and try again.')
    }).finally(() => setLoading(false))
  }, [toastError])

  async function handleSetServiceDate() {
    if (!setServiceForId || !setServiceDate) { toastError('Error', 'Pick equipment and a date.'); return }
    const res = await window.api.serials.updateServiceInfo({ id: setServiceForId, nextServiceDueDate: setServiceDate })
    if (!res.success) { toastError('Error', res.error?.message ?? 'Could not save the service date.'); return }
    setSetServiceForId(''); setSetServiceDate('')
    await loadServiceDue()
  }

  async function handleSendReminder(serialId: string) {
    const res = await window.api.serials.scheduleServiceReminder({ serialId })
    if (!res.success) { toastError('Error', res.error?.message ?? 'Could not schedule the reminder.'); return }
  }

  const now = Date.now()
  const warrantyExpiringSoon = serials.filter(s => {
    if (!s.warrantyExpiryDate) return false
    const days = (new Date(s.warrantyExpiryDate).getTime() - now) / 86400000
    return days >= 0 && days <= 30
  })
  const warrantyExpired = serials.filter(s => s.warrantyExpiryDate && new Date(s.warrantyExpiryDate).getTime() < now)

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-brand/10 flex items-center justify-center">
          <Sprout size={22} className="text-brand" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-dark dark:text-slate-100">Agri Inputs Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Consumables and equipment, at a glance</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Low Stock Consumables" value={loading ? '—' : lowStockCount} icon={<PackageX size={18} />} color={lowStockCount > 0 ? 'warning' : 'neutral'} />
        <KpiCard label="Expiring in 30 Days" value={loading ? '—' : expiring.length} icon={<AlertTriangle size={18} />} color={expiring.length > 0 ? 'warning' : 'neutral'} />
        <KpiCard label="Expired Consumables" value={loading ? '—' : expired.length} icon={<PackageX size={18} />} color={expired.length > 0 ? 'danger' : 'neutral'} />
        <KpiCard label="Equipment on File" value={loading ? '—' : serials.length} icon={<Wrench size={18} />} color="brand" />
        <KpiCard label="Warranty Expiring Soon" value={loading ? '—' : warrantyExpiringSoon.length} icon={<ShieldAlert size={18} />} color={warrantyExpiringSoon.length > 0 ? 'warning' : 'neutral'} />
      </div>

      {/* Phase 67 §9.1 — Agri Inputs item 5: equipment AMC/service reminders. */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard
          label="Overdue for Service"
          value={loading ? '—' : serviceDue.filter(s => s.overdue).length}
          icon={<CalendarClock size={18} />}
          color={serviceDue.some(s => s.overdue) ? 'danger' : 'neutral'}
        />
        <KpiCard
          label="Due for Service Soon"
          value={loading ? '—' : serviceDue.filter(s => s.dueForService && !s.overdue).length}
          icon={<CalendarClock size={18} />}
          color={serviceDue.some(s => s.dueForService && !s.overdue) ? 'warning' : 'neutral'}
        />
      </div>

      <Card padding="md" className="space-y-3">
        <h2 className="text-sm font-bold text-dark dark:text-slate-100 flex items-center gap-2"><CalendarClock size={16} /> Equipment Service Due</h2>
        {loading && <p className="text-xs text-slate-400">Loading…</p>}
        {!loading && serviceDue.length === 0 && (
          <p className="text-xs text-slate-400">No equipment has an upcoming service date set.</p>
        )}
        {serviceDue.map(s => (
          <div key={s.serialId} className="flex items-center justify-between text-xs border-b border-slate-50 dark:border-slate-800 pb-1.5">
            <div>
              <p className="font-medium text-dark dark:text-slate-100">{s.productName}</p>
              <p className="text-slate-400 font-mono">{s.serialNumber} · next service {formatDate(new Date(s.nextServiceDueDate))}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={s.overdue ? 'danger' : 'warning'} size="sm">{s.overdue ? 'Overdue' : 'Due soon'}</Badge>
              <button
                onClick={() => handleSendReminder(s.serialId)}
                className="text-brand hover:underline flex items-center gap-1"
                title="Send a WhatsApp reminder to the customer"
              >
                <Send size={12} /> Remind
              </button>
            </div>
          </div>
        ))}

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-500 mb-1.5">Set a Service Date</p>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={setServiceForId}
              onChange={e => setSetServiceForId(e.target.value)}
              className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">Select equipment</option>
              {serials.map(s => (
                <option key={s.id} value={s.id}>{s.productName} — {s.serialNumber}</option>
              ))}
            </select>
            <input
              type="date" value={setServiceDate}
              onChange={e => setSetServiceDate(e.target.value)}
              className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <button
              onClick={handleSetServiceDate}
              className="h-8 px-3 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-dark"
            >
              Save
            </button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Consumables panel */}
        <Card padding="md" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-dark dark:text-slate-100 flex items-center gap-2"><Boxes size={16} /> Consumables</h2>
            <button onClick={() => navigate('/pharmacy/batches')} className="text-xs text-brand flex items-center gap-1 hover:underline">
              View all <ArrowRight size={12} />
            </button>
          </div>
          {loading && <p className="text-xs text-slate-400">Loading…</p>}
          {!loading && expired.length === 0 && expiring.length === 0 && (
            <p className="text-xs text-slate-400">No expiring or expired batches right now.</p>
          )}
          {expired.slice(0, 3).map(b => (
            <div key={b.id} className="flex items-center justify-between text-xs border-b border-slate-50 dark:border-slate-800 pb-1.5">
              <div>
                <p className="font-medium text-dark dark:text-slate-100">{b.productName}</p>
                <p className="text-slate-400 font-mono">{b.batchNumber} · {b.quantityRemaining} left</p>
              </div>
              <Badge variant="danger" size="sm">Expired {formatDate(new Date(b.expiryDate))}</Badge>
            </div>
          ))}
          {expiring.slice(0, 5).map(b => (
            <div key={b.id} className="flex items-center justify-between text-xs border-b border-slate-50 dark:border-slate-800 pb-1.5">
              <div>
                <p className="font-medium text-dark dark:text-slate-100">{b.productName}</p>
                <p className="text-slate-400 font-mono">{b.batchNumber} · {b.quantityRemaining} left</p>
              </div>
              <Badge variant="warning" size="sm">{b.daysToExpiry}d left</Badge>
            </div>
          ))}
        </Card>

        {/* Equipment panel */}
        <Card padding="md" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-dark dark:text-slate-100 flex items-center gap-2"><Wrench size={16} /> Equipment</h2>
            <button onClick={() => navigate('/electronics/serials')} className="text-xs text-brand flex items-center gap-1 hover:underline">
              View all <ArrowRight size={12} />
            </button>
          </div>
          {loading && <p className="text-xs text-slate-400">Loading…</p>}
          {!loading && warrantyExpired.length === 0 && warrantyExpiringSoon.length === 0 && (
            <p className="text-xs text-slate-400">No warranty items expiring soon.</p>
          )}
          {warrantyExpired.slice(0, 3).map(s => (
            <div key={s.id} className="flex items-center justify-between text-xs border-b border-slate-50 dark:border-slate-800 pb-1.5">
              <div>
                <p className="font-medium text-dark dark:text-slate-100">{s.productName}</p>
                <p className="text-slate-400 font-mono">{s.serialNumber}</p>
              </div>
              <Badge variant="danger" size="sm">Warranty expired</Badge>
            </div>
          ))}
          {warrantyExpiringSoon.slice(0, 5).map(s => (
            <div key={s.id} className="flex items-center justify-between text-xs border-b border-slate-50 dark:border-slate-800 pb-1.5">
              <div>
                <p className="font-medium text-dark dark:text-slate-100">{s.productName}</p>
                <p className="text-slate-400 font-mono">{s.serialNumber}</p>
              </div>
              <Badge variant="warning" size="sm">{formatDate(new Date(s.warrantyExpiryDate as string))}</Badge>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
