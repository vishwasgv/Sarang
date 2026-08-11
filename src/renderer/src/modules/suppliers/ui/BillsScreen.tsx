import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { Receipt, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { DataTable } from '@shared/ui/organisms/DataTable'
import { Button } from '@shared/ui/atoms/Button'
import { Badge } from '@shared/ui/atoms/Badge'
import { BillFormModal } from './BillFormModal'
import { useAuthStore } from '@app/store/auth.store'
import { useNotificationStore } from '@app/store/notification.store'
import { cn } from '@shared/utils/cn'
import { formatDate } from '@shared/utils/locale.util'
import { formatCurrency } from '@shared/utils/currency.util'

interface Supplier { id: string; supplierName: string; supplierCode: string }
interface Bill {
  id: string
  billNumber: string
  status: string
  billDate: string
  totalAmount: number
  balanceAmount: number
  supplier: Supplier
  items: { id: string }[]
}

const STATUS_VARIANT: Record<string, 'neutral' | 'brand' | 'success' | 'danger' | 'warning'> = {
  OPEN: 'warning',
  PARTIALLY_PAID: 'brand',
  PAID: 'success',
  VOID: 'danger'
}

const BILL_STATUSES = ['ALL', 'OPEN', 'PARTIALLY_PAID', 'PAID', 'VOID']

export function BillsScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { hasPermission } = useAuthStore()
  const { error: toastError } = useNotificationStore()
  const [bills, setBills] = useState<Bill[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [formOpen, setFormOpen] = useState(false)
  const [page, setPage] = useState(1)
  const limit = 20

  const canCreate = hasPermission('bills.create')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.bills.list({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        page,
        limit
      })
      if (res.success) {
        const d = res.data as { bills: Bill[]; total: number }
        setBills(d.bills ?? [])
        setTotal(d.total ?? 0)
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [statusFilter, page, toastError, t])

  useEffect(() => { loadData() }, [loadData])

  function handleStatusFilterChange(s: string) {
    setStatusFilter(s)
    setPage(1)
  }

  const columns: ColumnDef<Bill, unknown>[] = [
    {
      accessorKey: 'billNumber',
      header: () => t('bills.billNumber'),
      cell: ({ row }) => <span className="text-sm font-mono font-medium text-dark dark:text-slate-100">{row.original.billNumber}</span>
    },
    {
      accessorFn: (r) => r.supplier.supplierName,
      id: 'supplier',
      header: () => t('bills.supplierColumn'),
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-medium text-dark dark:text-slate-100">{row.original.supplier.supplierName}</p>
          <p className="text-xs text-slate-400">{row.original.supplier.supplierCode}</p>
        </div>
      )
    },
    {
      id: 'items',
      header: () => t('purchaseOrders.items'),
      cell: ({ row }) => <span className="text-sm text-slate-600">{row.original.items.length} item{row.original.items.length !== 1 ? 's' : ''}</span>
    },
    {
      accessorKey: 'totalAmount',
      header: () => t('common.total'),
      cell: ({ getValue }) => <span className="text-sm font-semibold text-dark dark:text-slate-100">{formatCurrency(getValue() as number)}</span>
    },
    {
      accessorKey: 'balanceAmount',
      header: () => t('bills.balanceDue'),
      cell: ({ row }) => (
        <span className={cn('text-sm font-semibold', row.original.balanceAmount > 0 ? 'text-danger' : 'text-slate-400')}>
          {formatCurrency(row.original.balanceAmount)}
        </span>
      )
    },
    {
      id: 'date',
      header: () => t('common.date'),
      cell: ({ row }) => <span className="text-sm text-slate-500">{formatDate(row.original.billDate)}</span>
    },
    {
      accessorKey: 'status',
      header: () => t('bills.statusColumn'),
      cell: ({ getValue }) => {
        const s = getValue() as string
        return <Badge variant={STATUS_VARIANT[s] ?? 'neutral'} size="sm">{s.replace(/_/g, ' ')}</Badge>
      }
    }
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
            <Receipt size={20} className="text-brand" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark dark:text-slate-100">{t('bills.title')}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('bills.subtitle', { count: total })}</p>
          </div>
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus size={14} className="me-1.5" /> {t('bills.recordBill')}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {BILL_STATUSES.map(s => (
          <button
            key={s}
            onClick={() => handleStatusFilterChange(s)}
            className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors', statusFilter === s ? 'bg-brand text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700')}
          >
            {s === 'ALL' ? t('common.all') : s.replace(/_/g, ' ').charAt(0) + s.replace(/_/g, ' ').slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <DataTable
        data={bills}
        columns={columns}
        searchPlaceholder={`${t('common.search')}…`}
        loading={loading}
        onRowClick={(row) => navigate(`/bills/${row.id}`)}
        emptyMessage={t('bills.noBills')}
      />

      {total > limit && (
        <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <span>{t('audit.page')} {page} {t('audit.of')} {Math.max(1, Math.ceil(total / limit))}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={14} className="me-1" /> {t('inventory.previous')}
            </Button>
            <Button variant="secondary" size="sm" disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)}>
              {t('common.next')} <ChevronRight size={14} className="ms-1" />
            </Button>
          </div>
        </div>
      )}

      <BillFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={(id) => { setFormOpen(false); navigate(`/bills/${id}`) }}
      />
    </div>
  )
}
