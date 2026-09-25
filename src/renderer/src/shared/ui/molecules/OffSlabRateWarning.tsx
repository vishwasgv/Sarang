import { useTranslation } from 'react-i18next'
import { isOffSlabRate, useConfiguredTaxRates } from '@shared/utils/use-configured-tax-rates'

// Soft warning under a document's lines: a typed tax rate that is not one of the configured rates.
// It never blocks saving (a one-off rate is legitimate); it only asks the owner to check it.
export function OffSlabRateWarning({ rates }: { rates: number[] }) {
  const { t } = useTranslation()
  const configured = useConfiguredTaxRates()
  const off = Array.from(new Set(rates.map(Number).filter(r => isOffSlabRate(r, configured))))
  if (off.length === 0) return null
  return (
    <div className="text-xs text-warning space-y-0.5" role="status">
      {off.map(r => <p key={r}>{t('billing.offSlabRate', { rate: r })}</p>)}
    </div>
  )
}
