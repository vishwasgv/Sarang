import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Check, Upload, X, Sparkles, Copy, ShieldAlert } from 'lucide-react'
import { BrandIcon, AszurexMark } from '@shared/ui/atoms/Brand'
import { useForm, FormProvider, useFormContext } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Card } from '@shared/ui/molecules/Card'
import { Select } from '@shared/ui/atoms/Select'
import { api } from '@renderer/services/ipc-client'
import { CURRENCIES } from '@shared/utils/currency.util'
import { documentLogoUrl } from '@shared/ui/molecules/DocumentWatermark'

const BUSINESS_TYPES = [
  { value: 'RESTAURANT', label: 'Restaurant / Cafe / Bakery', icon: '🍽️' },
  { value: 'RETAIL', label: 'Retail / Grocery / Supermarket', icon: '🏪' },
  { value: 'HARDWARE', label: 'Hardware / Glass / Plywood', icon: '🔧' },
  { value: 'DISTRIBUTOR', label: 'Distributor / Wholesaler', icon: '📦' },
  { value: 'ELECTRONICS', label: 'Electronics / Mobile Store', icon: '📱' },
  { value: 'PHARMACY', label: 'Pharmacy / Medical Store', icon: '💊' },
  { value: 'CLOTHING', label: 'Clothing / Textile / Apparel', icon: '👗' },
  { value: 'FOOTWEAR', label: 'Footwear / Shoe Store', icon: '👟' },
  { value: 'AGRI_INPUTS', label: 'Agricultural Inputs & Equipment', icon: '🚜' },
  { value: 'BLOOD_BANK', label: 'Blood Bank', icon: '🩸' },
  { value: 'JEWELLERY', label: 'Jewellery', icon: '💍' },
  { value: 'MANUFACTURING', label: 'Manufacturing / Production', icon: '🏭' },
  { value: 'RENTAL', label: 'Rental Business', icon: '🔑' },
  { value: 'SERVICE', label: 'Service Business / Agency / IT', icon: '🛎️' },
  { value: 'CONSULTANT', label: 'Consultant / Freelancer', icon: '🧑‍💼' },
  { value: 'REPAIR', label: 'Repair Shop / Service Centre', icon: '🪛' },
  { value: 'GENERAL', label: 'General Business / Other', icon: '🏢' }
]

const SERVICE_TEMPLATES = [
  // Clinical
  { value: 'VET_CLINIC', label: 'Veterinary Clinic', icon: '🐾', group: 'Clinical' },
  { value: 'GP_CLINIC', label: 'GP / General Physician', icon: '🩺', group: 'Clinical' },
  { value: 'SPECIALIST_CLINIC', label: 'Specialist Clinic', icon: '🏥', group: 'Clinical' },
  { value: 'DENTAL_CLINIC', label: 'Dental Clinic', icon: '🦷', group: 'Clinical' },
  { value: 'PHYSIO_CLINIC', label: 'Physiotherapy Clinic', icon: '🏃', group: 'Clinical' },
  { value: 'DIAGNOSTIC_LAB', label: 'Diagnostic & Pathology Lab', icon: '🧪', group: 'Clinical' },
  // Wellness
  { value: 'BEAUTY_SALON', label: 'Beauty Salon / Spa', icon: '💅', group: 'Wellness' },
  { value: 'GYM_STUDIO', label: 'Gym / Fitness Studio', icon: '💪', group: 'Wellness' },
  { value: 'DRIVING_SCHOOL', label: 'Driving School', icon: '🚗', group: 'Wellness' },
  // Professional
  { value: 'LAWYER', label: 'Lawyer / Law Firm', icon: '⚖️', group: 'Professional' },
  { value: 'CA_FIRM', label: 'CA / Chartered Accountant', icon: '📊', group: 'Professional' },
  { value: 'COMPANY_SECRETARY', label: 'Company Secretary', icon: '🗂️', group: 'Professional' },
  { value: 'ARCHITECT', label: 'Architect', icon: '📐', group: 'Professional' },
  { value: 'CIVIL_ENGINEER', label: 'Civil Engineer', icon: '🏗️', group: 'Professional' },
  { value: 'REAL_ESTATE', label: 'Real Estate Agent', icon: '🏠', group: 'Professional' },
  { value: 'INDEPENDENT_CONSULTANT', label: 'Consultant', icon: '💼', group: 'Professional' },
  // Creative & Agencies
  { value: 'MARKETING_AGENCY', label: 'Marketing Agency', icon: '📣', group: 'Creative & Agencies' },
  { value: 'SOFTWARE_AGENCY', label: 'Software / IT Agency', icon: '💻', group: 'Creative & Agencies' },
  { value: 'PHOTO_STUDIO', label: 'Photography Studio', icon: '📷', group: 'Creative & Agencies' },
  { value: 'EVENT_MANAGEMENT', label: 'Event Management', icon: '🎪', group: 'Creative & Agencies' },
  // Education
  { value: 'COACHING_INSTITUTE', label: 'Coaching / Tuition Institute', icon: '📚', group: 'Education' },
  // Trade
  { value: 'CAR_SERVICE_CENTER', label: 'Car Service Center', icon: '🔩', group: 'Trade' },
  { value: 'TAILOR_BOUTIQUE', label: 'Tailor / Boutique', icon: '✂️', group: 'Trade' },
  { value: 'PEST_CONTROL', label: 'Pest Control Service', icon: '🪲', group: 'Trade' },
  { value: 'PLACEMENT_AGENCY', label: 'Placement / Recruitment Agency', icon: '🤝', group: 'Trade' },
]

