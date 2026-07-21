// Shared IPC type definitions — used by both main process and preload
// This file defines the complete API surface exposed to the renderer

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: { code: string; message: string; details?: unknown }
}

// Import Wizard wire types — kept in sync by hand with the shapes returned by
// src/main/services/import.service.ts (that file can't be imported here since
// it's the one main-process file also compiled under the renderer's
// browser-lib tsconfig, and import.service.ts pulls in Node/Electron modules).
export type ImportModule = 'products' | 'customers' | 'suppliers' | 'inventory' | 'openingBalances'

export interface ImportField {
  key: string
  label: string
  required: boolean
  description?: string
}

export interface ImportParseFileResult {
  sessionId: string
  headers: string[]
  preview: Record<string, string>[]
  totalRows: number
  suggestedMapping: Record<string, string>
  templateFields: ImportField[]
}

export interface ImportPreviewRow {
  rowIndex: number
  status: 'valid' | 'invalid' | 'warning'
  errors: string[]
  warnings: string[]
  data: Record<string, unknown>
}

export interface ImportPreviewResult {
  rows: ImportPreviewRow[]
  validCount: number
  invalidCount: number
  warningCount: number
  totalCount: number
}

export interface ImportExecuteResult {
  imported: number
  skipped: number
  failed: number
  warnings: number
  errors: Array<{ row: number; message: string }>
  backupCreated: boolean
  backupId?: string
}

