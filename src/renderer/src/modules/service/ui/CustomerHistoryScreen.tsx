import React, { useEffect, useState, useCallback } from 'react'
import { Users, RefreshCw, ChevronDown, ChevronUp, Receipt, Briefcase, Headphones, Wrench, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@renderer/services/ipc-client'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDate } from '@shared/utils/locale.util'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { useNotificationStore } from '@app/store/notification.store'

interface Customer { id: string; customerName: string; phone: string | null; email: string | null; outstandingBalance: number }
interface Project { id: string; projectNumber: string; title: string; status: string; createdAt: string; estimatedAmount: number }
interface Ticket { id: string; ticketNumber: string; title: string; status: string; priority: string; createdAt: string }
interface JobCard { id: string; jobNumber: string; title: string; status: string; estimatedCost: number; actualCost: number; createdAt: string }
interface Invoice { id: string; invoiceNumber: string; totalAmount: number; status: string; paymentStatus: string; createdAt: string }

// This single pill renders 4 different entities' status fields (Project.status,
// ServiceTicket.status, JobCard.status, Invoice.paymentStatus) side by side, so
// the map must be exhaustive over the union of all 4 real value sets, verified
// against project.service.ts, service-ticket.service.ts, job-card.service.ts,
// and payment.service.ts/billing.service.ts (not just this screen's own types).
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  OPEN: 'info', IN_PROGRESS: 'warning', ON_HOLD: 'neutral', COMPLETED: 'success', CANCELLED: 'danger',
  RESOLVED: 'success', CLOSED: 'neutral',
  RECEIVED: 'info', DIAGNOSING: 'warning', IN_REPAIR: 'warning', PENDING_PARTS: 'warning', READY: 'success', DELIVERED: 'neutral',
  PAID: 'success', UNPAID: 'danger', PARTIAL: 'warning'
}

