import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, Edit, Archive, Users } from 'lucide-react'
import { DataTable } from '@shared/ui/organisms/DataTable'
import { Button } from '@shared/ui/atoms/Button'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { CustomerFormModal } from './CustomerFormModal'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'

interface Customer {
  id: string; customerCode: string; customerName: string
  phone?: string | null; email?: string | null; city?: string | null
  state?: string | null; creditLimit: number; isActive: boolean
}

export function CustomersScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<Customer | null>(null)
  const [archiving, setArchiving] = useState(false)

  const canCreate = hasPermission('customers.create')
  const canUpdate = hasPermission('customers.update')
  const canArchive = hasPermission('customers.archive')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.customers.list({ limit: 200 })
      if (res.success) {
        const d = res.data as { customers: Customer[]; total: number }
        setCustomers(d.customers ?? [])
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
      const res = await window.api.customers.archive(archiveTarget.id)
      if (res.success) {
        toastSuccess(t('customers.archiveCustomer'), `${archiveTarget.customerName}`)
        setArchiveTarget(null)
        loadData()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } finally {
      setArchiving(false)
    }
  }

  const columns: ColumnDef<Customer, unknown>[] = [
    {
      id: 'name',
      accessorFn: (r) => r.customerName,
      header: t('customers.customerName'),
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-dark dark:text-slate-100">{row.original.customerName}</p>
          <p className="text-xs text-slate-400">{row.original.customerCode}</p>
        </div>
      )
    },
    {
      accessorKey: 'phone',
      header: t('customers.phone'),
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
      accessorKey: 'creditLimit',
      header: t('customers.creditLimit'),
      cell: ({ getValue }) => {
        const v = getValue() as number
        return <span className="text-sm text-slate-600">{v > 0 ? v.toFixed(2) : '—'}</span>
      }
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          {canUpdate && (
            <button onClick={(e) => { e.stopPropagation(); setEditCustomer(row.original); setFormOpen(true) }}
              className="p-2.5 rounded-lg text-slate-400 hover:text-brand hover:bg-brand/10 transition-colors" title="Edit">
              <Edit size={16} />
            </button>
          )}
          {canArchive && (
            <button onClick={(e) => { e.stopPropagation(); setArchiveTarget(row.original) }}
              className="p-2.5 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/10 transition-colors" title="Archive">
              <Archive size={16} />
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
          <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
            <Users size={20} className="text-success" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark dark:text-slate-100">{t('nav.customers')}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{total} {t('nav.customers').toLowerCase()}</p>
          </div>
        </div>
        {canCreate && (
          <Button size="md" onClick={() => { setEditCustomer(null); setFormOpen(true) }}>
            <Plus size={16} className="mr-1.5" /> {t('customers.addCustomer')}
          </Button>
        )}
      </div>

      {!loading && total === 0 && (
        <div className="bg-brand/5 border border-brand/20 rounded-xl px-5 py-4 flex items-center gap-4">
          <Users size={28} className="text-brand shrink-0" />
          <div>
            <p className="text-sm font-semibold text-brand">Add customers to track credit and ledger</p>
            <p className="text-xs text-slate-500 mt-0.5">Customers you add here can be selected on invoices and their payment history is tracked automatically.</p>
          </div>
        </div>
      )}
      <DataTable
        data={customers}
        columns={columns}
        searchPlaceholder={t('customers.searchCustomers')}
        loading={loading}
        emptyMessage={t('customers.noCustomers')}
        onRowClick={(customer) => navigate(`/customers/${customer.id}`)}
      />

      <CustomerFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditCustomer(null) }}
        onSaved={loadData}
        customer={editCustomer}
      />

      <ConfirmDialog
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchive}
        loading={archiving}
        title={t('customers.archiveCustomer')}
        message={`${t('customers.archiveCustomer')} "${archiveTarget?.customerName}"?`}
        confirmLabel={t('customers.archiveCustomer')}
      />
    </div>
  )
}