export interface IpcChannels {
  auth: {
    login: (payload: { username: string; password: string; rememberMe?: boolean }) => Promise<ApiResponse>
    loginWithToken: () => Promise<ApiResponse>
    logout: () => Promise<ApiResponse>
    changePassword: (payload: { userId: string; oldPassword: string; newPassword: string }) => Promise<ApiResponse>
    getCurrentUser: () => Promise<ApiResponse>
    getPermissions: () => Promise<ApiResponse>
  }
  setup: {
    isSetupComplete: () => Promise<ApiResponse<boolean>>
    completeSetup: (payload: SetupPayload) => Promise<ApiResponse>
  }
  users: {
    list: () => Promise<ApiResponse>
    create: (payload: unknown) => Promise<ApiResponse>
    update: (payload: unknown) => Promise<ApiResponse>
    deactivate: (payload: { userId: string }) => Promise<ApiResponse>
    adminResetPassword: (payload: { userId: string; newPassword: string }) => Promise<ApiResponse>
  }
  roles: {
    list: () => Promise<ApiResponse>
    getPermissions: () => Promise<ApiResponse>
    updatePermissions: (payload: unknown) => Promise<ApiResponse>
  }
  businessProfile: {
    get: () => Promise<ApiResponse>
    update: (payload: unknown) => Promise<ApiResponse>
  }
  settings: {
    get: (key: string) => Promise<ApiResponse>
    set: (payload: { key: string; value: string }) => Promise<ApiResponse>
    getAll: () => Promise<ApiResponse>
  }
  products: {
    list: (payload?: { page?: number; limit?: number; categoryId?: string; isActive?: boolean }) => Promise<ApiResponse>
    get: (id: string) => Promise<ApiResponse>
    create: (payload: unknown) => Promise<ApiResponse>
    update: (payload: unknown) => Promise<ApiResponse>
    archive: (id: string) => Promise<ApiResponse>
    setAvailability: (payload: { id: string; unavailableUntil: string | null }) => Promise<ApiResponse>
    search: (query: string) => Promise<ApiResponse>
    getByBarcode: (barcode: string) => Promise<ApiResponse>
    // Phase 38: barcode generation + loose/weight billing
    generateBarcode: (payload: { productId: string }) => Promise<ApiResponse>
    bulkGenerateMissingBarcodes: () => Promise<ApiResponse>
    getByScannedBarcode: (payload: { code: string }) => Promise<ApiResponse>
    generateWeightLabel: (payload: { productId: string; weightGrams: number }) => Promise<ApiResponse>
    // Phase 58 §2 — Distributor customer-class/negotiated pricing
    resolveCustomerPrice: (payload: { productId: string; customerId?: string | null }) => Promise<ApiResponse<{ price: number }>>
    listCustomerClassPrices: (payload?: { productId?: string }) => Promise<ApiResponse>
    upsertCustomerClassPrice: (payload: { productId: string; customerClass: string; price: number }) => Promise<ApiResponse>
    deleteCustomerClassPrice: (payload: string) => Promise<ApiResponse>
  }
  categories: {
    list: () => Promise<ApiResponse>
    create: (payload: unknown) => Promise<ApiResponse>
    update: (payload: unknown) => Promise<ApiResponse>
    archive: (id: string) => Promise<ApiResponse>
  }
  inventory: {
    get: (productId: string) => Promise<ApiResponse>
    list: (payload?: { lowStockOnly?: boolean; page?: number; limit?: number; search?: string }) => Promise<ApiResponse>
    addStock: (payload: unknown) => Promise<ApiResponse>
    adjustStock: (payload: unknown) => Promise<ApiResponse>
    getMovements: (payload?: { productId?: string; movementType?: string; page?: number; limit?: number }) => Promise<ApiResponse>
    getInventoryValue: () => Promise<ApiResponse>
  }
  customers: {
    list: (payload?: { page?: number; limit?: number }) => Promise<ApiResponse>
    listOutstanding: () => Promise<ApiResponse>
    get: (id: string) => Promise<ApiResponse>
    create: (payload: unknown) => Promise<ApiResponse>
    update: (payload: unknown) => Promise<ApiResponse>
    archive: (id: string) => Promise<ApiResponse>
    getLedger: (id: string) => Promise<ApiResponse>
    search: (query: string) => Promise<ApiResponse>
  }
  suppliers: {
    list: (payload?: { page?: number; limit?: number }) => Promise<ApiResponse>
    get: (id: string) => Promise<ApiResponse>
    create: (payload: unknown) => Promise<ApiResponse>
    update: (payload: unknown) => Promise<ApiResponse>
    archive: (id: string) => Promise<ApiResponse>
    getLedger: (id: string) => Promise<ApiResponse>
    search: (query: string) => Promise<ApiResponse>
    recordPayment: (payload: { supplierId: string; amount: number; paymentMethod: string; referenceNumber?: string; remarks?: string }) => Promise<ApiResponse>
  }
  purchaseOrders: {
    list: (payload?: { supplierId?: string; status?: string; page?: number; limit?: number }) => Promise<ApiResponse>
    get: (id: string) => Promise<ApiResponse>
    create: (payload: unknown) => Promise<ApiResponse>
    approve: (id: string) => Promise<ApiResponse>
    receive: (id: string) => Promise<ApiResponse>
    cancel: (payload: { id: string; reason: string }) => Promise<ApiResponse>
    // Phase 58 §2 — reorder automation triggered from low-stock alerts
    generateReorderDraftPOs: () => Promise<ApiResponse<{ created: Array<{ poId: string; poNumber: string; supplierId: string; supplierName: string; itemCount: number }>; skippedNoDefaultSupplier: number; skippedAlreadyOnOpenPO: number }>>
  }
  billing: {
    createInvoice: (payload: unknown) => Promise<ApiResponse>
    getInvoice: (id: string) => Promise<ApiResponse>
    listInvoices: (payload?: unknown) => Promise<ApiResponse>
    cancelInvoice: (payload: { invoiceId: string; reason: string }) => Promise<ApiResponse>
    generateInvoiceNumber: () => Promise<ApiResponse<string>>
    getOrCreateTipProduct: () => Promise<ApiResponse>
    getFrequentlySoldProducts: (payload?: { limit?: number }) => Promise<ApiResponse>
    // Phase 58 §2 (2026-07-21) — real split-bill: divides one invoice's
    // (allocated) line quantities across N brand-new invoices.
    splitInvoice: (payload: unknown) => Promise<ApiResponse<{ invoiceIds: string[] }>>
  }
  heldSale: {
    hold: (payload: { cartJson: string; itemCount: number; totalAmount: number; label?: string; customerId?: string }) => Promise<ApiResponse>
    list: () => Promise<ApiResponse>
    resume: (payload: { id: string }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
  }
  payments: {
    record: (payload: unknown) => Promise<ApiResponse>
    recordSplit: (payload: { invoiceId: string; legs: { paymentMethod: string; amount: number; referenceNumber?: string }[] }) => Promise<ApiResponse>
    reverse: (payload: { paymentId: string; reason: string }) => Promise<ApiResponse>
    list: (payload?: { invoiceId?: string; customerId?: string; method?: string; dateFrom?: string; dateTo?: string; search?: string; page?: number; limit?: number }) => Promise<ApiResponse>
  }
  cashClose: {
    getSummary: (payload?: { date?: string }) => Promise<ApiResponse>
    create: (payload: { date: string; actualCash: number; notes?: string }) => Promise<ApiResponse>
    list: (payload?: { dateFrom?: string; dateTo?: string; page?: number; limit?: number }) => Promise<ApiResponse>
  }
  expenses: {
    list: (payload?: { categoryId?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number }) => Promise<ApiResponse>
    create: (payload: { categoryId: string; expenseName: string; amount: number; expenseDate?: string; paymentMethod?: string; remarks?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; categoryId: string; expenseName: string; amount: number; expenseDate?: string; paymentMethod?: string; remarks?: string }) => Promise<ApiResponse>
    delete: (id: string) => Promise<ApiResponse>
    summary: (payload: { dateFrom: string; dateTo: string }) => Promise<ApiResponse>
    listCategories: () => Promise<ApiResponse>
    createCategory: (payload: { categoryName: string; description?: string }) => Promise<ApiResponse>
  }
  tax: {
    list: () => Promise<ApiResponse>
    create: (payload: unknown) => Promise<ApiResponse>
    update: (payload: unknown) => Promise<ApiResponse>
    delete: (id: string) => Promise<ApiResponse>
  }
  reports: {
    sales: (payload: unknown) => Promise<ApiResponse>
    inventory: (payload?: unknown) => Promise<ApiResponse>
    tax: (payload: unknown) => Promise<ApiResponse>
    outstanding: () => Promise<ApiResponse>
    expenses: (payload: unknown) => Promise<ApiResponse>
    profitAndLoss: (payload: { dateFrom: string; dateTo: string }) => Promise<ApiResponse>
    cashBook: (payload: { dateFrom: string; dateTo: string; paymentMethod?: string }) => Promise<ApiResponse>
    trialBalance: (payload: { dateFrom: string; dateTo: string }) => Promise<ApiResponse>
    customerLedger: (payload: unknown) => Promise<ApiResponse>
    supplierLedger: (payload: unknown) => Promise<ApiResponse>
    audit: (payload?: unknown) => Promise<ApiResponse>
    foodCost: (payload?: { dateFrom?: string; dateTo?: string }) => Promise<ApiResponse>
    gstr1: (payload: { dateFrom: string; dateTo: string }) => Promise<ApiResponse>
    hsnSummary: (payload: { dateFrom: string; dateTo: string }) => Promise<ApiResponse>
    documentSummary: (payload: { dateFrom: string; dateTo: string }) => Promise<ApiResponse>
    gstr3bPreview: (payload: { dateFrom: string; dateTo: string }) => Promise<ApiResponse>
    appointmentUtilisation: (payload: { dateFrom: string; dateTo: string; providerId?: string }) => Promise<ApiResponse>
    clientRetention: (payload: { dateFrom: string; dateTo: string }) => Promise<ApiResponse>
    commission: (payload: { dateFrom: string; dateTo: string; staffId?: string }) => Promise<ApiResponse>
    orderVolume: (payload: { dateFrom: string; dateTo: string }) => Promise<ApiResponse>
    batchExpiry: () => Promise<ApiResponse>
    labThroughput: (payload: { dateFrom: string; dateTo: string }) => Promise<ApiResponse>
    bloodStock: () => Promise<ApiResponse>
    jewellery: (payload: { dateFrom: string; dateTo: string }) => Promise<ApiResponse>
    projects: (payload: { dateFrom: string; dateTo: string }) => Promise<ApiResponse>
    serviceProjects: (payload: { dateFrom: string; dateTo: string }) => Promise<ApiResponse>
    jobCards: (payload: { dateFrom: string; dateTo: string }) => Promise<ApiResponse>
    carJobCards: (payload: { dateFrom: string; dateTo: string }) => Promise<ApiResponse>
    tailoringOrders: (payload: { dateFrom: string; dateTo: string }) => Promise<ApiResponse>
    pestContracts: (payload: { dateFrom: string; dateTo: string }) => Promise<ApiResponse>
    realEstatePipeline: (payload: { dateFrom: string; dateTo: string }) => Promise<ApiResponse>
    retainers: (payload: { dateFrom: string; dateTo: string }) => Promise<ApiResponse>
    shootBookings: (payload: { dateFrom: string; dateTo: string }) => Promise<ApiResponse>
    eventBookings: (payload: { dateFrom: string; dateTo: string }) => Promise<ApiResponse>
    placements: (payload: { dateFrom: string; dateTo: string }) => Promise<ApiResponse>
    drawingRegister: (payload: { dateFrom: string; dateTo: string }) => Promise<ApiResponse>
    siteVisitLog: (payload: { dateFrom: string; dateTo: string }) => Promise<ApiResponse>
    prescriptionDrugSales: (payload: { dateFrom: string; dateTo: string }) => Promise<ApiResponse>
    logistics: (payload: { dateFrom: string; dateTo: string }) => Promise<ApiResponse>
    attendance: (payload: { dateFrom: string; dateTo: string }) => Promise<ApiResponse>
    production: (payload: { dateFrom: string; dateTo: string }) => Promise<ApiResponse>
    serialWarranty: () => Promise<ApiResponse>
    variantStock: () => Promise<ApiResponse>
    testScores: (payload?: { dateFrom?: string; dateTo?: string; batchId?: string }) => Promise<ApiResponse>
    complianceTasks: () => Promise<ApiResponse>
    rentalStatus: () => Promise<ApiResponse>
    rentalRevenue: (payload: { dateFrom: string; dateTo: string }) => Promise<ApiResponse>
  }
  export: {
    toCsv: (payload: { filename: string; headers: string[]; rows: (string | number | null | undefined)[][] }) => Promise<ApiResponse>
    toExcel: (payload: { filename: string; sheets: { name: string; headers: string[]; rows: (string | number | null | undefined)[][] }[] }) => Promise<ApiResponse>
    toPdf: (payload: { html: string; filename: string }) => Promise<ApiResponse>
    generateReportHtml: (payload: {
      title: string; subtitle?: string; dateRange?: string
      summaryCards?: { label: string; value: string }[]
      charts?: Array<
        | { type: 'bar'; title: string; orientation?: 'horizontal' | 'vertical'; data: { label: string; value: number; color?: string }[]; valueIsCurrency?: boolean }
        | { type: 'stackedBar'; title: string; data: { label: string; segments: { value: number; color: string; name?: string }[] }[]; legend?: { name: string; color: string }[] }
        | { type: 'line'; title: string; data: { label: string; value: number }[]; valueIsCurrency?: boolean }
        | { type: 'pie'; title: string; data: { label: string; value: number; color?: string }[]; valueIsCurrency?: boolean }
      >
      tables: { heading?: string; headers: string[]; rows: (string | number | null)[][] }[]
      currencySymbol?: string; reportPermission?: string
    }) => Promise<ApiResponse<string>>
  }
  analytics: {
    getDashboardKpis: (payload?: { forceRefresh?: boolean }) => Promise<ApiResponse>
    getRevenueTrend: (payload: { period: '1d' | '7d' | '30d' | '90d' | '12m' | 'custom'; customFrom?: string; customTo?: string }) => Promise<ApiResponse>
    getTopProducts: (payload: { limit: number }) => Promise<ApiResponse>
    getRecentActivity: () => Promise<ApiResponse>
    getDashboardAlerts: () => Promise<ApiResponse>
    getTopOutstanding: (payload: { limit: number }) => Promise<ApiResponse>
    getTopCategories: (payload: { limit: number }) => Promise<ApiResponse>
    getEstimatedProfit: (payload: { dateFrom: string; dateTo: string }) => Promise<ApiResponse>
  }
  import: {
    parseFile: (payload: { module: ImportModule }) => Promise<ApiResponse<ImportParseFileResult>>
    parseDroppedFile: (payload: { module: ImportModule; filePath: string }) => Promise<ApiResponse<ImportParseFileResult>>
    validatePreview: (payload: { sessionId: string; mapping: Record<string, string>; module: ImportModule }) => Promise<ApiResponse<ImportPreviewResult>>
    execute: (payload: { sessionId: string; mapping: Record<string, string>; module: ImportModule }) => Promise<ApiResponse<ImportExecuteResult>>
    downloadTemplate: (payload: { module: ImportModule }) => Promise<ApiResponse>
    getFields: (payload: { module: ImportModule }) => Promise<ApiResponse<ImportField[]>>
  }
  backup: {
    create: () => Promise<ApiResponse>
    list: () => Promise<ApiResponse>
    restore: (payload: { backupId: string }) => Promise<ApiResponse>
    validate: (payload: { backupId: string }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
    checkIntegrity: () => Promise<ApiResponse<{ ok: boolean; message: string }>>
    pickDestinationFolder: () => Promise<ApiResponse<{ folderPath: string } | null>>
    getDestination: () => Promise<ApiResponse<{ configuredDir: string | null; effectiveDir: string; usedFallback: boolean }>>
    setDestination: (payload: { path: string | null }) => Promise<ApiResponse>
  }
  audit: {
    list: (payload?: unknown) => Promise<ApiResponse>
    verifyChain: () => Promise<ApiResponse<{ ok: boolean; verifiedCount: number; brokenAt?: { id: string; reason: string } }>>
  }
  notifications: {
    list: () => Promise<ApiResponse>
    getUnreadCount: () => Promise<ApiResponse<number>>
    markRead: (id: string) => Promise<ApiResponse>
    markAllRead: () => Promise<ApiResponse>
  }
  dialog: {
    openFile: (options: { title?: string; accept?: string[]; maxSizeBytes?: number }) => Promise<ApiResponse<string | null>>
  }
  app: {
    getPaths: () => Promise<ApiResponse<{ userData: string; logs: string; backups: string }>>
    getPlatform: () => Promise<ApiResponse<NodeJS.Platform>>
    checkForUpdates: () => Promise<ApiResponse<{ hasUpdate: boolean; latestVersion: string; currentVersion: string }>>
    acknowledgeDisclaimer: () => Promise<ApiResponse>
    isDisclaimerAccepted: () => Promise<ApiResponse<boolean>>
    isBackupPromptDismissed: () => Promise<ApiResponse<boolean>>
    dismissBackupPrompt: () => Promise<ApiResponse>
    // Phase 44: base64 data-URI form of the business logo, for renderer-side print
    // paths (e.g. ChallanScreen's window.open()/document.write() popup) that have no
    // resolvable file:// base and can't just interpolate a file path like the
    // main-process print templates do.
    getBusinessLogoDataUri: () => Promise<ApiResponse<string | null>>
    // Generic UPI-QR generator for renderer-side, self-built print flows not
    // already routed through print.service.ts's own invoice/receipt HTML
    // (which embed it server-side). Returns { qrDataUrl: null } — not an
    // error — whenever the business has no UPI configured or isn't Indian.
    generateUpiPaymentQr: (payload: { amount: number; note: string }) => Promise<ApiResponse<{ qrDataUrl: string } | null>>
  }
  print: {
    invoice: (payload: { invoiceId: string }) => Promise<ApiResponse>
    receipt: (payload: { invoiceId: string; paperWidth?: '80mm' | '58mm' }) => Promise<ApiResponse>
    kot: (payload: { kotId: string }) => Promise<ApiResponse>
    // Lists Windows-registered printers so Settings can offer a "Kitchen Printer"
    // picker — KOT tickets print silently (no OS dialog), so without this the
    // silent print always lands on whatever the OS default printer happens to be.
    listPrinters: () => Promise<ApiResponse<Array<{ name: string; displayName: string; isDefault: boolean }>>>
    previewInvoice: (payload: { invoiceId: string }) => Promise<ApiResponse<string>>
    previewReceipt: (payload: { invoiceId: string; paperWidth?: '80mm' | '58mm' }) => Promise<ApiResponse<string>>
    // Phase 38: barcode/price label printing — routes through the same HTML + OS print-dialog
    // mechanism as invoice/receipt printing (see print.service.ts), not a raw ZPL/TSPL path.
    labels: (payload: {
      items: Array<{ productId: string; variantId?: string; copies: number; barcodeOverride?: string; priceTextOverride?: string }>
      outputMode: 'THERMAL_LABEL' | 'A4_SHEET'
      fields?: { showPrice?: boolean; showBarcode?: boolean; showName?: boolean }
    }) => Promise<ApiResponse>
    previewLabels: (payload: {
      items: Array<{ productId: string; variantId?: string; copies: number; barcodeOverride?: string; priceTextOverride?: string }>
      outputMode: 'THERMAL_LABEL' | 'A4_SHEET'
      fields?: { showPrice?: boolean; showBarcode?: boolean; showName?: boolean }
    }) => Promise<ApiResponse<string>>
  }
  search: {
    global: (payload: { query: string }) => Promise<ApiResponse>
  }
  industry: {
    getTemplate: () => Promise<ApiResponse>
    setTemplate: (payload: { businessType: string }) => Promise<ApiResponse>
    changeBusinessType: (payload: { businessType: string }) => Promise<ApiResponse>
    updateModules: (payload: { modules: string[] }) => Promise<ApiResponse>
  }
  restaurant: {
    listTables: () => Promise<ApiResponse>
    createTable: (payload: { tableNumber: string; tableName?: string }) => Promise<ApiResponse>
    updateTableStatus: (payload: { tableId: string; status: string }) => Promise<ApiResponse>
    assignWaiter: (payload: { tableId: string; waiterId: string | null }) => Promise<ApiResponse>
    deleteTable: (payload: { tableId: string }) => Promise<ApiResponse>
    listKOTs: (payload?: { status?: string; tableId?: string }) => Promise<ApiResponse>
    createKOT: (payload: { invoiceId: string; tableId?: string }) => Promise<ApiResponse>
    updateKOTStatus: (payload: { kotId: string; status: string }) => Promise<ApiResponse>
    listRecipes: () => Promise<ApiResponse>
    getRecipe: (productId: string) => Promise<ApiResponse>
    upsertRecipe: (payload: { productId: string; recipeName: string; items: Array<{ ingredientProductId: string; quantity: number }> }) => Promise<ApiResponse>
    deleteRecipe: (payload: { recipeId: string }) => Promise<ApiResponse>
    getDailyClosingSummary: (payload?: { date?: string }) => Promise<ApiResponse>
    performDailyClose: () => Promise<ApiResponse>
    // Phase 47 — QR Table Ordering
    getQrOrderingStatus: () => Promise<ApiResponse>
    listOrderRequests: (payload?: { status?: string }) => Promise<ApiResponse>
    acceptOrderRequest: (payload: { requestId: string; paymentMethod: string; customerId?: string }) => Promise<ApiResponse>
    rejectOrderRequest: (payload: { requestId: string }) => Promise<ApiResponse>
    generateTableQr: (payload: { tableId: string }) => Promise<ApiResponse>
    // Kitchen Display (phone/laptop, LAN) — additive to KOT printing and the
    // second-monitor board, same qr-order-server.ts LAN-trust model.
    getKitchenDisplayStatus: () => Promise<ApiResponse<{ running: boolean; port: number | null; lanUrls: string[]; token: string | null }>>
    regenerateKitchenDisplayToken: () => Promise<ApiResponse<{ token: string }>>
    generateKitchenDisplayQr: () => Promise<ApiResponse<{ qrDataUrl: string; boardUrl: string }>>
    // Phase 58 §2 (2026-07-21) — ad-hoc table merge (mid-service, after an
    // order is already running); merging AT order-open time instead goes
    // through billing.createInvoice's own tableIds array.
    mergeTableIntoInvoice: (payload: { tableId: string; invoiceId: string }) => Promise<ApiResponse>
  }
  // Phase 58 §2 (2026-07-21) — real reservation records (replacing the old
  // bare RESERVED status string with no metadata).
  reservations: {
    create: (payload: { customerName: string; phone: string; partySize: number; reservedFor: string; tableId?: string; notes?: string }) => Promise<ApiResponse>
    list: (payload?: { status?: string; dateFrom?: string; dateTo?: string }) => Promise<ApiResponse>
    updateStatus: (payload: { id: string; status: string }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
    upcomingByTable: (payload?: { withinHours?: number }) => Promise<ApiResponse>
  }
  // Kitchen Display (second monitor, same billing PC) — opens/closes a
  // BrowserWindow showing the #/kitchen-display board on a chosen display.
  kitchenDisplay: {
    listDisplays: () => Promise<ApiResponse<Array<{ id: number; label: string; isPrimary: boolean }>>>
    open: (payload?: { displayId?: number }) => Promise<ApiResponse>
    close: () => Promise<ApiResponse>
    getStatus: () => Promise<ApiResponse<{ open: boolean; displayId: number | null }>>
  }
  // Phase 58 §2 — Distributor field-rep order capture (phone/laptop, LAN),
  // same qr-order-server.ts/kitchen-display-server.ts LAN-trust model.
  distributor: {
    getFieldOrderStatus: () => Promise<ApiResponse<{ running: boolean; port: number | null; lanUrls: string[]; token: string | null }>>
    regenerateFieldOrderToken: () => Promise<ApiResponse<{ token: string }>>
    generateFieldOrderQr: () => Promise<ApiResponse<{ qrDataUrl: string; captureUrl: string }>>
    listFieldOrderRequests: (payload?: { status?: string }) => Promise<ApiResponse>
    acceptFieldOrderRequest: (payload: { requestId: string; paymentMethod: string }) => Promise<ApiResponse>
    rejectFieldOrderRequest: (payload: { requestId: string }) => Promise<ApiResponse>
  }
  // Phase 58 §2 — Electronics repair/RMA workflow, linked to a specific
  // ProductSerial/IMEI.
  repairTickets: {
    create: (payload: { serialId: string; customerId?: string; issueDescription: string; vendorId?: string; notes?: string }) => Promise<ApiResponse<{ id: string; claimNumber: string }>>
    list: (payload?: { status?: string; productId?: string; customerId?: string; search?: string; page?: number; limit?: number }) => Promise<ApiResponse>
    get: (payload: { id: string }) => Promise<ApiResponse>
    serviceHistory: (payload: { serialId: string }) => Promise<ApiResponse<{ tickets: unknown[]; replacedOnTicket: { id: string; claimNumber: string } | null; serial: { id: string; serialNumber: string; imeiNumber: string | null; status: string; productId: string; productName: string } | null }>>
    updateStatus: (payload: { id: string; status: string; vendorId?: string; vendorRmaNumber?: string; replacementSerialId?: string; repairCost?: number; notes?: string }) => Promise<ApiResponse>
  }
  returns: {
    create: (payload: { originalInvoiceId: string; items: Array<{ productId: string; quantity: number }>; reason: string }) => Promise<ApiResponse>
    list: (payload?: { originalInvoiceId?: string }) => Promise<ApiResponse>
    todaySummary: () => Promise<ApiResponse<{ count: number; totalRefunded: number }>>
  }
  // Phase 2 — Industry Expansion
  batches: {
    list: (payload?: { productId?: string; expiringSoonDays?: number; expired?: boolean; page?: number; limit?: number }) => Promise<ApiResponse>
    create: (payload: { productId: string; batchNumber: string; expiryDate: string; mfgDate?: string; quantityReceived: number; unitCost?: number; supplierId?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; expiryDate?: string; mfgDate?: string; quantityRemaining?: number; unitCost?: number }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
    expiryAlerts: (payload?: { withinDays?: number }) => Promise<ApiResponse>
  }
  serials: {
    list: (payload?: { productId?: string; status?: string; imeiNumber?: string; serialNumber?: string; page?: number; limit?: number }) => Promise<ApiResponse>
    create: (payload: { productId: string; serialNumber: string; imeiNumber?: string; imei2Number?: string; warrantyMonths?: number; purchaseDate?: string; unitCost?: number }) => Promise<ApiResponse>
    bulkCreate: (payload: { productId: string; serials: Array<{ serialNumber: string; imeiNumber?: string; imei2Number?: string; warrantyMonths?: number; unitCost?: number }>; purchaseDate?: string }) => Promise<ApiResponse>
    updateStatus: (payload: { id: string; status: string; invoiceId?: string; soldDate?: string }) => Promise<ApiResponse>
    searchByImei: (payload: { imei: string }) => Promise<ApiResponse>
  }
  variants: {
    list: (payload: { productId: string }) => Promise<ApiResponse>
    upsert: (payload: { productId: string; variants: Array<{ id?: string; size?: string; color?: string; sku?: string; barcode?: string; additionalPrice?: number; stockQty?: number }> }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
    adjustStock: (payload: { variantId: string; quantityDelta: number }) => Promise<ApiResponse>
    summary: (payload: { productId: string }) => Promise<ApiResponse>
    // Phase 58 §2 — Clothing/Footwear variant barcode generation
    generateBarcode: (payload: { variantId: string }) => Promise<ApiResponse<{ barcode: string }>>
    bulkGenerateMissingBarcodes: (payload: { productId: string }) => Promise<ApiResponse<{ generated: number; totalMissing: number }>>
  }
  // Phase 3 — Manufacturing Lite
  rawMaterials: {
    list: (payload?: { isActive?: boolean; lowStock?: boolean; supplierId?: string; search?: string; limit?: number }) => Promise<ApiResponse>
    create: (payload: { name: string; unit?: string; currentStock?: number; reorderLevel?: number; unitCost?: number; supplierId?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; name?: string; unit?: string; reorderLevel?: number; unitCost?: number; supplierId?: string | null }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
    adjustStock: (payload: { id: string; type: 'PURCHASE' | 'ADJUSTMENT' | 'RETURN'; quantity: number; unitCost?: number; reference?: string; notes?: string }) => Promise<ApiResponse>
    movements: (payload: { rawMaterialId: string; limit?: number }) => Promise<ApiResponse>
    // Phase 58 §2 — raw-material lot/batch traceability
    receiveBatch: (payload: { rawMaterialId: string; batchNumber: string; quantity: number; unitCost?: number; supplierId?: string }) => Promise<ApiResponse>
    listBatches: (payload?: { rawMaterialId?: string }) => Promise<ApiResponse>
  }
  bom: {
    list: (payload?: { isActive?: boolean }) => Promise<ApiResponse>
    get: (payload: { productId: string }) => Promise<ApiResponse>
    // Phase 58 §2 — multi-level BOM: a line is either a raw material or a
    // component Product (sub-assembly), never both.
    upsert: (payload: { productId: string; description?: string; outputQty?: number; items: Array<{ rawMaterialId?: string; componentProductId?: string; quantityNeeded: number; wastagePercent?: number }> }) => Promise<ApiResponse>
    delete: (payload: { productId: string }) => Promise<ApiResponse>
  }
  production: {
    list: (payload?: { status?: string; productId?: string; limit?: number }) => Promise<ApiResponse>
    get: (payload: { id: string }) => Promise<ApiResponse>
    create: (payload: { productId: string; plannedQty: number; notes?: string }) => Promise<ApiResponse>
    start: (payload: { id: string }) => Promise<ApiResponse>
    // Phase 58 §2 — scrapQty/laborCost folded into produced-unit cost basis
    complete: (payload: { id: string; producedQty: number; scrapQty?: number; laborCost?: number; notes?: string }) => Promise<ApiResponse>
    cancel: (payload: { id: string; notes?: string }) => Promise<ApiResponse>
  }
  workOrders: {
    list: (payload: { productionOrderId: string }) => Promise<ApiResponse>
    // Phase 58 §2 — isQcStep flags a QC/inspection checkpoint
    upsert: (payload: { productionOrderId: string; steps: Array<{ id?: string; stepNumber: number; taskName: string; notes?: string; isQcStep?: boolean }> }) => Promise<ApiResponse>
    updateStatus: (payload: { id: string; status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED'; qcResult?: 'PASS' | 'FAIL'; qcNotes?: string }) => Promise<ApiResponse>
  }
  dispatch: {
    list: (payload?: { status?: string; productId?: string; limit?: number }) => Promise<ApiResponse>
    create: (payload: { productId: string; productionOrderId?: string; quantity: number; customerId?: string; destination?: string; notes?: string }) => Promise<ApiResponse>
    updateStatus: (payload: { id: string; status: 'DISPATCHED' | 'DELIVERED'; date?: string }) => Promise<ApiResponse>
  }
  // Phase 4 — Service Business Module
  projects: {
    list: (payload?: { status?: string; customerId?: string; limit?: number }) => Promise<ApiResponse>
    get: (payload: { id: string }) => Promise<ApiResponse>
    create: (payload: { title: string; description?: string; priority?: string; customerId?: string; assignedToId?: string; estimatedHours?: number; estimatedAmount?: number; startDate?: string; dueDate?: string; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; title?: string; description?: string; status?: string; priority?: string; customerId?: string | null; assignedToId?: string | null; estimatedHours?: number; estimatedAmount?: number; startDate?: string | null; dueDate?: string | null; notes?: string }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
    generateInvoice: (payload: { id: string }) => Promise<ApiResponse>
    tasks: {
      list: (payload: { projectId: string }) => Promise<ApiResponse>
      create: (payload: { projectId: string; title: string; description?: string; priority?: string; estimatedHours?: number; dueDate?: string }) => Promise<ApiResponse>
      update: (payload: { id: string; title?: string; description?: string; status?: string; priority?: string; estimatedHours?: number; dueDate?: string | null }) => Promise<ApiResponse>
      delete: (payload: { id: string }) => Promise<ApiResponse>
    }
  }
  tickets: {
    list: (payload?: { status?: string; priority?: string; customerId?: string; limit?: number }) => Promise<ApiResponse>
    create: (payload: { title: string; description?: string; priority?: string; category?: string; customerId?: string; assignedToId?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; title?: string; description?: string; status?: string; priority?: string; category?: string; customerId?: string | null; assignedToId?: string | null; resolution?: string }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
    generateInvoice: (payload: { id: string; amount: number }) => Promise<ApiResponse>
  }
  jobCards: {
    list: (payload?: { status?: string; customerId?: string; limit?: number }) => Promise<ApiResponse>
    create: (payload: { title: string; itemDescription?: string; priority?: string; customerId?: string; assignedToId?: string; estimatedCost?: number; expectedDate?: string; notes?: string; internalNotes?: string; warrantyClaimAgainstId?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; title?: string; itemDescription?: string; status?: string; priority?: string; customerId?: string | null; assignedToId?: string | null; estimatedCost?: number; actualCost?: number; expectedDate?: string | null; notes?: string; internalNotes?: string; warrantyDays?: number | null }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
    generateInvoice: (payload: { id: string }) => Promise<ApiResponse>
    listParts: (payload: { jobCardId: string }) => Promise<ApiResponse>
    addPart: (payload: { jobCardId: string; productId: string; quantity: number }) => Promise<ApiResponse>
    removePart: (payload: { id: string }) => Promise<ApiResponse>
  }
  workLogs: {
    list: (payload: { projectId?: string; ticketId?: string; jobCardId?: string; limit?: number }) => Promise<ApiResponse>
    create: (payload: { projectId?: string; ticketId?: string; jobCardId?: string; title: string; description?: string; hours: number; logDate?: string; billable?: boolean }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
  }
  // Phase 11 — Document Management
  documents: {
    pick: (payload?: { title?: string }) => Promise<ApiResponse<{ filePath: string } | null>>
    attach: (payload: { sourcePath: string; fileName: string; entityType: string; entityId: string; notes?: string }) => Promise<ApiResponse>
    list: (payload: { entityType: string; entityId: string }) => Promise<ApiResponse>
    listAll: (payload?: { entityType?: string; limit?: number }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
    open: (payload: { id: string }) => Promise<ApiResponse>
  }
  // Phase 17 — HR & Attendance
  hr: {
    listEmployees: (payload?: { isActive?: boolean; department?: string }) => Promise<ApiResponse>
    getEmployee: (payload: { id: string }) => Promise<ApiResponse>
    createEmployee: (payload: { fullName: string; phone?: string; email?: string; department?: string; designation?: string; employeeType?: string; joinDate: string; salaryType?: string; basicSalary?: number; allowances?: { name: string; amount: number }[]; notes?: string; employeeNumber?: string }) => Promise<ApiResponse>
    updateEmployee: (payload: { id: string; fullName?: string; phone?: string; email?: string; department?: string; designation?: string; employeeType?: string; joinDate?: string; exitDate?: string | null; isActive?: boolean; salaryType?: string; basicSalary?: number; allowances?: { name: string; amount: number }[]; notes?: string; employeeNumber?: string }) => Promise<ApiResponse>
    deactivateEmployee: (payload: { id: string }) => Promise<ApiResponse>
    markAttendance: (payload: { employeeId: string; date: string; status: string; checkIn?: string; checkOut?: string; notes?: string }) => Promise<ApiResponse>
    bulkMarkAttendance: (payload: { date: string; records: { employeeId: string; status: string }[] }) => Promise<ApiResponse>
    getMonthAttendance: (payload: { year: number; month: number; employeeId?: string }) => Promise<ApiResponse>
    getMonthlySummaries: (payload: { year: number; month: number }) => Promise<ApiResponse>
    listLeaveTypes: () => Promise<ApiResponse>
    createLeaveType: (payload: { name: string; maxDays?: number; isPaid?: boolean }) => Promise<ApiResponse>
    listLeaveRequests: (payload?: { employeeId?: string; status?: string; year?: number }) => Promise<ApiResponse>
    createLeaveRequest: (payload: { employeeId: string; leaveTypeId: string; fromDate: string; toDate: string; days: number; reason?: string }) => Promise<ApiResponse>
    updateLeaveStatus: (payload: { id: string; status: 'APPROVED' | 'REJECTED'; notes?: string }) => Promise<ApiResponse>
    getLeaveBalance: (payload: { employeeId: string; year: number }) => Promise<ApiResponse>
  }
  payroll: {
    listForPeriod: (payload: { year: number; month: number }) => Promise<ApiResponse>
    generate: (payload: { year: number; month: number }) => Promise<ApiResponse>
    updateDeductions: (payload: { id: string; deductions: { name: string; amount: number }[]; notes?: string }) => Promise<ApiResponse>
    markPaid: (payload: { id: string; paymentMethod: string; paidDate?: string }) => Promise<ApiResponse>
    print: (payload: { id: string }) => Promise<ApiResponse>
  }
  rental: {
    checkAvailability: (payload: { productId: string; startDateTime: string; endDateTime: string; quantity?: number; excludeBookingId?: string }) => Promise<ApiResponse>
    listBookings: (payload?: { status?: string; customerId?: string }) => Promise<ApiResponse>
    getBooking: (payload: { id: string }) => Promise<ApiResponse>
    createBooking: (payload: { customerId: string; startDateTime: string; endDateTime: string; securityDepositCollected?: number; notes?: string; recurrenceIntervalDays?: number; parentBookingId?: string; items: Array<{ productId: string; rateBasis: string; quantity?: number }> }) => Promise<ApiResponse>
    checkoutBooking: (payload: { id: string; checkoutNotes?: string; itemConditions?: Array<{ itemId: string; conditionOut: string }> }) => Promise<ApiResponse>
    returnBooking: (payload: { id: string; returnNotes?: string; damageChargeAmount?: number; securityDepositRefunded?: number; itemConditions?: Array<{ itemId: string; conditionIn?: string; damageChargeAmount?: number }> }) => Promise<ApiResponse>
    extendBooking: (payload: { id: string; newEndDateTime: string }) => Promise<ApiResponse>
    cancelBooking: (payload: { id: string; reason?: string }) => Promise<ApiResponse>
    generateInvoice: (payload: { bookingId: string }) => Promise<ApiResponse>
    createNextCycle: (payload: { bookingId: string }) => Promise<ApiResponse>
    listUnits: (payload?: { productId?: string; status?: string }) => Promise<ApiResponse>
    createUnit: (payload: { productId: string; unitLabel: string; conditionNotes?: string; purchaseDate?: string; unitCost?: number; serviceIntervalRentals?: number; serviceIntervalDays?: number }) => Promise<ApiResponse>
    updateUnit: (payload: { id: string; unitLabel?: string; status?: string; conditionNotes?: string; serviceIntervalRentals?: number | null; serviceIntervalDays?: number | null }) => Promise<ApiResponse>
    deleteUnit: (payload: { id: string }) => Promise<ApiResponse>
    markUnitServiced: (payload: { id: string }) => Promise<ApiResponse>
  }
  hotel: {
    listRooms: (payload?: { status?: string; roomType?: string; includeInactive?: boolean }) => Promise<ApiResponse>
    createRoom: (payload: { roomNumber: string; roomType: string; floor?: string; maxOccupancy?: number; baseRate?: number; dayUseRate?: number; amenities?: string; notes?: string }) => Promise<ApiResponse>
    updateRoom: (payload: { id: string; roomType?: string; floor?: string; maxOccupancy?: number; baseRate?: number; dayUseRate?: number | null; status?: string; amenities?: string; notes?: string; isActive?: boolean }) => Promise<ApiResponse>
    deleteRoom: (payload: { id: string }) => Promise<ApiResponse>
    checkAvailability: (payload: { roomId: string; checkInDate: string; checkOutDate: string; excludeBookingId?: string }) => Promise<ApiResponse>
    listAvailableRooms: (payload: { checkInDate: string; checkOutDate: string; roomType?: string }) => Promise<ApiResponse>
    listBookings: (payload?: { status?: string; roomId?: string; customerId?: string }) => Promise<ApiResponse>
    getBooking: (payload: { id: string }) => Promise<ApiResponse>
    createBooking: (payload: { roomId: string; customerId?: string; guestName: string; guestPhone?: string; guestEmail?: string; numberOfGuests?: number; checkInDate: string; checkOutDate?: string; ratePerNight?: number; channel?: string; bookingType?: string; advanceAmount?: number; advancePaymentMethod?: string; notes?: string }) => Promise<ApiResponse>
    checkIn: (payload: { id: string; guests: Array<{ guestName: string; idType: string; idNumber: string; nationality?: string; address?: string; isPrimary?: boolean }> }) => Promise<ApiResponse>
    checkOut: (payload: { id: string }) => Promise<ApiResponse>
    cancelBooking: (payload: { id: string; reason?: string }) => Promise<ApiResponse>
    markNoShow: (payload: { id: string }) => Promise<ApiResponse>
    addExtraCharge: (payload: { bookingId: string; description: string; quantity?: number; unitPrice: number }) => Promise<ApiResponse>
    removeExtraCharge: (payload: { chargeId: string }) => Promise<ApiResponse>
    generateInvoice: (payload: { bookingId: string }) => Promise<ApiResponse>
    generateGroupInvoice: (payload: { bookingIds: string[] }) => Promise<ApiResponse>
    occupancyReport: () => Promise<ApiResponse>
    guestRegister: (payload: { dateFrom: string; dateTo: string }) => Promise<ApiResponse>
    listRateCalendar: () => Promise<ApiResponse>
    createRateCalendarEntry: (payload: { roomType?: string; startDate: string; endDate: string; rate: number; label?: string }) => Promise<ApiResponse>
    deleteRateCalendarEntry: (payload: { id: string }) => Promise<ApiResponse>
    listHousekeepingTasks: (payload?: { status?: string; roomId?: string }) => Promise<ApiResponse>
    createHousekeepingTask: (payload: { roomId: string; taskLabel: string; bookingId?: string; notes?: string }) => Promise<ApiResponse>
    assignHousekeepingTask: (payload: { id: string; assignedToId: string | null }) => Promise<ApiResponse>
    updateHousekeepingTaskStatus: (payload: { id: string; status: string }) => Promise<ApiResponse>
    deleteHousekeepingTask: (payload: { id: string }) => Promise<ApiResponse>
    getCustomerStayHistory: (payload: { customerId: string }) => Promise<ApiResponse>
  }
  metalRate: {
    list: () => Promise<ApiResponse>
    get: (payload: { metalType: string; purity: string }) => Promise<ApiResponse>
    upsert: (payload: { metalType: string; purity: string; ratePerGram: number }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
  }
  metalExchange: {
    list: (payload?: { customerId?: string; unlinkedOnly?: boolean }) => Promise<ApiResponse>
    create: (payload: { customerId?: string; customerName?: string; metalType: string; purity: string; grossWeight: number; deductionWeight?: number; notes?: string }) => Promise<ApiResponse>
    linkToInvoice: (payload: { exchangeId: string; invoiceId: string }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
  }
  drawingRevision: {
    list: (payload: { projectId: string }) => Promise<ApiResponse>
    create: (payload: { projectId: string; drawingNumber: string; title: string; discipline?: string; revisionNumber?: string; status?: string; issuedDate?: string; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; drawingNumber?: string; title?: string; discipline?: string; revisionNumber?: string; status?: string; issuedDate?: string | null; notes?: string | null; approvedByName?: string | null }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
    issueNewRevision: (payload: { previousRevisionId: string; revisionNumber: string; title?: string; discipline?: string; issuedDate?: string; notes?: string }) => Promise<ApiResponse>
    getHistory: (payload: { projectId: string; drawingNumber: string }) => Promise<ApiResponse>
  }
  siteVisit: {
    list: (payload: { projectId: string }) => Promise<ApiResponse>
    create: (payload: { projectId: string; visitDate: string; visitType?: string; findings?: string; weatherConditions?: string; latitude?: number; longitude?: number; locationAccuracy?: number }) => Promise<ApiResponse>
    update: (payload: { id: string; visitDate?: string; visitType?: string; findings?: string | null; weatherConditions?: string | null; latitude?: number | null; longitude?: number | null; locationAccuracy?: number | null }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
  }
  materialTestResult: {
    list: (payload: { siteVisitId: string }) => Promise<ApiResponse>
    add: (payload: { siteVisitId: string; testType: string; materialDescription?: string; testValue?: number; unit?: string; requiredMinValue?: number; testedDate?: string; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; testType?: string; materialDescription?: string | null; testValue?: number | null; unit?: string | null; requiredMinValue?: number | null; result?: string; testedDate?: string | null; notes?: string | null }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
  }
  campaignPerformance: {
    list: (payload: { projectId: string }) => Promise<ApiResponse>
    add: (payload: { projectId: string; periodStart: string; periodEnd: string; impressions?: number; clicks?: number; conversions?: number; actualSpend?: number; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; periodStart?: string; periodEnd?: string; impressions?: number | null; clicks?: number | null; conversions?: number | null; actualSpend?: number | null; notes?: string | null }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
    summary: (payload: { projectId: string }) => Promise<ApiResponse>
  }
  contentCalendar: {
    list: (payload: { projectId: string }) => Promise<ApiResponse>
    create: (payload: { projectId: string; scheduledDate: string; contentType?: string; title: string; platform?: string; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; scheduledDate?: string; contentType?: string; title?: string; platform?: string | null; status?: string; notes?: string | null }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
  }
  quotations: {
    list: (payload?: { status?: string; customerId?: string; page?: number; limit?: number }) => Promise<ApiResponse>
    get: (id: string) => Promise<ApiResponse>
    create: (payload: { customerId?: string; customerName?: string; validUntil?: string; notes?: string; items: Array<{ productId?: string; productName: string; sku?: string; quantity: number; unitPrice: number; discount?: number; taxRate?: number }> }) => Promise<ApiResponse>
    print: (id: string) => Promise<ApiResponse>
    printReceipt: (payload: { id: string; paperWidth?: '80mm' | '58mm' }) => Promise<ApiResponse>
    updateStatus: (payload: { id: string; status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'EXPIRED' }) => Promise<ApiResponse>
    convertToInvoice: (id: string) => Promise<ApiResponse>
    delete: (id: string) => Promise<ApiResponse>
  }
  creditNotes: {
    list: (payload?: { customerId?: string; invoiceId?: string; page?: number; limit?: number }) => Promise<ApiResponse>
    get: (id: string) => Promise<ApiResponse>
    create: (payload: { customerId?: string; invoiceId?: string; reason: string; amount: number; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; customerId?: string | null; invoiceId?: string | null; reason?: string; amount?: number; notes?: string | null }) => Promise<ApiResponse>
    delete: (id: string) => Promise<ApiResponse>
    print: (id: string) => Promise<ApiResponse>
    printReceipt: (payload: { id: string; paperWidth?: '80mm' | '58mm' }) => Promise<ApiResponse>
  }
  debitNotes: {
    list: (payload?: { supplierId?: string; purchaseOrderId?: string; page?: number; limit?: number }) => Promise<ApiResponse>
    get: (id: string) => Promise<ApiResponse>
    create: (payload: { supplierId?: string; purchaseOrderId?: string; reason: string; amount: number; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; supplierId?: string | null; purchaseOrderId?: string | null; reason?: string; amount?: number; notes?: string | null }) => Promise<ApiResponse>
    delete: (id: string) => Promise<ApiResponse>
    print: (id: string) => Promise<ApiResponse>
    printReceipt: (payload: { id: string; paperWidth?: '80mm' | '58mm' }) => Promise<ApiResponse>
  }
  // Phase 22 — Service Business Foundation
  appointments: {
    list: (payload?: { providerId?: string; customerId?: string; status?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number }) => Promise<ApiResponse>
    getByDate: (payload: { date: string }) => Promise<ApiResponse>
    get: (payload: { id: string }) => Promise<ApiResponse>
    // Phase 58 §2 — petId: which pet a vet visit is for (Vet Clinic only, harmless elsewhere)
    create: (payload: { customerId?: string; customerName?: string; providerId?: string; serviceCatalogId?: string; serviceTitle: string; scheduledDate: string; scheduledTime: string; durationMinutes?: number; notes?: string; totalAmount?: number; depositPaid?: number; chairAssignment?: string; createdBy?: string; services?: string; petId?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; customerId?: string | null; customerName?: string | null; providerId?: string | null; serviceCatalogId?: string | null; serviceTitle?: string; scheduledDate?: string; scheduledTime?: string; durationMinutes?: number; notes?: string | null; privateNotes?: string | null; totalAmount?: number; depositPaid?: number; chairAssignment?: string | null; petId?: string | null }) => Promise<ApiResponse>
    updateStatus: (payload: { id: string; status: string; cancellationReason?: string }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
    stats: () => Promise<ApiResponse>
    // Phase 58 §2 — Beauty Salon: unify a retail product upsell + a real payment-method choice into the same appointment checkout
    generateInvoice: (payload: { id: string; retailItems?: Array<{ productId: string; quantity: number }>; paymentMethod?: 'CASH' | 'UPI' | 'CARD' | 'WALLET' | 'CREDIT' | 'SPLIT' }) => Promise<ApiResponse>
    generateBatchInvoice: (payload: { ids: string[] }) => Promise<ApiResponse>
  }
  serviceCatalog: {
    list: (payload?: { isActive?: boolean; category?: string }) => Promise<ApiResponse>
    get: (payload: { id: string }) => Promise<ApiResponse>
    create: (payload: { serviceName: string; serviceCode?: string; category?: string; description?: string; durationMinutes?: number; basePrice?: number; taxRate?: number; sacCode?: string; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; serviceName?: string; serviceCode?: string | null; category?: string | null; description?: string | null; durationMinutes?: number; basePrice?: number; taxRate?: number; sacCode?: string | null; isActive?: boolean; notes?: string | null }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
    listCategories: () => Promise<ApiResponse>
  }
  providerSchedule: {
    list: (payload: { providerId: string }) => Promise<ApiResponse>
    upsert: (payload: { providerId: string; dayOfWeek: number; isWorking: boolean; startTime: string; endTime: string; breakStart?: string | null; breakEnd?: string | null; slotDuration?: number }) => Promise<ApiResponse>
    getAvailability: (payload: { providerId: string; date: string; durationMinutes?: number }) => Promise<ApiResponse>
    listHolidays: (payload?: { providerId?: string; year?: number }) => Promise<ApiResponse>
    addHoliday: (payload: { date: string; name: string; isGlobal?: boolean; providerId?: string }) => Promise<ApiResponse>
    deleteHoliday: (payload: { id: string }) => Promise<ApiResponse>
    getCancellationPolicy: () => Promise<ApiResponse>
    upsertCancellationPolicy: (payload: { noticePeriodHours?: number; cancellationFeeType?: string; cancellationFeeValue?: number; notes?: string | null }) => Promise<ApiResponse>
  }
  notificationQueue: {
    list: (payload?: { status?: string; limit?: number }) => Promise<ApiResponse>
    getUnsentCount: () => Promise<ApiResponse>
    markSent: (payload: { id: string }) => Promise<ApiResponse>
    dismiss: (payload: { id: string }) => Promise<ApiResponse>
    generateWhatsAppLink: (payload: { phone: string; message: string; notificationType: string; appointmentId?: string; customerId?: string; customerName?: string }) => Promise<ApiResponse>
    createReminder: (payload: { appointmentId: string }) => Promise<ApiResponse>
  }
  // Phase 24 — Medical (GP + Specialist)
  visitNotes: {
    list: (payload?: { search?: string; isFinalized?: boolean; dateFrom?: string; dateTo?: string; page?: number; limit?: number }) => Promise<ApiResponse>
    get: (payload: { appointmentId: string }) => Promise<ApiResponse>
    create: (payload: { appointmentId: string; patientName: string; patientAge?: string; chiefComplaint?: string; subjective?: string; objective?: string; assessment?: string; plan?: string; followUpDate?: string; followUpNotes?: string; referredBy?: string; referralDate?: string; referralReason?: string; treatmentDone?: string; painScore?: number | null; functionalScore?: number | null; treatmentGiven?: string; bpSystolic?: number | null; bpDiastolic?: number | null; pulseRate?: number | null; temperatureF?: number | null; heightCm?: number | null; weightKg?: number | null }) => Promise<ApiResponse>
    update: (payload: { id: string; patientName?: string; patientAge?: string | null; chiefComplaint?: string | null; subjective?: string | null; objective?: string | null; assessment?: string | null; plan?: string | null; followUpDate?: string | null; followUpNotes?: string | null; referredBy?: string | null; referralDate?: string | null; referralReason?: string | null; treatmentDone?: string | null; painScore?: number | null; functionalScore?: number | null; treatmentGiven?: string | null; bpSystolic?: number | null; bpDiastolic?: number | null; pulseRate?: number | null; temperatureF?: number | null; heightCm?: number | null; weightKg?: number | null }) => Promise<ApiResponse>
    finalize: (payload: { id: string }) => Promise<ApiResponse>
    referToProvider: (payload: { visitNoteId: string; providerId: string; serviceCatalogId?: string; serviceTitle?: string; scheduledDate: string; scheduledTime: string; durationMinutes?: number; reason?: string }) => Promise<ApiResponse>
    listReferrals: (payload: { visitNoteId: string }) => Promise<ApiResponse>
    // Phase 58 §2 — GP/Specialist Clinic: structured prescription + vitals trend
    listPrescriptionItems: (payload: { visitNoteId: string }) => Promise<ApiResponse>
    savePrescriptionItems: (payload: { visitNoteId: string; items: Array<{ drugName: string; dosage?: string; frequency?: string; duration?: string; instructions?: string }> }) => Promise<ApiResponse>
    getVitalsTrend: (payload: { appointmentId: string }) => Promise<ApiResponse>
  }
  normalRange: {
    list: (payload?: { testName?: string }) => Promise<ApiResponse>
    // Phase 58 §2 — species dimension (Vet Clinic), free text, defaults to "ALL" (generic/human); criticalLow/criticalHigh (Diagnostic Lab panic-value tier)
    save: (payload: { testName: string; unit?: string | null; minValue?: number | null; maxValue?: number | null; criticalLow?: number | null; criticalHigh?: number | null; gender?: 'ALL' | 'MALE' | 'FEMALE'; species?: string; notes?: string | null }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
    evaluate: (payload: { testName: string; value: number; gender?: 'ALL' | 'MALE' | 'FEMALE' }) => Promise<ApiResponse>
    find: (payload: { testName: string; gender?: 'ALL' | 'MALE' | 'FEMALE' }) => Promise<ApiResponse>
  }
  tokenQueue: {
    today: (payload?: { date?: string }) => Promise<ApiResponse>
    stats: (payload?: { date?: string }) => Promise<ApiResponse>
    create: (payload: { patientName: string; age?: string; gender?: string; phone?: string; appointmentId?: string; notes?: string; date?: string }) => Promise<ApiResponse>
    call: (payload: { id: string }) => Promise<ApiResponse>
    seen: (payload: { id: string }) => Promise<ApiResponse>
    skip: (payload: { id: string }) => Promise<ApiResponse>
    reset: (payload: { id: string }) => Promise<ApiResponse>
  }
  // Phase 50 — Diagnostic & Pathology Labs
  labTestOrders: {
    list: (payload?: { status?: string; customerId?: string; search?: string; page?: number; limit?: number }) => Promise<ApiResponse>
    get: (payload: { id: string }) => Promise<ApiResponse>
    create: (payload: { customerId?: string; patientName: string; patientAge?: string; appointmentId?: string; referredByProviderId?: string; referringNotes?: string; notes?: string; items: Array<{ serviceCatalogId?: string; testName: string; category?: string; sampleType?: string; price?: number }> }) => Promise<ApiResponse>
    update: (payload: { id: string; customerId?: string | null; patientName?: string; patientAge?: string | null; referredByProviderId?: string | null; referringNotes?: string | null; notes?: string | null }) => Promise<ApiResponse>
    addItem: (payload: { labTestOrderId: string; serviceCatalogId?: string; testName: string; category?: string; sampleType?: string; price?: number }) => Promise<ApiResponse>
    removeItem: (payload: { itemId: string }) => Promise<ApiResponse>
    markSampleCollected: (payload: { id: string; collectedById?: string }) => Promise<ApiResponse>
    updateResult: (payload: { itemId: string; resultParameters?: Array<{ parameter: string; value: string; unit?: string; referenceRange?: string; flag?: string }>; resultSummary?: string | null }) => Promise<ApiResponse>
    finalizeReport: (payload: { id: string; reportedById?: string }) => Promise<ApiResponse>
    markDelivered: (payload: { id: string }) => Promise<ApiResponse>
    cancel: (payload: { id: string; reason?: string }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
    generateInvoice: (payload: { id: string }) => Promise<ApiResponse>
    // Phase 58 §2 — critical/panic-value escalation workflow
    acknowledgeCritical: (payload: { itemId: string; notifiedById?: string; notes?: string }) => Promise<ApiResponse>
    listPendingCriticalEscalations: () => Promise<ApiResponse>
  }
  // Phase 51 — Blood Bank
  bloodBank: {
    createDonor: (payload: { fullName: string; phone?: string; email?: string; dateOfBirth?: string; gender?: string; bloodGroup?: string; weightKg?: number; address?: string; notes?: string }) => Promise<ApiResponse>
    listDonors: (payload?: { bloodGroup?: string; search?: string; isActive?: boolean; page?: number; limit?: number }) => Promise<ApiResponse>
    getDonor: (payload: { id: string }) => Promise<ApiResponse>
    updateDonor: (payload: { id: string; fullName?: string; phone?: string | null; email?: string | null; bloodGroup?: string | null; weightKg?: number | null; address?: string | null; isDeferred?: boolean; deferralReason?: string | null; deferredUntil?: string | null; notes?: string | null }) => Promise<ApiResponse>
    deactivateDonor: (payload: { id: string }) => Promise<ApiResponse>
    sendDonorRecall: (payload: { donorId: string }) => Promise<ApiResponse>
    createDonationCamp: (payload: { campName: string; location?: string; campDate: string; organizer?: string; notes?: string }) => Promise<ApiResponse>
    listDonationCamps: () => Promise<ApiResponse>
    createDonationRecord: (payload: { donorId: string; campId?: string; bloodGroup: string; componentType?: string; volumeMl?: number; notes?: string }) => Promise<ApiResponse>
    listDonationRecords: (payload?: { screeningStatus?: string; donorId?: string; page?: number; limit?: number }) => Promise<ApiResponse>
    updateScreeningStatus: (payload: { id: string; screeningStatus: string; screeningNotes?: string }) => Promise<ApiResponse>
    getBloodStock: () => Promise<ApiResponse>
    checkCompatibilityBatch: (payload: { recipientBloodGroup: string; units: Array<{ donationRecordId: string; bloodGroup: string; componentType: string }> }) => Promise<ApiResponse>
    createIssue: (payload: { customerId?: string; recipientName: string; recipientBloodGroup?: string; purpose?: string; donationRecordIds: string[]; price?: number; overrideIncompatibility?: boolean; overrideReason?: string }) => Promise<ApiResponse>
    listIssues: (payload?: { status?: string; page?: number; limit?: number }) => Promise<ApiResponse>
    getIssue: (payload: { id: string }) => Promise<ApiResponse>
    cancelIssue: (payload: { id: string }) => Promise<ApiResponse>
    generateIssueInvoice: (payload: { id: string }) => Promise<ApiResponse>
  }
  // Phase 25 — Dental Clinic
  toothRecord: {
    getChart: (payload: { patientId: string }) => Promise<ApiResponse>
    upsert: (payload: { patientId: string; toothNumber: number; condition: string; surface?: string; notes?: string | null }) => Promise<ApiResponse>
    // Phase 58 §2 — per-tooth chronological history
    getHistory: (payload: { patientId: string; toothNumber: number }) => Promise<ApiResponse>
  }
  // Phase 58 §2 — Beauty Salon: stylist skill-matching
  providerSkills: {
    listForEmployee: (payload: { employeeId: string }) => Promise<ApiResponse>
    set: (payload: { employeeId: string; serviceCatalogIds: string[] }) => Promise<ApiResponse>
    listQualified: (payload: { serviceCatalogId: string }) => Promise<ApiResponse>
  }
  treatmentPlan: {
    list: (payload: { patientId: string }) => Promise<ApiResponse>
    get: (payload: { id: string }) => Promise<ApiResponse>
    create: (payload: { patientId: string; title?: string; status?: string; planItems?: string; totalEstimatedCost?: number; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; title?: string; status?: string; planItems?: string; totalEstimatedCost?: number; notes?: string | null; acceptedDate?: string | null; completedDate?: string | null }) => Promise<ApiResponse>
  }
  recall: {
    get: (payload: { patientId: string }) => Promise<ApiResponse>
    list: (payload?: { overdueOnly?: boolean; dateFrom?: string; dateTo?: string }) => Promise<ApiResponse>
    upsert: (payload: { patientId: string; recallType: string; lastVisitDate: string; nextRecallDate: string; notes?: string | null }) => Promise<ApiResponse>
  }
  // Phase 23 — Veterinary
  pets: {
    list: (payload?: { customerId?: string; species?: string; isActive?: boolean; search?: string }) => Promise<ApiResponse>
    get: (payload: { id: string }) => Promise<ApiResponse>
    create: (payload: { customerId?: string; petName: string; species: string; breed?: string; dateOfBirth?: string; gender?: string; color?: string; weight?: number; microchipId?: string; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; customerId?: string | null; petName?: string; species?: string; breed?: string | null; dateOfBirth?: string | null; gender?: string | null; color?: string | null; weight?: number | null; microchipId?: string | null; notes?: string | null; isActive?: boolean }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
    addWeight: (payload: { petId: string; weightKg: number; notes?: string; recordedAt?: string }) => Promise<ApiResponse>
    weightHistory: (payload: { petId: string }) => Promise<ApiResponse>
  }
  vaccinations: {
    list: (payload: { petId: string }) => Promise<ApiResponse>
    get: (payload: { id: string }) => Promise<ApiResponse>
    create: (payload: { petId: string; vaccineName: string; vaccineType?: string; batchNumber?: string; manufacturer?: string; administeredAt: string; administeredBy?: string; nextDueDate?: string; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; vaccineName?: string; vaccineType?: string | null; batchNumber?: string | null; manufacturer?: string | null; administeredAt?: string; administeredBy?: string | null; nextDueDate?: string | null; notes?: string | null; certificatePrinted?: boolean }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
    createReminder: (payload: { vaccinationRecordId: string }) => Promise<ApiResponse>
    upcoming: (payload?: { daysAhead?: number }) => Promise<ApiResponse>
  }
  // Phase 26 — Physiotherapy Clinic
  treatmentPhase: {
    list: (payload: { patientId: string }) => Promise<ApiResponse>
    create: (payload: { patientId: string; phase?: string; title: string; startDate: string; goals?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; phase?: string; title?: string; startDate?: string; goals?: string | null }) => Promise<ApiResponse>
    close: (payload: { id: string; outcome?: string }) => Promise<ApiResponse>
  }
  exerciseProgram: {
    getActive: (payload: { patientId: string }) => Promise<ApiResponse>
    list: (payload: { patientId: string }) => Promise<ApiResponse>
    upsert: (payload: { patientId: string; title?: string; exercises: string }) => Promise<ApiResponse>
    markPrinted: (payload: { id: string }) => Promise<ApiResponse>
  }
  sessionPack: {
    getActive: (payload: { customerId: string }) => Promise<ApiResponse>
    list: (payload: { customerId: string }) => Promise<ApiResponse>
    listAll: () => Promise<ApiResponse>
    create: (payload: { customerId: string; packName: string; totalSessions: number; purchaseDate?: string; expiryDate?: string | null; pricePerPack?: number; taxRate?: number; sacCode?: string; notes?: string; assignedTrainerId?: string }) => Promise<ApiResponse>
    deduct: (payload: { customerId: string; appointmentId?: string }) => Promise<ApiResponse>
    logs: (payload: { clientSessionPackId: string }) => Promise<ApiResponse>
    generateInvoice: (payload: { id: string }) => Promise<ApiResponse>
    assignTrainer: (payload: { packId: string; trainerId: string | null }) => Promise<ApiResponse>
  }
  // Phase 27 — Salon, Gym/Studio, Driving School
  staffCommission: {
    calculate: (payload: { appointmentId: string; staffId: string; serviceRevenue: number; commissionType: 'PERCENT' | 'FLAT'; commissionRate: number; tipAmount?: number; period?: string }) => Promise<ApiResponse>
    listByStaff: (payload: { staffId: string; period?: string }) => Promise<ApiResponse>
    listAll: (payload?: { period?: string; isPaid?: boolean; staffId?: string }) => Promise<ApiResponse>
    markPaid: (payload: { ids: string[]; paidDate?: string }) => Promise<ApiResponse>
    monthlyReport: (payload?: { period?: string }) => Promise<ApiResponse>
  }
  membershipPlan: {
    list: () => Promise<ApiResponse>
    create: (payload: { planName: string; durationDays: number; price: number; sessionsIncluded?: number; allowedClasses?: string; isActive?: boolean }) => Promise<ApiResponse>
    update: (payload: { id: string; planName?: string; durationDays?: number; price?: number; sessionsIncluded?: number | null; allowedClasses?: string | null; isActive?: boolean }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
  }
  membership: {
    list: (payload?: { status?: string; search?: string }) => Promise<ApiResponse>
    getByClient: (payload: { clientId: string }) => Promise<ApiResponse>
    create: (payload: { clientId: string; planId: string; startDate: string; paymentStatus?: string; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; status?: string; paymentStatus?: string; freezeHistory?: string; notes?: string; sessionsUsed?: number }) => Promise<ApiResponse>
    checkIn: (payload: { clientId: string; membershipId: string }) => Promise<ApiResponse>
    attendance: (payload: { membershipId: string; dateFrom?: string; dateTo?: string }) => Promise<ApiResponse>
    expiring: (payload?: { daysAhead?: number }) => Promise<ApiResponse>
    generateInvoice: (payload: { id: string }) => Promise<ApiResponse>
    freeze: (payload: { id: string; reason?: string }) => Promise<ApiResponse>
    resume: (payload: { id: string }) => Promise<ApiResponse>
  }
  batchClass: {
    list: (payload?: { status?: string; instructorId?: string }) => Promise<ApiResponse>
    get: (payload: { id: string }) => Promise<ApiResponse>
    create: (payload: { className: string; instructorId?: string; maxCapacity: number; scheduleDays: string; scheduleTime: string; startDate: string; endDate?: string; roomOrLocation?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; className?: string; instructorId?: string | null; maxCapacity?: number; scheduleDays?: string; scheduleTime?: string; startDate?: string; endDate?: string | null; roomOrLocation?: string | null; status?: string }) => Promise<ApiResponse>
    enroll: (payload: { batchClassId: string; memberId: string }) => Promise<ApiResponse>
    unenroll: (payload: { batchClassId: string; memberId: string }) => Promise<ApiResponse>
    markAttendance: (payload: { classId: string; memberIds: string[]; sessionDate: string }) => Promise<ApiResponse>
    getAttendance: (payload: { classId: string; sessionDate?: string }) => Promise<ApiResponse>
  }
  learnerProfile: {
    get: (payload: { customerId: string }) => Promise<ApiResponse>
    upsert: (payload: { customerId: string; dlApplicationNumber?: string | null; learnerLicenseNumber?: string | null; learnerLicenseDate?: string | null; permanentLicenseNumber?: string | null; permanentLicenseDate?: string | null; licenseClass?: string; vehicleClassPreference?: string | null }) => Promise<ApiResponse>
  }
  drivingVehicle: {
    list: (payload?: { status?: string }) => Promise<ApiResponse>
    create: (payload: { registrationNumber: string; make: string; model: string; vehicleClass: string; instructorId?: string; status?: string; odometerKm?: number; serviceIntervalKm?: number; serviceIntervalSessions?: number }) => Promise<ApiResponse>
    update: (payload: { id: string; registrationNumber?: string; make?: string; model?: string; vehicleClass?: string; instructorId?: string | null; status?: string; odometerKm?: number; serviceIntervalKm?: number; serviceIntervalSessions?: number }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
    logMaintenance: (payload: { vehicleId: string; serviceDate?: string; odometerKm: number; serviceType: string; cost?: number; notes?: string }) => Promise<ApiResponse>
    listMaintenanceLogs: (payload: { vehicleId: string }) => Promise<ApiResponse>
  }
  drivingSession: {
    list: (payload?: { learnerId?: string; instructorId?: string; date?: string; status?: string }) => Promise<ApiResponse>
    create: (payload: { learnerId: string; instructorId: string; vehicleId: string; sessionDate: string; sessionTime: string; durationMinutes?: number; pickupPoint?: string; sessionNumber?: number; sessionFee?: number; packageEnrollmentId?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; status?: string; instructorNotes?: string; sessionDate?: string; sessionTime?: string; durationMinutes?: number; pickupPoint?: string | null; sessionFee?: number | null }) => Promise<ApiResponse>
    generateInvoice: (payload: { id: string }) => Promise<ApiResponse>
    listTests: (payload?: { learnerId?: string; testType?: string; result?: string; instructorId?: string }) => Promise<ApiResponse>
    createTest: (payload: { learnerId: string; testType: string; testDate: string; testCenter: string; notes?: string; instructorId?: string }) => Promise<ApiResponse>
    updateTest: (payload: { id: string; result?: string; retestDate?: string | null; notes?: string | null; instructorId?: string | null }) => Promise<ApiResponse>
    instructorPassRates: () => Promise<ApiResponse>
  }
  drivingPackage: {
    list: (payload?: { isActive?: boolean }) => Promise<ApiResponse>
    create: (payload: { packageName: string; totalSessions: number; price: number; vehicleClass?: string; isActive?: boolean }) => Promise<ApiResponse>
    update: (payload: { id: string; packageName?: string; totalSessions?: number; price?: number; vehicleClass?: string; isActive?: boolean }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
  }
  drivingPackageEnrollment: {
    list: (payload?: { learnerId?: string }) => Promise<ApiResponse>
    create: (payload: { learnerId: string; packageId: string; purchaseDate?: string; notes?: string }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
    generateInvoice: (payload: { id: string }) => Promise<ApiResponse>
  }
  // Phase 28 — Legal
  legalCase: {
    list: (payload?: { status?: string; clientId?: string; advocateId?: string; search?: string }) => Promise<ApiResponse>
    get: (payload: { id: string }) => Promise<ApiResponse>
    create: (payload: { caseNumber: string; caseTitle: string; caseType?: string; courtName: string; courtDistrict?: string; courtState?: string; eCourtId?: string; clientId: string; advocateId?: string; filingDate?: string; opposingPartyName?: string; limitationDate?: string; feeAgreed?: number; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; caseNumber?: string; caseTitle?: string; caseType?: string; courtName?: string; courtDistrict?: string | null; courtState?: string | null; eCourtId?: string | null; advocateId?: string | null; status?: string; filingDate?: string | null; nextHearingDate?: string | null; opposingPartyName?: string | null; limitationDate?: string | null; feeAgreed?: number | null; feeCollected?: number; notes?: string | null }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
    checkConflict: (payload: { clientId?: string; opposingPartyName?: string; excludeCaseId?: string }) => Promise<ApiResponse>
  }
  hearing: {
    list: (payload?: { caseId?: string; status?: string; fromDate?: string; toDate?: string }) => Promise<ApiResponse>
    create: (payload: { caseId: string; hearingDate: string; hearingTime?: string; courtRoom?: string; purpose?: string; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; hearingDate?: string; hearingTime?: string | null; courtRoom?: string | null; purpose?: string | null; status?: string; outcome?: string | null; nextDate?: string | null; notes?: string | null }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
  }
  timeEntry: {
    list: (payload?: { caseId?: string; projectId?: string; retainerId?: string; employeeId?: string; isBilled?: boolean; fromDate?: string; toDate?: string }) => Promise<ApiResponse>
    create: (payload: { caseId?: string; projectId?: string; retainerId?: string; employeeId?: string; date: string; description: string; hours: number; ratePerHour: number }) => Promise<ApiResponse>
    update: (payload: { id: string; date?: string; description?: string; hours?: number; ratePerHour?: number }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
    markBilled: (payload: { ids: string[] }) => Promise<ApiResponse>
    generateInvoice: (payload: { ids: string[] }) => Promise<ApiResponse>
  }
  complianceEvent: {
    list: (payload?: { category?: string; isActive?: boolean }) => Promise<ApiResponse>
    setClientAgmDate: (payload: { clientId: string; agmDate: string | null }) => Promise<ApiResponse>
  }
  clientDocumentChecklist: {
    list: (payload: { clientId: string }) => Promise<ApiResponse>
    add: (payload: { clientId: string; documentType: string; label?: string; notes?: string }) => Promise<ApiResponse>
    seedStandard: (payload: { clientId: string }) => Promise<ApiResponse>
    update: (payload: { id: string; status?: string; notes?: string | null }) => Promise<ApiResponse>
    remove: (payload: { id: string }) => Promise<ApiResponse>
  }
  complianceTask: {
    list: (payload?: { clientId?: string; staffId?: string; status?: string; category?: string; fromDate?: string; toDate?: string }) => Promise<ApiResponse>
    create: (payload: { complianceEventId?: string; clientId: string; staffId?: string; title: string; category: string; dueDate: string; priority?: string; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; staffId?: string | null; title?: string; category?: string; dueDate?: string; status?: string; priority?: string; notes?: string | null; filedOn?: string | null; acknowledgmentNo?: string | null }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
  }
  engagement: {
    list: (payload?: { clientId?: string; staffId?: string; status?: string; engagementType?: string }) => Promise<ApiResponse>
    create: (payload: { clientId: string; staffId?: string; title: string; engagementType?: string; feeType?: string; feeAmount?: number; billingDay?: number; startDate?: string; endDate?: string; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; staffId?: string | null; title?: string; engagementType?: string; status?: string; feeType?: string; feeAmount?: number | null; billingDay?: number | null; startDate?: string | null; endDate?: string | null; notes?: string | null }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
    generateInvoice: (payload: { id: string; period?: string }) => Promise<ApiResponse>
  }
  rocFiling: {
    list: (payload?: { clientId?: string; staffId?: string; status?: string; formType?: string; financialYear?: string }) => Promise<ApiResponse>
    create: (payload: { clientId: string; staffId?: string; formType: string; financialYear?: string; purpose?: string; dueDate?: string; govtFee?: number; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; staffId?: string | null; formType?: string; financialYear?: string | null; purpose?: string | null; dueDate?: string | null; filedOn?: string | null; srn?: string | null; status?: string; govtFee?: number | null; notes?: string | null }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
    complianceRollup: (payload: { financialYear: string }) => Promise<ApiResponse>
  }
  boardMeeting: {
    list: (payload?: { clientId?: string; meetingType?: string; fromDate?: string; toDate?: string }) => Promise<ApiResponse>
    create: (payload: { clientId: string; meetingType?: string; meetingDate: string; meetingTime?: string; venue?: string; agenda?: string; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; meetingType?: string; meetingDate?: string; meetingTime?: string | null; venue?: string | null; agenda?: string | null; quorumMet?: boolean; minutesDone?: boolean; minutesText?: string | null; noticesSent?: boolean; notes?: string | null }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
  }
  boardResolution: {
    list: (payload: { boardMeetingId: string }) => Promise<ApiResponse>
    create: (payload: { boardMeetingId: string; resolutionNumber?: string; resolutionType?: string; resolutionText: string; passedUnanimously?: boolean }) => Promise<ApiResponse>
    update: (payload: { id: string; resolutionNumber?: string; resolutionType?: string; resolutionText?: string; passedUnanimously?: boolean }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
  }
  // Phase 30 — Architect, Civil, Consultant, Agency
  lead: {
    list: (payload?: { status?: string; assignedToId?: string }) => Promise<ApiResponse>
    create: (payload: { fullName: string; email?: string; phone?: string; companyName?: string; source?: string; status?: string; estimatedValue?: number; assignedToId?: string; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; fullName?: string; email?: string | null; phone?: string | null; companyName?: string | null; source?: string; status?: string; estimatedValue?: number | null; assignedToId?: string | null; convertedClientId?: string | null; notes?: string | null }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
  }
  serviceProject: {
    list: (payload?: { clientId?: string; assignedToId?: string; status?: string }) => Promise<ApiResponse>
    get: (payload: { id: string }) => Promise<ApiResponse>
    create: (payload: { clientId: string; projectName: string; projectType?: string; stage?: string; status?: string; totalContractValue?: number; startDate?: string; expectedEndDate?: string; assignedToId?: string; notes?: string; targetChannel?: string; deliverableType?: string; adSpendBudget?: number }) => Promise<ApiResponse>
    update: (payload: { id: string; projectName?: string; projectType?: string; stage?: string | null; status?: string; totalContractValue?: number | null; startDate?: string | null; expectedEndDate?: string | null; completedDate?: string | null; assignedToId?: string | null; notes?: string | null; targetChannel?: string | null; deliverableType?: string | null; adSpendBudget?: number | null }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
  }
  milestone: {
    list: (payload: { projectId: string }) => Promise<ApiResponse>
    create: (payload: { projectId: string; milestoneName: string; milestoneAmount?: number; status?: string; dueDate?: string; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; milestoneName?: string; milestoneAmount?: number | null; status?: string; dueDate?: string | null; completedDate?: string | null; notes?: string | null }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
    generateInvoice: (payload: { id: string }) => Promise<ApiResponse>
  }
  retainer: {
    list: (payload?: { clientId?: string; assignedToId?: string; status?: string }) => Promise<ApiResponse>
    create: (payload: { clientId: string; assignedToId?: string; title: string; retainerType?: string; status?: string; monthlyAmount: number; billingDay?: number; hoursPerMonth?: number; deliverables?: string; startDate: string; endDate?: string; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; assignedToId?: string | null; title?: string; retainerType?: string; monthlyAmount?: number; billingDay?: number | null; hoursPerMonth?: number | null; deliverables?: string | null; status?: string; startDate?: string; endDate?: string | null; notes?: string | null }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
    generateInvoice: (payload: { id: string; period?: string }) => Promise<ApiResponse>
    getHoursUsage: (payload: { id: string; period?: string }) => Promise<ApiResponse>
  }
  issue: {
    list: (payload?: { projectId?: string; status?: string; priority?: string; assignedToId?: string; sprintId?: string }) => Promise<ApiResponse>
    create: (payload: { projectId: string; title: string; description?: string; priority?: string; status?: string; assignedToId?: string; sprintId?: string; storyPoints?: number }) => Promise<ApiResponse>
    update: (payload: { id: string; title?: string; description?: string | null; priority?: string; status?: string; assignedToId?: string | null; sprintId?: string | null; resolvedDate?: string | null; storyPoints?: number | null }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
  }
  issueComment: {
    list: (payload: { issueId: string }) => Promise<ApiResponse>
    add: (payload: { issueId: string; body: string }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
  }
  issueSubtask: {
    list: (payload: { issueId: string }) => Promise<ApiResponse>
    create: (payload: { issueId: string; title: string }) => Promise<ApiResponse>
    toggle: (payload: { id: string; isDone: boolean }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
  }
  sprint: {
    list: (payload: { projectId: string }) => Promise<ApiResponse>
    create: (payload: { projectId: string; name?: string; goal?: string; startDate: string; endDate: string }) => Promise<ApiResponse>
    update: (payload: { id: string; name?: string | null; goal?: string | null; startDate?: string; endDate?: string; status?: string }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
    burndown: (payload: { sprintId: string }) => Promise<ApiResponse>
    velocity: (payload: { projectId: string; limit?: number }) => Promise<ApiResponse>
  }
  // Phase 31 — Coaching Institute
  student: {
    list: (payload: { isActive?: boolean; search?: string }) => Promise<ApiResponse>
    get: (payload: { id: string }) => Promise<ApiResponse>
    create: (payload: { customerId?: string; customerName: string; phone?: string; email?: string; address?: string; rollNumber?: string; classOrGrade: string; schoolName?: string; parentPhone?: string; enrollmentDate?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; customerName?: string; phone?: string | null; email?: string | null; rollNumber?: string | null; classOrGrade?: string; schoolName?: string | null; parentPhone?: string | null; isActive?: boolean }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
  }
  coachingBatch: {
    list: (payload: { status?: string; search?: string }) => Promise<ApiResponse>
    create: (payload: { batchName: string; subjectOrCourse: string; instructorId?: string; scheduleDays?: string[]; scheduleTime?: string; roomOrLocation?: string; maxCapacity?: number; startDate: string; endDate?: string; feePerMonth: number; status?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; batchName?: string; subjectOrCourse?: string; instructorId?: string | null; scheduleDays?: string[]; scheduleTime?: string | null; roomOrLocation?: string | null; maxCapacity?: number; startDate?: string; endDate?: string | null; feePerMonth?: number; status?: string }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
    kpis: () => Promise<ApiResponse>
  }
  enrollment: {
    listByBatch: (payload: { batchId: string }) => Promise<ApiResponse>
    listByStudent: (payload: { studentId: string }) => Promise<ApiResponse>
    create: (payload: { batchId: string; studentId: string; discountType?: string; discountAmount?: number; effectiveFee: number; enrolledDate?: string; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; status?: string; discountType?: string; discountAmount?: number; effectiveFee?: number; notes?: string | null }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
    promoteFromWaitlist: (payload: { id: string }) => Promise<ApiResponse>
  }
  coachingAttendance: {
    get: (payload: { batchId: string; date: string }) => Promise<ApiResponse>
    save: (payload: { batchId: string; attendanceDate: string; presentStudentIds: string[]; absentStudentIds: string[]; takenById?: string; notes?: string }) => Promise<ApiResponse>
    listDates: (payload: { batchId: string }) => Promise<ApiResponse>
  }
  coachingFee: {
    generate: (payload: { month: string; taxRate?: number }) => Promise<ApiResponse>
    list: (payload: { month?: string; status?: string; batchId?: string; studentId?: string }) => Promise<ApiResponse>
    kpis: (payload: { month: string }) => Promise<ApiResponse>
    update: (payload: { id: string; amountReceived?: number; status?: string; paidDate?: string | null; notes?: string | null }) => Promise<ApiResponse>
  }
  // Phase 58 §2 — Coaching Institute
  syllabusTopic: {
    list: (payload: { batchId: string }) => Promise<ApiResponse>
    create: (payload: { batchId: string; topicName: string; sequenceOrder?: number; plannedDate?: string; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; topicName?: string; sequenceOrder?: number; plannedDate?: string | null; status?: string; notes?: string | null }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
    progress: (payload: { batchId: string }) => Promise<ApiResponse>
  }
  coachingProgress: {
    getReport: (payload: { studentId: string }) => Promise<ApiResponse>
  }
  performance: {
    list: (payload: { batchId?: string }) => Promise<ApiResponse>
    create: (payload: { batchId: string; performanceName: string; date: string; venue?: string; participatingStudentIds?: string[]; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; performanceName?: string; date?: string; venue?: string | null; participatingStudentIds?: string[]; notes?: string | null }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
  }
  studentTestScore: {
    list: (payload?: { enrollmentId?: string; batchId?: string }) => Promise<ApiResponse>
    create: (payload: { enrollmentId: string; testName: string; subject?: string; marksObtained: number; maxMarks: number; testDate: string; grade?: string; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; testName?: string; subject?: string | null; marksObtained?: number; maxMarks?: number; testDate?: string; grade?: string | null; notes?: string | null }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
  }
  // Phase 32 — Photography, Event Management, Real Estate
  shootBooking: {
    list: (payload: { status?: string; clientId?: string; search?: string }) => Promise<ApiResponse>
    get: (payload: string) => Promise<ApiResponse>
    create: (payload: { clientId: string; shootType: string; shootDate: string; shootTime?: string; shootLocation: string; estimatedDurationHours: number; deliverableType?: string; expectedPhotosCount?: number; deliveryDeadline?: string; photographerIds?: string[]; editorAssignedId?: string; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; shootType?: string; shootDate?: string; shootTime?: string | null; shootLocation?: string; estimatedDurationHours?: number; deliverableType?: string; expectedPhotosCount?: number | null; deliveryDeadline?: string | null; photographerIds?: string[]; editorAssignedId?: string | null; status?: string; finalAmount?: number | null; notes?: string | null }) => Promise<ApiResponse>
    delete: (payload: string) => Promise<ApiResponse>
    kpis: () => Promise<ApiResponse>
    generateInvoice: (payload: string) => Promise<ApiResponse>
  }
  deliveryTracker: {
    get: (payload: string) => Promise<ApiResponse>
    upsert: (payload: { shootBookingId: string; proofsSentDate?: string | null; selectionReceivedDate?: string | null; editingStartedDate?: string | null; albumProofSentDate?: string | null; finalDeliveredDate?: string | null; deliveryFormat?: string | null; deliveredPhotosCount?: number | null; notes?: string | null }) => Promise<ApiResponse>
  }
  shootChecklist: {
    list: (payload: { shootBookingId: string }) => Promise<ApiResponse>
    add: (payload: { shootBookingId: string; label: string; category?: string }) => Promise<ApiResponse>
    toggle: (payload: { id: string; isDone: boolean }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
  }
  shootAddOn: {
    list: (payload: { shootBookingId: string }) => Promise<ApiResponse>
    add: (payload: { shootBookingId: string; description: string; quantity?: number; unitPrice: number }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
    total: (payload: { shootBookingId: string }) => Promise<ApiResponse>
  }
  eventBooking: {
    list: (payload: { status?: string; search?: string }) => Promise<ApiResponse>
    create: (payload: { clientId: string; eventName: string; eventType: string; eventDate: string; eventEndDate?: string; venueName: string; venueAddress?: string; expectedGuestCount?: number; clientBudget?: number; status?: string; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; eventName?: string; eventType?: string; eventDate?: string; eventEndDate?: string | null; venueName?: string; venueAddress?: string | null; expectedGuestCount?: number | null; clientBudget?: number | null; finalAmount?: number | null; status?: string; notes?: string | null }) => Promise<ApiResponse>
    delete: (payload: string) => Promise<ApiResponse>
    kpis: () => Promise<ApiResponse>
    generateInvoice: (payload: string) => Promise<ApiResponse>
  }
  eventVendorBooking: {
    list: (payload: string) => Promise<ApiResponse>
    create: (payload: { eventId: string; vendorId: string; vendorCategory: string; pricingType?: string; quotedAmount?: number; perHeadRate?: number; advancePaid?: number; status?: string; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; vendorCategory?: string; pricingType?: string; quotedAmount?: number; perHeadRate?: number; advancePaid?: number; status?: string; notes?: string | null }) => Promise<ApiResponse>
    delete: (payload: string) => Promise<ApiResponse>
  }
  eventRunOfShow: {
    list: (payload: { eventId: string }) => Promise<ApiResponse>
    create: (payload: { eventId: string; scheduledTime: string; activity: string; responsibleParty?: string; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; scheduledTime?: string; activity?: string; responsibleParty?: string | null; isDone?: boolean; notes?: string | null }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
  }
  property: {
    list: (payload: { status?: string; listingType?: string; search?: string }) => Promise<ApiResponse>
    get: (payload: string) => Promise<ApiResponse>
    create: (payload: { propertyType: string; listingType: string; location: string; area: number; ownerClientId: string; floorNumber?: number; totalFloors?: number; askingPrice?: number; monthlyRent?: number; securityDeposit?: number; brokeragePercent?: number; photos?: string[]; amenities?: string[]; description?: string; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; propertyType?: string; listingType?: string; status?: string; location?: string; area?: number; floorNumber?: number | null; totalFloors?: number | null; askingPrice?: number | null; monthlyRent?: number | null; securityDeposit?: number | null; ownerClientId?: string; brokeragePercent?: number | null; photos?: string[]; amenities?: string[]; description?: string | null; notes?: string | null }) => Promise<ApiResponse>
    delete: (payload: string) => Promise<ApiResponse>
    kpis: () => Promise<ApiResponse>
  }
  propertyInquiry: {
    list: (payload: string) => Promise<ApiResponse>
    create: (payload: { propertyId: string; buyerClientId: string; notes?: string; nextFollowUpDate?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; status?: string; notes?: string | null; nextFollowUpDate?: string | null }) => Promise<ApiResponse>
    delete: (payload: string) => Promise<ApiResponse>
  }
  propertySiteVisit: {
    list: (payload: { inquiryId: string }) => Promise<ApiResponse>
    schedule: (payload: { inquiryId: string; scheduledDate: string; scheduledTime?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; scheduledDate?: string; scheduledTime?: string | null; status?: string; feedback?: string | null; interestLevel?: string | null }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
  }
  propertyDeal: {
    list: (payload: { status?: string; propertyId?: string }) => Promise<ApiResponse>
    create: (payload: { propertyId: string; buyerClientId: string; sellerClientId: string; dealValue: number; brokeragePercent: number; expectedRegistrationDate?: string; notes?: string; coBrokerName?: string; coBrokerSharePercent?: number }) => Promise<ApiResponse>
    update: (payload: { id: string; dealValue?: number; brokeragePercent?: number; expectedRegistrationDate?: string | null; status?: string; invoiceId?: string | null; notes?: string | null; coBrokerName?: string | null; coBrokerSharePercent?: number | null }) => Promise<ApiResponse>
    delete: (payload: string) => Promise<ApiResponse>
    generateInvoice: (payload: string) => Promise<ApiResponse>
  }
  // Phase 33 — Car Service, Tailor Boutique, Pest Control
  carJobCard: {
    list: (payload?: { status?: string; clientId?: string; search?: string }) => Promise<ApiResponse>
    get: (payload: string) => Promise<ApiResponse>
    create: (payload: { clientId: string; vehicleNumber: string; vehicleMake: string; vehicleModel: string; vehicleYear?: number; vehicleType?: string; kmIn?: number; serviceAdvisorId?: string; technicianIds?: string[]; serviceItems?: Array<{ name: string; quantity: number; unitPrice: number }>; partsItems?: Array<{ name: string; partNumber?: string; quantity: number; unitPrice: number }>; estimatedDelivery?: string; notes?: string; internalNotes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; vehicleNumber?: string; vehicleMake?: string; vehicleModel?: string; vehicleYear?: number | null; vehicleType?: string; kmIn?: number | null; kmOut?: number | null; serviceAdvisorId?: string | null; technicianIds?: string[]; serviceItems?: Array<{ name: string; quantity: number; unitPrice: number }>; partsItems?: Array<{ name: string; partNumber?: string; quantity: number; unitPrice: number }>; estimatedDelivery?: string | null; deliveredDate?: string | null; status?: string; invoiceId?: string | null; notes?: string | null; internalNotes?: string | null; nextServiceDueDate?: string | null; nextServiceDueKm?: number | null }) => Promise<ApiResponse>
    delete: (payload: string) => Promise<ApiResponse>
    generateInvoice: (payload: string) => Promise<ApiResponse>
    kpis: () => Promise<ApiResponse>
    vehicleHistory: (payload: { vehicleNumber: string }) => Promise<ApiResponse>
    vehiclesDueForService: (payload?: { dueSoonDays?: number }) => Promise<ApiResponse>
    scheduleServiceReminder: (payload: { jobCardId: string; daysBefore?: number }) => Promise<ApiResponse>
  }
  measurementRecord: {
    list: (payload: string) => Promise<ApiResponse>
    get: (payload: string) => Promise<ApiResponse>
    create: (payload: { clientId: string; chest?: number; waist?: number; hips?: number; shoulder?: number; neck?: number; sleeve?: number; inseam?: number; outseam?: number; thigh?: number; height?: number; armhole?: number; frontNeckDepth?: number; backNeckDepth?: number; garmentLength?: number; cuff?: number; notes?: string; takenById?: string; recordDate?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; chest?: number | null; waist?: number | null; hips?: number | null; shoulder?: number | null; neck?: number | null; sleeve?: number | null; inseam?: number | null; outseam?: number | null; thigh?: number | null; height?: number | null; armhole?: number | null; frontNeckDepth?: number | null; backNeckDepth?: number | null; garmentLength?: number | null; cuff?: number | null; notes?: string | null; takenById?: string | null; recordDate?: string }) => Promise<ApiResponse>
    delete: (payload: string) => Promise<ApiResponse>
  }
  tailoringOrder: {
    list: (payload?: { status?: string; clientId?: string; search?: string }) => Promise<ApiResponse>
    get: (payload: string) => Promise<ApiResponse>
    create: (payload: { clientId: string; measurementRecordId?: string; garmentType: string; gender?: string; styleRegion?: string; fabricDescription?: string; fabricSupplied?: string; quantity?: number; unitPrice: number; advancePaid?: number; trialDate?: string; deliveryDate?: string; assignedToId?: string; specialInstructions?: string; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; measurementRecordId?: string | null; garmentType?: string; gender?: string | null; styleRegion?: string | null; fabricDescription?: string | null; fabricSupplied?: string; quantity?: number; unitPrice?: number; advancePaid?: number; trialDate?: string | null; deliveryDate?: string | null; deliveredDate?: string | null; status?: string; assignedToId?: string | null; invoiceId?: string | null; specialInstructions?: string | null; notes?: string | null }) => Promise<ApiResponse>
    delete: (payload: string) => Promise<ApiResponse>
    generateInvoice: (payload: string) => Promise<ApiResponse>
    kpis: () => Promise<ApiResponse>
    scheduleTrialAppointment: (payload: { orderId: string; providerId?: string; scheduledDate: string; scheduledTime: string; durationMinutes?: number }) => Promise<ApiResponse>
    setFabric: (payload: { orderId: string; fabricProductId: string; fabricQuantity: number }) => Promise<ApiResponse>
    clearFabric: (payload: string) => Promise<ApiResponse>
  }
  pestContract: {
    list: (payload?: { status?: string; clientId?: string; search?: string }) => Promise<ApiResponse>
    get: (payload: string) => Promise<ApiResponse>
    create: (payload: { clientId: string; propertyAddress: string; propertyType?: string; pestTypes?: string[]; serviceFrequency?: string; startDate: string; endDate?: string; contractValue: number; status?: string; assignedToId?: string; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; propertyAddress?: string; propertyType?: string; pestTypes?: string[]; serviceFrequency?: string; startDate?: string; endDate?: string | null; contractValue?: number; status?: string; assignedToId?: string | null; notes?: string | null }) => Promise<ApiResponse>
    delete: (payload: string) => Promise<ApiResponse>
    kpis: () => Promise<ApiResponse>
    generateInvoice: (payload: { id: string; period?: string }) => Promise<ApiResponse>
  }
  pestJobSheet: {
    list: (payload?: { status?: string; contractId?: string; clientId?: string; search?: string }) => Promise<ApiResponse>
    create: (payload: { contractId?: string; clientId: string; visitDate: string; scheduledTime?: string; technicianIds?: string[]; pesticideUsed?: string; areasServiced?: string[]; treatmentType?: string; jobAmount?: number; clientSignature?: boolean; followUpDate?: string; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; visitDate?: string; scheduledTime?: string | null; technicianIds?: string[]; pesticideUsed?: string | null; areasServiced?: string[]; treatmentType?: string; jobAmount?: number; status?: string; completedDate?: string | null; followUpDate?: string | null; clientSignature?: boolean; invoiceId?: string | null; notes?: string | null }) => Promise<ApiResponse>
    delete: (payload: string) => Promise<ApiResponse>
    generateInvoice: (payload: string) => Promise<ApiResponse>
    listPesticides: (payload: string) => Promise<ApiResponse>
    addPesticide: (payload: { jobSheetId: string; productId?: string; pesticideName: string; quantityUsed: number; unit?: string; dosageNote?: string; targetPest?: string }) => Promise<ApiResponse>
    removePesticide: (payload: string) => Promise<ApiResponse>
  }
  // Phase 34 — Placement Agency
  candidate: {
    list: (payload?: { status?: string; search?: string }) => Promise<ApiResponse>
    get: (payload: string) => Promise<ApiResponse>
    create: (payload: { fullName: string; email?: string; phone?: string; currentJobTitle?: string; currentEmployer?: string; totalExperience?: number; skills?: string[]; preferredLocations?: string[]; educationSummary?: string; resumeNotes?: string; expectedSalary?: number; currentSalary?: number; availableFrom?: string; source?: string; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; fullName?: string; email?: string | null; phone?: string | null; currentJobTitle?: string | null; currentEmployer?: string | null; totalExperience?: number | null; skills?: string[]; preferredLocations?: string[]; educationSummary?: string | null; resumeNotes?: string | null; expectedSalary?: number | null; currentSalary?: number | null; availableFrom?: string | null; status?: string; source?: string; notes?: string | null }) => Promise<ApiResponse>
    delete: (payload: string) => Promise<ApiResponse>
  }
  jobOrder: {
    list: (payload?: { status?: string; clientId?: string; search?: string }) => Promise<ApiResponse>
    get: (payload: string) => Promise<ApiResponse>
    create: (payload: { clientId: string; jobTitle: string; jobDescription?: string; requiredSkills?: string[]; experienceMin?: number; experienceMax?: number; salaryBudgetMin?: number; salaryBudgetMax?: number; location?: string; numberOfPositions?: number; targetDate?: string; commissionType?: string; commissionValue?: number; feeAgreementTerms?: string; replacementGuaranteeDays?: number; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; jobTitle?: string; jobDescription?: string | null; requiredSkills?: string[]; experienceMin?: number | null; experienceMax?: number | null; salaryBudgetMin?: number | null; salaryBudgetMax?: number | null; location?: string | null; numberOfPositions?: number; targetDate?: string | null; status?: string; commissionType?: string; commissionValue?: number; feeAgreementTerms?: string | null; replacementGuaranteeDays?: number | null; notes?: string | null }) => Promise<ApiResponse>
    delete: (payload: string) => Promise<ApiResponse>
  }
  interviewRound: {
    list: (payload?: { candidateId?: string; jobOrderId?: string }) => Promise<ApiResponse>
    create: (payload: { candidateId: string; jobOrderId: string; roundNumber?: number; roundType?: string; scheduledDate?: string; interviewerName?: string; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; roundType?: string; scheduledDate?: string | null; status?: string; interviewerName?: string | null; clientFeedback?: string | null; notes?: string | null }) => Promise<ApiResponse>
    delete: (payload: { id: string }) => Promise<ApiResponse>
  }
  placement: {
    list: (payload?: { status?: string; candidateId?: string; jobOrderId?: string; search?: string }) => Promise<ApiResponse>
    get: (payload: string) => Promise<ApiResponse>
    create: (payload: { candidateId: string; jobOrderId: string; clientId: string; joiningDate: string; offeredSalary: number; commissionAmount: number; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; joiningDate?: string; offeredSalary?: number; commissionAmount?: number; status?: string; invoiceId?: string | null; notes?: string | null }) => Promise<ApiResponse>
    delete: (payload: string) => Promise<ApiResponse>
    generateInvoice: (payload: string) => Promise<ApiResponse>
    kpis: () => Promise<ApiResponse>
  }
  // Phase 37 — Logistics & Supply Chain
  logisticsVehicle: {
    list: (payload?: { status?: string; ownerType?: string; offset?: number; limit?: number }) => Promise<ApiResponse>
    create: (payload: { vehicleNumber: string; vehicleType: string; ownerType?: string; driverName?: string; driverPhone?: string; capacity?: number; capacityUnit?: string; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; vehicleNumber?: string; vehicleType?: string; ownerType?: string; driverName?: string; driverPhone?: string; capacity?: number; capacityUnit?: string; notes?: string; status?: string }) => Promise<ApiResponse>
    delete: (payload: string) => Promise<ApiResponse>
    updateStatus: (payload: { id: string; status: string }) => Promise<ApiResponse>
  }
  logisticsCarrier: {
    list: (payload?: { activeOnly?: boolean; offset?: number; limit?: number }) => Promise<ApiResponse>
    create: (payload: { name: string; type?: string; phone?: string; email?: string; gstNumber?: string; ratePerKg?: number; ratePerKm?: number; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; name?: string; type?: string; phone?: string; email?: string; gstNumber?: string; ratePerKg?: number | null; ratePerKm?: number | null; notes?: string; isActive?: boolean }) => Promise<ApiResponse>
    delete: (payload: string) => Promise<ApiResponse>
    toggleActive: (payload: string) => Promise<ApiResponse>
  }
  logisticsShipment: {
    list: (payload?: { status?: string; shipmentType?: string; search?: string; fromDate?: string; toDate?: string; offset?: number; limit?: number }) => Promise<ApiResponse>
    get: (payload: string) => Promise<ApiResponse>
    create: (payload: { shipmentType?: string; referenceType?: string; referenceId?: string; referenceNumber?: string; originAddress?: string; destinationAddress: string; customerId?: string; customerName?: string; supplierId?: string; supplierName?: string; carrierId?: string; vehicleId?: string; trackingNumber?: string; freightAmount?: number; freightPaidBy?: string; weight?: number; weightUnit?: string; packages?: number; scheduledDate?: string; expectedDelivery?: string; challanNumber?: string; ewayBillNumber?: string; notes?: string; items?: Array<{ productId?: string; productName: string; quantity: number; unit?: string; unitValue?: number; batchNumber?: string; serialNumber?: string; notes?: string }> }) => Promise<ApiResponse>
    update: (payload: { id: string; shipmentType?: string; referenceType?: string; referenceNumber?: string; originAddress?: string; destinationAddress?: string; customerId?: string; customerName?: string; supplierId?: string; supplierName?: string; carrierId?: string | null; vehicleId?: string | null; trackingNumber?: string; freightAmount?: number; freightPaidBy?: string; weight?: number; packages?: number; scheduledDate?: string; expectedDelivery?: string; challanNumber?: string; ewayBillNumber?: string; notes?: string; items?: Array<{ productId?: string; productName: string; quantity: number; unit?: string; unitValue?: number; batchNumber?: string; serialNumber?: string; notes?: string }> }) => Promise<ApiResponse>
    updateStatus: (payload: { id: string; status: string }) => Promise<ApiResponse>
    delete: (payload: string) => Promise<ApiResponse>
    // Phase 58 §2 — Distributor route/beat planning (multi-stop shipments)
    addStop: (payload: { shipmentId: string; customerId?: string; customerName?: string; destinationAddress: string; notes?: string }) => Promise<ApiResponse>
    updateStopStatus: (payload: { id: string; status: 'DELIVERED' | 'SKIPPED' | 'PENDING' }) => Promise<ApiResponse>
    deleteStop: (payload: string) => Promise<ApiResponse>
  }
  logisticsGrn: {
    list: (payload?: { status?: string; supplierId?: string; fromDate?: string; toDate?: string; offset?: number; limit?: number }) => Promise<ApiResponse>
    get: (payload: string) => Promise<ApiResponse>
    create: (payload: { supplierId?: string; supplierName: string; purchaseOrderId?: string; shipmentId?: string; invoiceNumber?: string; invoiceDate?: string; receivedDate?: string; notes?: string; items: Array<{ productId?: string; rawMaterialId?: string; itemName: string; orderedQty?: number; receivedQty: number; rejectedQty?: number; unit?: string; unitCost?: number; batchNumber?: string; expiryDate?: string; notes?: string }> }) => Promise<ApiResponse>
    update: (payload: { id: string; status?: string; supplierName?: string; invoiceNumber?: string; invoiceDate?: string; receivedDate?: string; notes?: string; items?: Array<{ itemName: string; receivedQty: number; rejectedQty?: number; unit?: string; unitCost?: number; batchNumber?: string; notes?: string }> }) => Promise<ApiResponse>
    post: (payload: string) => Promise<ApiResponse>
    reverse: (payload: string) => Promise<ApiResponse>
    delete: (payload: string) => Promise<ApiResponse>
  }
  logisticsChallan: {
    list: (payload?: { status?: string; challanType?: string; customerId?: string; offset?: number; limit?: number }) => Promise<ApiResponse>
    get: (payload: string) => Promise<ApiResponse>
    create: (payload: { challanType?: string; customerId?: string; customerName: string; customerAddress?: string; shipmentId?: string; invoiceId?: string; vehicleId?: string; driverName?: string; driverPhone?: string; dispatchDate?: string; expectedReturn?: string; notes?: string; items: Array<{ productId?: string; productName: string; quantity: number; unit?: string; unitValue?: number; notes?: string }> }) => Promise<ApiResponse>
    update: (payload: { id: string; challanType?: string; customerName?: string; customerAddress?: string; vehicleId?: string | null; driverName?: string; driverPhone?: string; dispatchDate?: string; expectedReturn?: string | null; notes?: string; items?: Array<{ productId?: string; productName: string; quantity: number; unit?: string; unitValue?: number; notes?: string }> }) => Promise<ApiResponse>
    updateStatus: (payload: { id: string; status: string }) => Promise<ApiResponse>
    recordReturn: (payload: { id: string; items: Array<{ itemId: string; returnedQty: number }> }) => Promise<ApiResponse>
    delete: (payload: string) => Promise<ApiResponse>
  }
  logisticsFreight: {
    list: (payload?: { carrierId?: string; shipmentId?: string; status?: string; fromDate?: string; toDate?: string; offset?: number; limit?: number }) => Promise<ApiResponse>
    create: (payload: { shipmentId?: string; carrierId?: string; carrierName?: string; referenceNumber?: string; amount: number; paidBy?: string; notes?: string }) => Promise<ApiResponse>
    update: (payload: { id: string; carrierId?: string | null; carrierName?: string; referenceNumber?: string; amount?: number; paidBy?: string; notes?: string }) => Promise<ApiResponse>
    markPaid: (payload: { id: string; paidBy?: string; notes?: string }) => Promise<ApiResponse>
    delete: (payload: string) => Promise<ApiResponse>
    summary: (payload?: { fromDate?: string; toDate?: string }) => Promise<ApiResponse>
  }
  logisticsAnalytics: {
    get: (payload?: { fromDate?: string; toDate?: string }) => Promise<ApiResponse>
  }
  // Phase 57 — AI Assistant. Local, offline natural-language business
  // queries. See AI_ASSISTANT_MASTER_PROMPT.md / PHASE_57_TECHNICAL_SPEC.md.
  ai: {
    query: (payload: { question: string }) => Promise<ApiResponse>
    getStatus: () => Promise<ApiResponse>
    clearHistory: () => Promise<ApiResponse>
  }
}

export interface SetupPayload {
  businessName: string
  businessType: string
  serviceTemplateType?: string
  ownerName?: string
  country: string
  currencyCode: string
  currencySymbol: string
  taxModel: string
  phone?: string
  email?: string
  taxNumber?: string
  upiId?: string
  logoPath?: string
  adminUsername: string
  adminPassword: string
  adminFullName: string
}
