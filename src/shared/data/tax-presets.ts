// Country tax presets: the tax model, local tax name, standard, reduced and zero rates, tax number label and
// cash-rounding and tax-inclusive hints for each supported country.
//
// RATES CHANGE. Every entry was checked against the sources listed in its own `sources` array on `asOf`
// (2026-09-25); governments change rates, temporary cuts expire and thresholds move, so an owner must still
// confirm a rate with their accountant, and the Settings screen shows the `asOf` date next to the button.
//
// Gating: a preset is only ever loaded or offered for the business's own country (see tax-preset.service.ts).
// Nothing here is applied silently: `suggestedRounding` and `pricesUsuallyIncludeTax` are suggestions the owner confirms.
//
// taxModel is the model the app runs: 'GST' is India only (CGST + SGST, IGST and GST-only reports). Countries that
// call their tax GST (Australia, New Zealand, Singapore, Canada) run as 'VAT' (one tax line) and show their own
// `taxLabel` instead. Countries with more than one tax on a line (Brazil, and the US state, county and city layers)
// need multi-tax support and are not included as full presets; the US preset provides the mechanism only.
//
// Excluded (could not be reduced to a verifiable single rate list): Brazil (ICMS by state, ISS by municipality,
// PIS/COFINS and the 2026 reform transition).

export type TaxModelKind = 'GST' | 'VAT' | 'SALES_TAX' | 'CUSTOM' | 'NONE'
export type TaxRateCategory = 'STANDARD' | 'REDUCED' | 'ZERO_RATED' | 'EXEMPT' | 'NIL_RATED' | 'OUT_OF_SCOPE'
export type SuggestedRounding = '0.05' | '0.10' | '0.50' | '1'

export const TAX_RATE_CATEGORIES: readonly TaxRateCategory[] = ['STANDARD', 'REDUCED', 'ZERO_RATED', 'EXEMPT', 'NIL_RATED', 'OUT_OF_SCOPE']

/** The 13 interface languages of the app. */
export const INTERFACE_LANGUAGES: readonly string[] = ['en', 'hi', 'mr', 'gu', 'kn', 'ta', 'te', 'ml', 'es', 'fr', 'pt', 'ar', 'id']

export interface TaxPresetRate {
  name: string
  rate: number
  category: TaxRateCategory
  isDefault?: boolean
  note?: string
}

export interface TaxPreset {
  code: string
  name: string
  currency: string
  taxModel: TaxModelKind
  /** What the tax is called locally on invoices (VAT, GST, IVA, TVA, MwSt, Sales Tax). */
  taxLabel: string
  rates: TaxPresetRate[]
  taxNumberLabel: string
  /** Only present when the format is certain. Matched against the number without spaces, dots or hyphens, upper-cased. */
  taxNumberPattern?: RegExp
  /** Main languages of the country (ISO 639-1); languageLock is derived from these against the 13 interface languages. */
  languages: string[]
  /** 'en' when none of the country's main languages is an interface language: its tax names and notes always show in English. */
  languageLock: 'en' | null
  suggestedRounding?: SuggestedRounding
  pricesUsuallyIncludeTax: boolean
  asOf: string
  sources: string[]
  notes?: string[]
}

const AS_OF = '2026-09-25'

const TF_EU = 'https://taxfoundation.org/data/all/eu/value-added-tax-vat-rates-europe/'
const EUROFISCALIS = 'https://www.eurofiscalis.com/en/vat-rates-in-ue/'
const VATUPDATE_GLOBAL = 'https://www.vatupdate.com/2026/01/05/global-vat-rates-by-country-2026-standard-and-reduced-rates/'
const CASH_ROUNDING = 'https://en.wikipedia.org/wiki/Cash_rounding'
const pwc = (slug: string) => `https://taxsummaries.pwc.com/${slug}/corporate/other-taxes`

const r = (name: string, rate: number, category: TaxRateCategory, extra: { isDefault?: boolean; note?: string } = {}): TaxPresetRate => ({ name, rate, category, ...extra })
const std = (name: string, rate: number, note?: string) => r(name, rate, 'STANDARD', { isDefault: true, ...(note ? { note } : {}) })
const red = (name: string, rate: number, note?: string) => r(name, rate, 'REDUCED', note ? { note } : {})
const zero = (name: string, note?: string) => r(name, 0, 'ZERO_RATED', note ? { note } : {})

function lockFor(languages: string[]): 'en' | null {
  return languages.some((l) => INTERFACE_LANGUAGES.includes(l)) ? null : 'en'
}

type PresetInput = Omit<TaxPreset, 'languageLock' | 'asOf'>
const make = (p: PresetInput): TaxPreset => ({ ...p, languageLock: lockFor(p.languages), asOf: AS_OF })

const RATES_CHANGE_NOTE = 'Tax rates change. Confirm them with your accountant or the tax authority before you rely on them.'

