import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Users, Phone, Mail, MapPin, CreditCard, TrendingUp, TrendingDown, Percent } from 'lucide-react'
import { useAuthStore } from '@app/store/auth.store'
import { useIndustryStore } from '@app/store/industry.store'
import { useNotificationStore } from '@app/store/notification.store'
import { DocumentPanel } from '@renderer/modules/documents/ui/DocumentPanel'
import { formatDate } from '@shared/utils/locale.util'
import { formatCurrency } from '@shared/utils/currency.util'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { Button } from '@shared/ui/atoms/Button'
import { api } from '@renderer/services/ipc-client'

interface Customer {
  id: string; customerCode: string; customerName: string
  phone?: string | null; email?: string | null
  address?: string | null; city?: string | null; state?: string | null; country?: string | null
  taxNumber?: string | null; creditLimit: number; notes?: string | null; isActive: boolean
}

interface LedgerEntry {
  id: string; createdAt: string; referenceType: string; remarks?: string | null
  debitAmount: number; creditAmount: number; balance: number
}

interface InterestLine { invoiceId: string; invoiceNumber: string; balanceAmount: number; daysOverdue: number; interest: number }
interface InterestPreview { ratePercent: number; type: 'SIMPLE' | 'COMPOUND'; lines: InterestLine[]; totalInterest: number }

