import { useRecordLock } from '@shared/hooks/useRecordLock'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { useTaxNumberField } from '@shared/hooks/useTaxNumberField'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '@shared/ui/molecules/Modal'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { useNotificationStore } from '@app/store/notification.store'
import { useIndustryStore } from '@app/store/industry.store'
import { CustomFieldsEditor, parseCustomFields } from '@shared/ui/molecules/CustomFieldsEditor'
import { usePatientNoun } from '@shared/hooks/usePatientNoun'

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
  doNotMessage: z.boolean().optional(),
  taxExemptReason: z.string().max(200).optional(),
  taxExemptCertificate: z.string().max(60).optional(),
  taxExemptExpiry: z.string().max(10).optional(),
  creditLimit: z.coerce.number().min(0).optional(),
  paymentTermsDays: z.union([z.literal(''), z.coerce.number().int().min(0).max(365)]).optional(),
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
  priceListId: z.string().optional(),
  // 2026-09-23 — clinic verticals only (see usePatientNoun.ts). Deliberately
  // hardcoded-English labels below, not t() — this section only ever
  // renders when isDoctorVertical is true, and every clinic vertical is
  // languageLock:'en' (enforced app-wide, see industry.store.ts's
  // enforceLanguageLock), so translating these labels would be genuine dead
  // code. Same convention VisitNoteScreen's SOAP field labels and
  // AppointmentsScreen's STATUS_LABEL already follow.
  bloodGroup: z.string().max(10).optional(),
  allergies: z.string().max(1000).optional(),
  chronicConditions: z.string().max(1000).optional(),
  currentMedications: z.string().max(1000).optional(),
  emergencyContactName: z.string().max(200).optional(),
  emergencyContactPhone: z.string().max(30).optional(),
})

type FormValues = z.infer<typeof schema>