const PRESET_LIST: TaxPreset[] = [
  make({
    code: 'IN', name: 'India', currency: 'INR', taxModel: 'GST', taxLabel: 'GST',
    rates: [
      std('GST 18%', 18),
      red('GST 5%', 5),
      r('GST 40%', 40, 'STANDARD'),
      red('GST 3%', 3, 'Gold, silver and jewellery'),
      red('GST 0.25%', 0.25, 'Rough diamonds'),
      zero('GST 0%')
    ],
    taxNumberLabel: 'GSTIN', languages: ['hi', 'mr', 'gu', 'kn', 'ta', 'te', 'ml', 'en'], pricesUsuallyIncludeTax: false,
    sources: ['https://www.cbic.gov.in/'],
    notes: ['India keeps its existing GST behaviour (CGST + SGST, IGST, GSTIN and PAN). Rates follow the structure in force from 22 September 2025.']
  }),
  make({
    code: 'GB', name: 'United Kingdom', currency: 'GBP', taxModel: 'VAT', taxLabel: 'VAT',
    rates: [std('VAT 20%', 20), red('VAT 5%', 5, 'For example home energy and children\'s car seats'), zero('VAT 0%', 'Most food and children\'s clothes')],
    taxNumberLabel: 'VAT registration number', taxNumberPattern: /^(GB)?(\d{9}|\d{12}|GD\d{3}|HA\d{3})$/,
    languages: ['en'], pricesUsuallyIncludeTax: true,
    sources: ['https://www.gov.uk/vat-rates', TF_EU]
  }),
  make({
    code: 'IE', name: 'Ireland', currency: 'EUR', taxModel: 'VAT', taxLabel: 'VAT',
    rates: [
      std('VAT 23%', 23), red('VAT 13.5%', 13.5, 'Reduced rate, for example construction, cleaning and hotel accommodation'),
      red('VAT 9%', 9, 'Second reduced rate. From 1 July 2026 it also covers restaurant, catering and hot takeaway food and hairdressing'),
      red('VAT 4.8%', 4.8, 'Livestock rate'), zero('VAT 0%', 'Basic food, children\'s clothing, oral medicines, books')
    ],
    taxNumberLabel: 'VAT number', languages: ['en', 'ga'], suggestedRounding: '0.05', pricesUsuallyIncludeTax: true,
    sources: ['https://www.ibec.ie/sfa/news-insights-and-events/insights/2026/07/14/vat-rates-in-ireland-2026---what-changed-from-1-july', TF_EU, CASH_ROUNDING]
  }),
  make({
    code: 'DE', name: 'Germany', currency: 'EUR', taxModel: 'VAT', taxLabel: 'MwSt',
    rates: [std('VAT 19%', 19), red('VAT 7%', 7)],
    taxNumberLabel: 'VAT ID (USt-IdNr.)', taxNumberPattern: /^(DE)?\d{9}$/, languages: ['de'], pricesUsuallyIncludeTax: true,
    sources: [TF_EU, EUROFISCALIS],
    notes: ['Sources disagree on whether restaurant food is at 7% from 1 January 2026; confirm the rate for meals.']
  }),
  make({
    code: 'FR', name: 'France', currency: 'EUR', taxModel: 'VAT', taxLabel: 'TVA',
    rates: [std('VAT 20%', 20), red('VAT 10%', 10), red('VAT 5.5%', 5.5), red('VAT 2.1%', 2.1)],
    taxNumberLabel: 'TVA number (VAT number)', taxNumberPattern: /^(FR)?[A-Z0-9]{2}\d{9}$/, languages: ['fr'], pricesUsuallyIncludeTax: true,
    sources: [TF_EU, EUROFISCALIS],
    notes: ['Corsica and the overseas departments have their own rates.']
  }),
  make({
    code: 'IT', name: 'Italy', currency: 'EUR', taxModel: 'VAT', taxLabel: 'IVA',
    rates: [std('VAT 22%', 22), red('VAT 10%', 10), red('VAT 5%', 5), red('VAT 4%', 4)],
    taxNumberLabel: 'Partita IVA (VAT number)', taxNumberPattern: /^(IT)?\d{11}$/, languages: ['it'], suggestedRounding: '0.05', pricesUsuallyIncludeTax: true,
    sources: [TF_EU, EUROFISCALIS, CASH_ROUNDING],
    notes: ['Italy requires electronic invoicing through a government platform; Sarang cannot submit invoices.']
  }),
  make({
    code: 'ES', name: 'Spain', currency: 'EUR', taxModel: 'VAT', taxLabel: 'IVA',
    rates: [std('VAT 21%', 21), red('VAT 10%', 10), red('VAT 4%', 4)],
    taxNumberLabel: 'NIF / VAT number', taxNumberPattern: /^(ES)?[A-Z0-9]\d{7}[A-Z0-9]$/, languages: ['es', 'ca', 'eu', 'gl'], pricesUsuallyIncludeTax: true,
    sources: [TF_EU, EUROFISCALIS],
    notes: ['The Canary Islands, Ceuta and Melilla use different indirect taxes that are not included here.']
  }),
  make({
    code: 'NL', name: 'Netherlands', currency: 'EUR', taxModel: 'VAT', taxLabel: 'BTW',
    rates: [std('VAT 21%', 21), red('VAT 9%', 9)],
    taxNumberLabel: 'BTW-id (VAT number)', taxNumberPattern: /^(NL)?\d{9}B\d{2}$/, languages: ['nl'], suggestedRounding: '0.05', pricesUsuallyIncludeTax: true,
    sources: [TF_EU, EUROFISCALIS, CASH_ROUNDING],
    notes: ['Accommodation moved from 9% to 21% in 2026.']
  }),
  make({
    code: 'PT', name: 'Portugal', currency: 'EUR', taxModel: 'VAT', taxLabel: 'IVA',
    rates: [std('VAT 23%', 23), red('VAT 13%', 13), red('VAT 6%', 6)],
    taxNumberLabel: 'NIF (VAT number)', taxNumberPattern: /^(PT)?\d{9}$/, languages: ['pt'], pricesUsuallyIncludeTax: true,
    sources: [TF_EU, EUROFISCALIS],
    notes: ['Rates are for mainland Portugal; Madeira and the Azores apply lower rates that are not included here.']
  }),
  make({
    code: 'BE', name: 'Belgium', currency: 'EUR', taxModel: 'VAT', taxLabel: 'BTW/TVA',
    rates: [std('VAT 21%', 21), red('VAT 12%', 12), red('VAT 6%', 6)],
    taxNumberLabel: 'VAT number (BTW/TVA)', taxNumberPattern: /^(BE)?[01]\d{9}$/, languages: ['nl', 'fr', 'de'], suggestedRounding: '0.05', pricesUsuallyIncludeTax: true,
    sources: [TF_EU, EUROFISCALIS, CASH_ROUNDING]
  }),
  make({
    code: 'AT', name: 'Austria', currency: 'EUR', taxModel: 'VAT', taxLabel: 'USt',
    rates: [std('VAT 20%', 20), red('VAT 13%', 13), red('VAT 10%', 10)],
    taxNumberLabel: 'UID number (VAT ID)', taxNumberPattern: /^(AT)?U\d{8}$/, languages: ['de'], pricesUsuallyIncludeTax: true,
    sources: [TF_EU, EUROFISCALIS]
  }),
  make({
    code: 'PL', name: 'Poland', currency: 'PLN', taxModel: 'VAT', taxLabel: 'VAT (PTU)',
    rates: [std('VAT 23%', 23), red('VAT 8%', 8), red('VAT 5%', 5)],
    taxNumberLabel: 'NIP (VAT number)', taxNumberPattern: /^(PL)?\d{10}$/, languages: ['pl'], pricesUsuallyIncludeTax: true,
    sources: [TF_EU, EUROFISCALIS]
  }),
  make({
    code: 'SE', name: 'Sweden', currency: 'SEK', taxModel: 'VAT', taxLabel: 'Moms',
    rates: [std('VAT 25%', 25), red('VAT 12%', 12), red('VAT 6%', 6)],
    taxNumberLabel: 'VAT number (momsregistreringsnummer)', taxNumberPattern: /^(SE)?\d{12}$/, languages: ['sv'], suggestedRounding: '1', pricesUsuallyIncludeTax: true,
    sources: [TF_EU, EUROFISCALIS, CASH_ROUNDING]
  }),
  make({
    code: 'DK', name: 'Denmark', currency: 'DKK', taxModel: 'VAT', taxLabel: 'Moms',
    rates: [std('VAT 25%', 25)],
    taxNumberLabel: 'CVR number', taxNumberPattern: /^(DK)?\d{8}$/, languages: ['da'], suggestedRounding: '0.50', pricesUsuallyIncludeTax: true,
    sources: [TF_EU, EUROFISCALIS, CASH_ROUNDING],
    notes: ['Denmark has one VAT rate and no reduced rates.']
  }),
  make({
    code: 'CH', name: 'Switzerland', currency: 'CHF', taxModel: 'VAT', taxLabel: 'MWST',
    rates: [std('VAT 8.1%', 8.1), red('VAT 2.6%', 2.6, 'Reduced rate: food (not alcohol), medicines, printed matter'), red('VAT 3.8%', 3.8, 'Special rate for accommodation')],
    taxNumberLabel: 'UID / MWST number', taxNumberPattern: /^CHE\d{9}(MWST|TVA|IVA)?$/, languages: ['de', 'fr', 'it'], suggestedRounding: '0.05', pricesUsuallyIncludeTax: true,
    sources: ['https://www.estv.admin.ch/estv/en/home/value-added-tax/vat-rates-switzerland.html', TF_EU, CASH_ROUNDING]
  }),
  make({
    code: 'AE', name: 'United Arab Emirates', currency: 'AED', taxModel: 'VAT', taxLabel: 'VAT',
    rates: [std('VAT 5%', 5), zero('VAT 0%', 'Exports, international transport, first residential sales, some healthcare and education')],
    taxNumberLabel: 'TRN (Tax Registration Number)', taxNumberPattern: /^\d{15}$/, languages: ['ar', 'en'], pricesUsuallyIncludeTax: true,
    sources: [pwc('united-arab-emirates'), VATUPDATE_GLOBAL],
    notes: ['E-invoicing rules that need a government platform are not supported offline.']
  }),
  make({
    code: 'SA', name: 'Saudi Arabia', currency: 'SAR', taxModel: 'VAT', taxLabel: 'VAT',
    rates: [std('VAT 15%', 15), zero('VAT 0%', 'Exports and other zero-rated supplies')],
    taxNumberLabel: 'VAT registration number', taxNumberPattern: /^3\d{13}3$/, languages: ['ar'], pricesUsuallyIncludeTax: true,
    sources: [pwc('saudi-arabia'), VATUPDATE_GLOBAL],
    notes: ['The e-invoicing (Fatoora) integration phases need the government platform and are not supported offline.']
  }),
  make({
    code: 'OM', name: 'Oman', currency: 'OMR', taxModel: 'VAT', taxLabel: 'VAT',
    rates: [std('VAT 5%', 5), zero('VAT 0%', 'Exports, international transport, basic food items')],
    taxNumberLabel: 'VAT registration number (VATIN)', languages: ['ar'], pricesUsuallyIncludeTax: true,
    sources: [pwc('oman'), VATUPDATE_GLOBAL]
  }),
  make({
    code: 'BH', name: 'Bahrain', currency: 'BHD', taxModel: 'VAT', taxLabel: 'VAT',
    rates: [std('VAT 10%', 10), zero('VAT 0%')],
    taxNumberLabel: 'VAT account number', languages: ['ar'], pricesUsuallyIncludeTax: true,
    sources: [pwc('bahrain'), VATUPDATE_GLOBAL]
  }),
  make({
    code: 'QA', name: 'Qatar', currency: 'QAR', taxModel: 'NONE', taxLabel: 'Tax',
    rates: [],
    taxNumberLabel: 'Tax card number', languages: ['ar'], pricesUsuallyIncludeTax: false,
    sources: [pwc('qatar')],
    notes: ['Qatar has no VAT or sales tax at present. A GCC-framework VAT is expected; add a rate manually if it starts.']
  }),
  make({
    code: 'KW', name: 'Kuwait', currency: 'KWD', taxModel: 'NONE', taxLabel: 'Tax',
    rates: [],
    taxNumberLabel: 'Tax number', languages: ['ar'], pricesUsuallyIncludeTax: false,
    sources: [pwc('kuwait')],
    notes: ['Kuwait has no VAT at present; the GCC framework is still with parliament. Add a rate manually if it starts.']
  }),
  make({
    code: 'EG', name: 'Egypt', currency: 'EGP', taxModel: 'VAT', taxLabel: 'VAT',
    rates: [std('VAT 14%', 14), red('VAT 5%', 5, 'Machinery and equipment for production lines'), zero('VAT 0%', 'Exports')],
    taxNumberLabel: 'Tax registration number', languages: ['ar'], pricesUsuallyIncludeTax: true,
    sources: [pwc('egypt'), VATUPDATE_GLOBAL],
    notes: ['E-invoicing is mandatory in Egypt through a government platform that Sarang cannot submit to.']
  }),
  make({
    code: 'TR', name: 'Turkey', currency: 'TRY', taxModel: 'VAT', taxLabel: 'KDV',
    rates: [std('VAT 20%', 20), red('VAT 10%', 10, 'Basic foodstuffs, textiles, books'), red('VAT 1%', 1, 'Some agricultural products')],
    taxNumberLabel: 'VKN (tax number)', languages: ['tr'], pricesUsuallyIncludeTax: true,
    sources: [pwc('turkey'), VATUPDATE_GLOBAL]
  }),
  make({
    code: 'IL', name: 'Israel', currency: 'ILS', taxModel: 'VAT', taxLabel: 'VAT',
    rates: [std('VAT 18%', 18), zero('VAT 0%', 'Exports of goods and certain services')],
    taxNumberLabel: 'Authorised dealer number', languages: ['he'], suggestedRounding: '0.10', pricesUsuallyIncludeTax: true,
    sources: [pwc('israel'), VATUPDATE_GLOBAL, CASH_ROUNDING],
    notes: ['Arabic is spoken by a large minority; the main language is treated as Hebrew, so tax labels stay in English.']
  }),
  make({
    code: 'AU', name: 'Australia', currency: 'AUD', taxModel: 'VAT', taxLabel: 'GST',
    rates: [std('GST 10%', 10), zero('GST-free 0%', 'Basic food, exports, most health and education supplies')],
    taxNumberLabel: 'ABN (Australian Business Number)', taxNumberPattern: /^\d{11}$/, languages: ['en'], suggestedRounding: '0.05', pricesUsuallyIncludeTax: true,
    sources: [pwc('australia'), VATUPDATE_GLOBAL, CASH_ROUNDING]
  }),
  make({
    code: 'NZ', name: 'New Zealand', currency: 'NZD', taxModel: 'VAT', taxLabel: 'GST',
    rates: [std('GST 15%', 15), zero('GST 0%', 'Exports and certain supplies')],
    taxNumberLabel: 'GST number (IRD number)', taxNumberPattern: /^\d{8,9}$/, languages: ['en', 'mi'], suggestedRounding: '0.10', pricesUsuallyIncludeTax: true,
    sources: [pwc('new-zealand'), VATUPDATE_GLOBAL, CASH_ROUNDING]
  }),
  make({
    code: 'SG', name: 'Singapore', currency: 'SGD', taxModel: 'VAT', taxLabel: 'GST',
    rates: [std('GST 9%', 9), zero('GST 0%', 'Exports and international services')],
    taxNumberLabel: 'GST registration number', languages: ['en', 'zh', 'ms', 'ta'], suggestedRounding: '0.05', pricesUsuallyIncludeTax: true,
    sources: [pwc('singapore'), VATUPDATE_GLOBAL, CASH_ROUNDING]
  }),
  make({
    code: 'MY', name: 'Malaysia', currency: 'MYR', taxModel: 'CUSTOM', taxLabel: 'SST',
    rates: [
      std('Service tax 8%', 8, 'Default only because most service providers charge it; choose the tax that applies to your registration'),
      red('Service tax 6%', 6, 'Food and beverage, telecommunications, parking, logistics and other listed services'),
      r('Sales tax 10%', 10, 'STANDARD', { note: 'Manufactured and imported goods' }),
      red('Sales tax 5%', 5, 'Selected goods')
    ],
    taxNumberLabel: 'SST registration number', languages: ['ms', 'en'], suggestedRounding: '0.05', pricesUsuallyIncludeTax: false,
    sources: [pwc('malaysia'), 'https://www.bdo.global/en-gb/insights/tax/indirect-tax/malaysia-changes-made-to-sales-and-service-tax', CASH_ROUNDING],
    notes: ['Malaysia charges two separate taxes, sales tax and service tax, each single-stage; most retailers charge neither.']
  }),
  make({
    code: 'TH', name: 'Thailand', currency: 'THB', taxModel: 'VAT', taxLabel: 'VAT',
    rates: [std('VAT 7%', 7, 'Reduced from the statutory 10%; the reduction is set to run to 30 September 2027 unless extended')],
    taxNumberLabel: 'Tax ID', taxNumberPattern: /^\d{13}$/, languages: ['th'], pricesUsuallyIncludeTax: false,
    sources: [pwc('thailand'), 'https://www.nationthailand.com/news/policy/40069105']
  }),
  make({
    code: 'ID', name: 'Indonesia', currency: 'IDR', taxModel: 'VAT', taxLabel: 'PPN',
    rates: [
      std('VAT 11%', 11, 'Effective rate on most goods and services: the 12% statutory rate on 11/12 of the price'),
      red('VAT 12%', 12, 'Luxury goods and services')
    ],
    taxNumberLabel: 'NPWP (tax number)', languages: ['id'], pricesUsuallyIncludeTax: false,
    sources: ['https://setkab.go.id/en/president-prabowo-12-vat-imposed-only-on-luxury-goods-services/', VATUPDATE_GLOBAL]
  }),
  make({
    code: 'PH', name: 'Philippines', currency: 'PHP', taxModel: 'VAT', taxLabel: 'VAT',
    rates: [std('VAT 12%', 12), zero('VAT 0%', 'Export sales by VAT-registered persons')],
    taxNumberLabel: 'TIN (Tax Identification Number)', languages: ['fil', 'en'], pricesUsuallyIncludeTax: false,
    sources: [pwc('philippines'), VATUPDATE_GLOBAL]
  }),
  make({
    code: 'VN', name: 'Vietnam', currency: 'VND', taxModel: 'VAT', taxLabel: 'VAT (GTGT)',
    rates: [
      std('VAT 10%', 10), red('VAT 8%', 8, 'Temporary 2 point reduction for listed goods and services from 1 July 2025 to 31 December 2026'),
      red('VAT 5%', 5), zero('VAT 0%', 'Exports')
    ],
    taxNumberLabel: 'Tax code (Ma so thue)', languages: ['vi'], pricesUsuallyIncludeTax: false,
    sources: [pwc('vietnam'), VATUPDATE_GLOBAL]
  }),
  make({
    code: 'JP', name: 'Japan', currency: 'JPY', taxModel: 'VAT', taxLabel: 'Consumption tax',
    rates: [std('Consumption tax 10%', 10), red('Consumption tax 8%', 8, 'Food and drink other than restaurant meals and alcohol; some newspaper subscriptions')],
    taxNumberLabel: 'Invoice registration number (T + 13 digits)', taxNumberPattern: /^T\d{13}$/, languages: ['ja'], pricesUsuallyIncludeTax: true,
    sources: [pwc('japan'), VATUPDATE_GLOBAL]
  }),
  make({
    code: 'KR', name: 'South Korea', currency: 'KRW', taxModel: 'VAT', taxLabel: 'VAT',
    rates: [std('VAT 10%', 10), zero('VAT 0%', 'Exports and international transport')],
    taxNumberLabel: 'Business registration number', taxNumberPattern: /^\d{10}$/, languages: ['ko'], pricesUsuallyIncludeTax: true,
    sources: [pwc('republic-of-korea'), VATUPDATE_GLOBAL]
  }),
  make({
    code: 'CN', name: 'China', currency: 'CNY', taxModel: 'VAT', taxLabel: 'VAT',
    rates: [
      std('VAT 13%', 13), red('VAT 9%', 9, 'Necessities and transport'), red('VAT 6%', 6, 'Financial and digital services'),
      red('VAT 1%', 1, 'Small-scale taxpayers, 1 January 2023 to 31 December 2027')
    ],
    taxNumberLabel: 'Unified social credit code', taxNumberPattern: /^[0-9A-Z]{18}$/, languages: ['zh'], pricesUsuallyIncludeTax: true,
    sources: [pwc('peoples-republic-of-china'), VATUPDATE_GLOBAL]
  }),
  make({
    code: 'HK', name: 'Hong Kong', currency: 'HKD', taxModel: 'NONE', taxLabel: 'Tax',
    rates: [],
    taxNumberLabel: 'Business registration number', languages: ['zh', 'en'], suggestedRounding: '0.10', pricesUsuallyIncludeTax: false,
    sources: [pwc('hong-kong-sar'), CASH_ROUNDING],
    notes: ['Hong Kong has no VAT, GST or sales tax.']
  }),
  make({
    code: 'PK', name: 'Pakistan', currency: 'PKR', taxModel: 'SALES_TAX', taxLabel: 'Sales Tax',
    rates: [std('Sales tax 18%', 18, 'Goods')],
    taxNumberLabel: 'STRN (Sales Tax Registration Number)', languages: ['ur', 'en'], pricesUsuallyIncludeTax: false,
    sources: [pwc('pakistan'), VATUPDATE_GLOBAL],
    notes: ['Services are taxed at 15% to 16% depending on the province; add the rate for your province manually.']
  }),
  make({
    code: 'BD', name: 'Bangladesh', currency: 'BDT', taxModel: 'VAT', taxLabel: 'VAT',
    rates: [std('VAT 15%', 15), red('VAT 10%', 10), red('VAT 7.5%', 7.5), red('VAT 5%', 5)],
    taxNumberLabel: 'BIN (Business Identification Number)', languages: ['bn'], pricesUsuallyIncludeTax: false,
    sources: [pwc('bangladesh'), VATUPDATE_GLOBAL],
    notes: ['Other reduced rates (1.5%, 2%, 2.4% and 4.5%) apply to specific goods and services; add them manually if you need them.']
  }),
  make({
    code: 'LK', name: 'Sri Lanka', currency: 'LKR', taxModel: 'VAT', taxLabel: 'VAT',
    rates: [std('VAT 18%', 18)],
    taxNumberLabel: 'VAT registration number', languages: ['si', 'ta'], pricesUsuallyIncludeTax: false,
    sources: ['https://www.vatcalc.com/sri-lanka/', 'https://kpmg.com/us/en/taxnewsflash/news/2026/04/sri-lanka-importation-supply-fabric-vat-rate.html', VATUPDATE_GLOBAL],
    notes: ['A separate higher rate applies to financial services; add it manually if you need it.']
  }),
  make({
    code: 'NP', name: 'Nepal', currency: 'NPR', taxModel: 'VAT', taxLabel: 'VAT',
    rates: [std('VAT 13%', 13)],
    taxNumberLabel: 'PAN / VAT number', languages: ['ne'], pricesUsuallyIncludeTax: false,
    sources: ['https://lookuptax.com/docs/country/nepal-vat-guidelines-indirect-tax', VATUPDATE_GLOBAL],
    notes: ['A 5% rate applies only to ride-sharing and delivery platform fares and to household electricity above 50 units; add it manually if you need it.']
  }),
  make({
    code: 'ZA', name: 'South Africa', currency: 'ZAR', taxModel: 'VAT', taxLabel: 'VAT',
    rates: [std('VAT 15%', 15), zero('VAT 0%', 'Exports and basic foodstuffs')],
    taxNumberLabel: 'VAT registration number', taxNumberPattern: /^4\d{9}$/, languages: ['en', 'zu', 'af'], pricesUsuallyIncludeTax: true,
    sources: [pwc('south-africa'), VATUPDATE_GLOBAL]
  }),
  make({
    code: 'KE', name: 'Kenya', currency: 'KES', taxModel: 'VAT', taxLabel: 'VAT',
    rates: [std('VAT 16%', 16), red('VAT 8%', 8, 'Fuel'), zero('VAT 0%')],
    taxNumberLabel: 'KRA PIN', taxNumberPattern: /^[AP]\d{9}[A-Z]$/, languages: ['en', 'sw'], pricesUsuallyIncludeTax: true,
    sources: [pwc('kenya'), VATUPDATE_GLOBAL]
  }),
  make({
    code: 'NG', name: 'Nigeria', currency: 'NGN', taxModel: 'VAT', taxLabel: 'VAT',
    rates: [std('VAT 7.5%', 7.5), zero('VAT 0%', 'Basic food items, exports')],
    taxNumberLabel: 'TIN (Tax Identification Number)', languages: ['en'], pricesUsuallyIncludeTax: false,
    sources: [pwc('nigeria'), VATUPDATE_GLOBAL]
  }),
  make({
    code: 'GH', name: 'Ghana', currency: 'GHS', taxModel: 'VAT', taxLabel: 'VAT',
    rates: [
      std('VAT + levies 20%', 20, 'VAT 15% plus health insurance levy 2.5% plus education trust fund levy 2.5%, all on the same price, since 1 January 2026'),
      zero('VAT 0%', 'Exports')
    ],
    taxNumberLabel: 'TIN (Tax Identification Number)', languages: ['en'], pricesUsuallyIncludeTax: false,
    sources: [pwc('ghana'), 'https://www.fas.usda.gov/data/gain/2026/02/ghana-ghana-tax-reforms-2026-impact-us-origin-food-and-agricultural-products-imports-and', VATUPDATE_GLOBAL],
    notes: ['The three components are stored as one 20% line until multi-tax lines are available.']
  }),
  make({
    code: 'CA', name: 'Canada', currency: 'CAD', taxModel: 'VAT', taxLabel: 'GST/HST',
    rates: [
      std('GST 5%', 5, 'Federal rate. Alberta and the territories charge only this'),
      zero('GST 0%', 'Zero-rated supplies such as basic groceries and exports'),
      r('HST 13%', 13, 'STANDARD', { note: 'Ontario' }),
      r('HST 14%', 14, 'STANDARD', { note: 'Nova Scotia, since 1 April 2025' }),
      r('HST 15%', 15, 'STANDARD', { note: 'New Brunswick, Newfoundland and Labrador, Prince Edward Island' }),
      r('GST + QST 14.975%', 14.975, 'STANDARD', { note: 'Quebec: 5% GST plus 9.975% QST, stored as one combined line' }),
      r('GST + PST 12%', 12, 'STANDARD', { note: 'British Columbia (7% PST) or Manitoba (7% RST), stored as one combined line' }),
      r('GST + PST 11%', 11, 'STANDARD', { note: 'Saskatchewan (6% PST), stored as one combined line' })
    ],
    taxNumberLabel: 'GST/HST number (Business Number)', taxNumberPattern: /^\d{9}(RT\d{4})?$/, languages: ['en', 'fr'], suggestedRounding: '0.05', pricesUsuallyIncludeTax: false,
    sources: ['https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate.html', 'https://www.taxtips.ca/salestaxes/sales-tax-rates-2026.htm', pwc('canada'), CASH_ROUNDING],
    notes: ['Provincial taxes vary. Combined rows are a single-line stand-in until GST and provincial tax can be shown as two lines.']
  }),
  make({
    code: 'US', name: 'United States', currency: 'USD', taxModel: 'SALES_TAX', taxLabel: 'Sales Tax',
    rates: [r('Sales tax 0% (add your state rate)', 0, 'OUT_OF_SCOPE', { isDefault: true, note: 'The United States has no federal sales tax' })],
    taxNumberLabel: 'EIN (Employer Identification Number)', taxNumberPattern: /^\d{9}$/, languages: ['en'], pricesUsuallyIncludeTax: false,
    sources: ['https://taxfoundation.org/data/all/state/sales-tax-rates/'],
    notes: ['There is no federal sales tax. State, county and city rates differ and are not listed here: add the rate for your location with Add Tax.']
  }),
  make({
    code: 'MX', name: 'Mexico', currency: 'MXN', taxModel: 'VAT', taxLabel: 'IVA',
    rates: [std('VAT 16%', 16), zero('VAT 0%', 'Exports, basic foodstuffs, medicines, books')],
    taxNumberLabel: 'RFC', taxNumberPattern: /^[A-Z&]{3,4}\d{6}[A-Z0-9]{3}$/, languages: ['es'], pricesUsuallyIncludeTax: true,
    sources: [pwc('mexico'), VATUPDATE_GLOBAL],
    notes: ['A reduced regime exists for the northern and southern border regions; check with your accountant.']
  }),
  make({
    code: 'AR', name: 'Argentina', currency: 'ARS', taxModel: 'VAT', taxLabel: 'IVA',
    rates: [std('VAT 21%', 21), red('VAT 10.5%', 10.5, 'Housing construction, some transport, live cattle and certain capital goods'), r('VAT 27%', 27, 'STANDARD', { note: 'Utilities: telecommunications, gas, water and energy not for residential use' })],
    taxNumberLabel: 'CUIT', taxNumberPattern: /^\d{11}$/, languages: ['es'], pricesUsuallyIncludeTax: true,
    sources: [pwc('argentina'), VATUPDATE_GLOBAL]
  }),
  make({
    code: 'CL', name: 'Chile', currency: 'CLP', taxModel: 'VAT', taxLabel: 'IVA',
    rates: [std('VAT 19%', 19)],
    taxNumberLabel: 'RUT', languages: ['es'], pricesUsuallyIncludeTax: true,
    sources: [pwc('chile'), VATUPDATE_GLOBAL]
  }),
  make({
    code: 'CO', name: 'Colombia', currency: 'COP', taxModel: 'VAT', taxLabel: 'IVA',
    rates: [std('VAT 19%', 19), red('VAT 5%', 5, 'Some agricultural products and electric vehicles'), zero('VAT 0%', 'Exports, meat, dairy')],
    taxNumberLabel: 'NIT', languages: ['es'], pricesUsuallyIncludeTax: true,
    sources: [pwc('colombia'), VATUPDATE_GLOBAL]
  })
]

