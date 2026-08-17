import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '@shared/ui/molecules/Modal'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { useNotificationStore } from '@app/store/notification.store'
import { useIndustryStore } from '@app/store/industry.store'
import { CustomFieldsEditor, parseCustomFields } from '@shared/ui/molecules/CustomFieldsEditor'

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
  notes: z.string().max(500).optional(),
  // Phase 61 — Individual vs Business split: a distributor/B2B seller's
  // customer is a company, not a person, and needs a registration number +
  // named contact rather than an ID proof.
  customerKind: z.enum(['INDIVIDUAL', 'BUSINESS']).optional(),
  companyRegistrationNumber: z.string().max(50).optional(),
  contactPersonName: z.string().max(200).optional(),
  idProofType: z.string().max(50).optional(),
  idProofNumber: z.string().max(50).optional(),
  // Phase 63 — Price List assignment (real gap found+fixed during live
  // verification: the backend field/validation/service already accepted
  // this, but no UI anywhere ever let a user actually set it, so an
  // assigned Price List could never resolve at billing time in real use).
  priceListId: z.string().optional()
})

type FormValues = z.infer<typeof schema>

interface Customer {
  id: string; customerName: string; phone?: string | null; email?: string | null
  address?: string | null; city?: string | null; state?: string | null; country?: string | null
  taxNumber?: string | null; taxExempt?: boolean; taxExemptReason?: string | null
  creditLimit?: number; customerClass?: string | null; notes?: string | null
  customerKind?: 'INDIVIDUAL' | 'BUSINESS'
  companyRegistrationNumber?: string | null; contactPersonName?: string | null
  idProofType?: string | null; idProofNumber?: string | null
  priceListId?: string | null
  customFields?: string | null
}

interface CustomerFormModalProps {
  open: boolean
  onClose: () => void
  // Phase 63 — widened to optionally pass back the created/updated customer,
  // same "+ New Supplier" precedent SupplierFormModal already established in
  // Phase 61 — lets an inline "+ New Customer" picker (e.g. on the Sales
  // Order form) auto-select the row it just created. Existing callers that
  // ignore the argument are unaffected.
  onSaved: (customer?: { id: string; customerName: string }) => void
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
  const customerKind = watch('customerKind')
  const [priceLists, setPriceLists] = useState<Array<{ id: string; name: string }>>([])
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string | number>>({})

  useEffect(() => {
    if (!open) return
    window.api.priceLists.list({ appliesTo: 'CUSTOMER', isActive: true }).then((res) => {
      if (res.success) setPriceLists((res.data as Array<{ id: string; name: string }>) ?? [])
    })
  }, [open])

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
        notes: customer?.notes ?? '',
        customerKind: customer?.customerKind ?? 'INDIVIDUAL',
        companyRegistrationNumber: customer?.companyRegistrationNumber ?? '',
        contactPersonName: customer?.contactPersonName ?? '',
        idProofType: customer?.idProofType ?? '',
        idProofNumber: customer?.idProofNumber ?? '',
        priceListId: customer?.priceListId ?? ''
      })
      setCustomFieldValues(parseCustomFields(customer?.customFields))
    }
  }, [open, customer, reset])

  async function onSubmit(values: FormValues) {
    try {
      const payload = { ...values, email: values.email || undefined, priceListId: values.priceListId || undefined, customFields: customFieldValues }
      const response = isEdit
        ? await window.api.customers.update({ id: customer!.id, ...payload })
        : await window.api.customers.create(payload)

      if (!response.success) {
        toastError('Error', response.error?.message ?? 'Failed to save customer.')
        return
      }
      toastSuccess(isEdit ? 'Customer Updated' : 'Customer Created', `${values.customerName} has been saved.`)
      onSaved(response.data as { id: string; customerName: string } | undefined)
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
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 p-1 w-fit">
          {(['INDIVIDUAL', 'BUSINESS'] as const).map(kind => (
            <label key={kind} className={`px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer transition-colors ${customerKind === kind ? 'bg-brand text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              <input type="radio" value={kind} {...register('customerKind')} className="sr-only" />
              {kind === 'INDIVIDUAL' ? 'Individual' : 'Business'}
            </label>
          ))}
        </div>
        <Input
          label={customerKind === 'BUSINESS' ? 'Business/Company Name *' : 'Customer Name *'}
          placeholder={customerKind === 'BUSINESS' ? 'e.g. Ramesh Enterprises Pvt Ltd' : 'e.g. Ramesh Kumar'}
          {...register('customerName')}
          error={errors.customerName?.message}
        />
        {customerKind === 'BUSINESS' ? (
          <div className="grid grid-cols-2 gap-4">
            <Input label="Company Registration Number" placeholder="CIN / registration no." {...register('companyRegistrationNumber')} />
            <Input label="Contact Person" placeholder="Person to reach at this company" {...register('contactPersonName')} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <Input label="ID Proof Type" placeholder="e.g. Aadhaar, Passport, Driving Licence" {...register('idProofType')} />
            <Input label="ID Proof Number" {...register('idProofNumber')} />
          </div>
        )}
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
        {priceLists.length > 0 && (
          <Select label="Price List" {...register('priceListId')}>
            <option value="">None — normal selling price</option>
            {priceLists.map((pl) => (
              <option key={pl.id} value={pl.id}>{pl.name}</option>
            ))}
          </Select>
        )}
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
        <CustomFieldsEditor entityType="CUSTOMER" values={customFieldValues} onChange={setCustomFieldValues} />
      </form>
    </Modal>
  )
}