const TAX_MODELS = [
  { value: 'GST', label: 'GST (India)', description: 'Goods & Services Tax' },
  { value: 'VAT', label: 'VAT', description: 'Value Added Tax (UK, Europe, Gulf)' },
  { value: 'SALES_TAX', label: 'Sales Tax', description: 'US Sales Tax' },
  { value: 'CUSTOM', label: 'Custom Tax', description: 'Custom tax rates' },
  { value: 'NONE', label: 'No Tax', description: 'Tax exempt business' }
]

// Country → default currency + tax model
const COUNTRY_DEFAULTS: Record<string, { currencyCode: string; currencySymbol: string; taxModel: string }> = {
  'india': { currencyCode: 'INR', currencySymbol: '₹', taxModel: 'GST' },
  'united states': { currencyCode: 'USD', currencySymbol: '$', taxModel: 'SALES_TAX' },
  'usa': { currencyCode: 'USD', currencySymbol: '$', taxModel: 'SALES_TAX' },
  'us': { currencyCode: 'USD', currencySymbol: '$', taxModel: 'SALES_TAX' },
  'united kingdom': { currencyCode: 'GBP', currencySymbol: '£', taxModel: 'VAT' },
  'uk': { currencyCode: 'GBP', currencySymbol: '£', taxModel: 'VAT' },
  'australia': { currencyCode: 'AUD', currencySymbol: 'A$', taxModel: 'VAT' },
  'canada': { currencyCode: 'CAD', currencySymbol: 'CA$', taxModel: 'VAT' },
  'germany': { currencyCode: 'EUR', currencySymbol: '€', taxModel: 'VAT' },
  'france': { currencyCode: 'EUR', currencySymbol: '€', taxModel: 'VAT' },
  'italy': { currencyCode: 'EUR', currencySymbol: '€', taxModel: 'VAT' },
  'spain': { currencyCode: 'EUR', currencySymbol: '€', taxModel: 'VAT' },
  'singapore': { currencyCode: 'SGD', currencySymbol: 'S$', taxModel: 'VAT' },
  'malaysia': { currencyCode: 'MYR', currencySymbol: 'RM', taxModel: 'VAT' },
  'uae': { currencyCode: 'AED', currencySymbol: 'AED', taxModel: 'VAT' },
  'united arab emirates': { currencyCode: 'AED', currencySymbol: 'AED', taxModel: 'VAT' },
  'saudi arabia': { currencyCode: 'SAR', currencySymbol: 'SAR', taxModel: 'VAT' },
  'bahrain': { currencyCode: 'BHD', currencySymbol: 'BD', taxModel: 'VAT' },
  'new zealand': { currencyCode: 'NZD', currencySymbol: 'NZ$', taxModel: 'VAT' },
  'south africa': { currencyCode: 'ZAR', currencySymbol: 'R', taxModel: 'VAT' },
  'bangladesh': { currencyCode: 'BDT', currencySymbol: '৳', taxModel: 'VAT' },
  'pakistan': { currencyCode: 'PKR', currencySymbol: '₨', taxModel: 'VAT' },
  'nepal': { currencyCode: 'NPR', currencySymbol: 'Rs', taxModel: 'VAT' },
  'sri lanka': { currencyCode: 'LKR', currencySymbol: 'Rs', taxModel: 'VAT' },
  'japan': { currencyCode: 'JPY', currencySymbol: '¥', taxModel: 'VAT' },
  'china': { currencyCode: 'CNY', currencySymbol: '¥', taxModel: 'VAT' },
  'indonesia': { currencyCode: 'IDR', currencySymbol: 'Rp', taxModel: 'VAT' },
  'thailand': { currencyCode: 'THB', currencySymbol: '฿', taxModel: 'VAT' },
  'philippines': { currencyCode: 'PHP', currencySymbol: '₱', taxModel: 'VAT' },
  'kenya': { currencyCode: 'KES', currencySymbol: 'KSh', taxModel: 'VAT' },
  'nigeria': { currencyCode: 'NGN', currencySymbol: '₦', taxModel: 'VAT' },
  'ghana': { currencyCode: 'GHS', currencySymbol: 'GH₵', taxModel: 'VAT' }
}