for (const p of PRESET_LIST) {
  p.notes = [...(p.notes ?? []), RATES_CHANGE_NOTE]
}

/** Country names for a picker, sorted; typing any other country still works. */
export const TAX_COUNTRY_NAMES: readonly string[] = PRESET_LIST.map((p) => p.name).sort((a, b) => a.localeCompare(b))

export const TAX_PRESETS: Readonly<Record<string, TaxPreset>> = Object.fromEntries(PRESET_LIST.map((p) => [p.code, p]))

/** Countries that were checked and left out on purpose, with the reason (kept next to the data so it is not lost). */
export const EXCLUDED_TAX_PRESET_COUNTRIES: ReadonlyArray<{ code: string; name: string; reason: string }> = [
  { code: 'BR', name: 'Brazil', reason: 'Several taxes apply to one sale (ICMS 17% to 20% by state, ISS 2% to 5% by municipality, IPI, PIS/COFINS) and 2026 is a reform pilot year; there is no single verifiable rate list. Needs multi-tax lines.' }
]

// ---------------------------------------------------------------- country resolution
// BusinessProfile.country is free text typed in the setup wizard, so it is matched by name, common short forms
// and ISO code, never by exact string.
const COUNTRY_ALIASES: Record<string, string> = {
  'india': 'IN', 'bharat': 'IN', 'republic of india': 'IN',
  'united kingdom': 'GB', 'uk': 'GB', 'u.k.': 'GB', 'great britain': 'GB', 'britain': 'GB', 'england': 'GB', 'scotland': 'GB', 'wales': 'GB', 'northern ireland': 'GB', 'gb': 'GB',
  'ireland': 'IE', 'republic of ireland': 'IE', 'eire': 'IE',
  'germany': 'DE', 'deutschland': 'DE', 'france': 'FR', 'italy': 'IT', 'italia': 'IT', 'spain': 'ES', 'espana': 'ES', 'españa': 'ES',
  'netherlands': 'NL', 'the netherlands': 'NL', 'holland': 'NL', 'portugal': 'PT', 'belgium': 'BE', 'austria': 'AT', 'poland': 'PL',
  'sweden': 'SE', 'denmark': 'DK', 'switzerland': 'CH', 'schweiz': 'CH', 'suisse': 'CH',
  'united arab emirates': 'AE', 'uae': 'AE', 'u.a.e.': 'AE', 'u.a.e': 'AE', 'emirates': 'AE',
  'saudi arabia': 'SA', 'ksa': 'SA', 'saudi': 'SA', 'oman': 'OM', 'bahrain': 'BH', 'qatar': 'QA', 'kuwait': 'KW',
  'egypt': 'EG', 'turkey': 'TR', 'türkiye': 'TR', 'turkiye': 'TR', 'israel': 'IL',
  'australia': 'AU', 'new zealand': 'NZ', 'nz': 'NZ', 'singapore': 'SG', 'malaysia': 'MY', 'thailand': 'TH', 'indonesia': 'ID',
  'philippines': 'PH', 'the philippines': 'PH', 'vietnam': 'VN', 'viet nam': 'VN', 'japan': 'JP',
  'south korea': 'KR', 'korea': 'KR', 'republic of korea': 'KR', 'china': 'CN', 'prc': 'CN', "people's republic of china": 'CN',
  'hong kong': 'HK', 'hongkong': 'HK', 'pakistan': 'PK', 'bangladesh': 'BD', 'sri lanka': 'LK', 'nepal': 'NP',
  'south africa': 'ZA', 'kenya': 'KE', 'nigeria': 'NG', 'ghana': 'GH',
  'canada': 'CA', 'united states': 'US', 'united states of america': 'US', 'usa': 'US', 'u.s.a.': 'US', 'u.s.': 'US', 'america': 'US',
  'mexico': 'MX', 'méxico': 'MX', 'brazil': 'BR', 'brasil': 'BR', 'argentina': 'AR', 'chile': 'CL', 'colombia': 'CO'
}

