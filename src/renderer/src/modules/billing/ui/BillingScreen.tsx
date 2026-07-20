import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, Search, X, Plus, Minus, UserPlus, User, Trash2, Ruler, HandCoins } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { useNotificationStore } from '@app/store/notification.store'
import { useIndustryStore } from '@app/store/industry.store'
import { cn } from '@shared/utils/cn'
import { formatCurrency } from '@shared/utils/currency.util'
import { useBusinessStore } from '@app/store/business.store'
import { splitTaxLines } from '@shared/utils/tax.util'

interface Product {
  id: string; productName: string; sku?: string | null; barcode?: string | null
  sellingPrice: number; mrp?: number | null; taxRate: number; unit: string; productType: string
  unavailableUntil?: string | null
  inventory?: { quantity: number } | null
  sellByWeight?: boolean; weightUnit?: string | null; pricePerWeightUnit?: number | null
  metalType?: string | null; purity?: string | null; netWeight?: number | null
  makingChargeType?: string | null; makingChargeValue?: number | null
  hallmarkNumber?: string | null
  isPrescriptionRequired?: boolean
}
interface Customer { id: string; customerName: string; phone?: string | null; customerCode?: string | null }
interface HeldSaleSummary {
  id: string; label: string | null; customerId: string | null; customerName: string | null
  itemCount: number; totalAmount: number; createdAt: string
}
interface VariantRecord {
  id: string; size: string | null; color: string | null; sku: string | null
  additionalPrice: number; stockQty: number
}
interface SerialRecord {
  id: string; serialNumber: string; imeiNumber: string | null; status: string
}
interface CartItem {
  productId: string; productName: string; unit: string; productType: string
  quantity: number; unitPrice: number; discountAmount: number; taxRate: number
  availableQty: number
  variantId?: string
  variantInfo?: string
  serialId?: string
  serialInfo?: string
  weightUnit?: string
  // Phase 38: set only for a weight-embedded scan — lets addLooseWeightItem
  // detect an accidental double-scan of the exact same physical label.
  scannedBarcode?: string
  // Fresh-audit fix (2026-07-12): informational only — the FIFO batch
  // billing.service.ts will actually deduct from is resolved server-side at
  // invoice-creation time regardless of what's shown here; this just lets
  // the cashier SEE which batch/expiry that will be before submitting.
  batchInfo?: { batchNumber: string; expiryDate: string; daysToExpiry: number } | null
  // Fresh-audit build (2026-07-12) — Jewellery. unitPrice for a jewellery
  // line is computed from ONE specific physical piece's own recorded
  // netWeight — real jewellery pieces of the "same" product/design still
  // vary slightly in actual weight (standard practice is weighing each
  // piece individually), so "quantity 2" at the same unitPrice would
  // silently assume two pieces of IDENTICAL weight, which is not a safe
  // assumption. Locked to quantity 1 per line, same reasoning and same
  // mechanism (disabled +/- buttons, ignored in updateQty) as a serialId line.
  isJewellery?: boolean
  // Fresh-audit fix (2026-07-12): the purity/weight/making-charge breakdown
  // this line's unitPrice was actually computed from — snapshotted here so
  // it can be sent through to the invoice record and printed, instead of
  // being discarded the moment the cart line's price is resolved.
  jewelleryDetail?: { metalType: string; purity: string; netWeight: number; ratePerGram: number; makingCharge: number; metalValue: number; hallmarkNumber: string | null; makingChargeOverridden?: boolean }
  // Phase 58 §2 — Pharmacy Schedule H/H1 prescription capture, required by
  // billing.service.ts before this line can be sold when the underlying
  // product is isPrescriptionRequired.
  prescriptionPatientName?: string
  prescriptionDoctorName?: string
  prescriptionDate?: string
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CARD', label: 'Card' },
  { value: 'WALLET', label: 'Wallet' },
  { value: 'CREDIT', label: 'Credit (Pay Later)' },
  { value: 'SPLIT', label: 'Split' }
] as const
type PaymentMethod = typeof PAYMENT_METHODS[number]['value']

function computeTotals(items: CartItem[], globalDiscount: number) {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const totalLineDiscount = items.reduce((s, i) => s + i.discountAmount, 0)
  const discountAmount = totalLineDiscount + globalDiscount
  const taxAmount = items.reduce((s, i) => {
    const taxable = (i.quantity * i.unitPrice) - i.discountAmount
    return s + taxable * (i.taxRate / 100)
  }, 0)
  const rawTotal = subtotal - discountAmount + taxAmount
  const roundingAmount = Math.round(rawTotal) - rawTotal
  const totalAmount = rawTotal + roundingAmount
  return { subtotal, discountAmount, taxAmount, roundingAmount, totalAmount }
}