interface Customer {
  id: string; customerName: string; phone?: string | null; email?: string | null
  address?: string | null; city?: string | null; state?: string | null; country?: string | null
  taxNumber?: string | null; taxExempt?: boolean; taxExemptReason?: string | null; taxExemptCertificate?: string | null; taxExemptExpiry?: string | null; taxExemptExpired?: boolean; doNotMessage?: boolean
  creditLimit?: number; paymentTermsDays?: number | null; customerClass?: string | null; notes?: string | null
  customerKind?: 'INDIVIDUAL' | 'BUSINESS'
  companyRegistrationNumber?: string | null; contactPersonName?: string | null
  idProofType?: string | null; idProofNumber?: string | null
  priceListId?: string | null
  customFields?: string | null
  bloodGroup?: string | null; allergies?: string | null; chronicConditions?: string | null
  currentMedications?: string | null; emergencyContactName?: string | null; emergencyContactPhone?: string | null
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
  const lockedBy = useRecordLock('customer', customer?.id, open)
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { isModuleEnabled } = useIndustryStore()
  const fieldOrderCaptureEnabled = isModuleEnabled('field_order_capture')
  const { isDoctorVertical, hasPatientMedicalRecord, singular: patientNoun } = usePatientNoun()
  const isEdit = !!customer

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema)
  })
  const taxExempt = watch('taxExempt')
  const taxField = useTaxNumberField(watch('country'), watch('taxNumber'), t('common.taxNumber'))
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
        doNotMessage: customer?.doNotMessage ?? false,
        taxExemptReason: customer?.taxExemptReason ?? '',
        taxExemptCertificate: customer?.taxExemptCertificate ?? '',
        taxExemptExpiry: customer?.taxExemptExpiry ?? '',
        creditLimit: customer?.creditLimit ?? 0,
        paymentTermsDays: customer?.paymentTermsDays ?? '',
        customerClass: customer?.customerClass ?? '',
        notes: customer?.notes ?? '',
        customerKind: customer?.customerKind ?? 'INDIVIDUAL',
        companyRegistrationNumber: customer?.companyRegistrationNumber ?? '',
        contactPersonName: customer?.contactPersonName ?? '',
        idProofType: customer?.idProofType ?? '',
        idProofNumber: customer?.idProofNumber ?? '',
        priceListId: customer?.priceListId ?? '',
        bloodGroup: customer?.bloodGroup ?? '',
        allergies: customer?.allergies ?? '',
        chronicConditions: customer?.chronicConditions ?? '',
        currentMedications: customer?.currentMedications ?? '',
        emergencyContactName: customer?.emergencyContactName ?? '',
        emergencyContactPhone: customer?.emergencyContactPhone ?? ''
      })
      setCustomFieldValues(parseCustomFields(customer?.customFields))
    }
  }, [open, customer, reset])

  async function onSubmit(values: FormValues) {
    try {
      const payload = { ...values, paymentTermsDays: values.paymentTermsDays === '' || values.paymentTermsDays === undefined ? null : Number(values.paymentTermsDays), email: values.email || undefined, priceListId: values.priceListId || undefined, customFields: customFieldValues }
      const response = isEdit
        ? await window.api.customers.update({ id: customer!.id, ...payload })
        : await window.api.customers.create(payload)

      if (!response.success) {
        toastError(t('common.error'), t('customers.saveFailedMessage'))
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
      title={isDoctorVertical ? (isEdit ? `Edit ${patientNoun}` : `Add ${patientNoun}`) : (isEdit ? t('customers.editCustomer') : t('customers.addCustomer'))}
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>{t('common.cancel')}</Button>
          <Button size="sm" onClick={handleSubmit(onSubmit)} loading={isSubmitting} disabled={lockedBy !== null}>
            {isEdit ? t('common.saveChanges') : (isDoctorVertical ? `Add ${patientNoun}` : t('customers.addCustomer'))}
          </Button>
        </>
      }
    >
      {lockedBy !== null && (
        <p role="alert" className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">{lockedBy ? t('lan.beingEdited', { name: lockedBy }) : t('lan.beingEditedGeneric')}</p>
      )}
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
          label={customerKind === 'BUSINESS' ? `${t('customers.businessCompanyName')} *` : (isDoctorVertical ? `${patientNoun} Name *` : `${t('customers.customerName')} *`)}
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
          <Input label={taxField.label} placeholder={taxField.placeholder ?? t('common.taxNumberPlaceholder')} hint={taxField.hint} {...register('taxNumber')} />
          <Input label={t('customers.creditLimit')} type="number" min="0" step="0.01" {...register('creditLimit')} error={errors.creditLimit?.message} />
          <Input label={t('customers.paymentTermsDays')} type="number" min="0" max="365" step="1" placeholder="30" {...register('paymentTermsDays')} error={errors.paymentTermsDays?.message} />
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
            <input type="checkbox" {...register('doNotMessage')} className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand" />
            {t('customers.doNotMessageLabel')}
          </label>
          <p className="text-xs text-slate-400">{t('customers.doNotMessageHint')}</p>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
            <input type="checkbox" {...register('taxExempt')} className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand" />
            {t('customers.taxExemptLabel')}
          </label>
          <p className="text-xs text-slate-400">{t('customers.taxExemptHint')}</p>
          {taxExempt && (
            <>
              <Input label={t('customers.taxExemptReasonLabel')} placeholder={t('customers.taxExemptReasonPlaceholder')} {...register('taxExemptReason')} />
              <Input label={t('customers.taxExemptCertificateLabel')} {...register('taxExemptCertificate')} />
              <Input label={t('customers.taxExemptExpiryLabel')} type="date" {...register('taxExemptExpiry')} />
              <p className="text-xs text-slate-400">{t('customers.taxExemptExpiryHint')}</p>
              {customer?.taxExemptExpired && <p className="text-xs text-danger">{t('customers.taxExemptExpiredWarning')}</p>}
            </>
          )}
        </div>
        {hasPatientMedicalRecord && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Medical Information</p>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Blood Group" placeholder="e.g. O+" {...register('bloodGroup')} />
              <Input label="Allergies" placeholder="e.g. Penicillin, Peanuts" {...register('allergies')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Chronic Conditions" placeholder="e.g. Type 2 Diabetes, Hypertension" {...register('chronicConditions')} />
              <Input label="Current Medications" placeholder="e.g. Metformin 500mg twice daily" {...register('currentMedications')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Emergency Contact Name" {...register('emergencyContactName')} />
              <Input label="Emergency Contact Phone" {...register('emergencyContactPhone')} />
            </div>
          </div>
        )}
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