export function CustomerHistoryScreen() {
  const { t } = useTranslation()
  const { error: toastError } = useNotificationStore()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [history, setHistory] = useState<Record<string, { projects: Project[]; tickets: Ticket[]; jobCards: JobCard[]; invoices: Invoice[]; loading: boolean }>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.customers.list({ limit: 500 })
      if (res.success && res.data) {
        const d = res.data as { customers: Customer[] }
        setCustomers(d.customers ?? [])
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  useEffect(() => { load() }, [load])

  async function loadCustomerHistory(customerId: string) {
    setHistory(prev => ({ ...prev, [customerId]: { projects: [], tickets: [], jobCards: [], invoices: [], loading: true } }))

    try {
      const [pRes, tRes, jRes, iRes] = await Promise.all([
        api.projects.list({ customerId, limit: 50 }),
        api.tickets.list({ customerId, limit: 50 }),
        api.jobCards.list({ customerId, limit: 50 }),
        api.billing.listInvoices({ customerId, limit: 50 })
      ])

      setHistory(prev => ({
        ...prev,
        [customerId]: {
          loading: false,
          projects: pRes.success && pRes.data ? ((pRes.data as any).projects ?? []) : [],
          tickets: tRes.success && tRes.data ? ((tRes.data as any).tickets ?? []) : [],
          jobCards: jRes.success && jRes.data ? ((jRes.data as any).jobCards ?? []) : [],
          invoices: iRes.success && iRes.data ? ((iRes.data as any).invoices ?? []) : []
        }
      }))
    } catch {
      toastError(t('common.error'), t('common.error'))
      setHistory(prev => ({ ...prev, [customerId]: { projects: [], tickets: [], jobCards: [], invoices: [], loading: false } }))
    }
  }

  function toggleCustomer(customerId: string) {
    if (expanded === customerId) {
      setExpanded(null)
    } else {
      setExpanded(customerId)
      if (!history[customerId]) loadCustomerHistory(customerId)
    }
  }

  const filtered = search.trim()
    ? customers.filter(c => c.customerName.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search))
    : customers

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <Users size={24} className="text-brand" />
              {t('service.customerHistory')}
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">{t('service.customerHistorySubtitle')}</p>
          </div>
          <button onClick={load} className="h-11 w-11 flex items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-surface-hover transition-colors">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('service.searchByNamePhone')}
          className="mt-4 w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand bg-white dark:bg-slate-900" />
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
            <Users size={40} className="mb-3 opacity-30" />
            <p className="text-base font-medium">{t('service.noCustomersFound')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(customer => {
              const isOpen = expanded === customer.id
              const ch = history[customer.id]

              return (
                <Card key={customer.id} padding="none" className="overflow-hidden">
                  <button onClick={() => toggleCustomer(customer.id)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-surface-hover/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-text-primary">{customer.customerName}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {customer.phone && <span className="text-xs text-text-secondary">{customer.phone}</span>}
                        {customer.outstandingBalance > 0 && (
                          <span className="text-xs font-semibold text-red-600">{formatCurrency(customer.outstandingBalance)} {t('service.outstandingBalance')}</span>
                        )}
                      </div>
                    </div>
                    {isOpen ? <ChevronUp size={16} className="text-text-secondary shrink-0" /> : <ChevronDown size={16} className="text-text-secondary shrink-0" />}
                  </button>

                  {isOpen && (
                    <div className="border-t border-border">
                      {ch?.loading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : (
                        <div className="p-4 space-y-4">
                          <HistorySection
                            icon={<Receipt size={14} />}
                            label={t('service.invoicesLabel')}
                            count={ch?.invoices.length ?? 0}
                            items={ch?.invoices.map(inv => ({
                              key: inv.id,
                              ref: inv.invoiceNumber,
                              title: formatCurrency(inv.totalAmount),
                              status: inv.paymentStatus,
                              date: inv.createdAt
                            })) ?? []}
                          />
                          <HistorySection
                            icon={<Briefcase size={14} />}
                            label={t('service.projects')}
                            count={ch?.projects.length ?? 0}
                            items={ch?.projects.map(p => ({
                              key: p.id, ref: p.projectNumber, title: p.title, status: p.status, date: p.createdAt
                            })) ?? []}
                          />
                          <HistorySection
                            icon={<Headphones size={14} />}
                            label={t('service.serviceTicketsLabel')}
                            count={ch?.tickets.length ?? 0}
                            items={ch?.tickets.map(t => ({
                              key: t.id, ref: t.ticketNumber, title: t.title, status: t.status, date: t.createdAt
                            })) ?? []}
                          />
                          <HistorySection
                            icon={<Wrench size={14} />}
                            label={t('service.jobCardsLabel')}
                            count={ch?.jobCards.length ?? 0}
                            items={ch?.jobCards.map(j => ({
                              key: j.id, ref: j.jobNumber, title: j.title, status: j.status, date: j.createdAt
                            })) ?? []}
                          />

                          {!ch?.projects.length && !ch?.tickets.length && !ch?.jobCards.length && !ch?.invoices.length && (
                            <div className="flex items-center gap-2 py-4 text-text-secondary text-sm">
                              <Clock size={14} />
                              <span>{t('service.noActivity')}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

interface HistoryItem { key: string; ref: string; title: string; status: string; date: string }

function HistorySection({ icon, label, count, items }: { icon: React.ReactNode; label: string; count: number; items: HistoryItem[] }) {
  if (count === 0) return null
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary uppercase mb-2">
        {icon} {label} ({count})
      </div>
      <div className="space-y-1.5">
        {items.map(item => (
          <div key={item.key} className="flex items-center gap-3 text-sm">
            <span className="font-mono text-xs text-text-secondary shrink-0">{item.ref}</span>
            <span className="flex-1 text-text-primary truncate">{item.title}</span>
            <Badge variant={STATUS_VARIANT[item.status] ?? 'neutral'} size="sm" className="shrink-0">
              {item.status}
            </Badge>
            <span className="text-xs text-text-secondary shrink-0">{formatDate(item.date)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
