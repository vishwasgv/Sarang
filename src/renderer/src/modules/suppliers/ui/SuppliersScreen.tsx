import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, Edit, Archive, Truck } from 'lucide-react'
import { DataTable } from '@shared/ui/organisms/DataTable'
import { Button } from '@shared/ui/atoms/Button'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { SupplierFormModal } from './SupplierFormModal'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'

interface Supplier {
  id: string; supplierCode: string; supplierName: string
  phone?: string | null; email?: string | null; city?: string | null; state?: string | null; isActive: boolean
}

export function SuppliersScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<Supplier | null>(null)
  const [archiving, setArchiving] = useState(false)

  const canCreate = hasPermission('suppliers.create')
  const canUpdate = hasPermission('suppliers.update')
  const canArchive = hasPermission('suppliers.archive')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.suppliers.list({ limit: 200 })
      if (res.success) {
        const d = res.data as { suppliers: Supplier[]; total: number }
        setSuppliers(d.suppliers ?? [])
        setTotal(d.total ?? 0)
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  useEffect(() => { loadData() }, [loadData])

  async function handleArchive() {
    if (!archiveTarget) return
    setArchiving(true)
    try {
      const res = await window.api.suppliers.archive(archiveTarget.id)
      if (res.success) {
        toastSuccess(t('suppliers.archiveSupplier'), `${archiveTarget.supplierName}`)
        setArchiveTarget(null)
        loadData()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } finally {
      setArchiving(false)
    }
  }

  const columns: ColumnDef<Supplier, unknown>[] = [
    {
      id: 'name',
      accessorFn: (r) => r.supplierName,
      header: t('suppliers.supplierName'),
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-dark dark:text-slate-100">{row.original.supplierName}</p>
          <p className="text-xs text-slate-400">{row.original.supplierCode}</p>
        </div>
      )
    },
    {
      accessorKey: 'phone',
      header: t('suppliers.phone'),
      cell: ({ getValue }) => <span className="text-sm text-slate-600">{(getValue() as string) || '—'}</span>
    },
    {
      accessorKey: 'email',
      header: t('suppliers.email'),
      cell: ({ getValue }) => <span className="text-sm text-slate-600">{(getValue() as string) || '—'}</span>
    },
    {
      id: 'location',
      header: t('customers.city'),
      cell: ({ row }) => {
        const loc = [row.original.city, row.original.state].filter(Boolean).join(', ')
        return <span className="text-sm text-slate-600">{loc || '—'}</span>
      }
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          {canUpdate && (
            <button onClick={(e) => { e.stopPropagation(); setEditSupplier(row.original); setFormOpen(true) }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-brand hover:bg-brand/10 transition-colors" title="Edit">
              <Edit size={14} />
            </button>
          )}
          {canArchive && (
            <button onClick={(e) => { e.stopPropagation(); setArchiveTarget(row.original) }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/10 transition-colors" title="Archive">
              <Archive size={14} />
            </button>
          )}
        </div>
      )
    }
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
            <Truck size={20} className="text-warning" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark dark:text-slate-100">{t('nav.suppliers')}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{total} {t('nav.suppliers').toLowerCase()}</p>
          </div>
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => { setEditSupplier(null); setFormOpen(true) }}>
            <Plus size={14} className="mr-1.5" /> {t('suppliers.addSupplier')}
          </Button>
        )}
      </div>

      <DataTable
        data={suppliers}
        columns={columns}
        searchPlaceholder={t('suppliers.searchSuppliers')}
        loading={loading}
        emptyMessage={t('suppliers.noSuppliers')}
        onRowClick={(row) => navigate(`/suppliers/${row.id}`)}
      />

      <SupplierFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditSupplier(null) }}
        onSaved={loadData}
        supplier={editSupplier}
      />

      <ConfirmDialog
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchive}
        loading={archiving}
        title={t('suppliers.archiveSupplier')}
        message={`${t('suppliers.archiveSupplier')} "${archiveTarget?.supplierName}"?`}
        confirmLabel={t('suppliers.archiveSupplier')}
      />
    </div>
  )
}
