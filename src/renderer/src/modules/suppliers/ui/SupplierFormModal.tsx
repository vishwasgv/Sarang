import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '@shared/ui/molecules/Modal'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { useNotificationStore } from '@app/store/notification.store'

const schema = z.object({
  supplierName: z.string().min(1, 'Supplier name is required').max(200),
  phone: z.string().max(30).optional(),
  email: z.string().email('Invalid email').max(100).optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  taxNumber: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
  bankAccountNumber: z.string().max(30).optional(),
  bankIfscCode: z.string().max(20).optional(),
  bankName: z.string().max(100).optional(),
  panNumber: z.string().max(20).optional(),
  // Onboarding-only — a one-time debit posted at creation, never editable
  // afterward (see supplier.service.ts's createSupplier). Coerced from the
  // text input's string value.
  openingBalance: z.coerce.number().min(0, 'Cannot be negative').optional()
})

type FormValues = z.infer<typeof schema>

interface Supplier {
  id: string; supplierName: string; phone?: string | null; email?: string | null
  address?: string | null; city?: string | null; state?: string | null; country?: string | null
  taxNumber?: string | null; notes?: string | null
  bankAccountNumber?: string | null; bankIfscCode?: string | null; bankName?: string | null; panNumber?: string | null
  openingBalance?: number
}

interface SupplierFormModalProps {
  open: boolean
  onClose: () => void
  onSaved: (supplier?: { id: string; supplierName: string }) => void
  supplier?: Supplier | null
}

export function SupplierFormModal({ open, onClose, onSaved, supplier }: SupplierFormModalProps) {
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const isEdit = !!supplier

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema)
  })

  useEffect(() => {
    if (open) {
      reset({
        supplierName: supplier?.supplierName ?? '',
        phone: supplier?.phone ?? '',
        email: supplier?.email ?? '',
        address: supplier?.address ?? '',
        city: supplier?.city ?? '',
        state: supplier?.state ?? '',
        country: supplier?.country ?? '',
        taxNumber: supplier?.taxNumber ?? '',
        notes: supplier?.notes ?? '',
        bankAccountNumber: supplier?.bankAccountNumber ?? '',
        bankIfscCode: supplier?.bankIfscCode ?? '',
        bankName: supplier?.bankName ?? '',
        panNumber: supplier?.panNumber ?? '',
        openingBalance: supplier?.openingBalance ?? 0
      })
    }
  }, [open, supplier, reset])

  async function onSubmit(values: FormValues) {
    try {
      const { openingBalance, ...rest } = values
      const payload = { ...rest, email: values.email || undefined }
      const response = isEdit
        ? await window.api.suppliers.update({ id: supplier!.id, ...payload })
        : await window.api.suppliers.create({ ...payload, openingBalance: openingBalance ?? 0 })

      if (!response.success) {
        toastError('Error', response.error?.message ?? 'Failed to save supplier.')
        return
      }
      toastSuccess(isEdit ? 'Supplier Updated' : 'Supplier Created', `${values.supplierName} has been saved.`)
      // Extra arg — existing callers using `() => {...}` simply ignore it;
      // new callers (e.g. the inline "+ Add New Supplier" on the PO/Bill
      // forms) use it to auto-select the just-created supplier.
      onSaved(response.data as { id: string; supplierName: string })
      onClose()
    } catch {
      toastError('Error', 'Something went wrong. Please try again.')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Supplier' : 'Add Supplier'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
            {isEdit ? 'Save Changes' : 'Add Supplier'}
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <Input label="Supplier Name *" placeholder="e.g. ABC Distributors" {...register('supplierName')} error={errors.supplierName?.message} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Phone" placeholder="+91 98765 43210" {...register('phone')} error={errors.phone?.message} />
          <Input label="Email" type="email" placeholder="supplier@example.com" {...register('email')} error={errors.email?.message} />
        </div>
        <Input label="Address" placeholder="Street address" {...register('address')} />
        <div className="grid grid-cols-3 gap-4">
          <Input label="City" placeholder="Pune" {...register('city')} />
          <Input label="State" placeholder="Maharashtra" {...register('state')} />
          <Input label="Country" placeholder="India" {...register('country')} />
        </div>
        <Input label="Tax Number" placeholder="GST / PAN / VAT" {...register('taxNumber')} />
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-3">Bank & Compliance Details</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Input label="Bank Account Number" placeholder="For making payments" {...register('bankAccountNumber')} />
            <Input label="IFSC Code" placeholder="e.g. HDFC0001234" {...register('bankIfscCode')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Bank Name" placeholder="e.g. HDFC Bank" {...register('bankName')} />
            <Input label="PAN Number" placeholder="For TDS/compliance" {...register('panNumber')} />
          </div>
        </div>
        {!isEdit && (
          <Input
            label="Opening Balance"
            type="number" min="0" step="0.01"
            placeholder="Amount already owed to this supplier, if any"
            {...register('openingBalance')}
            error={errors.openingBalance?.message}
          />
        )}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Notes</label>
          <textarea {...register('notes')} rows={2} placeholder="Optional notes…"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand resize-none text-slate-700 dark:text-slate-200 placeholder-slate-400" />
        </div>
      </form>
    </Modal>
  )
}
