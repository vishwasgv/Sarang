import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '@shared/ui/molecules/Modal'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { useNotificationStore } from '@app/store/notification.store'
import { useIndustryStore } from '@app/store/industry.store'

const schema = z.object({
  customerName: z.string().min(1, 'Customer name is required').max(200),
  phone: z.string().max(30).optional(),
  email: z.string().email('Invalid email').max(100).optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  taxNumber: z.string().max(50).optional(),
  taxExempt: z.boolean().optional(),
  taxExemptReason: z.string().max(200).optional(),
  creditLimit: z.coerce.number().min(0).optional(),
  // Phase 58 §2 — Distributor customer-class/negotiated pricing. Free text
  // (e.g. "RETAILER"/"WHOLESALER"/"VIP") — only surfaced in the UI when
  // field_order_capture is on (a DISTRIBUTOR default), same "config flags
  // only, no template-specific if/else" convention as area_pricing above.
  customerClass: z.string().max(50).optional(),
  notes: z.string().max(500).optional()
})

type FormValues = z.infer<typeof schema>

interface Customer {
  id: string; customerName: string; phone?: string | null; email?: string | null
  address?: string | null; city?: string | null; state?: string | null; country?: string | null
  taxNumber?: string | null; taxExempt?: boolean; taxExemptReason?: string | null
  creditLimit?: number; customerClass?: string | null; notes?: string | null
}

interface CustomerFormModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  customer?: Customer | null
}

export function CustomerFormModal({ open, onClose, onSaved, customer }: CustomerFormModalProps) {
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { isModuleEnabled } = useIndustryStore()
  const fieldOrderCaptureEnabled = isModuleEnabled('field_order_capture')
  const isEdit = !!customer

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema)
  })
  const taxExempt = watch('taxExempt')

  useEffect(() => {
    if (open) {
      reset({
        customerName: customer?.customerName ?? '',
        phone: customer?.phone ?? '',
        email: customer?.email ?? '',
        address: customer?.address ?? '',
        city: customer?.city ?? '',
        state: customer?.state ?? '',
        country: customer?.country ?? '',
        taxNumber: customer?.taxNumber ?? '',
        taxExempt: customer?.taxExempt ?? false,
        taxExemptReason: customer?.taxExemptReason ?? '',
        creditLimit: customer?.creditLimit ?? 0,
        customerClass: customer?.customerClass ?? '',
        notes: customer?.notes ?? ''
      })
    }
  }, [open, customer, reset])

  async function onSubmit(values: FormValues) {
    try {
      const payload = { ...values, email: values.email || undefined }
      const response = isEdit
        ? await window.api.customers.update({ id: customer!.id, ...payload })
        : await window.api.customers.create(payload)

      if (!response.success) {
        toastError('Error', response.error?.message ?? 'Failed to save customer.')
        return
      }
      toastSuccess(isEdit ? 'Customer Updated' : 'Customer Created', `${values.customerName} has been saved.`)
      onSaved()
      onClose()
    } catch {
      toastError('Error', 'Something went wrong. Please try again.')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Customer' : 'Add Customer'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
            {isEdit ? 'Save Changes' : 'Add Customer'}
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <Input label="Customer Name *" placeholder="e.g. Ramesh Enterprises" {...register('customerName')} error={errors.customerName?.message} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Phone" placeholder="+91 98765 43210" {...register('phone')} error={errors.phone?.message} />
          <Input label="Email" type="email" placeholder="customer@example.com" {...register('email')} error={errors.email?.message} />
        </div>
        <Input label="Address" placeholder="Street address" {...register('address')} error={errors.address?.message} />
        <div className="grid grid-cols-3 gap-4">
          <Input label="City" placeholder="Mumbai" {...register('city')} />
          <Input label="State" placeholder="Maharashtra" {...register('state')} />
          <Input label="Country" placeholder="India" {...register('country')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Tax Number" placeholder="GST / PAN / VAT" {...register('taxNumber')} />
          <Input label="Credit Limit" type="number" min="0" step="0.01" {...register('creditLimit')} error={errors.creditLimit?.message} />
        </div>
        {fieldOrderCaptureEnabled && (
          <Input
            label="Customer Class"
            placeholder="e.g. RETAILER, WHOLESALER, VIP"
            {...register('customerClass')}
            error={errors.customerClass?.message}
          />
        )}
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <input type="checkbox" {...register('taxExempt')} className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand" />
            Tax Exempt / Reverse Charge
          </label>
          <p className="text-xs text-slate-400">Invoices to this customer are billed at 0% tax — for B2B reverse charge, diplomatic/NGO exemptions, or other tax-exempt buyers.</p>
          {taxExempt && (
            <Input label="Reason (printed on the invoice)" placeholder="e.g. Reverse charge — VAT Reg GB123456789" {...register('taxExemptReason')} />
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Notes</label>
          <textarea {...register('notes')} rows={2} placeholder="Optional notes…"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand resize-none text-slate-700 dark:text-slate-200 placeholder-slate-400" />
        </div>
      </form>
    </Modal>
  )
}