const schema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  businessType: z.string().min(1, 'Please select a business type'),
  ownerName: z.string().optional(),
  country: z.string().min(1, 'Country is required'),
  currencyCode: z.string().min(1),
  currencySymbol: z.string().min(1),
  taxModel: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  taxNumber: z.string().optional(),
  upiId: z.string().optional(),
  logoPath: z.string().optional(),
  adminFullName: z.string().min(1, 'Full name is required'),
  adminUsername: z.string().min(3, 'Username must be at least 3 characters').regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores allowed'),
  adminPassword: z.string().min(6, 'Password must be at least 6 characters'),
  adminPasswordConfirm: z.string()
}).refine((d) => d.adminPassword === d.adminPasswordConfirm, {
  message: "Passwords don't match",
  path: ['adminPasswordConfirm']
})

type FormValues = z.infer<typeof schema>

// Step 0: Welcome, Step 1: Business Type, Step 2: Business Info,
// Step 3: Region (country + currency), Step 4: Tax, Step 5: Logo, Step 6: Admin
// Step 7: Complete
const TOTAL_ACTIVE_STEPS = 7
const STEP_LABELS = ['Welcome', 'Business Type', 'Business Info', 'Country & Currency', 'Tax Setup', 'Logo', 'Admin Account']

const STEP_FIELDS: Record<number, (keyof FormValues)[]> = {
  0: [], // Welcome — no validation
  1: ['businessType'],
  2: ['businessName'],
  3: ['country', 'currencyCode'],
  4: ['taxModel'],
  5: [], // Logo — optional
  6: ['adminFullName', 'adminUsername', 'adminPassword', 'adminPasswordConfirm']
}

