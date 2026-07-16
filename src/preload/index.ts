import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { IpcChannels } from '../main/ipc/channels'

// Typed IPC caller — expose ONLY approved APIs to renderer
// Frontend has NO direct access to Node.js, filesystem, or database
function invoke<T>(channel: string, payload?: unknown): Promise<T> {
  return ipcRenderer.invoke(channel, payload)
}

const api: IpcChannels = {
  auth: {
    login: (p) => invoke('auth:login', p),
    loginWithToken: () => invoke('auth:loginWithToken'),
    logout: () => invoke('auth:logout'),
    changePassword: (p) => invoke('auth:changePassword', p),
    getCurrentUser: () => invoke('auth:getCurrentUser'),
    getPermissions: () => invoke('auth:getPermissions')
  },
  setup: {
    isSetupComplete: () => invoke('setup:isSetupComplete'),
    completeSetup: (p) => invoke('setup:completeSetup', p)
  },
  users: {
    list: () => invoke('users:list'),
    create: (p) => invoke('users:create', p),
    update: (p) => invoke('users:update', p),
    deactivate: (p) => invoke('users:deactivate', p),
    adminResetPassword: (p) => invoke('users:adminResetPassword', p)
  },
  roles: {
    list: () => invoke('roles:list'),
    getPermissions: () => invoke('roles:getPermissions'),
    updatePermissions: (p) => invoke('roles:updatePermissions', p)
  },
  businessProfile: {
    get: () => invoke('businessProfile:get'),
    update: (p) => invoke('businessProfile:update', p)
  },
  settings: {
    get: (key) => invoke('settings:get', key),
    set: (p) => invoke('settings:set', p),
    getAll: () => invoke('settings:getAll')
  },
  products: {
    list: (p) => invoke('products:list', p),
    get: (id) => invoke('products:get', id),
    create: (p) => invoke('products:create', p),
    update: (p) => invoke('products:update', p),
    archive: (id) => invoke('products:archive', id),
    search: (q) => invoke('products:search', q),
    getByBarcode: (barcode) => invoke('products:getByBarcode', barcode),
    generateBarcode: (p) => invoke('products:generateBarcode', p),
    bulkGenerateMissingBarcodes: () => invoke('products:bulkGenerateMissingBarcodes'),
    getByScannedBarcode: (p) => invoke('products:getByScannedBarcode', p),
    generateWeightLabel: (p) => invoke('products:generateWeightLabel', p)
  },
  categories: {
    list: () => invoke('categories:list'),
    create: (p) => invoke('categories:create', p),
    update: (p) => invoke('categories:update', p),
    archive: (id) => invoke('categories:archive', id)
  },
  inventory: {
    get: (productId) => invoke('inventory:get', productId),
    list: (p) => invoke('inventory:list', p),
    addStock: (p) => invoke('inventory:addStock', p),
    adjustStock: (p) => invoke('inventory:adjustStock', p),
    getMovements: (p) => invoke('inventory:getMovements', p),
    getInventoryValue: () => invoke('inventory:getInventoryValue')
  },
  customers: {
    list: (p) => invoke('customers:list', p),
    listOutstanding: () => invoke('customers:listOutstanding'),
    get: (id) => invoke('customers:get', id),
    create: (p) => invoke('customers:create', p),
    update: (p) => invoke('customers:update', p),
    archive: (id) => invoke('customers:archive', id),
    getLedger: (id) => invoke('customers:getLedger', id),
    search: (q) => invoke('customers:search', q)
  },
  suppliers: {
    list: (p) => invoke('suppliers:list', p),
    get: (id) => invoke('suppliers:get', id),
    create: (p) => invoke('suppliers:create', p),
    update: (p) => invoke('suppliers:update', p),
    archive: (id) => invoke('suppliers:archive', id),
    getLedger: (id) => invoke('suppliers:getLedger', id),
    search: (q) => invoke('suppliers:search', q),
    recordPayment: (p) => invoke('suppliers:recordPayment', p)
  },
  purchaseOrders: {
    list: (p) => invoke('purchaseOrders:list', p),
    get: (id) => invoke('purchaseOrders:get', id),
    create: (p) => invoke('purchaseOrders:create', p),
    approve: (id) => invoke('purchaseOrders:approve', id),
    receive: (id) => invoke('purchaseOrders:receive', id),
    cancel: (p) => invoke('purchaseOrders:cancel', p)
  },
  billing: {
    createInvoice: (p) => invoke('billing:createInvoice', p),
    getInvoice: (id) => invoke('billing:getInvoice', id),
    listInvoices: (p) => invoke('billing:listInvoices', p),
    cancelInvoice: (p) => invoke('billing:cancelInvoice', p),
    generateInvoiceNumber: () => invoke('billing:generateInvoiceNumber')
  },
  payments: {
    record: (p) => invoke('payments:record', p),
    recordSplit: (p) => invoke('payments:recordSplit', p),
    reverse: (p) => invoke('payments:reverse', p),
    list: (p) => invoke('payments:list', p)
  },
  cashClose: {
    getSummary: (p) => invoke('cashClose:getSummary', p),
    create: (p) => invoke('cashClose:create', p),
    list: (p) => invoke('cashClose:list', p)
  },
  expenses: {
    list: (p) => invoke('expenses:list', p),
    create: (p) => invoke('expenses:create', p),
    update: (p) => invoke('expenses:update', p),
    delete: (id) => invoke('expenses:delete', id),
    summary: (p) => invoke('expenses:summary', p),
    listCategories: () => invoke('expenses:listCategories'),
    createCategory: (p) => invoke('expenses:createCategory', p)
  },
  tax: {
    list: () => invoke('tax:list'),
    create: (p) => invoke('tax:create', p),
    update: (p) => invoke('tax:update', p),
    delete: (id) => invoke('tax:delete', id)
  },
  reports: {
    sales: (p) => invoke('reports:sales', p),
    inventory: (p) => invoke('reports:inventory', p),
    tax: (p) => invoke('reports:tax', p),
    outstanding: () => invoke('reports:outstanding'),
    expenses: (p) => invoke('reports:expenses', p),
    profitAndLoss: (p) => invoke('reports:profitAndLoss', p),
    cashBook: (p) => invoke('reports:cashBook', p),
    trialBalance: (p) => invoke('reports:trialBalance', p),
    customerLedger: (p) => invoke('reports:customerLedger', p),
    supplierLedger: (p) => invoke('reports:supplierLedger', p),
    audit: (p) => invoke('reports:audit', p),
    foodCost: (p) => invoke('reports:foodCost', p),
    gstr1: (p) => invoke('reports:gstr1', p),
    hsnSummary: (p) => invoke('reports:hsnSummary', p),
    documentSummary: (p) => invoke('reports:documentSummary', p),
    gstr3bPreview: (p) => invoke('reports:gstr3bPreview', p),
    appointmentUtilisation: (p) => invoke('reports:appointmentUtilisation', p),
    clientRetention: (p) => invoke('reports:clientRetention', p),
    commission: (p) => invoke('reports:commission', p),
    orderVolume: (p) => invoke('reports:orderVolume', p),
    batchExpiry: () => invoke('reports:batchExpiry'),
    labThroughput: (p) => invoke('reports:labThroughput', p),
    bloodStock: () => invoke('reports:bloodStock'),
    jewellery: (p) => invoke('reports:jewellery', p),
    projects: (p) => invoke('reports:projects', p),
    jobCards: (p) => invoke('reports:jobCards', p),
    logistics: (p) => invoke('reports:logistics', p),
    attendance: (p) => invoke('reports:attendance', p),
    production: (p) => invoke('reports:production', p),
    serialWarranty: () => invoke('reports:serialWarranty'),
    variantStock: () => invoke('reports:variantStock'),
    testScores: (p) => invoke('reports:testScores', p),
    complianceTasks: () => invoke('reports:complianceTasks'),
    rentalStatus: () => invoke('reports:rentalStatus'),
    rentalRevenue: (p) => invoke('reports:rentalRevenue', p),
  },
  export: {
    toCsv: (p) => invoke('export:toCsv', p),
    toExcel: (p) => invoke('export:toExcel', p),
    toPdf: (p) => invoke('export:toPdf', p),
    generateReportHtml: (p) => invoke('export:generateReportHtml', p)
  },
  analytics: {
    getDashboardKpis: (payload) => invoke('analytics:getDashboardKpis', payload),
    getRevenueTrend: (p) => invoke('analytics:getRevenueTrend', p),
    getTopProducts: (p) => invoke('analytics:getTopProducts', p),
    getRecentActivity: () => invoke('analytics:getRecentActivity'),
    getDashboardAlerts: () => invoke('analytics:getDashboardAlerts'),
    getTopOutstanding: (p) => invoke('analytics:getTopOutstanding', p),
    getTopCategories: (p) => invoke('analytics:getTopCategories', p),
    getEstimatedProfit: (p) => invoke('analytics:getEstimatedProfit', p)
  },
  import: {
    parseFile: (p) => invoke('import:parseFile', p),
    parseDroppedFile: (p) => invoke('import:parseDroppedFile', p),
    validatePreview: (p) => invoke('import:validatePreview', p),
    execute: (p) => invoke('import:execute', p),
    downloadTemplate: (p) => invoke('import:downloadTemplate', p),
    getFields: (p) => invoke('import:getFields', p),
  },
  backup: {
    create: () => invoke('backup:create'),
    list: () => invoke('backup:list'),
    restore: (p) => invoke('backup:restore', p),
    validate: (p) => invoke('backup:validate', p),
    delete: (p) => invoke('backup:delete', p),
    checkIntegrity: () => invoke('backup:checkIntegrity'),
    pickDestinationFolder: () => invoke('backup:pickDestinationFolder'),
    getDestination: () => invoke('backup:getDestination'),
    setDestination: (p) => invoke('backup:setDestination', p)
  },
  audit: {
    list: (p) => invoke('audit:list', p),
    verifyChain: () => invoke('audit:verifyChain')
  },
  notifications: {
    list: () => invoke('notifications:list'),
    getUnreadCount: () => invoke('notifications:getUnreadCount'),
    markRead: (id) => invoke('notifications:markRead', id),
    markAllRead: () => invoke('notifications:markAllRead')
  },
  dialog: {
    openFile: (options) => invoke('dialog:openFile', options)
  },
  app: {
    getPaths: () => invoke('app:getPaths'),
    getPlatform: () => invoke('app:getPlatform'),
    checkForUpdates: () => invoke('app:checkForUpdates'),
    acknowledgeDisclaimer: () => invoke('app:acknowledgeDisclaimer'),
    isDisclaimerAccepted: () => invoke('app:isDisclaimerAccepted'),
    isBackupPromptDismissed: () => invoke('app:isBackupPromptDismissed'),
    dismissBackupPrompt: () => invoke('app:dismissBackupPrompt'),
    getBusinessLogoDataUri: () => invoke('app:getBusinessLogoDataUri'),
    generateUpiPaymentQr: (p) => invoke('app:generateUpiPaymentQr', p)
  },
  print: {
    invoice: (p) => invoke('print:invoice', p),
    receipt: (p) => invoke('print:receipt', p),
    kot: (p) => invoke('print:kot', p),
    listPrinters: () => invoke('print:listPrinters'),
    previewInvoice: (p) => invoke('print:previewInvoice', p),
    previewReceipt: (p) => invoke('print:previewReceipt', p),
    labels: (p) => invoke('print:labels', p),
    previewLabels: (p) => invoke('print:previewLabels', p)
  },
  search: {
    global: (p) => invoke('search:global', p),
  },
  industry: {
    getTemplate: () => invoke('industry:getTemplate'),
    setTemplate: (p) => invoke('industry:setTemplate', p),
    changeBusinessType: (p) => invoke('industry:changeBusinessType', p),
    updateModules: (p) => invoke('industry:updateModules', p),
  },
  restaurant: {
    listTables: () => invoke('restaurant:listTables'),
    createTable: (p) => invoke('restaurant:createTable', p),
    updateTableStatus: (p) => invoke('restaurant:updateTableStatus', p),
    deleteTable: (p) => invoke('restaurant:deleteTable', p),
    listKOTs: (p) => invoke('restaurant:listKOTs', p),
    createKOT: (p) => invoke('restaurant:createKOT', p),
    updateKOTStatus: (p) => invoke('restaurant:updateKOTStatus', p),
    listRecipes: () => invoke('restaurant:listRecipes'),
    getRecipe: (productId) => invoke('restaurant:getRecipe', productId),
    upsertRecipe: (p) => invoke('restaurant:upsertRecipe', p),
    deleteRecipe: (p) => invoke('restaurant:deleteRecipe', p),
    getDailyClosingSummary: (p) => invoke('restaurant:getDailyClosingSummary', p),
    performDailyClose: () => invoke('restaurant:performDailyClose'),
    getQrOrderingStatus: () => invoke('restaurant:getQrOrderingStatus'),
    listOrderRequests: (p) => invoke('restaurant:listOrderRequests', p),
    acceptOrderRequest: (p) => invoke('restaurant:acceptOrderRequest', p),
    rejectOrderRequest: (p) => invoke('restaurant:rejectOrderRequest', p),
    generateTableQr: (p) => invoke('restaurant:generateTableQr', p),
    getKitchenDisplayStatus: () => invoke('restaurant:getKitchenDisplayStatus'),
    regenerateKitchenDisplayToken: () => invoke('restaurant:regenerateKitchenDisplayToken'),
    generateKitchenDisplayQr: () => invoke('restaurant:generateKitchenDisplayQr'),
  },
  kitchenDisplay: {
    listDisplays: () => invoke('kitchenDisplay:listDisplays'),
    open: (p) => invoke('kitchenDisplay:open', p),
    close: () => invoke('kitchenDisplay:close'),
    getStatus: () => invoke('kitchenDisplay:getStatus'),
  },
  returns: {
    create: (p) => invoke('returns:create', p),
    list: (p) => invoke('returns:list', p),
    todaySummary: () => invoke('returns:todaySummary'),
  },
  // Phase 2 — Industry Expansion
  batches: {
    list: (p) => invoke('batches:list', p),
    create: (p) => invoke('batches:create', p),
    update: (p) => invoke('batches:update', p),
    delete: (p) => invoke('batches:delete', p),
    expiryAlerts: (p) => invoke('batches:expiryAlerts', p),
  },
  serials: {
    list: (p) => invoke('serials:list', p),
    create: (p) => invoke('serials:create', p),
    bulkCreate: (p) => invoke('serials:bulkCreate', p),
    updateStatus: (p) => invoke('serials:updateStatus', p),
    searchByImei: (p) => invoke('serials:searchByImei', p),
  },
  variants: {
    list: (p) => invoke('variants:list', p),
    upsert: (p) => invoke('variants:upsert', p),
    delete: (p) => invoke('variants:delete', p),
    adjustStock: (p) => invoke('variants:adjustStock', p),
    summary: (p) => invoke('variants:summary', p),
  },
  // Phase 3 — Manufacturing Lite
  rawMaterials: {
    list: (p) => invoke('rawMaterials:list', p),
    create: (p) => invoke('rawMaterials:create', p),
    update: (p) => invoke('rawMaterials:update', p),
    delete: (p) => invoke('rawMaterials:delete', p),
    adjustStock: (p) => invoke('rawMaterials:adjustStock', p),
    movements: (p) => invoke('rawMaterials:movements', p),
  },
  bom: {
    list: (p) => invoke('bom:list', p),
    get: (p) => invoke('bom:get', p),
    upsert: (p) => invoke('bom:upsert', p),
    delete: (p) => invoke('bom:delete', p),
  },
  production: {
    list: (p) => invoke('production:list', p),
    get: (p) => invoke('production:get', p),
    create: (p) => invoke('production:create', p),
    start: (p) => invoke('production:start', p),
    complete: (p) => invoke('production:complete', p),
    cancel: (p) => invoke('production:cancel', p),
  },
  workOrders: {
    list: (p) => invoke('workOrders:list', p),
    upsert: (p) => invoke('workOrders:upsert', p),
    updateStatus: (p) => invoke('workOrders:updateStatus', p),
  },
  dispatch: {
    list: (p) => invoke('dispatch:list', p),
    create: (p) => invoke('dispatch:create', p),
    updateStatus: (p) => invoke('dispatch:updateStatus', p),
  },
  // Phase 4 — Service Business Module
  projects: {
    list: (p) => invoke('projects:list', p),
    get: (p) => invoke('projects:get', p),
    create: (p) => invoke('projects:create', p),
    update: (p) => invoke('projects:update', p),
    delete: (p) => invoke('projects:delete', p),
    tasks: {
      list: (p) => invoke('projects:tasks:list', p),
      create: (p) => invoke('projects:tasks:create', p),
      update: (p) => invoke('projects:tasks:update', p),
      delete: (p) => invoke('projects:tasks:delete', p),
    },
  },
  tickets: {
    list: (p) => invoke('tickets:list', p),
    create: (p) => invoke('tickets:create', p),
    update: (p) => invoke('tickets:update', p),
    delete: (p) => invoke('tickets:delete', p),
  },
  jobCards: {
    list: (p) => invoke('jobCards:list', p),
    create: (p) => invoke('jobCards:create', p),
    update: (p) => invoke('jobCards:update', p),
    delete: (p) => invoke('jobCards:delete', p),
  },
  workLogs: {
    list: (p) => invoke('workLogs:list', p),
    create: (p) => invoke('workLogs:create', p),
    delete: (p) => invoke('workLogs:delete', p),
  },
  // Phase 11 — Document Management
  documents: {
    pick: (p) => invoke('documents:pick', p),
    attach: (p) => invoke('documents:attach', p),
    list: (p) => invoke('documents:list', p),
    listAll: (p) => invoke('documents:listAll', p),
    delete: (p) => invoke('documents:delete', p),
    open: (p) => invoke('documents:open', p),
  },
  // Phase 17 — HR & Attendance
  hr: {
    listEmployees: (p) => invoke('hr:listEmployees', p),
    getEmployee: (p) => invoke('hr:getEmployee', p),
    createEmployee: (p) => invoke('hr:createEmployee', p),
    updateEmployee: (p) => invoke('hr:updateEmployee', p),
    deactivateEmployee: (p) => invoke('hr:deactivateEmployee', p),
    markAttendance: (p) => invoke('hr:markAttendance', p),
    bulkMarkAttendance: (p) => invoke('hr:bulkMarkAttendance', p),
    getMonthAttendance: (p) => invoke('hr:getMonthAttendance', p),
    getMonthlySummaries: (p) => invoke('hr:getMonthlySummaries', p),
    listLeaveTypes: () => invoke('hr:listLeaveTypes', undefined),
    createLeaveType: (p) => invoke('hr:createLeaveType', p),
    listLeaveRequests: (p) => invoke('hr:listLeaveRequests', p),
    createLeaveRequest: (p) => invoke('hr:createLeaveRequest', p),
    updateLeaveStatus: (p) => invoke('hr:updateLeaveStatus', p),
    getLeaveBalance: (p) => invoke('hr:getLeaveBalance', p),
  },
  payroll: {
    listForPeriod: (p) => invoke('payroll:listForPeriod', p),
    generate: (p) => invoke('payroll:generate', p),
    updateDeductions: (p) => invoke('payroll:updateDeductions', p),
    markPaid: (p) => invoke('payroll:markPaid', p),
    print: (p) => invoke('payroll:print', p),
  },
  rental: {
    checkAvailability: (p) => invoke('rental:checkAvailability', p),
    listBookings: (p) => invoke('rental:listBookings', p),
    getBooking: (p) => invoke('rental:getBooking', p),
    createBooking: (p) => invoke('rental:createBooking', p),
    checkoutBooking: (p) => invoke('rental:checkoutBooking', p),
    returnBooking: (p) => invoke('rental:returnBooking', p),
    extendBooking: (p) => invoke('rental:extendBooking', p),
    cancelBooking: (p) => invoke('rental:cancelBooking', p),
    generateInvoice: (p) => invoke('rental:generateInvoice', p),
    listUnits: (p) => invoke('rental:listUnits', p),
    createUnit: (p) => invoke('rental:createUnit', p),
    updateUnit: (p) => invoke('rental:updateUnit', p),
    deleteUnit: (p) => invoke('rental:deleteUnit', p),
  },
  hotel: {
    listRooms: (p) => invoke('hotel:listRooms', p),
    createRoom: (p) => invoke('hotel:createRoom', p),
    updateRoom: (p) => invoke('hotel:updateRoom', p),
    deleteRoom: (p) => invoke('hotel:deleteRoom', p),
    checkAvailability: (p) => invoke('hotel:checkAvailability', p),
    listAvailableRooms: (p) => invoke('hotel:listAvailableRooms', p),
    listBookings: (p) => invoke('hotel:listBookings', p),
    getBooking: (p) => invoke('hotel:getBooking', p),
    createBooking: (p) => invoke('hotel:createBooking', p),
    checkIn: (p) => invoke('hotel:checkIn', p),
    checkOut: (p) => invoke('hotel:checkOut', p),
    cancelBooking: (p) => invoke('hotel:cancelBooking', p),
    markNoShow: (p) => invoke('hotel:markNoShow', p),
    addExtraCharge: (p) => invoke('hotel:addExtraCharge', p),
    removeExtraCharge: (p) => invoke('hotel:removeExtraCharge', p),
    generateInvoice: (p) => invoke('hotel:generateInvoice', p),
    occupancyReport: () => invoke('hotel:occupancyReport'),
    guestRegister: (p) => invoke('hotel:guestRegister', p),
  },
  metalRate: {
    list: () => invoke('metalRate:list'),
    get: (p: unknown) => invoke('metalRate:get', p),
    upsert: (p: unknown) => invoke('metalRate:upsert', p),
    delete: (p: unknown) => invoke('metalRate:delete', p),
  },
  metalExchange: {
    list: (p?: unknown) => invoke('metalExchange:list', p),
    create: (p: unknown) => invoke('metalExchange:create', p),
    linkToInvoice: (p: unknown) => invoke('metalExchange:linkToInvoice', p),
    delete: (p: unknown) => invoke('metalExchange:delete', p),
  },
  drawingRevision: {
    list: (p: unknown) => invoke('drawingRevision:list', p),
    create: (p: unknown) => invoke('drawingRevision:create', p),
    update: (p: unknown) => invoke('drawingRevision:update', p),
    delete: (p: unknown) => invoke('drawingRevision:delete', p),
  },
  siteVisit: {
    list: (p: unknown) => invoke('siteVisit:list', p),
    create: (p: unknown) => invoke('siteVisit:create', p),
    update: (p: unknown) => invoke('siteVisit:update', p),
    delete: (p: unknown) => invoke('siteVisit:delete', p),
  },
  quotations: {
    list: (p?: unknown) => invoke('quotations:list', p),
    get: (id: string) => invoke('quotations:get', id),
    create: (p: unknown) => invoke('quotations:create', p),
    updateStatus: (p: unknown) => invoke('quotations:updateStatus', p),
    convertToInvoice: (id: string) => invoke('quotations:convertToInvoice', id),
    print: (id: string) => invoke('quotations:print', id),
    printReceipt: (p: unknown) => invoke('quotations:printReceipt', p),
    delete: (id: string) => invoke('quotations:delete', id),
  },
  creditNotes: {
    list: (p?: unknown) => invoke('creditNotes:list', p),
    get: (id: string) => invoke('creditNotes:get', id),
    create: (p: unknown) => invoke('creditNotes:create', p),
    update: (p: unknown) => invoke('creditNotes:update', p),
    delete: (id: string) => invoke('creditNotes:delete', id),
    print: (id: string) => invoke('creditNotes:print', id),
    printReceipt: (p: unknown) => invoke('creditNotes:printReceipt', p),
  },
  debitNotes: {
    list: (p?: unknown) => invoke('debitNotes:list', p),
    get: (id: string) => invoke('debitNotes:get', id),
    create: (p: unknown) => invoke('debitNotes:create', p),
    update: (p: unknown) => invoke('debitNotes:update', p),
    delete: (id: string) => invoke('debitNotes:delete', id),
    print: (id: string) => invoke('debitNotes:print', id),
    printReceipt: (p: unknown) => invoke('debitNotes:printReceipt', p),
  },
  // Phase 22 — Service Business Foundation
  appointments: {
    list: (p?: unknown) => invoke('appointments:list', p),
    getByDate: (p: unknown) => invoke('appointments:getByDate', p),
    get: (p: unknown) => invoke('appointments:get', p),
    create: (p: unknown) => invoke('appointments:create', p),
    update: (p: unknown) => invoke('appointments:update', p),
    updateStatus: (p: unknown) => invoke('appointments:updateStatus', p),
    delete: (p: unknown) => invoke('appointments:delete', p),
    stats: () => invoke('appointments:stats'),
    generateInvoice: (p: unknown) => invoke('appointments:generateInvoice', p),
    generateBatchInvoice: (p: unknown) => invoke('appointments:generateBatchInvoice', p),
  },
  serviceCatalog: {
    list: (p?: unknown) => invoke('serviceCatalog:list', p),
    get: (p: unknown) => invoke('serviceCatalog:get', p),
    create: (p: unknown) => invoke('serviceCatalog:create', p),
    update: (p: unknown) => invoke('serviceCatalog:update', p),
    delete: (p: unknown) => invoke('serviceCatalog:delete', p),
    listCategories: () => invoke('serviceCatalog:listCategories'),
  },
  providerSchedule: {
    list: (p: unknown) => invoke('providerSchedule:list', p),
    upsert: (p: unknown) => invoke('providerSchedule:upsert', p),
    getAvailability: (p: unknown) => invoke('providerSchedule:getAvailability', p),
    listHolidays: (p?: unknown) => invoke('providerSchedule:listHolidays', p),
    addHoliday: (p: unknown) => invoke('providerSchedule:addHoliday', p),
    deleteHoliday: (p: unknown) => invoke('providerSchedule:deleteHoliday', p),
    getCancellationPolicy: () => invoke('providerSchedule:getCancellationPolicy'),
    upsertCancellationPolicy: (p: unknown) => invoke('providerSchedule:upsertCancellationPolicy', p),
  },
  notificationQueue: {
    list: (p?: unknown) => invoke('notificationQueue:list', p),
    getUnsentCount: () => invoke('notificationQueue:getUnsentCount'),
    markSent: (p: unknown) => invoke('notificationQueue:markSent', p),
    dismiss: (p: unknown) => invoke('notificationQueue:dismiss', p),
    generateWhatsAppLink: (p: unknown) => invoke('notificationQueue:generateWhatsAppLink', p),
    createReminder: (p: unknown) => invoke('notificationQueue:createReminder', p),
  },
  // Phase 24 — Medical (GP + Specialist)
  visitNotes: {
    list: (p?: unknown) => invoke('visitNotes:list', p),
    get: (p: unknown) => invoke('visitNotes:get', p),
    create: (p: unknown) => invoke('visitNotes:create', p),
    update: (p: unknown) => invoke('visitNotes:update', p),
    finalize: (p: unknown) => invoke('visitNotes:finalize', p),
    referToProvider: (p: unknown) => invoke('visitNotes:referToProvider', p),
    listReferrals: (p: unknown) => invoke('visitNotes:listReferrals', p),
  },
  normalRange: {
    list: (p?: unknown) => invoke('normalRange:list', p),
    save: (p: unknown) => invoke('normalRange:save', p),
    delete: (p: unknown) => invoke('normalRange:delete', p),
    evaluate: (p: unknown) => invoke('normalRange:evaluate', p),
    find: (p: unknown) => invoke('normalRange:find', p),
  },
  tokenQueue: {
    today: (p?: unknown) => invoke('tokenQueue:today', p),
    stats: (p?: unknown) => invoke('tokenQueue:stats', p),
    create: (p: unknown) => invoke('tokenQueue:create', p),
    call: (p: unknown) => invoke('tokenQueue:call', p),
    seen: (p: unknown) => invoke('tokenQueue:seen', p),
    skip: (p: unknown) => invoke('tokenQueue:skip', p),
    reset: (p: unknown) => invoke('tokenQueue:reset', p),
  },
  // Phase 50 — Diagnostic & Pathology Labs
  labTestOrders: {
    list: (p?: unknown) => invoke('labTestOrders:list', p),
    get: (p: unknown) => invoke('labTestOrders:get', p),
    create: (p: unknown) => invoke('labTestOrders:create', p),
    update: (p: unknown) => invoke('labTestOrders:update', p),
    addItem: (p: unknown) => invoke('labTestOrders:addItem', p),
    removeItem: (p: unknown) => invoke('labTestOrders:removeItem', p),
    markSampleCollected: (p: unknown) => invoke('labTestOrders:markSampleCollected', p),
    updateResult: (p: unknown) => invoke('labTestOrders:updateResult', p),
    finalizeReport: (p: unknown) => invoke('labTestOrders:finalizeReport', p),
    markDelivered: (p: unknown) => invoke('labTestOrders:markDelivered', p),
    cancel: (p: unknown) => invoke('labTestOrders:cancel', p),
    delete: (p: unknown) => invoke('labTestOrders:delete', p),
    generateInvoice: (p: unknown) => invoke('labTestOrders:generateInvoice', p),
  },
  // Phase 51 — Blood Bank
  bloodBank: {
    createDonor: (p: unknown) => invoke('bloodBank:createDonor', p),
    listDonors: (p?: unknown) => invoke('bloodBank:listDonors', p),
    getDonor: (p: unknown) => invoke('bloodBank:getDonor', p),
    updateDonor: (p: unknown) => invoke('bloodBank:updateDonor', p),
    deactivateDonor: (p: unknown) => invoke('bloodBank:deactivateDonor', p),
    sendDonorRecall: (p: unknown) => invoke('bloodBank:sendDonorRecall', p),
    createDonationCamp: (p: unknown) => invoke('bloodBank:createDonationCamp', p),
    listDonationCamps: () => invoke('bloodBank:listDonationCamps'),
    createDonationRecord: (p: unknown) => invoke('bloodBank:createDonationRecord', p),
    listDonationRecords: (p?: unknown) => invoke('bloodBank:listDonationRecords', p),
    updateScreeningStatus: (p: unknown) => invoke('bloodBank:updateScreeningStatus', p),
    getBloodStock: () => invoke('bloodBank:getBloodStock'),
    checkCompatibilityBatch: (p: unknown) => invoke('bloodBank:checkCompatibilityBatch', p),
    createIssue: (p: unknown) => invoke('bloodBank:createIssue', p),
    listIssues: (p?: unknown) => invoke('bloodBank:listIssues', p),
    getIssue: (p: unknown) => invoke('bloodBank:getIssue', p),
    cancelIssue: (p: unknown) => invoke('bloodBank:cancelIssue', p),
    generateIssueInvoice: (p: unknown) => invoke('bloodBank:generateIssueInvoice', p),
  },
  // Phase 25 — Dental Clinic
  toothRecord: {
    getChart: (p: unknown) => invoke('toothRecord:getChart', p),
    upsert: (p: unknown) => invoke('toothRecord:upsert', p),
  },
  treatmentPlan: {
    list: (p: unknown) => invoke('treatmentPlan:list', p),
    get: (p: unknown) => invoke('treatmentPlan:get', p),
    create: (p: unknown) => invoke('treatmentPlan:create', p),
    update: (p: unknown) => invoke('treatmentPlan:update', p),
  },
  recall: {
    get: (p: unknown) => invoke('recall:get', p),
    list: (p?: unknown) => invoke('recall:list', p),
    upsert: (p: unknown) => invoke('recall:upsert', p),
  },
  // Phase 23 — Veterinary
  pets: {
    list: (p?: unknown) => invoke('pets:list', p),
    get: (p: unknown) => invoke('pets:get', p),
    create: (p: unknown) => invoke('pets:create', p),
    update: (p: unknown) => invoke('pets:update', p),
    delete: (p: unknown) => invoke('pets:delete', p),
    addWeight: (p: unknown) => invoke('pets:addWeight', p),
    weightHistory: (p: unknown) => invoke('pets:weightHistory', p),
  },
  vaccinations: {
    list: (p: unknown) => invoke('vaccinations:list', p),
    get: (p: unknown) => invoke('vaccinations:get', p),
    create: (p: unknown) => invoke('vaccinations:create', p),
    update: (p: unknown) => invoke('vaccinations:update', p),
    delete: (p: unknown) => invoke('vaccinations:delete', p),
    createReminder: (p: unknown) => invoke('vaccinations:createReminder', p),
    upcoming: (p?: unknown) => invoke('vaccinations:upcoming', p),
  },
  // Phase 26 — Physiotherapy Clinic
  treatmentPhase: {
    list: (p: unknown) => invoke('treatmentPhase:list', p),
    create: (p: unknown) => invoke('treatmentPhase:create', p),
    update: (p: unknown) => invoke('treatmentPhase:update', p),
    close: (p: unknown) => invoke('treatmentPhase:close', p),
  },
  exerciseProgram: {
    getActive: (p: unknown) => invoke('exerciseProgram:getActive', p),
    list: (p: unknown) => invoke('exerciseProgram:list', p),
    upsert: (p: unknown) => invoke('exerciseProgram:upsert', p),
    markPrinted: (p: unknown) => invoke('exerciseProgram:markPrinted', p),
  },
  sessionPack: {
    getActive: (p: unknown) => invoke('sessionPack:getActive', p),
    list: (p: unknown) => invoke('sessionPack:list', p),
    listAll: () => invoke('sessionPack:listAll'),
    create: (p: unknown) => invoke('sessionPack:create', p),
    deduct: (p: unknown) => invoke('sessionPack:deduct', p),
    logs: (p: unknown) => invoke('sessionPack:logs', p),
    generateInvoice: (p: unknown) => invoke('sessionPack:generateInvoice', p),
  },
  // Phase 27 — Salon, Gym/Studio, Driving School
  staffCommission: {
    calculate: (p: unknown) => invoke('staffCommission:calculate', p),
    listByStaff: (p: unknown) => invoke('staffCommission:listByStaff', p),
    listAll: (p?: unknown) => invoke('staffCommission:listAll', p),
    markPaid: (p: unknown) => invoke('staffCommission:markPaid', p),
    monthlyReport: (p?: unknown) => invoke('staffCommission:monthlyReport', p),
  },
  membershipPlan: {
    list: () => invoke('membershipPlan:list'),
    create: (p: unknown) => invoke('membershipPlan:create', p),
    update: (p: unknown) => invoke('membershipPlan:update', p),
    delete: (p: unknown) => invoke('membershipPlan:delete', p),
  },
  membership: {
    list: (p?: unknown) => invoke('membership:list', p),
    getByClient: (p: unknown) => invoke('membership:getByClient', p),
    create: (p: unknown) => invoke('membership:create', p),
    update: (p: unknown) => invoke('membership:update', p),
    checkIn: (p: unknown) => invoke('membership:checkIn', p),
    attendance: (p: unknown) => invoke('membership:attendance', p),
    expiring: (p?: unknown) => invoke('membership:expiring', p),
    generateInvoice: (p: unknown) => invoke('membership:generateInvoice', p),
  },
  batchClass: {
    list: (p?: unknown) => invoke('batchClass:list', p),
    get: (p: unknown) => invoke('batchClass:get', p),
    create: (p: unknown) => invoke('batchClass:create', p),
    update: (p: unknown) => invoke('batchClass:update', p),
    enroll: (p: unknown) => invoke('batchClass:enroll', p),
    unenroll: (p: unknown) => invoke('batchClass:unenroll', p),
    markAttendance: (p: unknown) => invoke('batchClass:markAttendance', p),
    getAttendance: (p: unknown) => invoke('batchClass:getAttendance', p),
  },
  learnerProfile: {
    get: (p: unknown) => invoke('learnerProfile:get', p),
    upsert: (p: unknown) => invoke('learnerProfile:upsert', p),
  },
  drivingVehicle: {
    list: (p?: unknown) => invoke('drivingVehicle:list', p),
    create: (p: unknown) => invoke('drivingVehicle:create', p),
    update: (p: unknown) => invoke('drivingVehicle:update', p),
    delete: (p: unknown) => invoke('drivingVehicle:delete', p),
  },
  drivingSession: {
    list: (p?: unknown) => invoke('drivingSession:list', p),
    create: (p: unknown) => invoke('drivingSession:create', p),
    update: (p: unknown) => invoke('drivingSession:update', p),
    generateInvoice: (p: unknown) => invoke('drivingSession:generateInvoice', p),
    listTests: (p?: unknown) => invoke('drivingSession:listTests', p),
    createTest: (p: unknown) => invoke('drivingSession:createTest', p),
    updateTest: (p: unknown) => invoke('drivingSession:updateTest', p),
  },
  drivingPackage: {
    list: (p?: unknown) => invoke('drivingPackage:list', p),
    create: (p: unknown) => invoke('drivingPackage:create', p),
    update: (p: unknown) => invoke('drivingPackage:update', p),
    delete: (p: unknown) => invoke('drivingPackage:delete', p),
  },
  drivingPackageEnrollment: {
    list: (p?: unknown) => invoke('drivingPackageEnrollment:list', p),
    create: (p: unknown) => invoke('drivingPackageEnrollment:create', p),
    delete: (p: unknown) => invoke('drivingPackageEnrollment:delete', p),
    generateInvoice: (p: unknown) => invoke('drivingPackageEnrollment:generateInvoice', p),
  },
  // Phase 28 — Legal
  legalCase: {
    list: (p?: unknown) => invoke('legalCase:list', p),
    get: (p: unknown) => invoke('legalCase:get', p),
    create: (p: unknown) => invoke('legalCase:create', p),
    update: (p: unknown) => invoke('legalCase:update', p),
    delete: (p: unknown) => invoke('legalCase:delete', p),
  },
  hearing: {
    list: (p?: unknown) => invoke('hearing:list', p),
    create: (p: unknown) => invoke('hearing:create', p),
    update: (p: unknown) => invoke('hearing:update', p),
    delete: (p: unknown) => invoke('hearing:delete', p),
  },
  timeEntry: {
    list: (p?: unknown) => invoke('timeEntry:list', p),
    create: (p: unknown) => invoke('timeEntry:create', p),
    update: (p: unknown) => invoke('timeEntry:update', p),
    delete: (p: unknown) => invoke('timeEntry:delete', p),
    markBilled: (p: unknown) => invoke('timeEntry:markBilled', p),
    generateInvoice: (p: unknown) => invoke('timeEntry:generateInvoice', p),
  },
  complianceEvent: {
    list: (p?: unknown) => invoke('complianceEvent:list', p),
  },
  complianceTask: {
    list: (p?: unknown) => invoke('complianceTask:list', p),
    create: (p: unknown) => invoke('complianceTask:create', p),
    update: (p: unknown) => invoke('complianceTask:update', p),
    delete: (p: unknown) => invoke('complianceTask:delete', p),
  },
  engagement: {
    list: (p?: unknown) => invoke('engagement:list', p),
    create: (p: unknown) => invoke('engagement:create', p),
    update: (p: unknown) => invoke('engagement:update', p),
    delete: (p: unknown) => invoke('engagement:delete', p),
    generateInvoice: (p: unknown) => invoke('engagement:generateInvoice', p),
  },
  rocFiling: {
    list: (p?: unknown) => invoke('rocFiling:list', p),
    create: (p: unknown) => invoke('rocFiling:create', p),
    update: (p: unknown) => invoke('rocFiling:update', p),
    delete: (p: unknown) => invoke('rocFiling:delete', p),
  },
  boardMeeting: {
    list: (p?: unknown) => invoke('boardMeeting:list', p),
    create: (p: unknown) => invoke('boardMeeting:create', p),
    update: (p: unknown) => invoke('boardMeeting:update', p),
    delete: (p: unknown) => invoke('boardMeeting:delete', p),
  },
  boardResolution: {
    list: (p: unknown) => invoke('boardResolution:list', p),
    create: (p: unknown) => invoke('boardResolution:create', p),
    update: (p: unknown) => invoke('boardResolution:update', p),
    delete: (p: unknown) => invoke('boardResolution:delete', p),
  },
  // Phase 30 — Architect, Civil, Consultant, Agency
  lead: {
    list: (p?: unknown) => invoke('lead:list', p),
    create: (p: unknown) => invoke('lead:create', p),
    update: (p: unknown) => invoke('lead:update', p),
    delete: (p: unknown) => invoke('lead:delete', p),
  },
  serviceProject: {
    list: (p?: unknown) => invoke('serviceProject:list', p),
    get: (p: unknown) => invoke('serviceProject:get', p),
    create: (p: unknown) => invoke('serviceProject:create', p),
    update: (p: unknown) => invoke('serviceProject:update', p),
    delete: (p: unknown) => invoke('serviceProject:delete', p),
  },
  milestone: {
    list: (p: unknown) => invoke('milestone:list', p),
    create: (p: unknown) => invoke('milestone:create', p),
    update: (p: unknown) => invoke('milestone:update', p),
    delete: (p: unknown) => invoke('milestone:delete', p),
    generateInvoice: (p: unknown) => invoke('milestone:generateInvoice', p),
  },
  retainer: {
    list: (p?: unknown) => invoke('retainer:list', p),
    create: (p: unknown) => invoke('retainer:create', p),
    update: (p: unknown) => invoke('retainer:update', p),
    delete: (p: unknown) => invoke('retainer:delete', p),
    generateInvoice: (p: unknown) => invoke('retainer:generateInvoice', p),
  },
  issue: {
    list: (p?: unknown) => invoke('issue:list', p),
    create: (p: unknown) => invoke('issue:create', p),
    update: (p: unknown) => invoke('issue:update', p),
    delete: (p: unknown) => invoke('issue:delete', p),
  },
  sprint: {
    list: (p: unknown) => invoke('sprint:list', p),
    create: (p: unknown) => invoke('sprint:create', p),
    update: (p: unknown) => invoke('sprint:update', p),
    delete: (p: unknown) => invoke('sprint:delete', p),
  },
  // Phase 31 — Coaching Institute
  student: {
    list: (p?: unknown) => invoke('student:list', p),
    get: (p: unknown) => invoke('student:get', p),
    create: (p: unknown) => invoke('student:create', p),
    update: (p: unknown) => invoke('student:update', p),
    delete: (p: unknown) => invoke('student:delete', p),
  },
  coachingBatch: {
    list: (p?: unknown) => invoke('coachingBatch:list', p),
    create: (p: unknown) => invoke('coachingBatch:create', p),
    update: (p: unknown) => invoke('coachingBatch:update', p),
    delete: (p: unknown) => invoke('coachingBatch:delete', p),
    kpis: () => invoke('coachingBatch:kpis'),
  },
  enrollment: {
    listByBatch: (p: unknown) => invoke('enrollment:listByBatch', p),
    listByStudent: (p: unknown) => invoke('enrollment:listByStudent', p),
    create: (p: unknown) => invoke('enrollment:create', p),
    update: (p: unknown) => invoke('enrollment:update', p),
    delete: (p: unknown) => invoke('enrollment:delete', p),
  },
  coachingAttendance: {
    get: (p: unknown) => invoke('coachingAttendance:get', p),
    save: (p: unknown) => invoke('coachingAttendance:save', p),
    listDates: (p: unknown) => invoke('coachingAttendance:listDates', p),
  },
  coachingFee: {
    generate: (p: unknown) => invoke('coachingFee:generate', p),
    list: (p?: unknown) => invoke('coachingFee:list', p),
    kpis: (p: unknown) => invoke('coachingFee:kpis', p),
    update: (p: unknown) => invoke('coachingFee:update', p),
  },
  performance: {
    list: (p?: unknown) => invoke('performance:list', p),
    create: (p: unknown) => invoke('performance:create', p),
    update: (p: unknown) => invoke('performance:update', p),
    delete: (p: unknown) => invoke('performance:delete', p),
  },
  studentTestScore: {
    list: (p?: unknown) => invoke('studentTestScore:list', p),
    create: (p: unknown) => invoke('studentTestScore:create', p),
    update: (p: unknown) => invoke('studentTestScore:update', p),
    delete: (p: unknown) => invoke('studentTestScore:delete', p),
  },
  // Phase 32 — Photography, Event Management, Real Estate
  shootBooking: {
    list: (p?: unknown) => invoke('shootBooking:list', p),
    get: (p: unknown) => invoke('shootBooking:get', p),
    create: (p: unknown) => invoke('shootBooking:create', p),
    update: (p: unknown) => invoke('shootBooking:update', p),
    delete: (p: unknown) => invoke('shootBooking:delete', p),
    kpis: () => invoke('shootBooking:kpis'),
    generateInvoice: (p: unknown) => invoke('shootBooking:generateInvoice', p),
  },
  deliveryTracker: {
    get: (p: unknown) => invoke('deliveryTracker:get', p),
    upsert: (p: unknown) => invoke('deliveryTracker:upsert', p),
  },
  eventBooking: {
    list: (p?: unknown) => invoke('eventBooking:list', p),
    create: (p: unknown) => invoke('eventBooking:create', p),
    update: (p: unknown) => invoke('eventBooking:update', p),
    delete: (p: unknown) => invoke('eventBooking:delete', p),
    kpis: () => invoke('eventBooking:kpis'),
    generateInvoice: (p: unknown) => invoke('eventBooking:generateInvoice', p),
  },
  eventVendorBooking: {
    list: (p: unknown) => invoke('eventVendorBooking:list', p),
    create: (p: unknown) => invoke('eventVendorBooking:create', p),
    update: (p: unknown) => invoke('eventVendorBooking:update', p),
    delete: (p: unknown) => invoke('eventVendorBooking:delete', p),
  },
  property: {
    list: (p?: unknown) => invoke('property:list', p),
    get: (p: unknown) => invoke('property:get', p),
    create: (p: unknown) => invoke('property:create', p),
    update: (p: unknown) => invoke('property:update', p),
    delete: (p: unknown) => invoke('property:delete', p),
    kpis: () => invoke('property:kpis'),
  },
  propertyInquiry: {
    list: (p: unknown) => invoke('propertyInquiry:list', p),
    create: (p: unknown) => invoke('propertyInquiry:create', p),
    update: (p: unknown) => invoke('propertyInquiry:update', p),
    delete: (p: unknown) => invoke('propertyInquiry:delete', p),
  },
  propertyDeal: {
    list: (p?: unknown) => invoke('propertyDeal:list', p),
    create: (p: unknown) => invoke('propertyDeal:create', p),
    update: (p: unknown) => invoke('propertyDeal:update', p),
    delete: (p: unknown) => invoke('propertyDeal:delete', p),
    generateInvoice: (p: unknown) => invoke('propertyDeal:generateInvoice', p),
  },
  // Phase 33 — Car Service, Tailor Boutique, Pest Control
  carJobCard: {
    list: (p?: unknown) => invoke('carJobCard:list', p),
    get: (p: unknown) => invoke('carJobCard:get', p),
    create: (p: unknown) => invoke('carJobCard:create', p),
    update: (p: unknown) => invoke('carJobCard:update', p),
    delete: (p: unknown) => invoke('carJobCard:delete', p),
    generateInvoice: (p: unknown) => invoke('carJobCard:generateInvoice', p),
    kpis: () => invoke('carJobCard:kpis'),
  },
  measurementRecord: {
    list: (p: unknown) => invoke('measurementRecord:list', p),
    get: (p: unknown) => invoke('measurementRecord:get', p),
    create: (p: unknown) => invoke('measurementRecord:create', p),
    update: (p: unknown) => invoke('measurementRecord:update', p),
    delete: (p: unknown) => invoke('measurementRecord:delete', p),
  },
  tailoringOrder: {
    list: (p?: unknown) => invoke('tailoringOrder:list', p),
    get: (p: unknown) => invoke('tailoringOrder:get', p),
    create: (p: unknown) => invoke('tailoringOrder:create', p),
    update: (p: unknown) => invoke('tailoringOrder:update', p),
    delete: (p: unknown) => invoke('tailoringOrder:delete', p),
    generateInvoice: (p: unknown) => invoke('tailoringOrder:generateInvoice', p),
    kpis: () => invoke('tailoringOrder:kpis'),
  },
  pestContract: {
    list: (p?: unknown) => invoke('pestContract:list', p),
    get: (p: unknown) => invoke('pestContract:get', p),
    create: (p: unknown) => invoke('pestContract:create', p),
    update: (p: unknown) => invoke('pestContract:update', p),
    delete: (p: unknown) => invoke('pestContract:delete', p),
    kpis: () => invoke('pestContract:kpis'),
    generateInvoice: (p: unknown) => invoke('pestContract:generateInvoice', p),
  },
  pestJobSheet: {
    list: (p?: unknown) => invoke('pestJobSheet:list', p),
    create: (p: unknown) => invoke('pestJobSheet:create', p),
    update: (p: unknown) => invoke('pestJobSheet:update', p),
    delete: (p: unknown) => invoke('pestJobSheet:delete', p),
    generateInvoice: (p: unknown) => invoke('pestJobSheet:generateInvoice', p),
  },
  // Phase 34 — Placement Agency
  candidate: {
    list: (p?: unknown) => invoke('candidate:list', p),
    get: (p: unknown) => invoke('candidate:get', p),
    create: (p: unknown) => invoke('candidate:create', p),
    update: (p: unknown) => invoke('candidate:update', p),
    delete: (p: unknown) => invoke('candidate:delete', p),
  },
  jobOrder: {
    list: (p?: unknown) => invoke('jobOrder:list', p),
    get: (p: unknown) => invoke('jobOrder:get', p),
    create: (p: unknown) => invoke('jobOrder:create', p),
    update: (p: unknown) => invoke('jobOrder:update', p),
    delete: (p: unknown) => invoke('jobOrder:delete', p),
  },
  placement: {
    list: (p?: unknown) => invoke('placement:list', p),
    get: (p: unknown) => invoke('placement:get', p),
    create: (p: unknown) => invoke('placement:create', p),
    update: (p: unknown) => invoke('placement:update', p),
    delete: (p: unknown) => invoke('placement:delete', p),
    generateInvoice: (p: unknown) => invoke('placement:generateInvoice', p),
    kpis: () => invoke('placement:kpis'),
  },
  // Phase 37 — Logistics & Supply Chain
  logisticsVehicle: {
    list: (p?: unknown) => invoke('logisticsVehicle:list', p),
    create: (p: unknown) => invoke('logisticsVehicle:create', p),
    update: (p: unknown) => invoke('logisticsVehicle:update', p),
    delete: (p: unknown) => invoke('logisticsVehicle:delete', p),
    updateStatus: (p: unknown) => invoke('logisticsVehicle:updateStatus', p),
  },
  logisticsCarrier: {
    list: (p?: unknown) => invoke('logisticsCarrier:list', p),
    create: (p: unknown) => invoke('logisticsCarrier:create', p),
    update: (p: unknown) => invoke('logisticsCarrier:update', p),
    delete: (p: unknown) => invoke('logisticsCarrier:delete', p),
    toggleActive: (p: unknown) => invoke('logisticsCarrier:toggleActive', p),
  },
  logisticsShipment: {
    list: (p?: unknown) => invoke('logisticsShipment:list', p),
    get: (p: unknown) => invoke('logisticsShipment:get', p),
    create: (p: unknown) => invoke('logisticsShipment:create', p),
    update: (p: unknown) => invoke('logisticsShipment:update', p),
    updateStatus: (p: unknown) => invoke('logisticsShipment:updateStatus', p),
    delete: (p: unknown) => invoke('logisticsShipment:delete', p),
  },
  logisticsGrn: {
    list: (p?: unknown) => invoke('logisticsGrn:list', p),
    get: (p: unknown) => invoke('logisticsGrn:get', p),
    create: (p: unknown) => invoke('logisticsGrn:create', p),
    update: (p: unknown) => invoke('logisticsGrn:update', p),
    post: (p: unknown) => invoke('logisticsGrn:post', p),
    reverse: (p: unknown) => invoke('logisticsGrn:reverse', p),
    delete: (p: unknown) => invoke('logisticsGrn:delete', p),
  },
  logisticsChallan: {
    list: (p?: unknown) => invoke('logisticsChallan:list', p),
    get: (p: unknown) => invoke('logisticsChallan:get', p),
    create: (p: unknown) => invoke('logisticsChallan:create', p),
    update: (p: unknown) => invoke('logisticsChallan:update', p),
    updateStatus: (p: unknown) => invoke('logisticsChallan:updateStatus', p),
    recordReturn: (p: unknown) => invoke('logisticsChallan:recordReturn', p),
    delete: (p: unknown) => invoke('logisticsChallan:delete', p),
  },
  logisticsFreight: {
    list: (p?: unknown) => invoke('logisticsFreight:list', p),
    create: (p: unknown) => invoke('logisticsFreight:create', p),
    update: (p: unknown) => invoke('logisticsFreight:update', p),
    markPaid: (p: unknown) => invoke('logisticsFreight:markPaid', p),
    delete: (p: unknown) => invoke('logisticsFreight:delete', p),
    summary: (p?: unknown) => invoke('logisticsFreight:summary', p),
  },
  logisticsAnalytics: {
    get: (p?: unknown) => invoke('logisticsAnalytics:get', p),
  },
  ai: {
    query: (p: { question: string }) => invoke('ai:query', p),
    getStatus: () => invoke('ai:getStatus'),
    clearHistory: () => invoke('ai:clearHistory'),
  },
}

