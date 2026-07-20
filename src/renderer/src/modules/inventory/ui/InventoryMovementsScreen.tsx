import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowLeft, Package, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DataTable } from '@shared/ui/organisms/DataTable'
import { Button } from '@shared/ui/atoms/Button'
import { Badge } from '@shared/ui/atoms/Badge'
import { useNotificationStore } from '@app/store/notification.store'
import { cn } from '@shared/utils/cn'
import { formatDate, formatTime } from '@shared/utils/locale.util'

interface Movement {
  id: string
  productId: string
  movementType: string
  quantity: number
  referenceType?: string | null
  referenceId?: string | null
  remarks?: string | null
  createdAt: string
  product: { id: string; productName: string; sku?: string | null; unit: string }
  createdBy?: { id: string; fullName: string } | null
}

// Kept in sync with every movementType string actually written across the app:
// inventory.service.ts (ADDITION/SALE/ADJUSTMENT/PURCHASE/DAMAGE), billing.service.ts
// (RETURN), dispatch.service.ts (DISPATCH_OUT), production-order.service.ts
// (PRODUCTION_IN), returns.service.ts (RETURN_IN), import.service.ts (ADDITION).
const MOVEMENT_TYPES = ['ALL', 'ADDITION', 'SALE', 'PURCHASE', 'ADJUSTMENT', 'DAMAGE', 'RETURN', 'RETURN_IN', 'DISPATCH_OUT', 'PRODUCTION_IN']

const MOVEMENT_LABELS: Record<string, string> = {
  ADDITION: 'Stock Added',
  SALE: 'Sale',
  PURCHASE: 'PO Received',
  ADJUSTMENT: 'Adjustment',
  DAMAGE: 'Damage / Breakage',
  RETURN: 'Sale Return',
  RETURN_IN: 'Return Received',
  DISPATCH_OUT: 'Dispatched',
  PRODUCTION_IN: 'Produced'
}

const MOVEMENT_VARIANT: Record<string, 'success' | 'info' | 'brand' | 'warning' | 'danger'> = {
  ADDITION: 'success',
  SALE: 'info',
  PURCHASE: 'brand',
  ADJUSTMENT: 'warning',
  DAMAGE: 'danger',
  RETURN: 'success',
  RETURN_IN: 'success',
  DISPATCH_OUT: 'danger',
  PRODUCTION_IN: 'brand'
}

function MovementTypeBadge({ type }: { type: string }) {
  const label = MOVEMENT_LABELS[type] ?? type
  return (
    <Badge variant={MOVEMENT_VARIANT[type] ?? 'neutral'} size="sm">
      {label}
    </Badge>
  )
}

function MovementIcon({ quantity }: { quantity: number }) {
  if (quantity > 0) return <TrendingUp size={14} className="text-success shrink-0" />
  if (quantity < 0) return <TrendingDown size={14} className="text-danger shrink-0" />
  return <RefreshCw size={14} className="text-warning shrink-0" />
}

export function InventoryMovementsScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { error: toastError } = useNotificationStore()
  const [movements, setMovements] = useState<Movement[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const limit = 50

  const productId = searchParams.get('productId') ?? undefined

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.inventory.getMovements({
        productId,
        movementType: typeFilter === 'ALL' ? undefined : typeFilter,
        page,
        limit
      })
      if (res.success) {
        const d = res.data as { movements: Movement[]; total: number }
        setMovements(d.movements ?? [])
        setTotal(d.total ?? 0)
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [productId, typeFilter, page, toastError, t])

  useEffect(() => { loadData() }, [loadData])

  function handleTypeFilterChange(type: string) {
    // Reset page in the same batch as the filter change, not via a separate
    // effect — two effects firing in sequence would fetch once with the old
    // page + new filter (often an out-of-range/empty page), then again once
    // page resets.
    setTypeFilter(type)
    setPage(1)
  }

  const columns: ColumnDef<Movement, unknown>[] = [
    {
      id: 'date',
      header: () => t('common.date'),
      cell: ({ row }) => (
        <span className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {formatDate(row.original.createdAt)}
          <span className="block text-xs text-slate-400">
            {formatTime(row.original.createdAt)}
          </span>
        </span>
      )
    },
    {
      accessorFn: (r) => r.product.productName,
      id: 'product',
      header: () => t('billing.product'),
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-medium text-dark dark:text-slate-100">{row.original.product.productName}</p>
          {row.original.product.sku && <p className="text-xs text-slate-400 mt-0.5">SKU: {row.original.product.sku}</p>}
        </div>
      )
    },
    {
      accessorKey: 'movementType',
      header: () => t('inventory.movementType'),
      cell: ({ getValue }) => <MovementTypeBadge type={getValue() as string} />
    },
    {
      accessorKey: 'quantity',
      header: () => t('inventory.qtyChange'),
      cell: ({ row }) => {
        const { quantity, product } = row.original
        return (
          <div className="flex items-center gap-1.5">
            <MovementIcon quantity={quantity} />
            <span className={cn('text-sm font-semibold', quantity > 0 ? 'text-success' : quantity < 0 ? 'text-danger' : 'text-warning')}>
              {quantity > 0 ? '+' : ''}{quantity} {product.unit}
            </span>
          </div>
        )
      }
    },
    {
      accessorKey: 'remarks',
      header: () => t('expenses.remarks'),
      cell: ({ getValue }) => {
        const v = getValue() as string | null
        return <span className="text-sm text-slate-600 dark:text-slate-300">{v ?? '—'}</span>
      }
    },
    {
      id: 'by',
      header: () => t('inventory.by'),
      cell: ({ row }) => (
        <span className="text-sm text-slate-500 dark:text-slate-400">{row.original.createdBy?.fullName ?? t('audit.system')}</span>
      )
    }
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/inventory')}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
            <Package size={20} className="text-brand" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark dark:text-slate-100">{t('inventory.movementsTitle')}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{total} {t('inventory.records')} ({t('inventory.readOnly')})</p>
          </div>
        </div>
      </div>

      {/* Type filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {MOVEMENT_TYPES.map(type => (
          <button
            key={type}
            onClick={() => handleTypeFilterChange(type)}
            className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors', typeFilter === type ? 'bg-brand text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700')}
          >
            {type === 'ALL' ? t('inventory.allTypes') : (MOVEMENT_LABELS[type] ?? type)}
          </button>
        ))}
      </div>

      <DataTable
        data={movements}
        columns={columns}
        searchPlaceholder={`${t('common.search')}…`}
        loading={loading}
        emptyMessage={t('inventory.noMovements')}
        virtualize={movements.length > 100}
      />

      {total > limit && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-slate-500 dark:text-slate-400">{t('audit.page')} {page} {t('audit.of')} {Math.ceil(total / limit)}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>{t('inventory.previous')}</Button>
            <Button variant="secondary" size="sm" disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)}>{t('common.next')}</Button>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400 text-center pb-2">
        {t('inventory.immutableNote')}
      </p>
    </div>
  )
}
