import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { ClipboardList, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DataTable } from '@shared/ui/organisms/DataTable'
import { Button } from '@shared/ui/atoms/Button'
import { Badge } from '@shared/ui/atoms/Badge'
import { PurchaseOrderFormModal } from './PurchaseOrderFormModal'
import { useAuthStore } from '@app/store/auth.store'
import { useNotificationStore } from '@app/store/notification.store'
import { cn } from '@shared/utils/cn'
import { formatDate } from '@shared/utils/locale.util'

interface Supplier { id: string; supplierName: string; supplierCode: string }
interface PO {
  id: string
  poNumber: string
  status: string
  orderDate: string
  totalAmount: number
  subtotal: number
  taxAmount: number
  notes?: string | null
  supplier: Supplier
  items: { id: string; quantity: number }[]
}

const STATUS_VARIANT: Record<string, 'neutral' | 'brand' | 'success' | 'danger' | 'warning'> = {
  DRAFT: 'neutral',
  APPROVED: 'brand',
  PARTIAL_RECEIVED: 'warning',
  RECEIVED: 'success',
  CANCELLED: 'danger'
}

const PO_STATUSES = ['ALL', 'DRAFT', 'APPROVED', 'PARTIAL_RECEIVED', 'RECEIVED', 'CANCELLED']

export function PurchaseOrdersScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { hasPermission } = useAuthStore()
  const { error: toastError } = useNotificationStore()
  const [orders, setOrders] = useState<PO[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [formOpen, setFormOpen] = useState(false)
  const [page, setPage] = useState(1)
  const limit = 20

  const canCreate = hasPermission('purchaseOrders.create')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.purchaseOrders.list({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        page,
        limit
      })
      if (res.success) {
        const d = res.data as { orders: PO[]; total: number }
        setOrders(d.orders ?? [])
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
    // Reset page alongside the filter change in the same batch, rather than via
    // a separate effect — two effects firing in sequence would fetch once with
    // the old page + new filter (wrong/empty page), then again once page resets.
    setStatusFilter(s)
    setPage(1)
  }

  const columns: ColumnDef<PO, unknown>[] = [
    {
      accessorKey: 'poNumber',
      header: () => t('purchaseOrders.poNumber'),
      cell: ({ row }) => (
        <span className="text-sm font-mono font-medium text-dark dark:text-slate-100">{row.original.poNumber}</span>
      )
    },
    {
      accessorFn: (r) => r.supplier.supplierName,
      id: 'supplier',
      header: () => t('purchaseOrders.supplier'),
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
      cell: ({ row }) => (
        <span className="text-sm text-slate-600">{row.original.items.length} item{row.original.items.length !== 1 ? 's' : ''}</span>
      )
    },
    {
      accessorKey: 'totalAmount',
      header: () => t('common.total'),
      cell: ({ getValue }) => (
        <span className="text-sm font-semibold text-dark dark:text-slate-100">{(getValue() as number).toFixed(2)}</span>
      )
    },
    {
      id: 'date',
      header: () => t('common.date'),
      cell: ({ row }) => (
        <span className="text-sm text-slate-500">
          {formatDate(row.original.orderDate)}
        </span>
      )
    },
    {
      accessorKey: 'status',
      header: () => t('common.status'),
      cell: ({ getValue }) => {
        const s = getValue() as string
        return (
          <Badge variant={STATUS_VARIANT[s] ?? 'neutral'} size="sm">
            {s.replace(/_/g, ' ')}
          </Badge>
        )
      }
    }
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
            <ClipboardList size={20} className="text-brand" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark dark:text-slate-100">{t('purchaseOrders.title')}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{total} {t('purchaseOrders.orders')}</p>
          </div>
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus size={14} className="mr-1.5" /> {t('purchaseOrders.newPO')}
          </Button>
        )}
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {PO_STATUSES.map(s => (
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
        data={orders}
        columns={columns}
        searchPlaceholder={`${t('common.search')}…`}
        loading={loading}
        onRowClick={(row) => navigate(`/purchase-orders/${row.id}`)}
        emptyMessage={t('purchaseOrders.noOrders')}
      />

      {total > limit && (
        <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <span>{t('audit.page')} {page} {t('audit.of')} {Math.max(1, Math.ceil(total / limit))}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={14} className="mr-1" /> {t('inventory.previous')}
            </Button>
            <Button variant="secondary" size="sm" disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)}>
              {t('common.next')} <ChevronRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      )}

      <PurchaseOrderFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={(id) => { setFormOpen(false); navigate(`/purchase-orders/${id}`) }}
      />
    </div>
  )
}