// Phase 67 §9.1 — Distributor item 5: risk-scored retailer credit.
interface CreditRisk { riskTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNRATED'; effectiveCreditLimit: number; avgDaysLate: number; currentOverdueCount: number }

export function CustomerDetailScreen() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { hasPermission } = useAuthStore()
  const { isModuleEnabled } = useIndustryStore()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [creditRisk, setCreditRisk] = useState<CreditRisk | null>(null)
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [outstanding, setOutstanding] = useState(0)
  const [loading, setLoading] = useState(true)
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ledgerError, setLedgerError] = useState<string | null>(null)
  const [interest, setInterest] = useState<InterestPreview | null>(null)
  const [interestEnabled, setInterestEnabled] = useState(true)
  const [postingInterest, setPostingInterest] = useState(false)

  const canViewLedger = hasPermission('customers.viewLedger')
  const canViewInterest = hasPermission('creditInterest.view')
  const canPostInterest = hasPermission('creditInterest.post')

  const loadCustomer = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await window.api.customers.get(id)
      if (res.success) {
        setCustomer(res.data as Customer)
      } else {
        setError(res.error?.message ?? t('customers.notFound'))
      }
    } catch {
      // Same class of bug as loadLedger below (see its comment) — a thrown
      // IPC/connection error must not be indistinguishable from "customer
      // genuinely doesn't exist".
      setError(t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [id, t])

  const loadLedger = useCallback(async () => {
    if (!id || !canViewLedger) return
    setLedgerLoading(true)
    setLedgerError(null)
    try {
      const res = await window.api.customers.getLedger(id)
      if (res.success) {
        const d = res.data as { ledger: LedgerEntry[]; outstanding: number }
        setEntries(d.ledger ?? [])
        setOutstanding(d.outstanding ?? 0)
      } else {
        // Was previously silently swallowed — the screen kept showing the
        // last-known (or default ₹0) outstanding balance with no
        // indication the fetch actually failed, a real risk for a credit
        // decision made off this screen.
        setLedgerError(res.error?.message ?? t('common.error'))
      }
    } catch {
      setLedgerError(t('common.error'))
    } finally {
      setLedgerLoading(false)
    }
  }, [id, canViewLedger, t])

  // Phase 62 — Credit Interest. This customer's accrued interest on overdue
  // invoices, read from the real creditInterestService.calculateInterest
  // (not re-derived here) so this can never disagree with the ledger figure
  // that actually gets posted. A CI-001 (feature not enabled in Settings)
  // response means there's nothing to show, not an error — the card simply
  // doesn't render, rather than confusing an owner who hasn't turned this on.
  const loadInterest = useCallback(async () => {
    if (!id || !canViewInterest) return
    try {
      const res = await window.api.creditInterest.calculate({ customerId: id })
      if (res.success) {
        setInterest(res.data as InterestPreview)
        setInterestEnabled(true)
      } else {
        setInterestEnabled(false)
      }
    } catch {
      setInterestEnabled(false)
    }
  }, [id, canViewInterest])

  // Phase 67 §9.1 — Distributor item 5. Same trust tier as the outstanding
  // balance it sits beside (customers.viewLedger) since it's derived from
  // that same payment history. Only meaningful once credit_limit_enforcement
  // is actually on and the customer has a limit to adjust in the first place.
  const loadCreditRisk = useCallback(async () => {
    if (!id || !canViewLedger || !isModuleEnabled('credit_limit_enforcement')) return
    try {
      const res = await api.distributor.getCustomerCreditRisk({ customerId: id })
      if (res.success && res.data) setCreditRisk(res.data as CreditRisk)
    } catch {
      // Non-critical enrichment of the credit limit figure above — must
      // never block the rest of the customer detail screen from rendering.
    }
  }, [id, canViewLedger, isModuleEnabled])

  useEffect(() => {
    loadCustomer()
    loadLedger()
    loadInterest()
    loadCreditRisk()
  }, [loadCustomer, loadLedger, loadInterest, loadCreditRisk])

  async function handlePostInterest() {
    if (!id) return
    setPostingInterest(true)
    try {
      const res = await window.api.creditInterest.post({ customerId: id })
      if (res.success) {
        toastSuccess(t('customers.interestPosted'), '')
        loadInterest()
        loadLedger()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('customers.couldNotPostInterest'))
      }
    } catch {
      toastError(t('common.error'), t('customers.couldNotPostInterest'))
    } finally {
      setPostingInterest(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
        <div className="h-32 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
        <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (error || !customer) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
        <Users size={40} className="text-slate-200 mb-4" />
        <p className="text-slate-500 dark:text-slate-400 text-sm">{error ?? t('customers.notFound')}</p>
        <button onClick={() => navigate('/customers')} className="mt-4 text-brand text-sm font-medium hover:underline">
          {t('customers.backToCustomers')}
        </button>
      </div>
    )
  }

  const location = [customer.city, customer.state, customer.country].filter(Boolean).join(', ')

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Back button + header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/customers')}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
            <Users size={20} className="text-success" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark dark:text-slate-100">{customer.customerName}</h1>
            <p className="text-sm text-slate-400">{customer.customerCode}</p>
          </div>
        </div>
        {!customer.isActive && (
          <Badge variant="neutral" size="sm" className="ms-auto">{t('customers.archived')}</Badge>
        )}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card padding="md" className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('customers.contact')}</p>
          {customer.phone && (
            <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <Phone size={14} className="text-slate-400 shrink-0" />
              <span>{customer.phone}</span>
            </div>
          )}
          {customer.email && (
            <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <Mail size={14} className="text-slate-400 shrink-0" />
              <span>{customer.email}</span>
            </div>
          )}
          {(customer.address || location) && (
            <div className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
              <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
              <div>
                {customer.address && <p>{customer.address}</p>}
                {location && <p className="text-slate-500 dark:text-slate-400">{location}</p>}
              </div>
            </div>
          )}
          {customer.taxNumber && (
            <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <span className="text-xs text-slate-400 font-medium w-14">{t('customers.taxNo')}</span>
              <span>{customer.taxNumber}</span>
            </div>
          )}
          {!customer.phone && !customer.email && !customer.address && (
            <p className="text-sm text-slate-300">{t('customers.noContactDetails')}</p>
          )}
        </Card>

        <Card padding="md" className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('customers.account')}</p>
          <div className="flex items-center gap-2">
            <CreditCard size={14} className="text-slate-400 shrink-0" />
            <span className="text-sm text-slate-600 dark:text-slate-300">{t('customers.creditLimit')}</span>
            <span className="ms-auto text-sm font-semibold text-dark dark:text-slate-100">
              {customer.creditLimit > 0 ? customer.creditLimit.toFixed(2) : '—'}
            </span>
          </div>
          {customer.creditLimit > 0 && creditRisk && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600 dark:text-slate-300 w-auto">{t('customers.creditRisk.effectiveLimit')}</span>
              <Badge
                variant={creditRisk.riskTier === 'HIGH' ? 'danger' : creditRisk.riskTier === 'MEDIUM' ? 'warning' : creditRisk.riskTier === 'LOW' ? 'success' : 'neutral'}
                size="sm"
              >
                {t(`customers.creditRisk.tier.${creditRisk.riskTier}`)}
              </Badge>
              <span className="ms-auto text-sm font-semibold text-dark dark:text-slate-100">
                {creditRisk.effectiveCreditLimit.toFixed(2)}
              </span>
            </div>
          )}
          {canViewLedger && (
            <div className="flex items-center gap-2">
              {outstanding > 0 ? (
                <TrendingUp size={14} className="text-danger shrink-0" />
              ) : (
                <TrendingDown size={14} className="text-success shrink-0" />
              )}
              <span className="text-sm text-slate-600 dark:text-slate-300">{t('customers.outstanding')}</span>
              <span className={`ms-auto text-sm font-semibold ${outstanding > 0 ? 'text-danger' : 'text-success'}`}>
                {outstanding.toFixed(2)}
              </span>
            </div>
          )}
          {customer.notes && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-400 mb-1">{t('common.notes')}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{customer.notes}</p>
            </div>
          )}
        </Card>
      </div>

      {/* Ledger */}
      {canViewLedger && (
        <Card padding="none">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-dark dark:text-slate-100">{t('customers.transactionLedger')}</p>
              <p className="text-xs text-slate-400 mt-0.5">{t('customers.last100Entries')}</p>
            </div>
            {outstanding !== 0 && (
              <div className={`text-sm font-bold px-3 py-1 rounded-lg ${outstanding > 0 ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
                {outstanding > 0 ? t('customers.owes') : t('customers.advance')}: {Math.abs(outstanding).toFixed(2)}
              </div>
            )}
          </div>

          {ledgerLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              ))}
            </div>
          ) : ledgerError ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <p className="text-sm text-danger">{ledgerError}</p>
              <button onClick={loadLedger} className="text-sm text-brand hover:underline">{t('common.refresh')}</button>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-sm text-slate-400">{t('customers.noTransactions')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                    <th className="px-5 py-3 text-start text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('common.date')}</th>
                    <th className="px-5 py-3 text-start text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('common.reference')}</th>
                    <th className="px-5 py-3 text-end text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('common.debit')}</th>
                    <th className="px-5 py-3 text-end text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('common.credit')}</th>
                    <th className="px-5 py-3 text-end text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('common.balance')}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(entry.createdAt)}
                      </td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{entry.remarks ?? entry.referenceType}</td>
                      <td className="px-5 py-3 text-end text-danger font-medium">
                        {entry.debitAmount > 0 ? entry.debitAmount.toFixed(2) : '—'}
                      </td>
                      <td className="px-5 py-3 text-end text-success font-medium">
                        {entry.creditAmount > 0 ? entry.creditAmount.toFixed(2) : '—'}
                      </td>
                      <td className={`px-5 py-3 text-end font-semibold ${entry.balance > 0 ? 'text-danger' : entry.balance < 0 ? 'text-success' : 'text-slate-500 dark:text-slate-400'}`}>
                        {entry.balance.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Credit Interest — Phase 62 */}
      {canViewInterest && interestEnabled && interest && (
        <Card padding="lg" className="space-y-3">
          <div className="flex items-center gap-2">
            <Percent size={16} className="text-brand" />
            <p className="text-sm font-semibold text-dark dark:text-slate-100">{t('customers.creditInterestTitle')}</p>
          </div>
          {interest.totalInterest > 0 ? (
            <>
              <p className="text-xs text-slate-400">
                {t('customers.interestAccrued', { type: interest.type === 'SIMPLE' ? t('customers.interestSimple') : t('customers.interestCompound'), rate: interest.ratePercent })}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-danger">{formatCurrency(interest.totalInterest)}</span>
                {canPostInterest && (
                  <Button size="sm" onClick={handlePostInterest} loading={postingInterest}>{t('customers.postInterestCharge')}</Button>
                )}
              </div>
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                {interest.lines.map((line) => (
                  <div key={line.invoiceId} className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">{line.invoiceNumber} — {t('customers.daysOverdue', { count: line.daysOverdue })}</span>
                    <span className="font-medium text-dark dark:text-slate-100">{formatCurrency(line.interest)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400">{t('customers.noInterestAccrued')}</p>
          )}
        </Card>
      )}

      {/* Attached documents */}
      {customer && (
        <Card padding="lg">
          <DocumentPanel entityType="CUSTOMER" entityId={customer.id} />
        </Card>
      )}
    </div>
  )
}
