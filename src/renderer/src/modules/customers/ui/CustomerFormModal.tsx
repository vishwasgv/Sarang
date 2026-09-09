import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  phone: z.string().min(1, 'Phone number is required').max(30),
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
  const { t } = useTranslation()
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
        toastError(t('common.error'), response.error?.message ?? t('customers.saveFailedMessage'))
        return
      }
      toastSuccess(isEdit ? t('customers.updatedTitle') : t('customers.createdTitle'), t('customers.savedMessage', { name: values.customerName }))
      onSaved(response.data as { id: string; customerName: string } | undefined)
      onClose()
    } catch {
      toastError(t('common.error'), t('common.somethingWentWrong'))
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t('customers.editCustomer') : t('customers.addCustomer')}
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>{t('common.cancel')}</Button>
          <Button size="sm" onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
            {isEdit ? t('common.saveChanges') : t('customers.addCustomer')}
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 p-1 w-fit">
          {(['INDIVIDUAL', 'BUSINESS'] as const).map(kind => (
            <label key={kind} className={`px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer transition-colors ${customerKind === kind ? 'bg-brand text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              <input type="radio" value={kind} {...register('customerKind')} className="sr-only" />
              {kind === 'INDIVIDUAL' ? t('customers.individualLabel') : t('customers.businessLabel')}
            </label>
          ))}
        </div>
        <Input
          label={customerKind === 'BUSINESS' ? `${t('customers.businessCompanyName')} *` : `${t('customers.customerName')} *`}
          placeholder={customerKind === 'BUSINESS' ? t('customers.businessNamePlaceholder') : t('customers.individualNamePlaceholder')}
          {...register('customerName')}
          error={errors.customerName?.message}
        />
        {customerKind === 'BUSINESS' ? (
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('customers.companyRegNumberLabel')} placeholder={t('customers.companyRegNumberPlaceholder')} {...register('companyRegistrationNumber')} />
            <Input label={t('customers.contactPersonLabel')} placeholder={t('customers.contactPersonPlaceholder')} {...register('contactPersonName')} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('customers.idProofTypeLabel')} placeholder={t('customers.idProofTypePlaceholder')} {...register('idProofType')} />
            <Input label={t('customers.idProofNumberLabel')} {...register('idProofNumber')} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Input label={`${t('common.phone')} *`} placeholder={t('common.phonePlaceholder')} {...register('phone')} error={errors.phone?.message} />
          <Input label={t('common.email')} type="email" placeholder={t('customers.emailPlaceholder')} {...register('email')} error={errors.email?.message} />
        </div>
        <Input label={t('common.address')} placeholder={t('common.streetAddressPlaceholder')} {...register('address')} error={errors.address?.message} />
        <div className="grid grid-cols-3 gap-4">
          <Input label={t('customers.city')} placeholder={t('customers.cityPlaceholder')} {...register('city')} />
          <Input label={t('customers.state')} placeholder={t('common.statePlaceholder')} {...register('state')} />
          <Input label={t('common.country')} placeholder={t('common.countryPlaceholder')} {...register('country')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label={t('common.taxNumber')} placeholder={t('common.taxNumberPlaceholder')} {...register('taxNumber')} />
          <Input label={t('customers.creditLimit')} type="number" min="0" step="0.01" {...register('creditLimit')} error={errors.creditLimit?.message} />
        </div>
        {priceLists.length > 0 && (
          <Select label={t('common.priceList')} {...register('priceListId')}>
            <option value="">{t('customers.priceListNoneSelling')}</option>
            {priceLists.map((pl) => (
              <option key={pl.id} value={pl.id}>{pl.name}</option>
            ))}
          </Select>
        )}
        {fieldOrderCaptureEnabled && (
          <Input
            label={t('customers.customerClassLabel')}
            placeholder={t('customers.customerClassPlaceholder')}
            {...register('customerClass')}
            error={errors.customerClass?.message}
          />
        )}
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <input type="checkbox" {...register('taxExempt')} className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand" />
            {t('customers.taxExemptLabel')}
          </label>
          <p className="text-xs text-slate-400">{t('customers.taxExemptHint')}</p>
          {taxExempt && (
            <Input label={t('customers.taxExemptReasonLabel')} placeholder={t('customers.taxExemptReasonPlaceholder')} {...register('taxExemptReason')} />
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{t('common.notes')}</label>
          <textarea {...register('notes')} rows={2} placeholder={t('common.optionalNotesPlaceholder')}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand resize-none text-slate-700 dark:text-slate-200 placeholder-slate-400" />
        </div>
        <CustomFieldsEditor entityType="CUSTOMER" values={customFieldValues} onChange={setCustomFieldValues} />
      </form>
    </Modal>
  )
}
