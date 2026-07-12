import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Activity, RefreshCw, AlertCircle, TrendingDown, Users } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { cn } from '@shared/utils/cn'
import { useBusinessStore } from '@app/store/business.store'
import { useNavigate } from 'react-router-dom'
import { SkeletonCard } from '@shared/ui/Skeleton'
import { Card } from '@shared/ui/molecules/Card'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { useNotificationStore } from '@app/store/notification.store'

interface OutstandingCustomer {
  id: string
  customerName: string
  customerCode?: string | null
  phone?: string | null
  outstandingBalance: number
  creditLimit: number
}

interface AgingBuckets { current: number; days1to30: number; days31to60: number; days61to90: number; days90plus: number }

const ZERO_AGING: AgingBuckets = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0 }

export function OutstandingAnalyticsScreen() {
  const profile = useBusinessStore(s => s.profile)
  const sym = profile?.currencySymbol ?? '₹'
  const navigate = useNavigate()
  const { error: toastError } = useNotificationStore()

  const [customers, setCustomers] = useState<OutstandingCustomer[]>([])
  const [loading, setLoading] = useState(true)
  // Fresh-audit fix (2026-07-12): this screen previously showed only a flat
  // total per customer, no aging — report.service.ts's generateOutstandingReport
  // already computes real current/1-30/31-60/61-90/90+ aging buckets (built
  // for the Reports module's own Outstanding Report), reused here directly
  // rather than duplicating that bucketing logic. Keyed by customerId since
  // the two endpoints return different row shapes (this one adds
  // customerCode/creditLimit that the aging report doesn't have).
  const [agingByCustomer, setAgingByCustomer] = useState<Map<string, AgingBuckets>>(new Map())
  const [agingTotals, setAgingTotals] = useState<AgingBuckets>(ZERO_AGING)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      // Dedicated, unbounded query — customers.list() defaults to the first 50
      // customers (alphabetically), which silently gave an incomplete picture
      // of total credit exposure for any distributor with more than 50 customers.
      const [res, agingRes] = await Promise.all([
        api.customers.listOutstanding(),
        api.reports.outstanding()
      ])
      if (res.success && res.data) {
        setCustomers(res.data as OutstandingCustomer[])
      } else {
        toastError('Failed to Load', (res.error as { message?: string })?.message ?? 'Could not load outstanding balances.')
      }
      // Degrades gracefully if this specific call is denied (a role could
      // hold customers.view without reports.outstanding) — aging is a bonus
      // breakdown, not required for the screen's core function.
      if (agingRes.success && agingRes.data) {
        const report = agingRes.data as { customers: { rows: Array<{ id: string; aging: AgingBuckets }>; agingTotals: AgingBuckets } }
        setAgingByCustomer(new Map(report.customers.rows.map(r => [r.id, r.aging])))
        setAgingTotals(report.customers.agingTotals)
      }
    } catch {
      toastError('Failed to Load', 'Could not load outstanding balances.')
    } finally {
      setLoading(false)
    }
  }

  const totalOutstanding = customers.reduce((s, c) => s + c.outstandingBalance, 0)
  const overLimit = customers.filter(c => c.creditLimit > 0 && c.outstandingBalance > c.creditLimit)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-dark">Outstanding Analytics</h2>
          <p className="text-sm text-slate-400">{customers.length} customers with unpaid balances</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:border-slate-300 transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <KpiCard label="Total Outstanding" value={`${sym}${totalOutstanding.toFixed(0)}`} icon={<Activity size={16} />} color="danger" />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <KpiCard label="Over Credit Limit" value={overLimit.length} icon={<AlertCircle size={16} />} color="warning" />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <KpiCard
            label="Avg. Outstanding"
            value={customers.length > 0 ? `${sym}${(totalOutstanding / customers.length).toFixed(0)}` : `${sym}0`}
            icon={<Users size={16} />}
            color="brand"
          />
        </motion.div>
      </div>

      {/* Aging buckets — how OLD the outstanding money is, not just how much */}
      {(agingTotals.current + agingTotals.days1to30 + agingTotals.days31to60 + agingTotals.days61to90 + agingTotals.days90plus) > 0.01 && (
        <Card padding="none" className="overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800">
            <p className="text-sm font-semibold text-dark dark:text-slate-100">Aging</p>
            <p className="text-xs text-slate-400">How long each rupee has been outstanding, based on invoice due date</p>
          </div>
          <div className="grid grid-cols-5 divide-x divide-slate-100 dark:divide-slate-800">
            {[
              { label: 'Current', value: agingTotals.current, tone: 'text-slate-500 dark:text-slate-400' },
              { label: '1–30 days', value: agingTotals.days1to30, tone: 'text-slate-500 dark:text-slate-400' },
              { label: '31–60 days', value: agingTotals.days31to60, tone: 'text-warning' },
              { label: '61–90 days', value: agingTotals.days61to90, tone: 'text-warning' },
              { label: '90+ days', value: agingTotals.days90plus, tone: 'text-danger' },
            ].map((b) => (
              <div key={b.label} className="px-4 py-3 text-center">
                <p className={cn('text-sm font-semibold', b.tone)}>{sym}{b.value.toFixed(0)}</p>
                <p className="text-xs text-slate-400 mt-0.5">{b.label}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Over limit warning */}
      {overLimit.length > 0 && (
        <div className="bg-danger/5 border border-danger/20 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-danger">
          <AlertCircle size={14} className="shrink-0" />
          {overLimit.length} customer{overLimit.length !== 1 ? 's' : ''} {overLimit.length !== 1 ? 'are' : 'is'} over their credit limit: {overLimit.map(c => c.customerName).join(', ')}
        </div>
      )}

      {/* Customer list */}
      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      ) : customers.length === 0 ? (
        <Card padding="lg" className="text-center py-12">
          <TrendingDown size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No outstanding balances</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">All customers are up to date</p>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-400 uppercase">
            <div className="col-span-3">Customer</div>
            <div className="col-span-2">Code</div>
            <div className="col-span-2">Phone</div>
            <div className="col-span-2 text-right">Credit Limit</div>
            <div className="col-span-2 text-right">Outstanding</div>
            <div className="col-span-1 text-right">90+ Days</div>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {customers.map((c, i) => {
              const isOver = c.creditLimit > 0 && c.outstandingBalance > c.creditLimit
              const pct = c.creditLimit > 0 ? Math.min(100, (c.outstandingBalance / c.creditLimit) * 100) : 0
              const aging = agingByCustomer.get(c.id)
              return (
                <motion.div key={c.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-12 gap-4 px-5 py-3.5 items-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  onClick={() => navigate(`/customers/${c.id}`)}>
                  <div className="col-span-3">
                    <p className={cn('text-sm font-medium', isOver ? 'text-danger' : 'text-dark')}>{c.customerName}</p>
                    {isOver && <p className="text-xs text-danger/70">Over credit limit</p>}
                    {c.creditLimit > 0 && (
                      <div className="mt-1 h-1 bg-slate-100 rounded-full overflow-hidden w-24">
                        <div className={cn('h-full rounded-full', isOver ? 'bg-danger' : pct > 80 ? 'bg-warning' : 'bg-success')}
                          style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="col-span-2 text-xs text-slate-400 dark:text-slate-500">{c.customerCode ?? '—'}</div>
                  <div className="col-span-2 text-xs text-slate-400 dark:text-slate-500">{c.phone ?? '—'}</div>
                  <div className="col-span-2 text-right text-xs text-slate-500 dark:text-slate-400">
                    {c.creditLimit > 0 ? `${sym}${c.creditLimit.toFixed(0)}` : '—'}
                  </div>
                  <div className={cn('col-span-2 text-right text-sm font-semibold', isOver ? 'text-danger' : 'text-dark')}>
                    {sym}{c.outstandingBalance.toFixed(2)}
                  </div>
                  <div className="col-span-1 text-right text-xs font-medium">
                    {aging && aging.days90plus > 0.01 ? (
                      <span className="text-danger">{sym}{aging.days90plus.toFixed(0)}</span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-between text-sm font-semibold">
            <span className="text-slate-500 dark:text-slate-400">Total</span>
            <span className="text-dark dark:text-slate-100">{sym}{totalOutstanding.toFixed(2)}</span>
          </div>
        </Card>
      )}
    </div>
  )
}