interface SetupWizardProps {
  onComplete: () => void
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState(0)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      currencyCode: 'INR',
      currencySymbol: '₹',
      country: 'India',
      taxModel: 'GST'
    }
  })

  async function nextStep() {
    const fields = STEP_FIELDS[step]
    if (fields?.length) {
      const valid = await form.trigger(fields)
      if (!valid) return
    }
    setStep((s) => s + 1)
  }

  async function onSubmit(values: FormValues) {
    setSubmitError(null)
    const currency = CURRENCIES.find((c) => c.code === values.currencyCode)

    const res = await api.setup.completeSetup({
      businessName: values.businessName,
      businessType: values.businessType,
      ownerName: values.ownerName || undefined,
      country: values.country,
      currencyCode: values.currencyCode,
      currencySymbol: currency?.symbol ?? values.currencySymbol,
      taxModel: values.taxModel,
      phone: values.phone || undefined,
      email: values.email || undefined,
      taxNumber: values.taxNumber || undefined,
      upiId: values.upiId || undefined,
      logoPath: values.logoPath || undefined,
      adminFullName: values.adminFullName,
      adminUsername: values.adminUsername,
      adminPassword: values.adminPassword
    })

    if (!res.success) {
      setSubmitError(res.error?.message ?? 'Setup failed. Please try again.')
      return
    }

    setRecoveryCode((res.data as { recoveryCode?: string } | undefined)?.recoveryCode ?? null)
    setStep(TOTAL_ACTIVE_STEPS)
  }

  const isCompletionStep = step === TOTAL_ACTIVE_STEPS

  return (
    // overflow-y-auto — same install-blocking bug class fixed in
    // DisclaimerScreen.tsx (2026-07-16, real user report): without it, a
    // step whose content is taller than the window (e.g. Business Info,
    // Tax Configuration) pushes Continue below the fold with no way to
    // reach it on a small/short display.
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg">
        {/* Header — icon mark + text, not the wordmark image: the wordmark's
            text is light-colored for the dark splash screen and washes out
            on this light background (bg-surface). */}
        <div className="text-center mb-8">
          <BrandIcon size={56} className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-dark dark:text-slate-100">Sarang Business OS</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 inline-flex items-center gap-1.5">
            Free · Offline · Private · Powered by Aszurex <AszurexMark width={14} />
          </p>
        </div>

        {/* Progress steps */}
        {!isCompletionStep && step > 0 && (
          <div className="flex items-center justify-center gap-1 mb-6 overflow-x-auto px-2">
            {STEP_LABELS.slice(1).map((label, i) => {
              const stepIndex = i + 1
              return (
                <React.Fragment key={label}>
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                      stepIndex < step ? 'bg-success text-white' : stepIndex === step ? 'bg-brand text-white' : 'bg-slate-200 text-slate-400'
                    }`}>
                      {stepIndex < step ? <Check size={11} /> : stepIndex}
                    </div>
                  </div>
                  {i < STEP_LABELS.length - 2 && (
                    <div className={`h-0.5 w-5 shrink-0 transition-colors ${stepIndex < step ? 'bg-success' : 'bg-slate-200'}`} />
                  )}
                </React.Fragment>
              )
            })}
          </div>
        )}

        {/* Card */}
        <Card padding="none" className="shadow-card overflow-hidden">
          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.18 }}
                  className="p-6"
                >
                  {step === 0 && <WelcomeStep />}
                  {step === 1 && <BusinessTypeStep />}
                  {step === 2 && <BusinessInfoStep />}
                  {step === 3 && <RegionStep />}
                  {step === 4 && <TaxStep />}
                  {step === 5 && <LogoStep />}
                  {step === 6 && <AdminStep submitError={submitError} />}
                  {step === 7 && <CompleteStep onComplete={onComplete} recoveryCode={recoveryCode} />}
                </motion.div>
              </AnimatePresence>

              {!isCompletionStep && (
                <div className="px-6 pb-6 flex justify-between items-center border-t border-slate-100 dark:border-slate-800 pt-4">
                  {step > 0 ? (
                    <Button variant="secondary" type="button" size="sm" onClick={() => setStep((s) => s - 1)}>
                      Back
                    </Button>
                  ) : (
                    <span />
                  )}
                  {step < 6 ? (
                    <Button type="button" onClick={nextStep} icon={<ChevronRight size={14} />} iconPosition="right">
                      {step === 0 ? 'Get Started' : 'Continue'}
                    </Button>
                  ) : (
                    <Button type="submit" loading={form.formState.isSubmitting}>
                      Complete Setup
                    </Button>
                  )}
                </div>
              )}
            </form>
          </FormProvider>
        </Card>

        <p className="text-center text-xs text-slate-400 mt-6 inline-flex items-center justify-center gap-1.5 w-full">
          Powered by <span className="text-brand font-medium">Aszurex</span> <AszurexMark width={14} /> · Trust Beyond Limits
        </p>
      </div>
    </div>
  )
}

// ─── Step Components ────────────────────────────────────────────────────────

function WelcomeStep() {
  return (
    <div className="text-center py-2">
      <h2 className="text-xl font-bold text-dark dark:text-slate-100 mb-2">Welcome to your business command centre</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">
        Manage billing, inventory, customers, expenses and more — completely offline, with no subscriptions and no data sharing.
      </p>
      <div className="grid grid-cols-3 gap-3 text-center mb-6">
        {[
          { icon: '🔒', title: 'Privacy First', desc: 'Your data never leaves your device' },
          { icon: '📴', title: 'Works Offline', desc: 'No internet needed for daily use' },
          { icon: '🆓', title: 'Always Free', desc: 'No subscriptions, no hidden fees' }
        ].map((item) => (
          <div key={item.title} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
            <div className="text-xl mb-1">{item.icon}</div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{item.title}</p>
            <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
          </div>
        ))}
      </div>
      <div className="bg-brand/5 border border-brand/20 rounded-lg p-3 text-left">
        <p className="text-xs font-semibold text-brand mb-1">Setup takes about 2 minutes</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">We'll ask about your business type, location, tax preferences, and create your admin account.</p>
      </div>
    </div>
  )
}

function BusinessTypeStep() {
  const { setValue, watch, formState: { errors } } = useFormContext<FormValues>()
  const selected = watch('businessType')
  const [showServicePicker, setShowServicePicker] = useState(false)

  const isServiceSelected = SERVICE_TEMPLATES.some((t) => t.value === selected)
  const selectedServiceLabel = SERVICE_TEMPLATES.find((t) => t.value === selected)?.label

  const serviceGroups = Array.from(new Set(SERVICE_TEMPLATES.map((t) => t.group)))

  if (showServicePicker) {
    return (
      <div>
        <button
          type="button"
          onClick={() => { setShowServicePicker(false); if (isServiceSelected) setValue('businessType', '', { shouldValidate: false }) }}
          className="flex items-center gap-1.5 text-sm text-brand font-medium mb-3 hover:underline"
        >
          <span>&larr;</span> Back to business categories
        </button>
        <h2 className="text-base font-semibold text-dark dark:text-slate-100 mb-1">Select your service type</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">All 24 templates are English-only and include appointment booking, service catalog, and WhatsApp notifications.</p>
        <div className="max-h-72 overflow-y-auto pr-1 space-y-3">
          {serviceGroups.map((group) => (
            <div key={group}>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">{group}</p>
              <div className="grid grid-cols-1 gap-1.5">
                {SERVICE_TEMPLATES.filter((t) => t.group === group).map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => { setValue('businessType', type.value, { shouldValidate: true }); setShowServicePicker(false) }}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${
                      selected === type.value
                        ? 'border-brand bg-brand/5 text-brand'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="text-lg w-6 text-center">{type.icon}</span>
                    <span className="text-sm font-medium flex-1">{type.label}</span>
                    {selected === type.value && <Check size={13} />}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-dark dark:text-slate-100 mb-1">What type of business do you run?</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">This helps us set up the right modules and layout for you.</p>
      {errors.businessType && <p className="text-xs text-danger mb-3">{errors.businessType.message}</p>}
      <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto pr-1">
        {BUSINESS_TYPES.map((type) => (
          <button
            key={type.value}
            type="button"
            onClick={() => setValue('businessType', type.value, { shouldValidate: true })}
            className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
              selected === type.value
                ? 'border-brand bg-brand/5 text-brand'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <span className="text-xl w-7 text-center">{type.icon}</span>
            <span className="text-sm font-medium flex-1">{type.label}</span>
            {selected === type.value && <Check size={15} />}
          </button>
        ))}
        {/* Service Business entry — opens template picker */}
        <button
          type="button"
          onClick={() => setShowServicePicker(true)}
          className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
            isServiceSelected
              ? 'border-brand bg-brand/5 text-brand'
              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
          }`}
        >
          <span className="text-xl w-7 text-center">🧑‍⚕️</span>
          <span className="text-sm font-medium flex-1">
            {isServiceSelected ? `Service: ${selectedServiceLabel}` : 'Service Business (24 types)'}
          </span>
          {isServiceSelected ? <Check size={15} /> : <span className="text-xs text-slate-400">Choose &rarr;</span>}
        </button>
      </div>
    </div>
  )
}

function BusinessInfoStep() {
  const { register, formState: { errors } } = useFormContext<FormValues>()
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-dark dark:text-slate-100 mb-1">Tell us about your business</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">This will appear on all invoices and receipts.</p>
      </div>
      <Input label="Business Name" placeholder="e.g. Sri Ganesh Traders" required error={errors.businessName?.message} {...register('businessName')} />
      <Input label="Owner / Proprietor Name" placeholder="e.g. Vishwas Sharma" {...register('ownerName')} />
      <Input label="Phone Number" placeholder="e.g. +91 98765 43210" type="tel" {...register('phone')} />
      <Input label="Email Address (Optional)" placeholder="e.g. business@example.com" type="email" error={errors.email?.message} {...register('email')} />
    </div>
  )
}

function RegionStep() {
  const { register, setValue, watch, formState: { errors } } = useFormContext<FormValues>()
  const [autoSuggested, setAutoSuggested] = useState(false)

  function handleCountryBlur(e: React.FocusEvent<HTMLInputElement>) {
    const key = e.target.value.trim().toLowerCase()
    const defaults = COUNTRY_DEFAULTS[key]
    if (defaults) {
      setValue('currencyCode', defaults.currencyCode, { shouldValidate: true })
      setValue('currencySymbol', defaults.currencySymbol)
      setValue('taxModel', defaults.taxModel, { shouldValidate: true })
      setAutoSuggested(true)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-dark dark:text-slate-100 mb-1">Country &amp; Currency</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Used for formatting invoices, reports, and tax calculations.</p>
      </div>
      <Input
        label="Country"
        placeholder="e.g. India"
        required
        error={errors.country?.message}
        {...register('country', { onBlur: handleCountryBlur })}
      />
      {autoSuggested && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-xs text-brand bg-brand/5 border border-brand/20 rounded-md px-3 py-2"
        >
          <Sparkles size={12} />
          Currency and tax model auto-suggested based on your country.
        </motion.div>
      )}
      <Select
        label="Currency"
        required
        value={watch('currencyCode')}
        onChange={(e) => {
          const c = CURRENCIES.find((c) => c.code === e.target.value)
          setValue('currencyCode', e.target.value, { shouldValidate: true })
          if (c) setValue('currencySymbol', c.symbol)
          setAutoSuggested(false)
        }}
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>{c.symbol} {c.name} ({c.code})</option>
        ))}
      </Select>
      <Input label="Tax / GST / VAT Number (Optional)" placeholder="e.g. 27AABCU9603R1ZX" {...register('taxNumber')} />
      <Input label="UPI ID (Optional)" placeholder="e.g. mybusiness@upi" {...register('upiId')} hint="Used to generate payment QR codes on invoices." />
    </div>
  )
}

