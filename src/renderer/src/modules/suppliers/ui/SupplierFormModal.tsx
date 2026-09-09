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
import { CustomFieldsEditor, parseCustomFields } from '@shared/ui/molecules/CustomFieldsEditor'

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
  openingBalance: z.coerce.number().min(0, 'Cannot be negative').optional(),
  // Phase 63 — Price List assignment (real gap found+fixed during live
  // verification: the backend field/validation/service already accepted
  // this, but no UI anywhere ever let a user actually set it).
  priceListId: z.string().optional()
})

type FormValues = z.infer<typeof schema>

interface Supplier {
  id: string; supplierName: string; phone?: string | null; email?: string | null
  address?: string | null; city?: string | null; state?: string | null; country?: string | null
  taxNumber?: string | null; notes?: string | null
  bankAccountNumber?: string | null; bankIfscCode?: string | null; bankName?: string | null; panNumber?: string | null
  openingBalance?: number
  priceListId?: string | null
  customFields?: string | null
}

interface SupplierFormModalProps {
  open: boolean
  onClose: () => void
  onSaved: (supplier?: { id: string; supplierName: string }) => void
  supplier?: Supplier | null
}

export function SupplierFormModal({ open, onClose, onSaved, supplier }: SupplierFormModalProps) {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const isEdit = !!supplier

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema)
  })
  const [priceLists, setPriceLists] = useState<Array<{ id: string; name: string }>>([])
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string | number>>({})

  useEffect(() => {
    if (!open) return
    window.api.priceLists.list({ appliesTo: 'SUPPLIER', isActive: true }).then((res) => {
      if (res.success) setPriceLists((res.data as Array<{ id: string; name: string }>) ?? [])
    })
  }, [open])

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
        openingBalance: supplier?.openingBalance ?? 0,
        priceListId: supplier?.priceListId ?? ''
      })
      setCustomFieldValues(parseCustomFields(supplier?.customFields))
    }
  }, [open, supplier, reset])

  async function onSubmit(values: FormValues) {
    try {
      const { openingBalance, ...rest } = values
      const payload = { ...rest, email: values.email || undefined, priceListId: values.priceListId || undefined, customFields: customFieldValues }
      const response = isEdit
        ? await window.api.suppliers.update({ id: supplier!.id, ...payload })
        : await window.api.suppliers.create({ ...payload, openingBalance: openingBalance ?? 0 })

      if (!response.success) {
        toastError(t('common.error'), response.error?.message ?? t('suppliers.saveFailedMessage'))
        return
      }
      toastSuccess(isEdit ? t('suppliers.updatedTitle') : t('suppliers.createdTitle'), t('suppliers.savedMessage', { name: values.supplierName }))
      // Extra arg — existing callers using `() => {...}` simply ignore it;
      // new callers (e.g. the inline "+ Add New Supplier" on the PO/Bill
      // forms) use it to auto-select the just-created supplier.
      onSaved(response.data as { id: string; supplierName: string })
      onClose()
    } catch {
      toastError(t('common.error'), t('common.somethingWentWrong'))
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t('suppliers.editSupplier') : t('suppliers.addSupplier')}
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>{t('common.cancel')}</Button>
          <Button size="sm" onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
            {isEdit ? t('common.saveChanges') : t('suppliers.addSupplier')}
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <Input label={`${t('suppliers.supplierName')} *`} placeholder={t('suppliers.supplierNamePlaceholder')} {...register('supplierName')} error={errors.supplierName?.message} />
        <div className="grid grid-cols-2 gap-4">
          <Input label={t('common.phone')} placeholder={t('common.phonePlaceholder')} {...register('phone')} error={errors.phone?.message} />
          <Input label={t('common.email')} type="email" placeholder={t('suppliers.emailPlaceholder')} {...register('email')} error={errors.email?.message} />
        </div>
        <Input label={t('common.address')} placeholder={t('common.streetAddressPlaceholder')} {...register('address')} />
        <div className="grid grid-cols-3 gap-4">
          <Input label={t('suppliers.city')} placeholder={t('suppliers.cityPlaceholder')} {...register('city')} />
          <Input label={t('suppliers.state')} placeholder={t('common.statePlaceholder')} {...register('state')} />
          <Input label={t('common.country')} placeholder={t('common.countryPlaceholder')} {...register('country')} />
        </div>
        <Input label={t('common.taxNumber')} placeholder={t('common.taxNumberPlaceholder')} {...register('taxNumber')} />
        {priceLists.length > 0 && (
          <Select label={t('common.priceList')} {...register('priceListId')}>
            <option value="">{t('suppliers.priceListNonePurchase')}</option>
            {priceLists.map((pl) => (
              <option key={pl.id} value={pl.id}>{pl.name}</option>
            ))}
          </Select>
        )}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-3">{t('suppliers.bankComplianceHeading')}</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Input label={t('suppliers.bankAccountNumberLabel')} placeholder={t('suppliers.bankAccountNumberPlaceholder')} {...register('bankAccountNumber')} />
            <Input label={t('suppliers.ifscCodeLabel')} placeholder={t('suppliers.ifscCodePlaceholder')} {...register('bankIfscCode')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('suppliers.bankNameLabel')} placeholder={t('suppliers.bankNamePlaceholder')} {...register('bankName')} />
            <Input label={t('suppliers.panNumberLabel')} placeholder={t('suppliers.panNumberPlaceholder')} {...register('panNumber')} />
          </div>
        </div>
        {!isEdit && (
          <Input
            label={t('suppliers.openingBalanceLabel')}
            type="number" min="0" step="0.01"
            placeholder={t('suppliers.openingBalancePlaceholder')}
            {...register('openingBalance')}
            error={errors.openingBalance?.message}
          />
        )}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{t('common.notes')}</label>
          <textarea {...register('notes')} rows={2} placeholder={t('common.optionalNotesPlaceholder')}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand resize-none text-slate-700 dark:text-slate-200 placeholder-slate-400" />
        </div>
        <CustomFieldsEditor entityType="SUPPLIER" values={customFieldValues} onChange={setCustomFieldValues} />
      </form>
    </Modal>
  )
}
