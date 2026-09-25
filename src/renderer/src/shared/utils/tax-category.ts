import { TAX_CATEGORIES, type TaxCategory } from '../../../../shared/utils/gst-presentation'

export { TAX_CATEGORIES, type TaxCategory }

export const TAX_CATEGORY_LABEL_KEYS: Record<TaxCategory, string> = {
  STANDARD: 'billing.taxCategoryStandard',
  REDUCED: 'billing.taxCategoryReduced',
  ZERO_RATED: 'billing.taxCategoryZeroRated',
  EXEMPT: 'billing.taxCategoryExempt',
  NIL_RATED: 'billing.taxCategoryNilRated',
  OUT_OF_SCOPE: 'billing.taxCategoryOutOfScope'
}