const norm = (v: unknown): string => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

/** Resolves a country typed as a name, a common short form or an ISO 3166 alpha-2 code to the ISO code. Null when unknown. */
export function resolveCountryCode(input: unknown): string | null {
  const key = norm(input)
  if (!key) return null
  const alias = COUNTRY_ALIASES[key]
  if (alias) return alias
  const upper = key.toUpperCase()
  if (/^[A-Z]{2}$/.test(upper) && (TAX_PRESETS[upper] || upper === 'BR')) return upper
  return null
}

export function isIndiaCountry(input: unknown): boolean {
  return resolveCountryCode(input) === 'IN'
}

/** India-only screens and fields (GST returns, PF/ESI, UPI) show for India and when the country is not recognised or not set. */
export function showIndiaFeatures(country: unknown): boolean {
  return !country || isIndiaCountry(country) || !resolveCountryCode(country)
}

/** The preset for the business's country (an ISO code or the free text typed at setup). Null when there is none. */
export function getTaxPreset(country: unknown): TaxPreset | null {
  const code = resolveCountryCode(country)
  return code ? (TAX_PRESETS[code] ?? null) : null
}

/**
 * 'en' when the country's tax names, notes and labels always render in English whatever the interface language
 * (none of its main languages is among the 13 interface languages); null when they may follow the interface
 * language, and for a country without a preset (there is nothing country-specific to lock).
 */
