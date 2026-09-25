import { useTranslation } from 'react-i18next'
import { useBusinessStore } from '@app/store/business.store'
import { getTaxLanguageLock, isIndiaCountry, isPlausibleTaxNumber, resolveCountryCode, taxNumberLabelForCountry } from '@taxpresets'

/**
 * Label and soft format hint for a tax number field. The business's country decides (its preset's label:
 * VAT number, TRN, ABN, EIN...); a party that has its own recognised country typed uses that country instead.
 * India keeps the app's own label and its existing GSTIN and PAN checks; a format is only checked where it is certain,
 * and the hint never blocks saving.
 */
export function useTaxNumberField(partyCountry: string | null | undefined, value: string | null | undefined, fallbackLabel: string): { label: string; placeholder?: string; hint?: string } {
  const { t } = useTranslation()
  const businessCountry = useBusinessStore((s) => s.profile?.country)
  const country = resolveCountryCode(partyCountry) ? partyCountry : businessCountry
  if (isIndiaCountry(country)) return { label: fallbackLabel }
  const presetLabel = taxNumberLabelForCountry(country)
  if (!presetLabel) return { label: fallbackLabel }
  const opts = getTaxLanguageLock(country) === 'en' ? { lng: 'en' } : {}
  return {
    label: presetLabel,
    placeholder: '',
    hint: isPlausibleTaxNumber(country, value) ? undefined : t('common.taxNumberCheck', { label: presetLabel, ...opts })
  }
}