contextBridge.exposeInMainWorld('api', api)

// Whitelisted channels for main→renderer push events (GAP R24)
const ALLOWED_PUSH_CHANNELS = [
  'notifications:new',
  'backup:progress',
  'backup:complete',
  'import:progress',
  'import:complete',
  'system:alert',
] as const
type AllowedPushChannel = typeof ALLOWED_PUSH_CHANNELS[number]

contextBridge.exposeInMainWorld('events', {
  on: (channel: AllowedPushChannel, listener: (...args: unknown[]) => void) => {
    if (!ALLOWED_PUSH_CHANNELS.includes(channel)) return
    const wrapped = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => listener(...args)
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.removeListener(channel, wrapped)
  },
  off: (channel: AllowedPushChannel, listener: (...args: unknown[]) => void) => {
    if (!ALLOWED_PUSH_CHANNELS.includes(channel)) return
    ipcRenderer.removeAllListeners(channel)
    void listener // suppress unused warning
  }
})

// Expose app info
contextBridge.exposeInMainWorld('appInfo', {
  version: process.env.npm_package_version || '1.0.0',
  name: 'Sarang Business OS Lite'
})

// Resolve a drag-and-dropped File to a real filesystem path. With
// contextIsolation on, a File object's `.path` is not available in the
// renderer — webUtils.getPathForFile must be called from the preload/main
// side, which still has access to the same File object reference passed
// across the context bridge.
contextBridge.exposeInMainWorld('fileUtils', {
  getPathForFile: (file: File): string => webUtils.getPathForFile(file)
})