function TaxStep() {
  const { setValue, watch } = useFormContext<FormValues>()
  const selected = watch('taxModel')

  return (
    <div>
      <h2 className="text-base font-semibold text-dark dark:text-slate-100 mb-1">Tax Configuration</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Select the tax model applicable to your country. You can configure specific rates after setup.</p>
      <div className="space-y-2">
        {TAX_MODELS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setValue('taxModel', t.value, { shouldValidate: true })}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
              selected === t.value
                ? 'border-brand bg-brand/5'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <div className="flex-1">
              <p className={`text-sm font-medium ${selected === t.value ? 'text-brand' : 'text-slate-700 dark:text-slate-300'}`}>{t.label}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.description}</p>
            </div>
            {selected === t.value && <Check size={15} className="text-brand shrink-0" />}
          </button>
        ))}
      </div>
    </div>
  )
}

function LogoStep() {
  const { setValue, watch } = useFormContext<FormValues>()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const logoPath = watch('logoPath')

  async function pickLogo() {
    setError(null)
    setUploading(true)
    try {
      const res = await api.dialog.openFile({ title: 'Select Business Logo', accept: ['.jpg', '.jpeg', '.png', '.webp'], maxSizeBytes: 2 * 1024 * 1024 })
      if (res.success && res.data) {
        setValue('logoPath', res.data, { shouldValidate: true })
      } else if (!res.success) {
        setError(res.error?.message ?? 'Could not open file.')
      }
    } catch {
      setError('Could not open file picker.')
    } finally {
      setUploading(false)
    }
  }

  function removeLogo() {
    setValue('logoPath', '', { shouldValidate: false })
    setError(null)
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-dark dark:text-slate-100 mb-1">Business Logo <span className="text-slate-400 font-normal text-sm">(Optional)</span></h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Your logo will appear on invoices and receipts. You can add or change it later in Settings.</p>
      </div>

      {logoPath ? (
        <div className="relative flex flex-col items-center gap-3">
          <div className="w-28 h-28 rounded-xl border-2 border-brand bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden shadow-sm">
            <img
              src={documentLogoUrl(logoPath)}
              alt="Business logo"
              className="max-w-full max-h-full object-contain"
            />
          </div>
          <p className="text-xs text-success font-medium flex items-center gap-1">
            <Check size={12} /> Logo selected
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" type="button" onClick={pickLogo} loading={uploading}>
              Change Logo
            </Button>
            <Button variant="secondary" size="sm" type="button" onClick={removeLogo} icon={<X size={13} />}>
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={pickLogo}
          disabled={uploading}
          className="w-full border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center gap-3 hover:border-brand hover:bg-brand/5 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-brand/10 flex items-center justify-center transition-colors">
            <Upload size={20} className="text-slate-400 group-hover:text-brand transition-colors" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 group-hover:text-brand transition-colors">
              {uploading ? 'Opening file picker…' : 'Click to select a logo'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">JPG, PNG, WEBP · Recommended 200×200 px</p>
          </div>
        </button>
      )}

      {error && (
        <p className="text-xs text-danger bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>
      )}

      <p className="text-xs text-slate-400 text-center">You can skip this step and add a logo later in Settings → Business Profile.</p>
    </div>
  )
}

function AdminStep({ submitError }: { submitError: string | null }) {
  const { register, formState: { errors } } = useFormContext<FormValues>()
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-dark dark:text-slate-100 mb-1">Create Admin Account</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">This account will have full access to manage your business.</p>
      </div>
      <Input label="Full Name" placeholder="e.g. Vishwas Sharma" required error={errors.adminFullName?.message} {...register('adminFullName')} />
      <Input label="Username" placeholder="e.g. admin" required error={errors.adminUsername?.message} hint="Letters, numbers, underscores only." {...register('adminUsername')} />
      <Input label="Password" type="password" placeholder="Create a strong password" required error={errors.adminPassword?.message} {...register('adminPassword')} />
      <Input label="Confirm Password" type="password" placeholder="Repeat your password" required error={errors.adminPasswordConfirm?.message} {...register('adminPasswordConfirm')} />
      {submitError && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-danger bg-red-50 border border-red-100 rounded-md px-3 py-2"
        >
          {submitError}
        </motion.p>
      )}
    </div>
  )
}