export function getTaxLanguageLock(country: unknown): 'en' | null {
  return getTaxPreset(country)?.languageLock ?? null
}

/** Language a preset's country-specific text must render in: English when locked, else the interface language. */
export function taxTextLanguage(country: unknown, interfaceLanguage: string): string {
  return getTaxLanguageLock(country) === 'en' ? 'en' : interfaceLanguage
}

/** Local tax label for a business country and the app's tax model; null when the model does not use a country label. */
export function taxLabelForCountry(country: unknown, taxModel: string | null | undefined): string | null {
  if (!taxModel || taxModel === 'GST' || taxModel === 'NONE' || taxModel === 'CUSTOM') return null
  const preset = getTaxPreset(country)
  if (!preset || preset.taxModel === 'NONE' || preset.taxModel === 'GST') return null
  return preset.taxLabel
}

/** Label for the business's tax number: the preset's for a country other than India, else null (keep the app's own label). */
export function taxNumberLabelForCountry(country: unknown): string | null {
  const preset = getTaxPreset(country)
  if (!preset || preset.code === 'IN') return null
  return preset.taxNumberLabel
}

/**
 * True when the number is fine or its format is not known for the country; false only when the country has a
 * format we are certain of and the number does not match. Spaces, dots and hyphens are ignored.
 */
export function isPlausibleTaxNumber(country: unknown, value: string | null | undefined): boolean {
  const v = String(value ?? '').trim()
  if (!v) return true
  const preset = getTaxPreset(country)
  if (!preset || !preset.taxNumberPattern) return true
  return preset.taxNumberPattern.test(v.replace(/[\s.\-]/g, '').toUpperCase())
}
