import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Users, Phone, Mail, MapPin, CreditCard, TrendingUp, TrendingDown } from 'lucide-react'
import { useAuthStore } from '@app/store/auth.store'
import { DocumentPanel } from '@renderer/modules/documents/ui/DocumentPanel'
import { formatDate } from '@shared/utils/locale.util'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'

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

export function CustomerDetailScreen() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { hasPermission } = useAuthStore()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [outstanding, setOutstanding] = useState(0)
  const [loading, setLoading] = useState(true)
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ledgerError, setLedgerError] = useState<string | null>(null)

  const canViewLedger = hasPermission('customers.viewLedger')

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
    } finally {
      setLoading(false)
    }
  }, [id])

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

  useEffect(() => {
    loadCustomer()
    loadLedger()
  }, [loadCustomer, loadLedger])

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
          <Badge variant="neutral" size="sm" className="ml-auto">{t('customers.archived')}</Badge>
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
            <span className="ml-auto text-sm font-semibold text-dark dark:text-slate-100">
              {customer.creditLimit > 0 ? customer.creditLimit.toFixed(2) : '—'}
            </span>
          </div>
          {canViewLedger && (
            <div className="flex items-center gap-2">
              {outstanding > 0 ? (
                <TrendingUp size={14} className="text-danger shrink-0" />
              ) : (
                <TrendingDown size={14} className="text-success shrink-0" />
              )}
              <span className="text-sm text-slate-600 dark:text-slate-300">{t('customers.outstanding')}</span>
              <span className={`ml-auto text-sm font-semibold ${outstanding > 0 ? 'text-danger' : 'text-success'}`}>
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
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('common.date')}</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('common.reference')}</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('common.debit')}</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('common.credit')}</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('common.balance')}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(entry.createdAt)}
                      </td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{entry.remarks ?? entry.referenceType}</td>
                      <td className="px-5 py-3 text-right text-danger font-medium">
                        {entry.debitAmount > 0 ? entry.debitAmount.toFixed(2) : '—'}
                      </td>
                      <td className="px-5 py-3 text-right text-success font-medium">
                        {entry.creditAmount > 0 ? entry.creditAmount.toFixed(2) : '—'}
                      </td>
                      <td className={`px-5 py-3 text-right font-semibold ${entry.balance > 0 ? 'text-danger' : entry.balance < 0 ? 'text-success' : 'text-slate-500 dark:text-slate-400'}`}>
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

      {/* Attached documents */}
      {customer && (
        <Card padding="lg">
          <DocumentPanel entityType="CUSTOMER" entityId={customer.id} />
        </Card>
      )}
    </div>
  )
}