export function BillingScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { isModuleEnabled } = useIndustryStore()
  const areaPricingEnabled = isModuleEnabled('area_pricing')
  const variantTrackingEnabled = isModuleEnabled('variant_tracking')
  const serialTrackingEnabled = isModuleEnabled('serial_tracking')
  // Fresh-audit fix (2026-07-12): batch.service.ts already does real FIFO
  // dispensing and expiry-blocking (BATCH-004) at invoice-creation time, but
  // none of it was ever visible to the cashier at the point of sale — no
  // batch number, no expiry date, no "expiring soon" warning. This is purely
  // informational/early-warning; the actual safety gate already exists
  // server-side in billing.service.ts regardless of whether this UI loads.
  const batchTrackingEnabled = isModuleEnabled('batch_tracking')
  // Phase 38: opt-in, off by default — see TEMPLATE_DEFAULTS in industry-template.service.ts.
  // Scanning is the "read" side of whichever "write" capability is on: a shop
  // could enable loose_billing + barcode_printing without barcode_generation
  // (e.g. they only ever want to weigh-and-print, never auto-generate plain
  // barcodes) — gating scan-decode on barcode_generation alone would print
  // real, scannable weight-embedded labels that then can't be scanned back in
  // at checkout. Any of the three turns scanning on.
  const barcodeScanEnabled = isModuleEnabled('barcode_generation') || isModuleEnabled('barcode_printing') || isModuleEnabled('loose_billing')
  const jewelleryPricingEnabled = isModuleEnabled('jewellery_pricing')
  const currSym = useBusinessStore(s => s.profile?.currencySymbol ?? '₹')
  const taxModel = useBusinessStore(s => s.profile?.taxModel ?? 'NONE')

  // Area pricing state: productId → { l, w, open }
  const [areaCalc, setAreaCalc] = useState<Record<string, { l: string; w: string; open: boolean }>>({})

  const [cart, setCart] = useState<CartItem[]>([])
  // Phase 58 §2 — tip / service-charge quick-add (no ad-hoc-line concept
  // exists anywhere in this app; this adds a real lookup-or-create generic
  // "Tip / Service Charge" Product to the cart with a custom price, same as
  // any other line item, see billingService.getOrCreateTipProduct).
  const [showTipModal, setShowTipModal] = useState(false)
  const [tipAmount, setTipAmount] = useState('')
  const [addingTip, setAddingTip] = useState(false)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [globalDiscount, setGlobalDiscount] = useState(0)
  // Phase 58 §2 — Jewellery old-metal exchange, applied atomically via
  // billing.service.ts's createInvoice (metalExchangeId), replacing the old
  // "type the same number into globalDiscount, then separately link"
  // two-step manual process.
  const [selectedExchange, setSelectedExchange] = useState<{ id: string; exchangeNumber: string; valueGiven: number } | null>(null)
  // Phase 58 §2 — optional payment due date for CREDIT sales
  const [dueDate, setDueDate] = useState('')
  const [showExchangePicker, setShowExchangePicker] = useState(false)
  const [exchangeSearch, setExchangeSearch] = useState('')
  const [exchangeResults, setExchangeResults] = useState<Array<{ id: string; exchangeNumber: string; valueGiven: number; customerName: string | null; customer?: { customerName: string } | null }>>([])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // Discount mode per item: 'amount' (₹) or 'percent' (%)
  const [discountMode, setDiscountMode] = useState<Record<string, 'amount' | 'percent'>>({})
  // Inline split payment amounts
  const [splitCash, setSplitCash] = useState('')
  const [splitUpi, setSplitUpi] = useState('')

  // GST inter-state sale — captured but previously never surfaced in the UI,
  // so every invoice silently defaulted to CGST_SGST regardless of reality,
  // and an actual inter-state sale would print legally-incorrect CGST/SGST
  // lines instead of a single IGST line.
  const [isInterState, setIsInterState] = useState(false)
  const [buyerState, setBuyerState] = useState('')

  // Variant picker state (clothing/footwear)
  const [variantPickProduct, setVariantPickProduct] = useState<Product | null>(null)
  const [variantPickList, setVariantPickList] = useState<VariantRecord[]>([])

  // Serial/IMEI picker state (electronics) — a serial identifies one
  // physical unit, so unlike variants there is nothing to "add more of"
  // once picked; each additional unit needs its own pick.
  const [serialPickProduct, setSerialPickProduct] = useState<Product | null>(null)
  const [serialPickList, setSerialPickList] = useState<SerialRecord[]>([])

  // Phase 58 §2 — Pharmacy Schedule H/H1 prescription capture, prompted
  // before a prescription-required product can be added to the cart at all.
  const [rxPickProduct, setRxPickProduct] = useState<Product | null>(null)
  const [rxPatientName, setRxPatientName] = useState('')
  const [rxDoctorName, setRxDoctorName] = useState('')
  const [rxDate, setRxDate] = useState('')

  // Product search
  const [productQuery, setProductQuery] = useState('')
  const [productResults, setProductResults] = useState<Product[]>([])
  const [productSearching, setProductSearching] = useState(false)
  const [productDropdownIdx, setProductDropdownIdx] = useState(-1)
  const productSearchRef = useRef<HTMLInputElement>(null)

  // Customer search
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState<Customer[]>([])
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const customerDropdownRef = useRef<HTMLDivElement>(null)

  // Customer quick-add
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickName, setQuickName] = useState('')
  const [quickPhone, setQuickPhone] = useState('')
  const [quickAdding, setQuickAdding] = useState(false)

  // Folds a selected metal exchange's credit into the discount used for
  // on-screen totals/split-payment validation — matches exactly what
  // billing.service.ts's createInvoice computes server-side (globalDiscount
  // + the exchange's valueGiven), so what the cashier sees before submit is
  // what actually gets charged.
  const effectiveGlobalDiscount = globalDiscount + (selectedExchange?.valueGiven ?? 0)
  const totals = useMemo(() => computeTotals(cart, effectiveGlobalDiscount), [cart, effectiveGlobalDiscount])

  // Phase 58 §2 — Retail's hold/park-sale. Snapshots only the
  // fiscal/customer-relevant slice of cart state (the same fields the
  // existing "Clear All" reset button already zeroes out, see below) — not
  // presentational UI state like discountMode/areaCalc/split-payment-leg
  // inputs, which re-derive sensible defaults on resume.
  const [showHoldModal, setShowHoldModal] = useState(false)
  const [holdLabel, setHoldLabel] = useState('')
  const [holding, setHolding] = useState(false)
  const [showResumeModal, setShowResumeModal] = useState(false)
  const [heldSales, setHeldSales] = useState<HeldSaleSummary[]>([])
  const [loadingHeldSales, setLoadingHeldSales] = useState(false)
  const [resumingId, setResumingId] = useState<string | null>(null)
  const [frequentProducts, setFrequentProducts] = useState<Product[]>([])

  useEffect(() => {
    window.api.billing.getFrequentlySoldProducts({ limit: 10 }).then((res) => {
      if (res.success && res.data) setFrequentProducts((res.data as { products: Product[] }).products)
    }).catch(() => { /* the grid is a convenience shortcut — the search box always still works */ })
  }, [])

  async function handleHoldSale() {
    if (cart.length === 0) { toastError(t('common.error'), t('billing.emptyCartCannotHold')); return }
    setHolding(true)
    try {
      const snapshot = { cart, customer, globalDiscount, paymentMethod, notes, referenceNumber, isInterState, buyerState }
      const res = await window.api.heldSale.hold({
        cartJson: JSON.stringify(snapshot), itemCount: cart.length, totalAmount: totals.totalAmount,
        label: holdLabel.trim() || undefined, customerId: customer?.id,
      })
      if (res.success) {
        toastSuccess(t('billing.holdSaleSuccess'), '')
        setCart([]); setCustomer(null); setGlobalDiscount(0); setPaymentMethod('CASH'); setNotes(''); setReferenceNumber('')
        setIsInterState(false); setBuyerState('')
        setShowHoldModal(false); setHoldLabel('')
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } finally {
      setHolding(false)
    }
  }

  async function openResumeModal() {
    setShowResumeModal(true)
    setLoadingHeldSales(true)
    try {
      const res = await window.api.heldSale.list()
      if (res.success && res.data) setHeldSales((res.data as { sales: HeldSaleSummary[] }).sales)
    } finally {
      setLoadingHeldSales(false)
    }
  }

  async function handleResumeSale(id: string) {
    setResumingId(id)
    try {
      const res = await window.api.heldSale.resume({ id })
      if (res.success && res.data) {
        const snapshot = JSON.parse((res.data as { cartJson: string }).cartJson) as {
          cart: CartItem[]; customer: Customer | null; globalDiscount: number; paymentMethod: PaymentMethod
          notes: string; referenceNumber: string; isInterState: boolean; buyerState: string
        }
        setCart(snapshot.cart); setCustomer(snapshot.customer); setGlobalDiscount(snapshot.globalDiscount)
        setPaymentMethod(snapshot.paymentMethod); setNotes(snapshot.notes); setReferenceNumber(snapshot.referenceNumber)
        setIsInterState(snapshot.isInterState); setBuyerState(snapshot.buyerState)
        setShowResumeModal(false)
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } finally {
      setResumingId(null)
    }
  }

  async function handleDeleteHeldSale(id: string) {
    const res = await window.api.heldSale.delete({ id })
    if (res.success) setHeldSales((prev) => prev.filter((h) => h.id !== id))
    else toastError(t('common.error'), res.error?.message ?? t('common.error'))
  }

  // Product search with debounce
  useEffect(() => {
    if (!productQuery.trim()) { setProductResults([]); return }
    const t = setTimeout(async () => {
      setProductSearching(true)
      try {
        // Phase 38: a 13-digit query is what a barcode scanner produces (real
        // manufacturer codes, our "20"-prefix generated codes, and "21"-prefix
        // weight-embedded codes are all 13 digits). A plain product barcode is
        // already found by the generic text search below via `contains`, but a
        // weight-embedded code is NOT a literal Product.barcode value — it has
        // to be decoded server-side — so it needs this dedicated path, and gets
        // added to the cart immediately (a scan should never require a second
        // Enter/click, unlike a name/SKU text search which legitimately can
        // return multiple matches to choose from).
        const looksLikeScan = barcodeScanEnabled && /^\d{13}$/.test(productQuery.trim())
        if (looksLikeScan) {
          const scanRes = await window.api.products.getByScannedBarcode({ code: productQuery.trim() })
          if (scanRes.success && scanRes.data) {
            const decoded = scanRes.data as
              | { kind: 'PLAIN'; product: Product }
              | { kind: 'WEIGHT_EMBEDDED'; product: Product; quantityInSellUnit: number; weightUnit: string; pricePerWeightUnitAtPrint: number; preTaxAmount: number; priceIsStale: boolean; currentPricePerWeightUnit: number; barcode: string }
            if (decoded.kind === 'WEIGHT_EMBEDDED') {
              addLooseWeightItem({ ...decoded, barcode: productQuery.trim() })
              setProductResults([])
              return
            }
            // PLAIN — fall through to addToCart via the normal single-result path below
            setProductResults([decoded.product])
            setProductDropdownIdx(0)
            return
          }
        }

        const res = await window.api.products.search(productQuery)
        if (res.success) {
          const results = res.data as Product[]
          setProductResults(results)
          // A barcode scanner emits the code as fast keystrokes followed by
          // Enter, with no manual arrow-key selection — without this, Enter
          // did nothing (it only acted on productDropdownIdx >= 0, which
          // stayed -1 since it's reset on every keystroke). A single exact
          // match is exactly what a real barcode scan produces, so it's safe
          // to pre-select it and let the existing Enter handler add it.
          setProductDropdownIdx(results.length === 1 ? 0 : -1)
          // A 13-digit query that resolved to nothing anywhere (neither our
          // decode path nor the generic name/SKU/barcode search) is almost
          // certainly a scanned barcode with no matching product — the spec
          // requires a clear message here, not a silent empty dropdown.
          if (looksLikeScan && results.length === 0) {
            toastError('Barcode Not Found', `No product matches the scanned code "${productQuery.trim()}".`)
          }
        } else {
          // NOTE: `t` (i18next) is shadowed inside this setTimeout callback by
          // the `const t = setTimeout(...)` timer-id variable below — plain
          // strings only here, never t(...).
          toastError('Search Failed', res.error?.message ?? 'Could not search products.')
        }
      } catch {
        toastError('Search Failed', 'Could not search products. Check your connection and try again.')
      } finally { setProductSearching(false) }
    }, 200)
    return () => clearTimeout(t)
  }, [productQuery])

  // Close customer dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Customer search with debounce
  useEffect(() => {
    if (!customerQuery.trim()) { setCustomerResults([]); return }
    const t = setTimeout(async () => {
      // NOTE: `t` (i18next) is shadowed here by the timer-id `t` above — plain
      // strings only in this callback, never t(...).
      try {
        const res = await window.api.customers.search(customerQuery)
        if (res.success) setCustomerResults(res.data as Customer[])
        else toastError('Search Failed', res.error?.message ?? 'Could not search customers.')
      } catch {
        toastError('Search Failed', 'Could not search customers.')
      }
    }, 200)
    return () => clearTimeout(t)
  }, [customerQuery])

  async function addToCart(product: Product) {
    // Phase 58 §2 — a product 86'd for today (unavailableUntil in the
    // future) can't be added to a new sale, same intent as isActive:false,
    // just self-expiring at midnight instead of a permanent deactivation.
    if (product.unavailableUntil && new Date(product.unavailableUntil) > new Date()) {
      toastError(t('billing.unavailableToday'), t('billing.unavailableTodayMessage', { productName: product.productName }))
      return
    }
    // Phase 58 §2 — a Schedule H/H1 item can't be added at all until a
    // patient + doctor name is captured — server-side billing.service.ts
    // enforces this too, but prompting here avoids a checkout-time rejection.
    if (product.isPrescriptionRequired) {
      setRxPickProduct(product)
      setRxPatientName(''); setRxDoctorName(''); setRxDate('')
      setProductQuery('')
      setProductResults([])
      return
    }
    try {
      if (variantTrackingEnabled) {
        const res = await window.api.variants.list({ productId: product.id })
        if (!res.success) {
          toastError(t('common.error'), res.error?.message ?? t('common.error'))
          return
        }
        const variants = (res.data as VariantRecord[]) ?? []
        if (variants.length > 0) {
          setVariantPickProduct(product)
          setVariantPickList(variants)
          setProductQuery('')
          setProductResults([])
          return
        }
      }
      if (serialTrackingEnabled) {
        const res = await window.api.serials.list({ productId: product.id, status: 'AVAILABLE' })
        if (!res.success) {
          toastError(t('common.error'), res.error?.message ?? t('common.error'))
          return
        }
        const serials = (res.data as { serials: SerialRecord[] }).serials ?? []
        if (serials.length > 0) {
          setSerialPickProduct(product)
          setSerialPickList(serials)
          setProductQuery('')
          setProductResults([])
          return
        }
      }
      addToCartDirect(product)
    } catch {
      toastError(t('common.error'), t('common.error'))
    }
  }

  async function handleConfirmTip() {
    const amount = Number(tipAmount)
    if (!amount || amount <= 0) { toastError(t('common.error'), t('billing.tipAmountInvalid')); return }
    setAddingTip(true)
    try {
      const res = await window.api.billing.getOrCreateTipProduct()
      if (!res.success) {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
        return
      }
      const tipProduct = res.data as Product
      // Always its own new line (not merged into an existing tip line) so a
      // cashier can add a second tip later in the same order without it
      // silently summing into one opaque number.
      setCart(prev => [...prev, {
        productId: tipProduct.id,
        productName: tipProduct.productName,
        unit: tipProduct.unit,
        productType: tipProduct.productType,
        quantity: 1,
        unitPrice: amount,
        discountAmount: 0,
        taxRate: tipProduct.taxRate ?? 0,
        availableQty: 0,
      }])
      setShowTipModal(false)
      setTipAmount('')
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setAddingTip(false)
    }
  }

  function addToCartDirect(product: Product, variant?: VariantRecord, serial?: SerialRecord, rxDetail?: { patientName: string; doctorName: string; date?: string }) {
    const variantId = variant?.id
    const variantInfo = variant ? [variant.size, variant.color].filter(Boolean).join(' / ') || undefined : undefined
    const serialId = serial?.id
    const serialInfo = serial ? (serial.imeiNumber ? `${serial.serialNumber} / IMEI ${serial.imeiNumber}` : serial.serialNumber) : undefined
    // A serial is one physical unit — it can never be "quantity + 1"'d onto
    // an existing line the way a fungible variant or plain product can, so
    // it always gets its own new cart line, keyed by its own id.
    const cartKey = serialId ?? variantId ?? product.id
    // Phase 38: a loose-billed product found via ordinary name/SKU search must
    // still price by weight, not silently fall back to Product.sellingPrice
    // (which is a required-but-largely-meaningless field for a pure loose
    // product — "loose OR fixed, never both" was being violated here: picking
    // a loose product from search added a fixed quantity-1 line at whatever
    // sellingPrice happened to be set, bypassing pricePerWeightUnit entirely).
    // Default to 1 of the configured weightUnit — a real, sane, editable
    // starting point the cashier adjusts via the 0.1-stepped quantity field.
    const isLoose = product.sellByWeight && product.weightUnit && product.pricePerWeightUnit != null
    // Fresh-audit build (2026-07-12) — Jewellery. A jewellery item's real
    // price is netWeight × today's metal rate + making charge, computed at
    // billing time (the rate fluctuates daily) — Product.sellingPrice is
    // meaningless for these, same "loose OR priced-by-formula, never a
    // static sellingPrice" reasoning loose/weight billing already
    // established. Price starts at 0 (an obvious placeholder, never a real
    // charge) and is resolved async right after — mirrors the batch-info
    // lookup pattern below, not a synchronous computation, since it needs
    // an IPC round-trip to read today's MetalRate.
    const isJewellery = !!product.metalType && product.netWeight != null
    setCart(prev => {
      // A prescription line always gets its own new cart entry — never
      // silently merged into an existing one, since two prescriptions for
      // the same drug shouldn't be combined into one anonymized quantity.
      const existing = !serialId && !isLoose && !isJewellery && !rxDetail && prev.find(i => (i.variantId ?? i.productId) === cartKey)
      if (existing) {
        return prev.map(i => (i.variantId ?? i.productId) === cartKey ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, {
        productId: product.id,
        productName: product.productName,
        unit: isLoose ? product.weightUnit! : product.unit,
        productType: product.productType,
        quantity: 1,
        unitPrice: isLoose ? product.pricePerWeightUnit! : isJewellery ? 0 : product.sellingPrice + (variant?.additionalPrice ?? 0),
        discountAmount: 0,
        taxRate: product.taxRate ?? 0,
        availableQty: variant ? variant.stockQty : (product.inventory?.quantity ?? 0),
        variantId,
        variantInfo,
        serialId,
        serialInfo,
        weightUnit: isLoose ? product.weightUnit! : undefined,
        isJewellery,
        prescriptionPatientName: rxDetail?.patientName,
        prescriptionDoctorName: rxDetail?.doctorName,
        prescriptionDate: rxDetail?.date
      }]
    })
    if (isLoose) {
      toastSuccess('Loose Item Added', `${product.productName} added at 1 ${product.weightUnit} — adjust the quantity to the actual weight before checkout.`)
    }
    if (isJewellery) {
      void loadJewelleryPriceForCartLine(product, cartKey)
    }
    if (batchTrackingEnabled && product.productType === 'STANDARD' && !isLoose) {
      void loadBatchInfoForCartLine(product.id, cartKey)
    }
    setProductQuery('')
    setProductResults([])
    setVariantPickProduct(null)
    setVariantPickList([])
    setSerialPickProduct(null)
    setSerialPickList([])
    setRxPickProduct(null)
    productSearchRef.current?.focus()
  }

  function handleConfirmRx() {
    if (!rxPickProduct) return
    if (!rxPatientName.trim() || !rxDoctorName.trim()) {
      toastError(t('common.error'), t('billing.rx.required'))
      return
    }
    addToCartDirect(rxPickProduct, undefined, undefined, { patientName: rxPatientName.trim(), doctorName: rxDoctorName.trim(), date: rxDate || undefined })
  }

  // Fresh-audit fix (2026-07-12): resolves which batch billing.service.ts's
  // own FIFO dispensing would actually use — same order (earliest expiry
  // first among batches with stock remaining) — purely to surface it to the
  // cashier. Silently no-ops if the product has no batches (a non-batch-
  // tracked product briefly added to a batch_tracking-enabled business, or a
  // lookup failure) — this is a nice-to-have display, never worth an error
  // toast interrupting the sale.
  async function loadBatchInfoForCartLine(productId: string, cartKey: string) {
    try {
      const res = await window.api.batches.list({ productId, limit: 5 })
      if (!res.success || !res.data) return
      const batches = (res.data as { batches: Array<{ batchNumber: string; expiryDate: string; daysToExpiry: number; quantityRemaining: number }> }).batches
      const next = batches.find(b => b.quantityRemaining > 0)
      if (!next) return
      setCart(prev => prev.map(i => (i.serialId ?? i.variantId ?? i.productId) === cartKey
        ? { ...i, batchInfo: { batchNumber: next.batchNumber, expiryDate: next.expiryDate, daysToExpiry: next.daysToExpiry } }
        : i))
    } catch {
      // Informational only — never surfaces an error for this.
    }
  }

  // Fresh-audit build (2026-07-12) — Jewellery. Reads today's MetalRate for
  // this item's metalType+purity and computes unitPrice = netWeight ×
  // ratePerGram + makingCharge, exactly mirroring metal-exchange.service.ts's
  // own pricing formula server-side. If no rate is configured yet, the line
  // stays at 0 with a toast telling the cashier to set it in Settings — never
  // silently charges an unpriced item.
  async function loadJewelleryPriceForCartLine(product: Product, cartKey: string) {
    try {
      const res = await window.api.metalRate.get({ metalType: product.metalType!, purity: product.purity! })
      const rate = res.success ? (res.data as { ratePerGram: number } | null) : null
      if (!rate) {
        toastError(t('jewellery.noRateSetTitle'), t('jewellery.noRateSetDesc', { metalType: product.metalType, purity: product.purity }))
        return
      }
      const netWeight = product.netWeight ?? 0
      const metalValue = netWeight * rate.ratePerGram
      let makingCharge = 0
      if (product.makingChargeType === 'FIXED') makingCharge = product.makingChargeValue ?? 0
      else if (product.makingChargeType === 'PER_GRAM') makingCharge = (product.makingChargeValue ?? 0) * netWeight
      else if (product.makingChargeType === 'PERCENTAGE') makingCharge = metalValue * ((product.makingChargeValue ?? 0) / 100)
      const unitPrice = metalValue + makingCharge
      setCart(prev => prev.map(i => (i.serialId ?? i.variantId ?? i.productId) === cartKey
        ? {
            ...i, unitPrice,
            jewelleryDetail: {
              metalType: product.metalType!, purity: product.purity!, netWeight, ratePerGram: rate.ratePerGram,
              makingCharge, metalValue, hallmarkNumber: product.hallmarkNumber ?? null
            }
          }
        : i))
    } catch {
      toastError(t('common.error'), t('jewellery.computeErrorDesc'))
    }
  }

  // Phase 58 §2 — Jewellery: override the auto-computed making charge for
  // this ONE transaction only (e.g. a negotiated discount on labour, or a
  // repeat-customer waiver) — never mutates the product's own global
  // makingChargeType/Value config, only this cart line's snapshot.
  function updateMakingChargeOverride(cartKey: string, newMakingCharge: number) {
    setCart(prev => prev.map(i => {
      if ((i.serialId ?? i.variantId ?? i.productId) !== cartKey || !i.jewelleryDetail) return i
      const makingCharge = Math.max(0, newMakingCharge)
      return {
        ...i,
        unitPrice: i.jewelleryDetail.metalValue + makingCharge,
        jewelleryDetail: { ...i.jewelleryDetail, makingCharge, makingChargeOverridden: true }
      }
    }))
  }

  // Phase 58 §2 — Jewellery old-metal exchange picker: loads every
  // still-unlinked exchange (not scoped to the current customer alone — a
  // walk-in exchange has no Customer record to match against) whenever the
  // picker opens, so staff can search/select one to apply atomically.
  useEffect(() => {
    if (!showExchangePicker) return
    window.api.metalExchange.list({ unlinkedOnly: true }).then(res => {
      if (res.success && res.data) setExchangeResults(res.data as typeof exchangeResults)
    })
  }, [showExchangePicker])

  // Phase 38: a scanned weight-embedded label always adds a brand-new line —
  // each label represents one physically weighed-and-priced parcel, so unlike
  // a fixed-pack product it never merges into an existing line for the same
  // product (two labels for the same product are two separate parcels sold).
  function addLooseWeightItem(decoded: {
    product: Product
    quantityInSellUnit: number
    weightUnit: string
    pricePerWeightUnitAtPrint: number
    priceIsStale: boolean
    currentPricePerWeightUnit: number
    barcode: string
  }) {
    // Spec 5.6: an accidental double-scan of the exact same physical label
    // must be handled sensibly, not left undefined. Two DIFFERENT labels for
    // the same product (different weighed parcels) are legitimately separate
    // lines — only the identical barcode string scanned twice is suspicious.
    const alreadyInCart = cart.some(i => i.scannedBarcode === decoded.barcode)
    if (alreadyInCart) {
      toastError(
        'Label already scanned',
        `This exact label was already added to this bill. If you're weighing a second parcel of the same item, weigh and print a new label instead of re-scanning this one.`
      )
      // Still add it — staff may genuinely be re-scanning after removing a
      // line, or intentionally selling two identical labels together — but
      // the warning above makes an accidental duplicate scan visible.
    }
    setCart(prev => [...prev, {
      productId: decoded.product.id,
      productName: decoded.product.productName,
      unit: decoded.weightUnit,
      productType: decoded.product.productType,
      quantity: decoded.quantityInSellUnit,
      // Per the resolved stale-pricing rule: charge what was printed on the
      // label, not the product's possibly-changed current price.
      unitPrice: decoded.pricePerWeightUnitAtPrint,
      discountAmount: 0,
      taxRate: decoded.product.taxRate ?? 0,
      availableQty: decoded.product.inventory?.quantity ?? 0,
      weightUnit: decoded.weightUnit,
      scannedBarcode: decoded.barcode
    }])
    if (decoded.priceIsStale) {
      toastError(
        'Price may be outdated',
        `This label was printed at ${formatCurrency(decoded.pricePerWeightUnitAtPrint)}/${decoded.weightUnit}, but the current price is ${formatCurrency(decoded.currentPricePerWeightUnit)}/${decoded.weightUnit}. The label price was charged. Reprint remaining labels for this product.`
      )
    }
    setProductQuery('')
    productSearchRef.current?.focus()
  }

  function updateQty(key: string, qty: number) {
    if (qty <= 0) { removeFromCart(key); return }
    setCart(prev => prev.map(i => {
      if ((i.serialId ?? i.variantId ?? i.productId) !== key) return i
      // A serial identifies exactly one physical unit — it can never be
      // "quantity 2"'d the way a fungible variant/plain product can. To sell
      // a second device, pick another serial (a new cart line), not more of this one.
      // Jewellery is the same: unitPrice was computed from ONE physical
      // piece's own recorded weight, and real pieces vary — sell a second
      // piece as its own new cart line, not "quantity 2" of this one.
      if (i.serialId || i.isJewellery) return i
      return { ...i, quantity: qty }
    }))
  }

  function updateDiscount(key: string, discount: number) {
    // A discount larger than the line's own gross value would drive that line's
    // taxable amount (and tax) negative — clamp at the line's value, not just at 0.
    // The backend re-validates this too (never rely on UI validation alone).
    setCart(prev => prev.map(i => {
      if ((i.serialId ?? i.variantId ?? i.productId) !== key) return i
      const lineGross = i.quantity * i.unitPrice
      return { ...i, discountAmount: Math.min(lineGross, Math.max(0, discount)) }
    }))
  }

  function removeFromCart(key: string) {
    setCart(prev => prev.filter(i => (i.serialId ?? i.variantId ?? i.productId) !== key))
  }

  const handleQuickAddCustomer = useCallback(async () => {
    if (!quickName.trim()) { toastError(t('common.required'), t('customers.customerName')); return }
    setQuickAdding(true)
    try {
      const res = await window.api.customers.create({ customerName: quickName.trim(), phone: quickPhone.trim() || undefined })
      if (res.success) {
        const c = res.data as Customer
        setCustomer(c)
        setShowQuickAdd(false); setQuickName(''); setQuickPhone('')
        toastSuccess(t('customers.addCustomer'), `${c.customerName}`)
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally { setQuickAdding(false) }
  }, [quickName, quickPhone, toastSuccess, toastError])

  const handleSubmit = useCallback(async () => {
    if (cart.length === 0) { toastError(t('billing.emptyCart'), t('billing.addItem')); return }
    if (paymentMethod === 'CREDIT' && !customer) { toastError(t('billing.customerRequired'), t('billing.customerRequired')); return }
    // Fresh-audit fix (2026-07-12): a jewellery line's price is resolved
    // async right after being added (an IPC round-trip to read today's
    // MetalRate) — if that lookup failed (no rate configured) or is still
    // in flight, unitPrice stays at its 0 placeholder. Nothing else in this
    // form would catch a 0-priced line before submit (a legitimate product
    // COULD have a real 0 price, e.g. a promotional giveaway, so this can't
    // be a blanket "reject any 0-price line" rule — it's specific to
    // jewellery, where 0 is never a real price).
    const unpricedJewellery = cart.find(i => i.isJewellery && i.unitPrice <= 0)
    if (unpricedJewellery) {
      toastError(t('jewellery.priceNotSetTitle'), t('jewellery.priceNotSetDesc', { productName: unpricedJewellery.productName }))
      return
    }

    // Inline split payment validation
    if (paymentMethod === 'SPLIT') {
      const cash = parseFloat(splitCash) || 0
      const upi = parseFloat(splitUpi) || 0
      if (cash <= 0 && upi <= 0) { toastError(t('billing.splitPayment'), t('billing.splitPayment')); return }
      const total = computeTotals(cart, effectiveGlobalDiscount).totalAmount
      if (Math.abs(cash + upi - total) > 0.05) {
        toastError('Split Payment', `Cash (${formatCurrency(cash)}) + UPI (${formatCurrency(upi)}) must equal the invoice total (${formatCurrency(total)}).`)
        return
      }
    }

    setSubmitting(true)
    try {
      const res = await window.api.billing.createInvoice({
        customerId: customer?.id,
        paymentMethod,
        items: cart.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discountAmount: i.discountAmount,
          taxRate: i.taxRate,
          variantId: i.variantId,
          variantInfo: i.variantInfo,
          serialId: i.serialId,
          weightUnit: i.weightUnit,
          jewelleryMetalType: i.jewelleryDetail?.metalType,
          jewelleryPurity: i.jewelleryDetail?.purity,
          jewelleryNetWeight: i.jewelleryDetail?.netWeight,
          jewelleryRatePerGram: i.jewelleryDetail?.ratePerGram,
          jewelleryMakingCharge: i.jewelleryDetail?.makingCharge,
          jewelleryHallmarkNumber: i.jewelleryDetail?.hallmarkNumber ?? undefined,
          prescriptionPatientName: i.prescriptionPatientName,
          prescriptionDoctorName: i.prescriptionDoctorName,
          prescriptionDate: i.prescriptionDate
        })),
        globalDiscount,
        notes: notes.trim() || undefined,
        referenceNumber: referenceNumber.trim() || undefined,
        gstType: taxModel === 'GST' && isInterState ? 'IGST' : 'CGST_SGST',
        buyerState: taxModel === 'GST' ? (buyerState.trim() || undefined) : undefined,
        metalExchangeId: selectedExchange?.id,
        dueDate: paymentMethod === 'CREDIT' && dueDate ? dueDate : undefined
      })

      if (res.success) {
        const inv = res.data as { id: string; invoiceNumber: string }

        // Inline split: record both legs atomically — single IPC call, single DB transaction
        if (paymentMethod === 'SPLIT') {
          const cash = parseFloat(splitCash) || 0
          const upi = parseFloat(splitUpi) || 0
          const legs: { paymentMethod: string; amount: number }[] = []
          if (cash > 0) legs.push({ paymentMethod: 'CASH', amount: cash })
          if (upi > 0) legs.push({ paymentMethod: 'UPI', amount: upi })

          // Recording the split legs is a separate IPC call from invoice creation
          // itself — if it throws (e.g. IPC/connection drop) rather than
          // returning success:false, the invoice still exists and must not be
          // reported as a generic failure; the cashier needs to be pointed at
          // the real invoice to finish recording payment manually.
          try {
            const splitRes = await window.api.payments.recordSplit({ invoiceId: inv.id, legs })
            if (!splitRes.success) {
              toastError(
                'Split Payment Failed',
                `Invoice ${inv.invoiceNumber} was created but payments could not be recorded: ${splitRes.error?.message ?? 'Unknown error'}. Go to the invoice and record payments manually.`
              )
              navigate(`/billing/${inv.id}`)
              return
            }
          } catch {
            toastError(
              'Split Payment Failed',
              `Invoice ${inv.invoiceNumber} was created but payments could not be recorded due to a connection error. Go to the invoice and record payments manually.`
            )
            navigate(`/billing/${inv.id}`)
            return
          }
        }

        toastSuccess(t('billing.invoiceCreated'), `${inv.invoiceNumber}`)
        navigate(`/billing/${inv.id}`)
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } catch {
      // createInvoice itself threw (IPC/connection error) — no invoice was
      // created, so a generic failure message is correct here (unlike the
      // recordSplit case above, which has its own catch because the invoice
      // DOES exist by that point).
      toastError(t('common.error'), t('common.error'))
    } finally {
      setSubmitting(false)
    }
  }, [cart, customer, paymentMethod, globalDiscount, effectiveGlobalDiscount, selectedExchange, dueDate, notes, referenceNumber, splitCash, splitUpi, navigate, toastSuccess, toastError])

  // F10 / Ctrl+Enter → confirm sale (declared after handleSubmit to avoid "used before assignment")
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'F10' || (e.ctrlKey && e.key === 'Enter')) && !submitting && cart.length > 0) {
        e.preventDefault()
        handleSubmit()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [submitting, cart, handleSubmit])

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* LEFT: Product search + Cart */}
      <div className="flex-1 flex flex-col border-r border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center">
            <ShoppingCart size={18} className="text-brand" />
          </div>
          <h1 className="text-lg font-bold text-dark flex-1">{t('billing.newInvoice')}</h1>
          <button
            onClick={() => setShowHoldModal(true)}
            disabled={cart.length === 0}
            className="text-xs font-medium px-3 py-1.5 rounded-lg text-slate-500 hover:text-brand hover:bg-brand/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {t('billing.holdSale')}
          </button>
          <button
            onClick={openResumeModal}
            className="text-xs font-medium px-3 py-1.5 rounded-lg text-slate-500 hover:text-brand hover:bg-brand/5 transition-colors"
          >
            {t('billing.resumeSale')}
          </button>
        </div>

        {/* Product search */}
        <div className="px-6 pt-4 pb-2 relative">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              ref={productSearchRef}
              value={productQuery}
              onChange={e => { setProductQuery(e.target.value); setProductDropdownIdx(-1) }}
              onKeyDown={async e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (productDropdownIdx >= 0 && productResults[productDropdownIdx]) {
                    addToCart(productResults[productDropdownIdx])
                    return
                  }
                  // A physical barcode scanner types the full code + Enter in
                  // well under the 200ms search debounce, so productResults
                  // can still be empty/stale when Enter arrives. Do an
                  // immediate, non-debounced lookup so a fast scan is never
                  // silently dropped.
                  const q = productQuery.trim()
                  if (!q) return
                  try {
                    const res = await window.api.products.search(q)
                    if (res.success) {
                      const results = res.data as Product[]
                      if (results.length === 1) {
                        addToCart(results[0])
                      } else {
                        setProductResults(results)
                        setProductDropdownIdx(results.length > 0 ? 0 : -1)
                      }
                    } else {
                      toastError(t('common.error'), res.error?.message ?? t('common.error'))
                    }
                  } catch {
                    toastError(t('common.error'), t('common.error'))
                  }
                  return
                }
                if (productResults.length === 0) return
                if (e.key === 'ArrowDown') { e.preventDefault(); setProductDropdownIdx(i => Math.min(i + 1, productResults.length - 1)) }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setProductDropdownIdx(i => Math.max(i - 1, 0)) }
                else if (e.key === 'Escape') { setProductResults([]); setProductQuery('') }
              }}
              placeholder={t('billing.searchProducts')}
              className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand text-slate-700 placeholder-slate-400"
              autoFocus
            />
            {productSearching && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />}
          </div>

          <button
            onClick={() => setShowTipModal(true)}
            className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-brand transition-colors"
          >
            <HandCoins size={13} /> {t('billing.addTipOrServiceCharge')}
          </button>

          {frequentProducts.length > 0 && productResults.length === 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">{t('billing.frequentlySold')}</p>
              <div className="flex flex-wrap gap-2">
                {frequentProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-brand hover:bg-brand/5 transition-colors text-left"
                  >
                    <p className="text-xs font-medium text-dark dark:text-slate-100 truncate max-w-[9rem]">{p.productName}</p>
                    <p className="text-xs text-brand font-semibold">{formatCurrency(p.sellingPrice)}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Product dropdown */}
          {productResults.length > 0 && (
            <div className="absolute left-6 right-6 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-20 max-h-64 overflow-y-auto">
              {productResults.map((p, idx) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  onMouseEnter={() => setProductDropdownIdx(idx)}
                  className={cn('w-full flex items-center justify-between px-4 py-3 text-left border-b border-slate-50 dark:border-slate-800 last:border-0 transition-colors',
                    productDropdownIdx === idx ? 'bg-brand/5 dark:bg-brand/10' : 'hover:bg-brand/5 dark:hover:bg-brand/10'
                  )}
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-dark">{p.productName}</p>
                      {p.unavailableUntil && new Date(p.unavailableUntil) > new Date() && (
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-warning/10 text-warning">{t('billing.unavailableToday')}</span>
                      )}
                    </div>
                    {p.sku && <p className="text-xs text-slate-400">SKU: {p.sku}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-brand">
                      {formatCurrency(p.sellingPrice)}
                      {p.mrp != null && p.mrp > p.sellingPrice && (
                        <span className="ml-1.5 text-xs font-normal text-slate-400 line-through">{formatCurrency(p.mrp)}</span>
                      )}
                    </p>
                    {p.productType === 'STANDARD' && (
                      <p className={cn('text-xs', (p.inventory?.quantity ?? 0) <= 0 ? 'text-danger' : 'text-slate-400')}>
                        Stock: {p.inventory?.quantity ?? 0} {p.unit}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-6 py-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
              <ShoppingCart size={40} className="opacity-30" />
              <p className="text-sm">{t('billing.emptyCart')}</p>
              <p className="text-xs text-slate-300 text-center px-4">Search for a product on the left or scan a barcode to add items to the cart</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Table header */}
              <div className="grid grid-cols-[2fr_120px_100px_100px_36px] gap-2 px-3 py-1">
                <span className="text-xs font-semibold text-slate-500 uppercase">{t('products.productName')}</span>
                <span className="text-xs font-semibold text-slate-500 uppercase text-center">{t('billing.qty')}</span>
                <span className="text-xs font-semibold text-slate-500 uppercase text-right">{t('products.sellingPrice')}</span>
                <span className="text-xs font-semibold text-slate-500 uppercase text-right">{t('common.total')}</span>
                <span />
              </div>

              {cart.map(item => {
                const ck = item.serialId ?? item.variantId ?? item.productId
                const taxable = (item.quantity * item.unitPrice) - item.discountAmount
                const lineTax = taxable * (item.taxRate / 100)
                const lineTotal = taxable + lineTax
                return (
                  <div key={ck} className="bg-white rounded-xl border border-slate-100 px-3 py-3 grid grid-cols-[2fr_120px_100px_100px_36px] gap-2 items-center">
                    <div>
                      <p className="text-sm font-medium text-dark leading-none">{item.productName}</p>
                      {item.variantInfo && <p className="text-xs text-brand/70 mt-0.5">{item.variantInfo}</p>}
                      {item.serialInfo && <p className="text-xs text-brand/70 mt-0.5">{item.serialInfo}</p>}
                      {item.batchInfo && (
                        <p className={cn(
                          'text-xs mt-0.5',
                          item.batchInfo.daysToExpiry < 0 ? 'text-danger font-medium'
                            : item.batchInfo.daysToExpiry <= 30 ? 'text-warning font-medium'
                            : 'text-slate-400'
                        )}>
                          {t('billing.batchLabel', {
                            batchNumber: item.batchInfo.batchNumber,
                            status: item.batchInfo.daysToExpiry < 0 ? t('billing.batchExpired')
                              : item.batchInfo.daysToExpiry === 0 ? t('billing.batchExpiresToday')
                              : t('billing.batchExpiresIn', { days: item.batchInfo.daysToExpiry })
                          })}
                        </p>
                      )}
                      {item.productType === 'STANDARD' && item.quantity > item.availableQty && (
                        <p className="text-xs text-danger mt-0.5">Low stock — only {item.availableQty} available</p>
                      )}
                      {item.jewelleryDetail && (
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <p className="text-xs text-slate-400">
                            {item.jewelleryDetail.metalType} {item.jewelleryDetail.purity} · {item.jewelleryDetail.netWeight.toFixed(3)}g @ {formatCurrency(item.jewelleryDetail.ratePerGram)}/g
                            {item.jewelleryDetail.hallmarkNumber && <> · HUID {item.jewelleryDetail.hallmarkNumber}</>}
                          </p>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-400">{t('jewellery.makingCharge')}:</span>
                            <input
                              type="number" min="0" step="1"
                              value={item.jewelleryDetail.makingCharge || ''}
                              onChange={e => updateMakingChargeOverride(ck, parseFloat(e.target.value) || 0)}
                              placeholder="0"
                              title={t('jewellery.makingChargeOverrideHint')}
                              className={cn(
                                'w-16 h-5 text-xs px-1.5 rounded border text-right focus:outline-none focus:ring-1 focus:ring-brand',
                                item.jewelleryDetail.makingChargeOverridden ? 'border-brand text-brand bg-brand/5' : 'border-slate-200'
                              )}
                            />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs text-slate-400">{formatCurrency(item.unitPrice)}/{item.unit}</span>
                        {item.taxRate > 0 && <span className="text-xs text-slate-400">Tax {item.taxRate}%</span>}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              const mode = discountMode[ck] === 'percent' ? 'amount' : 'percent'
                              setDiscountMode(prev => ({ ...prev, [ck]: mode }))
                              updateDiscount(ck, 0)
                            }}
                            className="text-xs text-brand border border-brand/30 rounded px-1 py-0.5 hover:bg-brand/5 transition-colors min-w-[24px] text-center"
                            title={`Toggle ${currSym} / %`}
                          >
                            {discountMode[ck] === 'percent' ? '%' : currSym}
                          </button>
                          <input
                            type="number" min="0" step={discountMode[ck] === 'percent' ? '1' : '0.50'}
                            max={discountMode[ck] === 'percent' ? '100' : item.quantity * item.unitPrice}
                            value={discountMode[ck] === 'percent'
                              ? (item.discountAmount > 0 ? ((item.discountAmount / (item.quantity * item.unitPrice)) * 100).toFixed(0) : '')
                              : (item.discountAmount || '')}
                            onChange={e => {
                              const v = parseFloat(e.target.value) || 0
                              if (discountMode[ck] === 'percent') {
                                updateDiscount(ck, Math.min(100, v) / 100 * item.quantity * item.unitPrice)
                              } else {
                                updateDiscount(ck, v)
                              }
                            }}
                            placeholder="0"
                            className="w-14 h-5 text-xs px-1.5 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand text-right"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Qty stepper — locked at 1 for a serial-linked line (one device = one unit)
                        or a jewellery line (one physical piece, priced from its own weight).
                        Phase 38: a weightUnit-carrying line steps by 0.1 (kg/L etc.), not whole
                        units — clicking + on a loose item must not jump the quantity by a full
                        kilogram. */}
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(ck, Math.round((item.quantity - (item.weightUnit ? 0.1 : 1)) * 1000) / 1000)}
                          disabled={!!item.serialId || !!item.isJewellery}
                          className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:border-brand transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                          <Minus size={12} />
                        </button>
                        <input
                          type="number" min="0.001" step={item.weightUnit ? '0.001' : '1'} value={item.quantity}
                          disabled={!!item.serialId || !!item.isJewellery}
                          onChange={e => updateQty(ck, parseFloat(e.target.value) || (item.weightUnit ? 0.001 : 1))}
                          className="w-14 text-center text-sm font-semibold text-dark h-7 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-60"
                        />
                        {item.weightUnit && <span className="text-xs text-slate-500">{item.weightUnit}</span>}
                        <button onClick={() => updateQty(ck, Math.round((item.quantity + (item.weightUnit ? 0.1 : 1)) * 1000) / 1000)}
                          disabled={!!item.serialId || !!item.isJewellery}
                          className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:border-brand transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                          <Plus size={12} />
                        </button>
                      </div>
                      {/* Area pricing calculator — Hardware template */}
                      {areaPricingEnabled && (
                        <div className="relative">
                          <button
                            onClick={() => setAreaCalc(prev => ({
                              ...prev,
                              [ck]: {
                                l: prev[ck]?.l ?? '',
                                w: prev[ck]?.w ?? '',
                                open: !(prev[ck]?.open ?? false)
                              }
                            }))}
                            title={t('billing.areaCalculator') as string}
                            className="flex items-center gap-1 text-xs text-brand/70 hover:text-brand transition-colors">
                            <Ruler size={10} /> {t('billing.areaLabel')}
                          </button>
                          {areaCalc[ck]?.open && (
                            <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20 bg-white rounded-xl border border-slate-200 shadow-lg p-3 w-40 space-y-2">
                              <p className="text-xs font-semibold text-dark text-center">{t('billing.areaFormula')}</p>
                              <div className="flex gap-1 items-center">
                                <input
                                  type="number" min="0" step="0.01"
                                  placeholder="L"
                                  value={areaCalc[ck]?.l ?? ''}
                                  onChange={e => setAreaCalc(prev => ({ ...prev, [ck]: { ...prev[ck], l: e.target.value } }))}
                                  className="w-14 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-brand text-center"
                                />
                                <span className="text-xs text-slate-400">×</span>
                                <input
                                  type="number" min="0" step="0.01"
                                  placeholder="W"
                                  value={areaCalc[ck]?.w ?? ''}
                                  onChange={e => setAreaCalc(prev => ({ ...prev, [ck]: { ...prev[ck], w: e.target.value } }))}
                                  className="w-14 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-brand text-center"
                                />
                              </div>
                              {(() => {
                                const l = parseFloat(areaCalc[ck]?.l ?? '0')
                                const w = parseFloat(areaCalc[ck]?.w ?? '0')
                                const area = l > 0 && w > 0 ? parseFloat((l * w).toFixed(3)) : null
                                return area !== null ? (
                                  <button
                                    onClick={() => {
                                      updateQty(ck, area)
                                      setAreaCalc(prev => ({ ...prev, [ck]: { ...prev[ck], open: false } }))
                                    }}
                                    className="w-full py-1 text-xs bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors font-semibold">
                                    {t('billing.useAreaSq', { area })}
                                  </button>
                                ) : null
                              })()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-medium text-dark">{formatCurrency(item.quantity * item.unitPrice)}</p>
                      {item.discountAmount > 0 && <p className="text-xs text-danger">-{formatCurrency(item.discountAmount)}</p>}
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold text-dark">{formatCurrency(lineTotal)}</p>
                    </div>

                    <button onClick={() => removeFromCart(ck)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-danger hover:bg-danger/10 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Order summary */}
      <div className="w-96 flex flex-col bg-white dark:bg-slate-900 overflow-y-auto">
        <div className="p-6 space-y-5 flex-1">
          {/* Customer */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">{t('billing.customer')}</p>
            {customer ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-brand/5 border border-brand/20">
                <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center">
                  <User size={14} className="text-brand" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-dark truncate">{customer.customerName}</p>
                  {customer.phone && <p className="text-xs text-slate-500">{customer.phone}</p>}
                </div>
                <button onClick={() => { setCustomer(null); setCustomerQuery('') }}
                  className="text-slate-400 hover:text-danger transition-colors">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <div className="relative" ref={customerDropdownRef}>
                  <div className="relative">
                    <UserPlus size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      value={customerQuery}
                      onChange={e => { setCustomerQuery(e.target.value); setShowCustomerDropdown(true) }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      placeholder={t('customers.searchCustomers')}
                      className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand text-slate-700 placeholder-slate-400"
                    />
                  </div>
                  {showCustomerDropdown && customerResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-20 max-h-40 overflow-y-auto">
                      {customerResults.map(c => (
                        <button key={c.id} onClick={() => { setCustomer(c); setCustomerQuery(''); setShowCustomerDropdown(false); setCustomerResults([]) }}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-brand/5 dark:hover:bg-brand/10 text-left border-b border-slate-50 dark:border-slate-800 last:border-0 text-sm">
                          <span className="font-medium text-dark dark:text-slate-100">{c.customerName}</span>
                          {c.phone && <span className="text-xs text-slate-400">{c.phone}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => setShowQuickAdd(true)}
                  className="mt-1.5 flex items-center gap-1.5 text-xs text-brand hover:text-brand/70 transition-colors">
                  <Plus size={12} /> {t('customers.addCustomer')}
                </button>
              </>
            )}
          </div>

          {/* Payment method */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">{t('expenses.paymentMethod')}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {PAYMENT_METHODS.map(m => (
                <button key={m.value} onClick={() => setPaymentMethod(m.value)}
                  className={cn('h-9 rounded-lg text-xs font-semibold border transition-colors', paymentMethod === m.value ? 'bg-brand text-white border-brand' : 'bg-white text-slate-600 border-slate-200 hover:border-brand hover:text-brand')}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* GST type — only meaningful under the GST tax model; determines whether
              tax prints as CGST+SGST (intra-state) or a single IGST line (inter-state) */}
          {taxModel === 'GST' && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" checked={isInterState} onChange={e => setIsInterState(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-brand focus:ring-brand" />
                Inter-State Sale (IGST)
              </label>
              {isInterState && (
                <input
                  value={buyerState}
                  onChange={e => setBuyerState(e.target.value)}
                  placeholder="Buyer's state (optional, for the invoice)"
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand text-slate-700 placeholder-slate-400"
                />
              )}
            </div>
          )}

          {/* Reference number for UPI/CARD */}
          {(paymentMethod === 'UPI' || paymentMethod === 'CARD') && (
            <Input
              label={paymentMethod === 'UPI' ? 'UPI Reference (optional)' : 'Card Reference (optional)'}
              value={referenceNumber}
              onChange={e => setReferenceNumber(e.target.value)}
              placeholder={paymentMethod === 'UPI' ? 'e.g. UTR number' : 'e.g. approval code'}
            />
          )}

          {/* Credit warning */}
          {paymentMethod === 'CREDIT' && (
            <div className="space-y-2">
              <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/10 border border-warning/20 text-warning text-xs">
                <span className="font-semibold shrink-0">Credit Sale</span>
                <span>Invoice created as UNPAID. Customer ledger debited. Payment to be collected later. Customer required.</span>
              </div>
              {/* Phase 58 §2 — optional payment due date (e.g. Agri Inputs'
                  harvest-tied credit terms — a farmer's bill may not fall due
                  for months). Generic across every vertical that sells on
                  credit, not agri-specific; feeds directly into the existing
                  Outstanding Analytics aging (report.service.ts's
                  generateOutstandingReport already ages by dueDate when set,
                  falling back to invoiceDate otherwise — this was the only
                  missing piece, nothing there needed to change). */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('billing.dueDate')} ({t('common.optional')})</label>
                <input
                  type="date" value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand text-slate-700"
                />
              </div>
            </div>
          )}

          {/* Split payment — inline cash + UPI entry */}
          {paymentMethod === 'SPLIT' && (
            <div className="space-y-2 p-3 rounded-xl bg-brand/5 border border-brand/20">
              <p className="text-xs font-semibold text-brand">Split Payment — enter amounts per method</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Cash ({currSym})</label>
                  <input
                    type="number" min="0" step="1" value={splitCash}
                    onChange={e => {
                      setSplitCash(e.target.value)
                      const cash = parseFloat(e.target.value) || 0
                      const remaining = Math.max(0, computeTotals(cart, effectiveGlobalDiscount).totalAmount - cash)
                      setSplitUpi(remaining > 0 ? remaining.toFixed(2) : '')
                    }}
                    placeholder="0.00"
                    className="w-full h-8 px-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">UPI ({currSym})</label>
                  <input
                    type="number" min="0" step="1" value={splitUpi}
                    onChange={e => {
                      setSplitUpi(e.target.value)
                      const upi = parseFloat(e.target.value) || 0
                      const remaining = Math.max(0, computeTotals(cart, effectiveGlobalDiscount).totalAmount - upi)
                      setSplitCash(remaining > 0 ? remaining.toFixed(2) : '')
                    }}
                    placeholder="0.00"
                    className="w-full h-8 px-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>
              {(() => {
                const cash = parseFloat(splitCash) || 0
                const upi = parseFloat(splitUpi) || 0
                const total = computeTotals(cart, effectiveGlobalDiscount).totalAmount
                const diff = Math.abs(cash + upi - total)
                return diff > 0.05 && (cash + upi) > 0 ? (
                  <p className="text-xs text-danger">Remaining: {formatCurrency(total - cash - upi)}</p>
                ) : null
              })()}
            </div>
          )}

          {/* Global discount */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">{t('billing.discount')} ({currSym})</p>
            <input
              type="number" min="0" step="1" value={globalDiscount || ''}
              onChange={e => setGlobalDiscount(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="w-full h-9 px-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand text-slate-700 placeholder-slate-400"
            />
          </div>

          {/* Phase 58 §2 — Jewellery old-metal exchange (applied atomically on checkout) */}
          {jewelleryPricingEnabled && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">{t('jewellery.applyExchange')}</p>
              {selectedExchange ? (
                <div className="flex items-center justify-between gap-2 border border-brand/30 bg-brand/5 rounded-xl px-3 py-2">
                  <p className="text-xs text-brand">{t('jewellery.exchangeApplied', { number: selectedExchange.exchangeNumber, amount: formatCurrency(selectedExchange.valueGiven) })}</p>
                  <button onClick={() => setSelectedExchange(null)} className="text-xs text-slate-400 hover:text-danger shrink-0">{t('jewellery.removeExchange')}</button>
                </div>
              ) : (
                <button
                  onClick={() => setShowExchangePicker(true)}
                  className="w-full h-9 px-3 rounded-xl border border-dashed border-slate-300 text-xs text-slate-500 hover:border-brand hover:text-brand transition-colors"
                >
                  {t('jewellery.applyExchange')}
                </button>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">{t('billing.notes')}</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder={t('billing.notes')}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand resize-none text-slate-700 placeholder-slate-400"
            />
          </div>
        </div>

        {/* Totals + Submit */}
        <div className="border-t border-slate-100 dark:border-slate-700 p-6 bg-slate-50 dark:bg-slate-800/50 space-y-2">
          <div className="flex justify-between text-sm text-slate-500">
            <span>{t('billing.subtotal')}</span><span>{formatCurrency(totals.subtotal)}</span>
          </div>
          {totals.discountAmount > 0 && (
            <div className="flex justify-between text-sm text-danger">
              <span>{t('billing.discount')}</span><span>– {formatCurrency(totals.discountAmount)}</span>
            </div>
          )}
          {splitTaxLines(taxModel, totals.taxAmount, isInterState ? 'IGST' : 'CGST_SGST').map(line => (
            <div key={line.label} className="flex justify-between text-sm text-slate-500">
              <span>{line.label}</span><span>{formatCurrency(line.amount)}</span>
            </div>
          ))}
          {Math.abs(totals.roundingAmount) > 0.001 && (
            <div className="flex justify-between text-sm text-slate-400">
              <span>{t('billing.rounding')}</span><span>{totals.roundingAmount > 0 ? '+' : ''}{formatCurrency(Math.abs(totals.roundingAmount))}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold text-dark border-t border-slate-200 pt-3 mt-1">
            <span>{t('common.total')}</span><span>{formatCurrency(totals.totalAmount)}</span>
          </div>

          <Button
            className="w-full mt-4"
            size="sm"
            onClick={handleSubmit}
            loading={submitting}
            disabled={cart.length === 0}
            title="Press F10 or Ctrl+Enter to confirm"
          >
            {paymentMethod === 'SPLIT' ? `${t('billing.splitPayment')} — ${formatCurrency(totals.totalAmount)}` : paymentMethod === 'CREDIT' ? t('billing.creditInvoice') : `${t('billing.confirmSale')} — ${formatCurrency(totals.totalAmount)}`}
            {!submitting && cart.length > 0 && <span className="ml-2 text-xs opacity-70">[F10]</span>}
          </Button>

          <button
            onClick={() => { setCart([]); setCustomer(null); setGlobalDiscount(0); setPaymentMethod('CASH'); setNotes(''); setReferenceNumber(''); setDiscountMode({}); setSplitCash(''); setSplitUpi(''); setAreaCalc({}); setVariantPickProduct(null); setVariantPickList([]); setIsInterState(false); setBuyerState('') }}
            className="w-full text-xs text-slate-400 hover:text-danger transition-colors py-1"
          >
            {t('billing.clearCart')}
          </button>
        </div>
      </div>

      {/* Variant picker modal — clothing/footwear */}
      {variantPickProduct && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-dark">Select Variant</h3>
                <p className="text-sm text-slate-500">{variantPickProduct.productName}</p>
              </div>
              <button onClick={() => { setVariantPickProduct(null); setVariantPickList([]); productSearchRef.current?.focus() }}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-dark hover:bg-slate-100 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
              {variantPickList.map(v => {
                const info = [v.size, v.color].filter(Boolean).join(' / ')
                const outOfStock = v.stockQty <= 0
                return (
                  <button
                    key={v.id}
                    disabled={outOfStock}
                    onClick={() => addToCartDirect(variantPickProduct, v)}
                    className={cn(
                      'flex flex-col p-3 rounded-xl border text-left transition-colors',
                      outOfStock
                        ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                        : 'border-slate-200 hover:border-brand hover:bg-brand/5'
                    )}
                  >
                    <span className="text-sm font-semibold text-dark">{info || 'Default'}</span>
                    {v.sku && <span className="text-xs text-slate-400 mt-0.5">SKU: {v.sku}</span>}
                    <div className="flex items-center justify-between mt-1.5">
                      <span className={cn('text-xs', outOfStock ? 'text-danger' : 'text-slate-500')}>
                        {outOfStock ? 'Out of stock' : `Stock: ${v.stockQty}`}
                      </span>
                      <span className="text-sm font-bold text-brand">
                        {formatCurrency(variantPickProduct.sellingPrice + v.additionalPrice)}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => addToCartDirect(variantPickProduct)}
              className="mt-3 w-full py-2 text-xs text-slate-400 hover:text-brand transition-colors border-t border-slate-100 pt-3"
            >
              Add without variant selection
            </button>
          </div>
        </div>
      )}

      {/* Serial/IMEI picker modal — electronics */}
      {serialPickProduct && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-dark">Select Device</h3>
                <p className="text-sm text-slate-500">{serialPickProduct.productName}</p>
              </div>
              <button onClick={() => { setSerialPickProduct(null); setSerialPickList([]); productSearchRef.current?.focus() }}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-dark hover:bg-slate-100 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
              {serialPickList.map(s => (
                <button
                  key={s.id}
                  onClick={() => addToCartDirect(serialPickProduct, undefined, s)}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200 text-left hover:border-brand hover:bg-brand/5 transition-colors"
                >
                  <div>
                    <span className="text-sm font-semibold text-dark">{s.serialNumber}</span>
                    {s.imeiNumber && <span className="text-xs text-slate-400 block mt-0.5">IMEI: {s.imeiNumber}</span>}
                  </div>
                  <span className="text-sm font-bold text-brand">{formatCurrency(serialPickProduct.sellingPrice)}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => addToCartDirect(serialPickProduct)}
              className="mt-3 w-full py-2 text-xs text-slate-400 hover:text-brand transition-colors border-t border-slate-100 pt-3"
            >
              Add without device selection
            </button>
          </div>
        </div>
      )}

      {/* Phase 58 §2 — Pharmacy Schedule H/H1 prescription-capture modal */}
      {rxPickProduct && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-dark">{t('billing.rx.title')}</h3>
                <p className="text-sm text-slate-500">{rxPickProduct.productName}</p>
              </div>
              <button onClick={() => setRxPickProduct(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-dark hover:bg-slate-100 transition-colors">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-3">{t('billing.rx.description')}</p>
            <div className="space-y-3">
              <Input label={t('billing.rx.patientName')} value={rxPatientName} onChange={e => setRxPatientName(e.target.value)} autoFocus />
              <Input label={t('billing.rx.doctorName')} value={rxDoctorName} onChange={e => setRxDoctorName(e.target.value)} />
              <Input label={t('billing.rx.date')} type="date" value={rxDate} onChange={e => setRxDate(e.target.value)} />
            </div>
            <Button className="w-full mt-4" onClick={handleConfirmRx} disabled={!rxPatientName.trim() || !rxDoctorName.trim()}>
              {t('billing.rx.addToCart')}
            </Button>
          </div>
        </div>
      )}

      {/* Customer quick-add modal */}
      {showQuickAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-base font-bold text-dark">{t('customers.addCustomer')}</h2>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">{t('customers.customerName')} *</label>
              <input value={quickName} onChange={e => setQuickName(e.target.value)}
                placeholder={t('customers.customerName')}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">{t('customers.phone')}</label>
              <input value={quickPhone} onChange={e => setQuickPhone(e.target.value)}
                placeholder={t('customers.phone')}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => { setShowQuickAdd(false); setQuickName(''); setQuickPhone('') }}>{t('common.cancel')}</Button>
              <Button className="flex-1" onClick={handleQuickAddCustomer} loading={quickAdding}>{t('customers.addCustomer')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Tip / Service Charge modal */}
      {showTipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-base font-bold text-dark dark:text-slate-100 flex items-center gap-2"><HandCoins size={18} /> {t('billing.addTipOrServiceCharge')}</h2>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">{t('billing.tipAmountLabel')}</label>
              <input
                type="number" min="0" step="0.01" value={tipAmount}
                onChange={e => setTipAmount(e.target.value)}
                placeholder="e.g. 100"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleConfirmTip() }}
              />
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => { setShowTipModal(false); setTipAmount('') }}>{t('common.cancel')}</Button>
              <Button className="flex-1" onClick={handleConfirmTip} loading={addingTip}>{t('billing.confirmAddToCart')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 58 §2 — Jewellery old-metal exchange picker */}
      {showExchangePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-base font-bold text-dark dark:text-slate-100">{t('jewellery.applyExchange')}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('jewellery.applyExchangeDesc')}</p>
            <input
              value={exchangeSearch}
              onChange={e => setExchangeSearch(e.target.value)}
              placeholder={t('jewellery.exchangeSearchPlaceholder') as string}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              autoFocus
            />
            <div className="space-y-2">
              {exchangeResults
                .filter(ex => {
                  const q = exchangeSearch.trim().toLowerCase()
                  if (!q) return true
                  return ex.exchangeNumber.toLowerCase().includes(q) || (ex.customer?.customerName ?? ex.customerName ?? '').toLowerCase().includes(q)
                })
                .map(ex => (
                  <button
                    key={ex.id}
                    onClick={() => { setSelectedExchange(ex); setShowExchangePicker(false); setExchangeSearch('') }}
                    className="w-full flex items-center justify-between border border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2 text-left hover:border-brand transition-colors"
                  >
                    <div>
                      <p className="text-sm font-mono text-dark dark:text-slate-100">{ex.exchangeNumber}</p>
                      <p className="text-xs text-slate-400">{ex.customer?.customerName ?? ex.customerName ?? '—'}</p>
                    </div>
                    <span className="text-sm font-semibold text-brand">{formatCurrency(ex.valueGiven)}</span>
                  </button>
                ))}
              {exchangeResults.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">{t('jewellery.noUnlinkedExchanges')}</p>
              )}
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => { setShowExchangePicker(false); setExchangeSearch('') }}>{t('common.cancel')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Hold Sale modal */}
      {showHoldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-base font-bold text-dark dark:text-slate-100">{t('billing.holdSale')}</h2>
            <Input
              label={t('billing.holdSaleLabel') as string}
              placeholder={t('billing.holdSaleLabelPlaceholder') as string}
              value={holdLabel}
              onChange={(e) => setHoldLabel(e.target.value)}
              autoFocus
            />
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => { setShowHoldModal(false); setHoldLabel('') }}>{t('common.cancel')}</Button>
              <Button className="flex-1" onClick={handleHoldSale} loading={holding}>{t('billing.confirmHold')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Resume Sale modal */}
      {showResumeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <p className="font-semibold text-dark dark:text-slate-100">{t('billing.heldSales')}</p>
              <button onClick={() => setShowResumeModal(false)} className="text-slate-400 hover:text-dark dark:hover:text-slate-100"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-2">
              {loadingHeldSales ? (
                <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>
              ) : heldSales.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">{t('billing.noHeldSales')}</p>
              ) : (
                heldSales.map((h) => (
                  <div key={h.id} className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-dark dark:text-slate-100">{h.label || h.customerName || `${h.itemCount} items`}</p>
                      <p className="text-xs text-slate-400">{t('billing.items', { count: h.itemCount })} · {formatCurrency(h.totalAmount)} · {new Date(h.createdAt).toLocaleTimeString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => handleResumeSale(h.id)} loading={resumingId === h.id}>{t('billing.resumeSaleAction')}</Button>
                      <button onClick={() => handleDeleteHeldSale(h.id)} className="text-slate-300 hover:text-danger" title={t('billing.abandonHeldSale') as string}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