function CompleteStep({ onComplete, recoveryCode }: { onComplete: () => void; recoveryCode: string | null }) {
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  async function copyCode() {
    if (!recoveryCode) return
    try {
      await navigator.clipboard.writeText(recoveryCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard permission denied — the code is still shown on screen to copy by hand */ }
  }

  return (
    <div className="text-center py-4">
      <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
        <Check size={32} className="text-success" />
      </div>
      <h2 className="text-xl font-bold text-dark dark:text-slate-100 mb-2">You're all set!</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-xs mx-auto">
        Your business has been configured. Let's start managing your operations.
      </p>

      {recoveryCode && (
        <div className="mb-6 p-4 bg-warning/5 border-2 border-warning/30 rounded-lg text-left">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert size={16} className="text-warning shrink-0" />
            <p className="text-sm font-bold text-dark dark:text-slate-100">Save your Password Recovery Code</p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Sarang works fully offline — there's no email or SMS to reset a forgotten password. This code is the <strong>only</strong> way to reset your password if you ever forget it. Write it down or print it and keep it somewhere safe. <strong>It will never be shown again.</strong>
          </p>
          <div className="flex items-center gap-2 mb-3">
            <code className="flex-1 text-center text-base font-mono font-bold tracking-wider text-dark dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-2.5 px-3 select-all">
              {recoveryCode}
            </code>
            <Button type="button" variant="secondary" size="sm" onClick={copyCode} icon={<Copy size={13} />}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-0.5" />
            <span className="text-xs text-slate-600 dark:text-slate-300">I've saved this recovery code somewhere safe.</span>
          </label>
        </div>
      )}

      <Button onClick={onComplete} size="lg" className="w-full" disabled={!!recoveryCode && !saved}>
        Launch Dashboard
      </Button>
      <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-left">
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Sarang Business OS Lite</p>
        <p className="text-xs text-slate-400 mt-0.5">No subscriptions. No cloud. No tracking. Your data stays on your device.</p>
        <p className="text-xs text-brand mt-1 font-medium inline-flex items-center gap-1.5">
          Powered by Aszurex <AszurexMark width={12} /> · Trust Beyond Limits
        </p>
      </div>
    </div>
  )
}
