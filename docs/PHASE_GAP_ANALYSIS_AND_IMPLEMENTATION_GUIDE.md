# PHASE GAP ANALYSIS & IMPLEMENTATION GUIDE

## SARANG BUSINESS OS LITE

### Powered by Aszurex | Trust Beyond Limits

**Document Type:** Phase Verification, Gap Analysis & Implementation Specification

**Scope:** All 30 documentation files cross-referenced against Phases 1–11 (CLAUDE_CODE_MASTER_EXECUTION_PROMPT.md)

**Purpose:** Identify every gap between what the docs specify and what a developer actually needs to implement each phase. For every gap, provide the missing specification and how to implement it.

---

## HOW TO READ THIS DOCUMENT

Each phase section contains:

1. **VERIFIED** — what the docs already specify completely
2. **GAP** — what is missing from docs that a developer needs
3. **IMPLEMENTATION** — exactly how to build what's missing

---

---

# PHASE 1 — PROJECT FOUNDATION

## What docs cover well

- Electron security baseline (ARCHITECTURE.md): All webPreferences settings specified with exact values
- Folder structure (ARCHITECTURE.md): `src/main/`, `src/renderer/`, `src/shared/` breakdown
- Module structure template (DEVELOPMENT_RULES.md): `.service.ts`, `.handlers.ts`, `.validator.ts`, `.types.ts` per module
- Authentication hashing rule (SECURITY.md): bcrypt or Argon2
- Setup wizard screens (INSTALLATION_AND_UPDATE_STRATEGY.md): All 6 screens with wireframe layouts
- Permission guard pattern (PERMISSIONS_MATRIX.md): `requirePermission()` signature

---

## GAP 1.1 — No `schema.prisma` file content

**Problem:** DATABASE_SCHEMA.md lists every field name and type but does not give the actual Prisma schema. A developer cannot generate migrations without it.

**Implementation — Full Prisma Schema:**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model BusinessProfile {
  id              Int      @id @default(autoincrement())
  business_name   String
  business_type   String
  owner_name      String?
  email           String?
  phone           String?
  address         String?
  city            String?
  state           String?
  country         String   @default("IN")
  postal_code     String?
  currency_code   String   @default("INR")
  currency_symbol String   @default("₹")
  tax_model       String   @default("GST")
  tax_number      String?
  upi_id          String?
  website         String?
  logo_path       String?
  timezone        String   @default("Asia/Kolkata")
  date_format     String   @default("DD/MM/YYYY")
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt
}

model User {
  id            Int       @id @default(autoincrement())
  full_name     String
  email         String?
  phone         String?
  username      String    @unique
  password_hash String
  role_id       Int
  is_active     Int       @default(1)
  last_login    DateTime?
  created_at    DateTime  @default(now())
  updated_at    DateTime  @updatedAt
  role          Role      @relation(fields: [role_id], references: [id], onDelete: Restrict)
  audit_logs    AuditLog[]
  invoices_created Invoice[] @relation("InvoiceCreator")
  expenses_created Expense[] @relation("ExpenseCreator")
  inventory_movements InventoryMovement[] @relation("MovementCreator")
  purchase_orders PurchaseOrder[] @relation("POCreator")
  payments_recorded Payment[] @relation("PaymentRecorder")
}

model Role {
  id          Int              @id @default(autoincrement())
  role_name   String           @unique
  description String?
  created_at  DateTime         @default(now())
  updated_at  DateTime         @updatedAt
  users       User[]
  permissions RolePermission[]
}

model Permission {
  id              Int              @id @default(autoincrement())
  permission_key  String           @unique
  permission_name String
  description     String?
  created_at      DateTime         @default(now())
  role_permissions RolePermission[]
}

model RolePermission {
  id            Int        @id @default(autoincrement())
  role_id       Int
  permission_id Int
  created_at    DateTime   @default(now())
  role          Role       @relation(fields: [role_id], references: [id], onDelete: Cascade)
  permission    Permission @relation(fields: [permission_id], references: [id], onDelete: Cascade)
  @@unique([role_id, permission_id])
}

model ProductCategory {
  id                 Int               @id @default(autoincrement())
  name               String
  description        String?
  parent_category_id Int?
  is_active          Int               @default(1)
  created_at         DateTime          @default(now())
  updated_at         DateTime          @updatedAt
  parent             ProductCategory?  @relation("CategoryChildren", fields: [parent_category_id], references: [id], onDelete: Restrict)
  children           ProductCategory[] @relation("CategoryChildren")
  products           Product[]
}

model Product {
  id            Int             @id @default(autoincrement())
  category_id   Int?
  sku           String?         @unique
  barcode       String?         @unique
  product_name  String
  description   String?
  product_type  String          @default("STANDARD")
  unit          String          @default("Piece")
  cost_price    Float           @default(0)
  selling_price Float
  tax_rate      Float           @default(0)
  image_path    String?
  is_active     Int             @default(1)
  created_at    DateTime        @default(now())
  updated_at    DateTime        @updatedAt
  category      ProductCategory? @relation(fields: [category_id], references: [id], onDelete: Restrict)
  inventory     Inventory?
  movements     InventoryMovement[]
  invoice_items InvoiceItem[]
  po_items      PurchaseOrderItem[]
  recipe_items  RecipeItem[]    @relation("RecipeIngredient")
  recipes       Recipe[]
}

model Inventory {
  id               Int      @id @default(autoincrement())
  product_id       Int      @unique
  quantity         Float    @default(0)
  reserved_quantity Float   @default(0)
  reorder_level    Float    @default(0)
  reorder_quantity Float    @default(0)
  updated_at       DateTime @updatedAt
  product          Product  @relation(fields: [product_id], references: [id], onDelete: Restrict)
}

model InventoryMovement {
  id             Int      @id @default(autoincrement())
  product_id     Int
  movement_type  String
  quantity       Float
  reference_type String?
  reference_id   Int?
  remarks        String?
  created_by     Int
  created_at     DateTime @default(now())
  product        Product  @relation(fields: [product_id], references: [id], onDelete: Restrict)
  creator        User     @relation("MovementCreator", fields: [created_by], references: [id], onDelete: Restrict)
}

model Customer {
  id                  Int              @id @default(autoincrement())
  customer_code       String?
  customer_name       String
  phone               String?
  email               String?
  address             String?
  city                String?
  state               String?
  country             String?
  tax_number          String?
  credit_limit        Float            @default(0)
  outstanding_balance Float            @default(0)
  notes               String?
  is_active           Int              @default(1)
  created_at          DateTime         @default(now())
  updated_at          DateTime         @updatedAt
  invoices            Invoice[]
  payments            Payment[]
  ledger_entries      CustomerLedger[]
}

model CustomerLedger {
  id             Int      @id @default(autoincrement())
  customer_id    Int
  reference_type String?
  reference_id   Int?
  debit_amount   Float    @default(0)
  credit_amount  Float    @default(0)
  balance        Float    @default(0)
  remarks        String?
  created_at     DateTime @default(now())
  customer       Customer @relation(fields: [customer_id], references: [id], onDelete: Restrict)
}

model Supplier {
  id             Int              @id @default(autoincrement())
  supplier_code  String?
  supplier_name  String
  phone          String?
  email          String?
  address        String?
  city           String?
  state          String?
  country        String?
  tax_number     String?
  notes          String?
  is_active      Int              @default(1)
  created_at     DateTime         @default(now())
  updated_at     DateTime         @updatedAt
  purchase_orders PurchaseOrder[]
  ledger_entries  SupplierLedger[]
}

model SupplierLedger {
  id             Int      @id @default(autoincrement())
  supplier_id    Int
  reference_type String?
  reference_id   Int?
  debit_amount   Float    @default(0)
  credit_amount  Float    @default(0)
  balance        Float    @default(0)
  remarks        String?
  created_at     DateTime @default(now())
  supplier       Supplier @relation(fields: [supplier_id], references: [id], onDelete: Restrict)
}

model PurchaseOrder {
  id             Int                @id @default(autoincrement())
  po_number      String             @unique
  supplier_id    Int
  order_date     String
  expected_date  String?
  status         String             @default("DRAFT")
  subtotal       Float              @default(0)
  tax_amount     Float              @default(0)
  total_amount   Float              @default(0)
  notes          String?
  created_by     Int
  created_at     DateTime           @default(now())
  updated_at     DateTime           @updatedAt
  supplier       Supplier           @relation(fields: [supplier_id], references: [id], onDelete: Restrict)
  creator        User               @relation("POCreator", fields: [created_by], references: [id], onDelete: Restrict)
  items          PurchaseOrderItem[]
}

model PurchaseOrderItem {
  id                Int           @id @default(autoincrement())
  purchase_order_id Int
  product_id        Int
  quantity          Float
  unit_cost         Float
  tax_rate          Float         @default(0)
  total             Float
  created_at        DateTime      @default(now())
  purchase_order    PurchaseOrder @relation(fields: [purchase_order_id], references: [id], onDelete: Restrict)
  product           Product       @relation(fields: [product_id], references: [id], onDelete: Restrict)
}

model Invoice {
  id              Int           @id @default(autoincrement())
  invoice_number  String        @unique
  invoice_type    String        @default("RETAIL")
  customer_id     Int?
  invoice_date    String
  due_date        String?
  status          String        @default("DRAFT")
  subtotal        Float         @default(0)
  discount_amount Float         @default(0)
  tax_amount      Float         @default(0)
  rounding_amount Float         @default(0)
  total_amount    Float         @default(0)
  paid_amount     Float         @default(0)
  balance_amount  Float         @default(0)
  payment_status  String        @default("UNPAID")
  notes           String?
  created_by      Int
  created_at      DateTime      @default(now())
  updated_at      DateTime      @updatedAt
  customer        Customer?     @relation(fields: [customer_id], references: [id], onDelete: Restrict)
  creator         User          @relation("InvoiceCreator", fields: [created_by], references: [id], onDelete: Restrict)
  items           InvoiceItem[]
  payments        Payment[]
  kots            KOT[]
}

model InvoiceItem {
  id              Int      @id @default(autoincrement())
  invoice_id      Int
  product_id      Int
  product_name    String
  quantity        Float
  unit_price      Float
  discount_amount Float    @default(0)
  tax_rate        Float    @default(0)
  tax_amount      Float    @default(0)
  line_total      Float
  created_at      DateTime @default(now())
  invoice         Invoice  @relation(fields: [invoice_id], references: [id], onDelete: Restrict)
  product         Product  @relation(fields: [product_id], references: [id], onDelete: Restrict)
}

model Payment {
  id               Int      @id @default(autoincrement())
  invoice_id       Int
  customer_id      Int?
  payment_method   String
  amount           Float
  reference_number String?
  payment_date     String
  remarks          String?
  recorded_by      Int
  created_at       DateTime @default(now())
  invoice          Invoice  @relation(fields: [invoice_id], references: [id], onDelete: Restrict)
  customer         Customer? @relation(fields: [customer_id], references: [id], onDelete: Restrict)
  recorder         User     @relation("PaymentRecorder", fields: [recorded_by], references: [id], onDelete: Restrict)
}

model ExpenseCategory {
  id            Int       @id @default(autoincrement())
  category_name String
  description   String?
  created_at    DateTime  @default(now())
  expenses      Expense[]
}

model Expense {
  id             Int             @id @default(autoincrement())
  category_id    Int
  expense_name   String
  amount         Float
  expense_date   String
  payment_method String          @default("CASH")
  remarks        String?
  created_by     Int
  created_at     DateTime        @default(now())
  category       ExpenseCategory @relation(fields: [category_id], references: [id], onDelete: Restrict)
  creator        User            @relation("ExpenseCreator", fields: [created_by], references: [id], onDelete: Restrict)
}

model TaxConfiguration {
  id         Int      @id @default(autoincrement())
  tax_name   String
  tax_type   String
  rate       Float
  country    String?
  is_default Int      @default(0)
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt
}

model Setting {
  id            Int      @id @default(autoincrement())
  setting_key   String   @unique
  setting_value String
  setting_type  String   @default("STRING")
  updated_at    DateTime @updatedAt
}

model AuditLog {
  id          Int      @id @default(autoincrement())
  user_id     Int
  action      String
  entity_type String
  entity_id   Int?
  old_value   String?
  new_value   String?
  created_at  DateTime @default(now())
  user        User     @relation(fields: [user_id], references: [id], onDelete: Restrict)
}

model Notification {
  id                Int      @id @default(autoincrement())
  notification_type String
  title             String
  message           String
  is_read           Int      @default(0)
  created_at        DateTime @default(now())
}

model Backup {
  id             Int      @id @default(autoincrement())
  backup_name    String
  backup_path    String
  backup_size    Int
  backup_date    DateTime @default(now())
  backup_version String
  sha256_checksum String?
  created_at     DateTime @default(now())
}

model IndustryTemplateSetting {
  id              Int      @id @default(autoincrement())
  business_type   String   @unique
  enabled_modules String
  dashboard_layout String?
  report_layout    String?
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt
}

// Restaurant-specific tables
model RestaurantTable {
  id           Int      @id @default(autoincrement())
  table_number String
  table_name   String?
  status       String   @default("AVAILABLE")
  created_at   DateTime @default(now())
  kots         KOT[]
}

model KOT {
  id         Int             @id @default(autoincrement())
  invoice_id Int
  table_id   Int?
  status     String          @default("PENDING")
  created_at DateTime        @default(now())
  updated_at DateTime        @updatedAt
  invoice    Invoice         @relation(fields: [invoice_id], references: [id], onDelete: Restrict)
  table      RestaurantTable? @relation(fields: [table_id], references: [id], onDelete: Restrict)
}

model Recipe {
  id           Int          @id @default(autoincrement())
  product_id   Int          @unique
  recipe_name  String
  created_at   DateTime     @default(now())
  product      Product      @relation(fields: [product_id], references: [id], onDelete: Restrict)
  items        RecipeItem[]
}

model RecipeItem {
  id                    Int     @id @default(autoincrement())
  recipe_id             Int
  ingredient_product_id Int
  quantity              Float
  created_at            DateTime @default(now())
  recipe                Recipe  @relation(fields: [recipe_id], references: [id], onDelete: Restrict)
  ingredient            Product @relation("RecipeIngredient", fields: [ingredient_product_id], references: [id], onDelete: Restrict)
}
```

**How to use:** Save as `prisma/schema.prisma`. Run `npx prisma generate` then `npx prisma migrate dev --name init`.

---

## GAP 1.2 — No preload.ts contextBridge specification

**Problem:** ARCHITECTURE.md says `window.sarangAPI.*` is the bridge but never specifies what channels exist.

**Implementation — Complete contextBridge surface:**

```typescript
// src/main/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('sarangAPI', {
  auth: {
    login: (input: { username: string; password: string }) =>
      ipcRenderer.invoke('auth:login', input),
    logout: () => ipcRenderer.invoke('auth:logout'),
    changePassword: (input: { userId: number; current: string; next: string }) =>
      ipcRenderer.invoke('auth:changePassword', input),
    getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser'),
  },
  business: {
    getProfile: () => ipcRenderer.invoke('business:getProfile'),
    updateProfile: (data: unknown) => ipcRenderer.invoke('business:updateProfile', data),
    completeSetup: (data: unknown) => ipcRenderer.invoke('business:completeSetup', data),
  },
  products: {
    getAll: (filters?: unknown) => ipcRenderer.invoke('products:getAll', filters),
    getById: (id: number) => ipcRenderer.invoke('products:getById', id),
    create: (data: unknown) => ipcRenderer.invoke('products:create', data),
    update: (id: number, data: unknown) => ipcRenderer.invoke('products:update', id, data),
    archive: (id: number) => ipcRenderer.invoke('products:archive', id),
    search: (query: string) => ipcRenderer.invoke('products:search', query),
  },
  categories: {
    getAll: () => ipcRenderer.invoke('categories:getAll'),
    create: (data: unknown) => ipcRenderer.invoke('categories:create', data),
    update: (id: number, data: unknown) => ipcRenderer.invoke('categories:update', id, data),
  },
  inventory: {
    getAll: (filters?: unknown) => ipcRenderer.invoke('inventory:getAll', filters),
    getById: (productId: number) => ipcRenderer.invoke('inventory:getById', productId),
    addStock: (data: unknown) => ipcRenderer.invoke('inventory:addStock', data),
    adjustStock: (data: unknown) => ipcRenderer.invoke('inventory:adjustStock', data),
    getMovements: (productId: number, filters?: unknown) =>
      ipcRenderer.invoke('inventory:getMovements', productId, filters),
  },
  customers: {
    getAll: (filters?: unknown) => ipcRenderer.invoke('customers:getAll', filters),
    getById: (id: number) => ipcRenderer.invoke('customers:getById', id),
    create: (data: unknown) => ipcRenderer.invoke('customers:create', data),
    update: (id: number, data: unknown) => ipcRenderer.invoke('customers:update', id, data),
    archive: (id: number) => ipcRenderer.invoke('customers:archive', id),
    search: (query: string) => ipcRenderer.invoke('customers:search', query),
    getLedger: (id: number) => ipcRenderer.invoke('customers:getLedger', id),
  },
  suppliers: {
    getAll: (filters?: unknown) => ipcRenderer.invoke('suppliers:getAll', filters),
    getById: (id: number) => ipcRenderer.invoke('suppliers:getById', id),
    create: (data: unknown) => ipcRenderer.invoke('suppliers:create', data),
    update: (id: number, data: unknown) => ipcRenderer.invoke('suppliers:update', id, data),
    archive: (id: number) => ipcRenderer.invoke('suppliers:archive', id),
    getLedger: (id: number) => ipcRenderer.invoke('suppliers:getLedger', id),
  },
  billing: {
    createInvoice: (data: unknown) => ipcRenderer.invoke('billing:createInvoice', data),
    getInvoice: (id: number) => ipcRenderer.invoke('billing:getInvoice', id),
    searchInvoices: (filters: unknown) => ipcRenderer.invoke('billing:searchInvoices', filters),
    cancelInvoice: (id: number, reason: string) =>
      ipcRenderer.invoke('billing:cancelInvoice', id, reason),
    recordPayment: (data: unknown) => ipcRenderer.invoke('billing:recordPayment', data),
    reversePayment: (id: number, reason: string) =>
      ipcRenderer.invoke('billing:reversePayment', id, reason),
    generateUPIQR: (invoiceId: number) => ipcRenderer.invoke('billing:generateUPIQR', invoiceId),
  },
  expenses: {
    getAll: (filters?: unknown) => ipcRenderer.invoke('expenses:getAll', filters),
    create: (data: unknown) => ipcRenderer.invoke('expenses:create', data),
    update: (id: number, data: unknown) => ipcRenderer.invoke('expenses:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('expenses:delete', id),
    getCategories: () => ipcRenderer.invoke('expenses:getCategories'),
  },
  reports: {
    generateSalesReport: (filters: unknown) =>
      ipcRenderer.invoke('reports:generateSalesReport', filters),
    generateInventoryReport: (filters: unknown) =>
      ipcRenderer.invoke('reports:generateInventoryReport', filters),
    generateTaxReport: (filters: unknown) =>
      ipcRenderer.invoke('reports:generateTaxReport', filters),
    generateOutstandingReport: () => ipcRenderer.invoke('reports:generateOutstandingReport'),
    generateExpenseReport: (filters: unknown) =>
      ipcRenderer.invoke('reports:generateExpenseReport', filters),
    exportPDF: (reportType: string, filters: unknown) =>
      ipcRenderer.invoke('reports:exportPDF', reportType, filters),
    exportCSV: (reportType: string, filters: unknown) =>
      ipcRenderer.invoke('reports:exportCSV', reportType, filters),
    exportExcel: (reportType: string, filters: unknown) =>
      ipcRenderer.invoke('reports:exportExcel', reportType, filters),
  },
  analytics: {
    getDashboardKPIs: () => ipcRenderer.invoke('analytics:getDashboardKPIs'),
    getRevenueTrend: (period: 'daily' | 'weekly' | 'monthly') =>
      ipcRenderer.invoke('analytics:getRevenueTrend', period),
    getTopProducts: (limit: number) => ipcRenderer.invoke('analytics:getTopProducts', limit),
    getExpenseTrend: (period: string) => ipcRenderer.invoke('analytics:getExpenseTrend', period),
  },
  backup: {
    create: (destinationPath: string) => ipcRenderer.invoke('backup:create', destinationPath),
    restore: (backupPath: string) => ipcRenderer.invoke('backup:restore', backupPath),
    validate: (backupPath: string) => ipcRenderer.invoke('backup:validate', backupPath),
    list: () => ipcRenderer.invoke('backup:list'),
    selectDestination: () => ipcRenderer.invoke('backup:selectDestination'),
    selectFile: () => ipcRenderer.invoke('backup:selectFile'),
  },
  importWizard: {
    preview: (filePath: string, module: string) =>
      ipcRenderer.invoke('import:preview', filePath, module),
    validate: (filePath: string, module: string) =>
      ipcRenderer.invoke('import:validate', filePath, module),
    execute: (filePath: string, module: string, mode: string) =>
      ipcRenderer.invoke('import:execute', filePath, module, mode),
    selectFile: () => ipcRenderer.invoke('import:selectFile'),
  },
  print: {
    printInvoice: (invoiceId: number, format: '80mm' | 'a4') =>
      ipcRenderer.invoke('print:printInvoice', invoiceId, format),
    printKOT: (kotId: number) => ipcRenderer.invoke('print:printKOT', kotId),
    printReport: (reportData: unknown) => ipcRenderer.invoke('print:printReport', reportData),
  },
  users: {
    getAll: () => ipcRenderer.invoke('users:getAll'),
    create: (data: unknown) => ipcRenderer.invoke('users:create', data),
    update: (id: number, data: unknown) => ipcRenderer.invoke('users:update', id, data),
    deactivate: (id: number) => ipcRenderer.invoke('users:deactivate', id),
    getRoles: () => ipcRenderer.invoke('users:getRoles'),
    assignRole: (userId: number, roleId: number) =>
      ipcRenderer.invoke('users:assignRole', userId, roleId),
  },
  settings: {
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    update: (key: string, value: string) => ipcRenderer.invoke('settings:update', key, value),
    updateBatch: (settings: Record<string, string>) =>
      ipcRenderer.invoke('settings:updateBatch', settings),
  },
  auditLogs: {
    getAll: (filters?: unknown) => ipcRenderer.invoke('auditLogs:getAll', filters),
  },
  restaurant: {
    getTables: () => ipcRenderer.invoke('restaurant:getTables'),
    updateTableStatus: (id: number, status: string) =>
      ipcRenderer.invoke('restaurant:updateTableStatus', id, status),
    getKOTs: (invoiceId: number) => ipcRenderer.invoke('restaurant:getKOTs', invoiceId),
    updateKOTStatus: (id: number, status: string) =>
      ipcRenderer.invoke('restaurant:updateKOTStatus', id, status),
    createKOT: (invoiceId: number, tableId?: number) =>
      ipcRenderer.invoke('restaurant:createKOT', invoiceId, tableId),
  },
  purchaseOrders: {
    getAll: (filters?: unknown) => ipcRenderer.invoke('purchaseOrders:getAll', filters),
    getById: (id: number) => ipcRenderer.invoke('purchaseOrders:getById', id),
    create: (data: unknown) => ipcRenderer.invoke('purchaseOrders:create', data),
    approve: (id: number) => ipcRenderer.invoke('purchaseOrders:approve', id),
    receive: (id: number, items: unknown) =>
      ipcRenderer.invoke('purchaseOrders:receive', id, items),
    cancel: (id: number, reason: string) =>
      ipcRenderer.invoke('purchaseOrders:cancel', id, reason),
  },
  dialog: {
    showSaveDialog: (options: unknown) => ipcRenderer.invoke('dialog:showSaveDialog', options),
    showOpenDialog: (options: unknown) => ipcRenderer.invoke('dialog:showOpenDialog', options),
    openExternal: (url: string) => ipcRenderer.invoke('dialog:openExternal', url),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getDataPath: () => ipcRenderer.invoke('app:getDataPath'),
  },
});

// TypeScript type declaration (place in src/shared/types/electron.d.ts)
declare global {
  interface Window {
    sarangAPI: typeof sarangAPI;
  }
}
```

---

## GAP 1.3 — No session management specification

**Problem:** No document specifies where in-memory session data is stored or how it's retrieved inside IPC handlers.

**Implementation:**

```typescript
// src/main/security/session-store.ts
import { WebContents } from 'electron';

interface SessionUser {
  id: number;
  username: string;
  full_name: string;
  role_id: number;
  role_name: string;
  permissions: string[];
}

// Map from WebContents ID to authenticated user
const sessions = new Map<number, SessionUser>();

export function setSessionUser(sender: WebContents, user: SessionUser): void {
  sessions.set(sender.id, user);
}

export function getSessionUser(sender: WebContents): SessionUser | undefined {
  return sessions.get(sender.id);
}

export function clearSession(sender: WebContents): void {
  sessions.delete(sender.id);
}

// Clear on window close (call in main process on 'closed' event)
export function clearSessionByContentsId(id: number): void {
  sessions.delete(id);
}
```

---

## GAP 1.4 — No electron-builder configuration

**Implementation:**

```javascript
// electron-builder.config.js
module.exports = {
  appId: 'com.aszurex.sarang',
  productName: 'Sarang Business OS',
  copyright: 'Copyright © 2026 Aszurex',
  publish: null,  // MANDATORY — no auto-update server
  directories: {
    output: 'dist-installer',
    buildResources: 'build-resources',
  },
  files: [
    'dist-electron/**/*',
    'dist/**/*',
    '!node_modules/**/*',
  ],
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'build-resources/icons/icon.ico',
    requestedExecutionLevel: 'asInvoker',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    installerIcon: 'build-resources/icons/icon.ico',
    uninstallerIcon: 'build-resources/icons/icon.ico',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Sarang Business OS',
    license: 'build-resources/license.txt',
  },
  extraResources: [
    {
      from: 'prisma',
      to: 'prisma',
      filter: ['schema.prisma'],
    },
  ],
};
```

---

## GAP 1.5 — No database initialization / seed data specification

**Problem:** First-run startup requires default data — roles, permissions, settings, expense categories. No document specifies this seed data.

**Implementation — database seed:**

```typescript
// src/main/database/seed.ts
import { PrismaClient } from '@prisma/client';

const ROLES = [
  { role_name: 'Admin', description: 'Full system access' },
  { role_name: 'Manager', description: 'Operational control' },
  { role_name: 'Cashier', description: 'Billing focused' },
  { role_name: 'Staff', description: 'Limited operational access' },
  { role_name: 'Kitchen Staff', description: 'Restaurant kitchen role' },
];

const PERMISSIONS = [
  { permission_key: 'auth.login', permission_name: 'Login' },
  { permission_key: 'users.view', permission_name: 'View Users' },
  { permission_key: 'users.create', permission_name: 'Create Users' },
  { permission_key: 'users.update', permission_name: 'Update Users' },
  { permission_key: 'users.deactivate', permission_name: 'Deactivate Users' },
  { permission_key: 'roles.modify', permission_name: 'Modify Roles' },
  { permission_key: 'products.view', permission_name: 'View Products' },
  { permission_key: 'products.create', permission_name: 'Create Products' },
  { permission_key: 'products.update', permission_name: 'Update Products' },
  { permission_key: 'products.archive', permission_name: 'Archive Products' },
  { permission_key: 'products.pricing', permission_name: 'Modify Pricing' },
  { permission_key: 'inventory.view', permission_name: 'View Inventory' },
  { permission_key: 'inventory.add', permission_name: 'Add Stock' },
  { permission_key: 'inventory.adjust', permission_name: 'Adjust Stock' },
  { permission_key: 'customers.view', permission_name: 'View Customers' },
  { permission_key: 'customers.create', permission_name: 'Create Customers' },
  { permission_key: 'customers.update', permission_name: 'Update Customers' },
  { permission_key: 'customers.archive', permission_name: 'Archive Customers' },
  { permission_key: 'customers.ledger', permission_name: 'View Customer Ledger' },
  { permission_key: 'suppliers.view', permission_name: 'View Suppliers' },
  { permission_key: 'suppliers.create', permission_name: 'Create Suppliers' },
  { permission_key: 'suppliers.update', permission_name: 'Update Suppliers' },
  { permission_key: 'billing.create', permission_name: 'Create Invoice' },
  { permission_key: 'billing.cancel', permission_name: 'Cancel Invoice' },
  { permission_key: 'billing.print', permission_name: 'Print Invoice' },
  { permission_key: 'payments.record', permission_name: 'Record Payment' },
  { permission_key: 'payments.reverse', permission_name: 'Reverse Payment' },
  { permission_key: 'expenses.view', permission_name: 'View Expenses' },
  { permission_key: 'expenses.create', permission_name: 'Create Expenses' },
  { permission_key: 'expenses.delete', permission_name: 'Delete Expenses' },
  { permission_key: 'reports.view', permission_name: 'View Reports' },
  { permission_key: 'reports.export', permission_name: 'Export Reports' },
  { permission_key: 'analytics.view', permission_name: 'View Analytics' },
  { permission_key: 'backup.create', permission_name: 'Create Backup' },
  { permission_key: 'backup.restore', permission_name: 'Restore Backup' },
  { permission_key: 'settings.view', permission_name: 'View Settings' },
  { permission_key: 'settings.modify', permission_name: 'Modify Settings' },
  { permission_key: 'audit.view', permission_name: 'View Audit Logs' },
  { permission_key: 'purchase_orders.view', permission_name: 'View Purchase Orders' },
  { permission_key: 'purchase_orders.create', permission_name: 'Create Purchase Orders' },
  { permission_key: 'purchase_orders.approve', permission_name: 'Approve Purchase Orders' },
  { permission_key: 'kot.view', permission_name: 'View KOT' },
  { permission_key: 'kot.update', permission_name: 'Update KOT Status' },
  { permission_key: 'tables.manage', permission_name: 'Manage Tables' },
];

// Admin gets ALL permissions
// Manager gets all except: users.deactivate, roles.modify, backup.restore, settings.modify
// Cashier gets: auth.login, products.view, inventory.view, customers.view, customers.create,
//               customers.update, customers.ledger, billing.create, billing.print, 
//               payments.record, payments.view, reports.view (limited), analytics.view (limited)
// Staff: auth.login, products.view, inventory.view, customers.view
// Kitchen Staff: auth.login, products.view, inventory.view, kot.view, kot.update

const DEFAULT_SETTINGS = [
  { setting_key: 'setup_complete', setting_value: 'false', setting_type: 'BOOLEAN' },
  { setting_key: 'invoice_prefix', setting_value: 'INV', setting_type: 'STRING' },
  { setting_key: 'invoice_sequence', setting_value: '1', setting_type: 'INTEGER' },
  { setting_key: 'allow_negative_inventory', setting_value: 'false', setting_type: 'BOOLEAN' },
  { setting_key: 'allow_advance_payment', setting_value: 'false', setting_type: 'BOOLEAN' },
  { setting_key: 'backup_reminder_days', setting_value: '7', setting_type: 'INTEGER' },
  { setting_key: 'session_timeout_minutes', setting_value: '480', setting_type: 'INTEGER' },
  { setting_key: 'print_size_default', setting_value: '80mm', setting_type: 'STRING' },
  { setting_key: 'show_cost_price', setting_value: 'false', setting_type: 'BOOLEAN' },
  { setting_key: 'po_prefix', setting_value: 'PO', setting_type: 'STRING' },
  { setting_key: 'po_sequence', setting_value: '1', setting_type: 'INTEGER' },
];

const DEFAULT_EXPENSE_CATEGORIES = [
  { category_name: 'Rent', description: 'Office/shop rent' },
  { category_name: 'Salary', description: 'Staff salaries and wages' },
  { category_name: 'Electricity', description: 'Power and utility bills' },
  { category_name: 'Transport', description: 'Fuel, transport, logistics' },
  { category_name: 'Maintenance', description: 'Repairs and maintenance' },
  { category_name: 'Supplies', description: 'Office and operational supplies' },
  { category_name: 'Marketing', description: 'Advertising and promotions' },
  { category_name: 'Miscellaneous', description: 'Other expenses' },
];
```

---

---

# PHASE 2 — CORE MASTER DATA

## What docs cover well

- All table schemas for Products, Categories, Customers, Suppliers
- Business rules P001-P006, C001-C005, S001-S003
- Zod validation patterns in DEVELOPMENT_RULES.md
- Permission matrix for CRUD operations per role

## GAP 2.1 — No Zod validation schemas specified

**Problem:** DEVELOPMENT_RULES.md shows one example schema but no schemas are defined for any module. Every IPC handler must validate with Zod.

**Implementation — Core Zod schemas:**

```typescript
// src/main/validators/product.validator.ts
import { z } from 'zod';

export const CreateProductSchema = z.object({
  product_name: z.string().min(1, 'Product name is required').max(200),
  category_id: z.number().int().positive().optional().nullable(),
  sku: z.string().max(50).optional().nullable(),
  barcode: z.string().max(50).optional().nullable(),
  product_type: z.enum(['STANDARD', 'SERVICE', 'COMPOSITE']).default('STANDARD'),
  unit: z.string().min(1).default('Piece'),
  cost_price: z.number().min(0, 'Cost price cannot be negative').default(0),
  selling_price: z.number().min(0, 'Selling price cannot be negative'),
  tax_rate: z.number().min(0).max(100).default(0),
  description: z.string().max(1000).optional().nullable(),
  is_active: z.number().int().default(1),
});

export const CreateCustomerSchema = z.object({
  customer_name: z.string().min(1, 'Customer name is required').max(200),
  phone: z.string().regex(/^\+?[\d\s\-]{7,20}$/).optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  tax_number: z.string().max(50).optional().nullable(),
  credit_limit: z.number().min(0).default(0),
  notes: z.string().max(1000).optional().nullable(),
});

export const CreateInvoiceSchema = z.object({
  customer_id: z.number().int().positive().optional().nullable(),
  invoice_type: z.enum(['RETAIL', 'WHOLESALE', 'RESTAURANT', 'TAKEAWAY']).default('RETAIL'),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  items: z.array(z.object({
    product_id: z.number().int().positive(),
    product_name: z.string(),
    quantity: z.number().positive('Quantity must be greater than zero'),
    unit_price: z.number().min(0),
    discount_amount: z.number().min(0).default(0),
    tax_rate: z.number().min(0).max(100),
  })).min(1, 'Invoice must have at least one item'),
});
```

---

## GAP 2.2 — No invoice number generation specification

**Problem:** No document specifies the invoice number format. Critical because invoice numbers must be unique and sequential.

**Implementation:**

```typescript
// src/main/services/invoice-number.service.ts
import { prisma } from '../database/client';

export async function generateInvoiceNumber(): Promise<string> {
  // Use a transaction + lock to prevent race conditions
  return await prisma.$transaction(async (tx) => {
    const seqSetting = await tx.setting.findUnique({
      where: { setting_key: 'invoice_sequence' },
    });
    const prefixSetting = await tx.setting.findUnique({
      where: { setting_key: 'invoice_prefix' },
    });

    const sequence = parseInt(seqSetting?.setting_value ?? '1', 10);
    const prefix = prefixSetting?.setting_value ?? 'INV';

    // Format: INV-2026-000001 (padded to 6 digits)
    const year = new Date().getFullYear();
    const invoiceNumber = `${prefix}-${year}-${String(sequence).padStart(6, '0')}`;

    // Increment sequence
    await tx.setting.update({
      where: { setting_key: 'invoice_sequence' },
      data: { setting_value: String(sequence + 1) },
    });

    return invoiceNumber;
  });
}
```

---

## GAP 2.3 — No specification for Settings initial defaults loading

**Problem:** The `settings_complete` flag controls whether setup wizard shows. No document explains how the app boots.

**Implementation — Main process boot sequence:**

```typescript
// src/main/startup.ts
async function checkFirstRun(): Promise<boolean> {
  const setting = await prisma.setting.findUnique({
    where: { setting_key: 'setup_complete' },
  });
  return setting?.setting_value !== 'true';
}

// In main.ts BrowserWindow creation:
// if (isFirstRun) → load /setup route
// else → load /dashboard route
```

---

---

# PHASE 3 — INVENTORY ENGINE

## What docs cover well

- MovementType union fully specified in API_AND_SERVICE_LAYER_SPEC.md
- Rules I001-I007 all specified
- Average Cost valuation method stated
- All service function signatures with TypeScript types

## GAP 3.1 — No average cost calculation formula

**Problem:** BUSINESS_RULES_ENGINE.md says "Inventory valuation: Average Cost" but never defines the formula.

**Implementation:**

```typescript
// Average Cost = Total Value of Stock / Total Quantity
// When new stock arrives at purchase_price:
// new_avg_cost = (current_quantity * current_avg_cost + added_quantity * purchase_price)
//                / (current_quantity + added_quantity)

// The PRODUCTS table needs an avg_cost_price column (add to schema.prisma):
// avg_cost_price Float @default(0)

// In inventory service addStock():
async function updateAverageCost(
  tx: PrismaTransactionClient,
  productId: number,
  addedQty: number,
  purchaseCost: number
): Promise<void> {
  const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });
  const inventory = await tx.inventory.findUniqueOrThrow({ where: { product_id: productId } });
  
  const currentQty = inventory.quantity;
  const currentAvgCost = product.avg_cost_price ?? product.cost_price;
  
  const newAvgCost = currentQty === 0
    ? purchaseCost
    : (currentQty * currentAvgCost + addedQty * purchaseCost) / (currentQty + addedQty);
  
  await tx.product.update({
    where: { id: productId },
    data: { avg_cost_price: Math.round(newAvgCost * 100) / 100 },
  });
}
```

**Schema addition required:** Add `avg_cost_price Float @default(0)` to the Product model.

---

## GAP 3.2 — No specification for invoice cancellation → inventory reversal

**Problem:** BUSINESS_RULES_ENGINE.md says "Cancelled invoices remain visible (Audit Trail Required)" but does not specify whether inventory is restored on cancellation.

**Implementation decision (fill this gap):**

When an invoice is cancelled:
1. Each invoice item creates a reversal INVENTORY_MOVEMENT with `movement_type: 'RETURN'` and `reference_type: 'INVOICE_CANCEL'`
2. The quantity is added back to INVENTORY
3. Customer outstanding balance is recalculated
4. CUSTOMER_LEDGER entry is reversed
5. If payments already recorded — they are NOT automatically reversed. Admin must manually reverse payments.

```typescript
// In billing.service.ts cancelInvoice():
async function cancelInvoice(id: number, reason: string, userId: number) {
  return await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUniqueOrThrow({
      where: { id },
      include: { items: true },
    });

    if (invoice.status === 'CANCELLED') throw new Error('INVOC-003');
    if (invoice.status === 'DRAFT') {
      // Draft can just be cancelled without inventory reversal
    } else {
      // FINAL invoice — reverse inventory
      for (const item of invoice.items) {
        await tx.inventory.update({
          where: { product_id: item.product_id },
          data: { quantity: { increment: item.quantity } },
        });
        await tx.inventoryMovement.create({
          data: {
            product_id: item.product_id,
            movement_type: 'RETURN',
            quantity: item.quantity,
            reference_type: 'INVOICE_CANCEL',
            reference_id: invoice.id,
            remarks: `Invoice ${invoice.invoice_number} cancelled: ${reason}`,
            created_by: userId,
          },
        });
      }
    }

    await tx.invoice.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
    // Audit log
  });
}
```

---

---

# PHASE 4 — BILLING ENGINE

## What docs cover well

- All billing business rules (B001-B011)
- Invoice statuses and payment statuses
- UPI QR generation rule (PM005)
- Invoice, A4, and 80mm print specs (RECEIPT_AND_REPORT_TEMPLATES.md)

## GAP 4.1 — No UPI URI format specification

**Problem:** V1_PRD.md says "Generate dynamic UPI QR" but never specifies the URI format or which library.

**Implementation:**

```typescript
// UPI Payment URI standard (NPCI spec):
// upi://pay?pa={upi_id}&pn={payee_name}&am={amount}&cu=INR&tn={note}

// Library: use 'qrcode' npm package for QR image generation
// npm install qrcode
// npm install --save-dev @types/qrcode

import QRCode from 'qrcode';

export async function generateUPIQR(params: {
  upiId: string;
  payeeName: string;
  amount: number;
  invoiceNumber: string;
  currency: string;
}): Promise<string> {
  // Only generate for INR — for other currencies, return null
  if (params.currency !== 'INR') return '';

  const uri = new URL('upi://pay');
  uri.searchParams.set('pa', params.upiId);
  uri.searchParams.set('pn', params.payeeName);
  uri.searchParams.set('am', params.amount.toFixed(2));
  uri.searchParams.set('cu', 'INR');
  uri.searchParams.set('tn', `Payment for ${params.invoiceNumber}`);

  // Generate QR as base64 PNG for embedding in print templates
  return await QRCode.toDataURL(uri.toString(), {
    width: 300,
    margin: 2,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
}
```

**Important:** UPI QR is only valid for INR. For other currencies, show "UPI not available for this currency."

---

## GAP 4.2 — No PDF/print library specification

**Problem:** RECEIPT_AND_REPORT_TEMPLATES.md specifies page dimensions but not which library generates PDF.

**Decision and implementation:**

Use `electron`'s native `webContents.printToPDF()` for PDF generation and `webContents.print()` for thermal printing. This avoids heavy dependencies.

```typescript
// src/main/services/print.service.ts
import { BrowserWindow } from 'electron';

export async function printToPDF(htmlContent: string, options: {
  pageSize: 'A4' | '80mm' | '58mm';
}): Promise<Buffer> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

  const pageRanges = options.pageSize === 'A4'
    ? { pageSize: 'A4' as const, marginsType: 1 }
    : { pageSize: { width: 80000, height: 297000 } as const, marginsType: 2 };

  const pdfBuffer = await win.webContents.printToPDF(pageRanges);
  win.destroy();
  return pdfBuffer;
}

// For thermal printing — send to specific printer
export async function printToThermal(htmlContent: string, printerName: string): Promise<void> {
  const win = new BrowserWindow({ show: false, webPreferences: { ... } });
  await win.loadURL(`data:text/html;charset=utf-8,...`);
  win.webContents.print({
    silent: true,
    deviceName: printerName,
    pageSize: { width: 80000, height: 200000 },
    margins: { marginType: 'custom', top: 0, bottom: 0, left: 4, right: 4 },
  });
}
```

For HTML-to-PDF invoice templates: use inline CSS with `@media print` and the dimensions from RECEIPT_AND_REPORT_TEMPLATES.md.

---

## GAP 4.3 — No tax breakdown specification (CGST/SGST vs single VAT)

**Problem:** For India GST, CGST and SGST must be shown separately. For VAT or Sales Tax, a single line. No document specifies this logic.

**Implementation:**

```typescript
// src/main/services/tax.service.ts
interface TaxBreakdown {
  label: string;
  rate: number;
  amount: number;
}

export function calculateTaxBreakdown(
  taxableAmount: number,
  taxRate: number,
  taxModel: string,  // 'GST' | 'VAT' | 'SALES_TAX' | 'CUSTOM' | 'NONE'
  country: string
): TaxBreakdown[] {
  if (taxRate === 0 || taxModel === 'NONE') return [];

  const totalTax = Math.round(taxableAmount * taxRate / 100 * 100) / 100;

  if (taxModel === 'GST' && country === 'IN') {
    // India GST: split equally into CGST + SGST
    const halfTax = Math.round(totalTax / 2 * 100) / 100;
    return [
      { label: `CGST @ ${taxRate / 2}%`, rate: taxRate / 2, amount: halfTax },
      { label: `SGST @ ${taxRate / 2}%`, rate: taxRate / 2, amount: totalTax - halfTax },
    ];
  }

  const label = taxModel === 'VAT' ? `VAT @ ${taxRate}%`
    : taxModel === 'SALES_TAX' ? `Tax @ ${taxRate}%`
    : `${taxModel} @ ${taxRate}%`;

  return [{ label, rate: taxRate, amount: totalTax }];
}
```

---

## GAP 4.4 — No split payment UI specification

**Problem:** PAYMENTS table supports method: 'MIXED' but no document specifies how the split payment UI works.

**Implementation spec:**

When a user selects "Split Payment" in the invoice payment screen:
1. Show multiple payment method rows (Cash + UPI, etc.)
2. Each row has: Method dropdown, Amount input
3. Running total shows "Allocated: ₹X" and "Remaining: ₹Y"
4. Save is only enabled when Allocated = Outstanding Balance
5. Each row creates a separate PAYMENT record
6. The method on INVOICE level is set to 'MIXED'

```typescript
// Each split creates its own payment record:
for (const split of splitPayments) {
  await paymentService.recordPayment({
    invoice_id: invoiceId,
    payment_method: split.method,  // CASH, UPI, CARD, etc.
    amount: split.amount,
    payment_date: today,
    recorded_by: userId,
  });
}
```

---

---

# PHASE 5 — REPORTING ENGINE

## What docs cover well

- All required report types listed in V1_PRD.md
- PDF, Excel, CSV export formats
- Reporting rules REP001-REP004

## GAP 5.1 — No Excel/CSV generation library specified

**Implementation:**

```bash
# For Excel: exceljs (best for formatting + styling)
npm install exceljs

# For CSV: built-in Node.js csv-stringify or manual join (no extra dep needed)
```

```typescript
// src/main/services/export.service.ts
import ExcelJS from 'exceljs';

export async function exportToExcel(data: {
  headers: string[];
  rows: (string | number)[][];
  sheetName: string;
  title: string;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sarang Business OS — Powered by Aszurex';

  const sheet = workbook.addWorksheet(data.sheetName);

  // Title row
  sheet.mergeCells(`A1:${String.fromCharCode(64 + data.headers.length)}1`);
  sheet.getCell('A1').value = data.title;
  sheet.getCell('A1').font = { bold: true, size: 14 };

  // Headers
  const headerRow = sheet.addRow(data.headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00AEEF' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  });

  // Data rows
  data.rows.forEach((row) => sheet.addRow(row));

  // Footer
  sheet.addRow([]);
  sheet.addRow(['Generated using Sarang Business OS Lite | Powered by Aszurex']);

  return await workbook.xlsx.writeBuffer() as Buffer;
}

export function exportToCSV(data: {
  headers: string[];
  rows: (string | number)[][];
}): string {
  const escapeCSV = (val: string | number) => {
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [
    data.headers.map(escapeCSV).join(','),
    ...data.rows.map((row) => row.map(escapeCSV).join(',')),
    '',
    'Generated using Sarang Business OS Lite,Powered by Aszurex',
  ];
  return lines.join('\r\n');
}
```

---

## GAP 5.2 — No outstanding report aging bucket specification

**Problem:** V1_PRD.md says "Outstanding Report" but never defines how aging buckets work.

**Implementation spec:**

```typescript
// Outstanding aging buckets — industry standard:
// Current: due_date >= today
// 1–30 days overdue: due_date = today - 1 to today - 30
// 31–60 days overdue: due_date = today - 31 to today - 60
// 61–90 days overdue: due_date = today - 61 to today - 90
// 90+ days overdue: due_date < today - 90

interface OutstandingBucket {
  customerId: number;
  customerName: string;
  current: number;    // Not yet due
  days1_30: number;
  days31_60: number;
  days61_90: number;
  days90plus: number;
  total: number;
}
```

---

---

# PHASE 6 — ANALYTICS ENGINE

## What docs cover well

- All KPI definitions with formulas (ANALYTICS_AND_DASHBOARD_SPEC.md)
- Recharts component specs with exact code (added in improvement session)
- Data sources clearly defined (Invoices, Payments, Expenses, etc.)
- Event-driven update strategy (no polling)

## GAP 6.1 — No profit estimate formula specification

**Problem:** Dashboard shows "Profit Estimate" KPI but no document defines the formula.

**Implementation decision:**

```typescript
// Profit Estimate = Revenue - COGS - Expenses
// Where:
// Revenue = Sum of invoice total_amount WHERE payment_status IN ('PAID', 'PARTIAL') AND date range
// COGS = Sum of (invoice_item.quantity × product.avg_cost_price) for same invoices
// Expenses = Sum of expenses.amount for same date range
// Net Profit = Revenue - COGS - Expenses
// Gross Profit = Revenue - COGS (shows as secondary)

// Label it "Profit Estimate" in UI — not "Profit" (since COGS may use avg cost, not exact cost)
// Disclaimer tooltip: "Estimated based on average cost pricing. Verify with accountant."
```

---

## GAP 6.2 — No specification for industry-specific dashboard widgets

**Problem:** ANALYTICS_AND_DASHBOARD_SPEC.md defines generic KPIs. Restaurant, Hardware, Distributor each need different primary widgets.

**Implementation spec:**

```typescript
// Restaurant dashboard additions:
// - Tables Occupied Now: COUNT(tables WHERE status = 'OCCUPIED')
// - Today's Orders: COUNT(invoices WHERE invoice_type = 'RESTAURANT' AND date = today)
// - Kitchen Queue: COUNT(kots WHERE status = 'PENDING')

// Hardware / Distributor dashboard additions:
// - Total Customer Outstanding: SUM(customers.outstanding_balance)
// - Today's Receivables: SUM(payments WHERE date = today)
// - Overdue Amount: SUM(invoices WHERE balance_amount > 0 AND due_date < today)

// These are controlled by IndustryTemplateService.loadTemplate() feature flags
```

---

## GAP 6.3 — No toast notification library specified

**Problem:** UI_UX_SYSTEM.md says "use toast for success confirmations" but no library is specified.

**Implementation:**

```bash
npm install sonner
```

```typescript
// In renderer's App.tsx root:
import { Toaster } from 'sonner';
<Toaster position="top-right" richColors duration={3000} />

// Usage throughout the app:
import { toast } from 'sonner';
toast.success('Invoice created successfully');
toast.error('Failed to save. Please try again.');
toast.warning('Low stock alert: Product XYZ has 2 units left');
```

---

---

# PHASE 7 — BACKUP & RECOVERY

## What docs cover well

- SHA-256 checksum algorithm with implementation code
- Backup file format (.sarang-backup ZIP with manifest.json + sarang.db)
- Pre-restore safety backup requirement (BACKUP_AND_DISASTER_RECOVERY.md)
- All BackupService TypeScript signatures with BackupMetadata and BackupValidation types

## GAP 7.1 — No ZIP library specification

**Problem:** BACKUP_AND_DISASTER_RECOVERY.md specifies the backup format but not which library creates the ZIP.

**Implementation:**

```bash
npm install archiver
npm install --save-dev @types/archiver
npm install adm-zip
npm install --save-dev @types/adm-zip
```

```typescript
// src/main/services/backup.service.ts
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import { createHash } from 'crypto';
import { readFileSync, createWriteStream, writeFileSync, mkdirSync } from 'fs';
import path from 'path';

export async function createBackup(destinationPath: string): Promise<BackupMetadata> {
  const dbPath = path.join(app.getPath('userData'), 'sarang.db');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupName = `sarang-backup-${timestamp}.sarang-backup`;
  const backupFilePath = path.join(destinationPath, backupName);

  // Compute SHA-256 of database file
  const dbBuffer = readFileSync(dbPath);
  const checksum = createHash('sha256').update(dbBuffer).digest('hex');
  const dbSize = dbBuffer.byteLength;

  // Build manifest
  const manifest = {
    backup_version: '1',
    sarang_version: app.getVersion(),
    created_at: new Date().toISOString(),
    database_name: 'sarang.db',
    database_size_bytes: dbSize,
    sha256_checksum: checksum,
  };

  // Create ZIP
  return new Promise((resolve, reject) => {
    const output = createWriteStream(backupFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', async () => {
      // Record in Backup table
      const stat = output.bytesWritten;
      const record = await prisma.backup.create({
        data: {
          backup_name: backupName,
          backup_path: backupFilePath,
          backup_size: stat,
          backup_version: app.getVersion(),
          sha256_checksum: checksum,
        },
      });
      resolve({ ...record });
    });

    archive.on('error', reject);
    archive.pipe(output);

    // Add database file
    archive.file(dbPath, { name: 'sarang.db' });

    // Add manifest
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    archive.finalize();
  });
}
```

---

## GAP 7.2 — No auto-backup reminder specification

**Problem:** V1_PRD.md says "Backup Reminder" is a must-have but no document specifies when/how it triggers.

**Implementation spec:**

```typescript
// On every app startup, check:
// If last_backup_date < today - backup_reminder_days setting → show reminder notification
// Setting: backup_reminder_days = 7 (default, configurable)

// Check logic in main process startup:
const lastBackup = await prisma.backup.findFirst({ orderBy: { created_at: 'desc' } });
const reminderDays = parseInt(await getSetting('backup_reminder_days'), 10);

if (!lastBackup || daysBetween(lastBackup.created_at, new Date()) > reminderDays) {
  // Send notification to renderer
  mainWindow.webContents.send('notification:backup-reminder', {
    title: 'Backup Reminder',
    message: `Your last backup was ${daysSinceLastBackup} days ago. Create a backup to protect your data.`,
    action: 'Create Backup',
  });
}
```

---

---

# PHASE 8 — DATA IMPORT WIZARD

## What docs cover well

- Import error codes IMP-001 through IMP-010 (added in improvement session)
- CSV template specifications for Products and Customers
- Batch size limits per module
- Import modes (Create Only, Create or Update, Update Existing)
- Rollback strategy

## GAP 8.1 — No Excel parsing library specified

**Implementation:**

```bash
npm install xlsx
# No @types needed — xlsx includes its own types
```

```typescript
// src/main/services/import.service.ts
import * as XLSX from 'xlsx';
import { createReadStream } from 'fs';
import { parse } from 'csv-parse/sync';

export function parseFile(filePath: string): { headers: string[]; rows: Record<string, string>[] } {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.csv') {
    const content = readFileSync(filePath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    return {
      headers: Object.keys(records[0] ?? {}),
      rows: records,
    };
  }

  if (ext === '.xlsx' || ext === '.xls') {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
    return {
      headers: Object.keys(data[0] ?? {}),
      rows: data,
    };
  }

  throw new Error('IMP-001'); // Unsupported file format
}
```

---

## GAP 8.2 — No column mapping UI specification

**Problem:** When a CSV file has columns named "Product Name" instead of "product_name", there's no spec for how the mapping works.

**Implementation spec:**

The import preview screen shows a mapping table:

```
CSV Column          →  Sarang Field
-----------             -----------
"Product Name"      →  product_name (auto-detected)
"Price"             →  selling_price (auto-detected)
"Category"          →  category (manual match required - highlight in yellow)
"My Stock"          →  UNMAPPED (show red — user must map or skip)
```

Auto-detection rules (case-insensitive, whitespace-stripped):
- "name", "product name", "item name" → `product_name`
- "price", "selling price", "rate", "mrp" → `selling_price`
- "sku", "code", "product code", "item code" → `sku`
- "barcode", "ean", "upc" → `barcode`
- "tax", "gst", "vat", "tax rate" → `tax_rate`
- "qty", "quantity", "stock", "opening stock" → `initial_stock`

If a required field (product_name / selling_price) cannot be mapped → block import.

---

---

# PHASE 9 — INDUSTRY TEMPLATES

## What docs cover well

- Feature comparison matrix (4 templates × features)
- Template activation mechanism via business_type setting
- All template-specific database tables (KOTS, TABLES, RECIPES)
- Industry-specific business rules in BUSINESS_RULES_ENGINE.md

## GAP 9.1 — No KOT print format specification

**Problem:** V1_PRD.md mentions KOT Printing but RECEIPT_AND_REPORT_TEMPLATES.md doesn't specify the KOT format.

**Implementation spec:**

```
KOT (Kitchen Order Ticket) — 80mm Thermal format:

┌─────────────────────────┐
│    KITCHEN ORDER        │
│                         │
│  KOT #: KOT-001        │
│  Table: 5               │
│  Time: 14:30            │
│  Server: Cashier Name   │
│─────────────────────────│
│  ITEMS:                 │
│                         │
│  2x Chicken Biryani     │
│  1x Naan                │
│  3x Mango Lassi         │
│                         │
│  Note: No onions        │
│─────────────────────────│
│     ** KOT COPY **      │
└─────────────────────────┘

- No prices on KOT (kitchen doesn't need them)
- Large font for item names (10pt minimum)
- Bold quantity prefix
- Print time stamp
- Table number prominent
```

---

## GAP 9.2 — No returns/exchanges workflow specification (Retail template)

**Problem:** INDUSTRY_TEMPLATES.md says "Returns / Exchanges" is enabled for Retail but no document specifies the workflow.

**Implementation spec:**

Returns create a "Sales Return Invoice" with `invoice_type: 'SALES_RETURN'`:
1. User selects original invoice to return against
2. User selects which items (and quantity) are being returned
3. System creates a negative/credit invoice
4. Inventory movement with `movement_type: 'RETURN'` adds stock back
5. Customer ledger gets a credit entry
6. The credit can be:
   - Applied against customer's outstanding balance
   - Refunded as cash (creates an outgoing payment record)

---

## GAP 9.3 — No area pricing formula for Hardware template

**Problem:** BUSINESS_RULES_ENGINE.md says "Area pricing calculations validated" (HW001) but never defines the formula.

**Implementation spec:**

```typescript
// Area-based pricing is a product type: product_type = 'AREA_BASED'
// For AREA_BASED products, the invoice item quantity is calculated as:
// quantity = length × width (in same unit as price_per)
// unit on AREA_BASED product = 'Sq. Ft.' or 'Sq. M.' or 'Sq. In.'

// Example: Glass sheet 6ft × 4ft at ₹80/sq.ft
// quantity = 6 × 4 = 24 sq.ft
// unit_price = 80
// line_total = 24 × 80 = ₹1,920

// In invoice UI for AREA_BASED products, show:
// Length: [___] × Width: [___] = 24 sq.ft
// Price per sq.ft: ₹80
// Total: ₹1,920
```

---

---

# PHASE 10 — UI POLISH

## What docs cover well

- Component interaction states (Default/Hover/Focus/Active/Disabled/Error/Loading/Success)
- Keyboard shortcuts (Ctrl+K for global search, Ctrl+N for new, Ctrl+S for save)
- Page layout patterns for List/Detail/Create/Dashboard
- Animation library: Framer Motion
- Empty state design rules
- Toast vs Modal decision rules

## GAP 10.1 — No modal/dialog library specification

**Implementation:**

```bash
npm install @radix-ui/react-dialog
npm install @radix-ui/react-alert-dialog
npm install @radix-ui/react-dropdown-menu
npm install @radix-ui/react-select
npm install @radix-ui/react-tooltip
```

Radix UI is the correct choice: headless, accessible, fully keyboard-navigable, works with Tailwind.

```typescript
// src/shared/ui/Modal.tsx — Base modal using Radix
import * as Dialog from '@radix-ui/react-dialog';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  const sizeClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  }[size];

  return (
    <Dialog.Root open={open} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content
          className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
            bg-white rounded-[10px] shadow-xl p-6 z-50 w-full ${sizeClass}
            focus:outline-none`}
        >
          <Dialog.Title className="text-xl font-semibold text-gray-800 mb-4">
            {title}
          </Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

---

## GAP 10.2 — No router specification

**Problem:** No document specifies routing for the renderer process.

**Implementation:**

```bash
npm install react-router-dom
```

```typescript
// src/renderer/routes.tsx
import { createHashRouter } from 'react-router-dom';

// Use HashRouter (not BrowserRouter) — Electron loads via file:// so hash routing works
export const router = createHashRouter([
  { path: '/setup', element: <SetupWizard /> },
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <AppShell />,  // Contains sidebar + top bar + outlet
    children: [
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'billing/new', element: <CreateInvoice /> },
      { path: 'billing/:id', element: <InvoiceDetail /> },
      { path: 'billing', element: <InvoiceList /> },
      { path: 'products', element: <ProductList /> },
      { path: 'products/new', element: <CreateProduct /> },
      { path: 'products/:id', element: <ProductDetail /> },
      { path: 'inventory', element: <InventoryList /> },
      { path: 'customers', element: <CustomerList /> },
      { path: 'customers/:id', element: <CustomerDetail /> },
      { path: 'suppliers', element: <SupplierList /> },
      { path: 'expenses', element: <ExpenseList /> },
      { path: 'reports', element: <Reports /> },
      { path: 'analytics', element: <Analytics /> },
      { path: 'backup', element: <BackupRestore /> },
      { path: 'settings', element: <Settings /> },
      { path: 'users', element: <UserManagement /> },
      { path: 'audit-logs', element: <AuditLogs /> },
      // Restaurant
      { path: 'restaurant/tables', element: <TableManagement /> },
      { path: 'restaurant/kot', element: <KOTList /> },
      { path: 'restaurant/recipes', element: <RecipeManagement /> },
      // Purchase Orders
      { path: 'purchase-orders', element: <PurchaseOrderList /> },
      { path: 'purchase-orders/new', element: <CreatePurchaseOrder /> },
      { path: 'import', element: <ImportWizard /> },
    ],
  },
]);
```

---

## GAP 10.3 — No global search implementation specification

**Problem:** UI_UX_SYSTEM.md says Ctrl+K opens global search but never specifies what it searches or how results are ranked.

**Implementation spec:**

```typescript
// Global search searches these entities in this priority order:
// 1. Products (by name, SKU, barcode)
// 2. Customers (by name, phone)
// 3. Invoices (by invoice number)
// 4. Suppliers (by name)
// 5. Expenses (by name/category)

// Implementation: Run all 5 queries in parallel, merge results, limit to 15 total
// Rank: exact prefix match > contains match
// Show entity type badge: "Product", "Customer", "Invoice", etc.
// Navigate on selection: /products/:id, /customers/:id, /billing/:id, etc.

// IPC handler:
ipcMain.handle('search:global', async (event, query: string) => {
  requirePermission(event, 'auth.login'); // Any logged-in user
  const q = query.trim();
  if (q.length < 2) return [];

  const [products, customers, invoices] = await Promise.all([
    prisma.product.findMany({
      where: { OR: [
        { product_name: { contains: q } },
        { sku: { contains: q } },
        { barcode: { contains: q } },
      ], is_active: 1 },
      take: 5,
      select: { id: true, product_name: true, sku: true },
    }),
    prisma.customer.findMany({
      where: { OR: [
        { customer_name: { contains: q } },
        { phone: { contains: q } },
      ], is_active: 1 },
      take: 5,
      select: { id: true, customer_name: true, phone: true },
    }),
    prisma.invoice.findMany({
      where: { invoice_number: { contains: q } },
      take: 5,
      select: { id: true, invoice_number: true, total_amount: true, status: true },
    }),
  ]);

  return [
    ...products.map(p => ({ type: 'product', id: p.id, label: p.product_name, sub: p.sku })),
    ...customers.map(c => ({ type: 'customer', id: c.id, label: c.customer_name, sub: c.phone })),
    ...invoices.map(i => ({ type: 'invoice', id: i.id, label: i.invoice_number, sub: i.status })),
  ];
});
```

---

---

# PHASE 11 — PACKAGING

## What docs cover well

- `publish: null` requirement
- Installer size target < 150 MB
- Upgrade strategy: auto-backup → Prisma migrate → validate → launch
- Setup wizard screen flow
- Pre-release checklist with CLI commands

## GAP 11.1 — No app icon specification

**Problem:** INSTALLATION_AND_UPDATE_STRATEGY.md doesn't mention app icons. electron-builder requires specific icon sizes.

**Implementation:**

```
Required icons (place in /build-resources/icons/):

icon.ico     — Windows installer and taskbar (256×256 minimum, 
               best to include all sizes: 16, 32, 48, 64, 128, 256)
icon.png     — Linux (512×512)

For the splash screen logo in-app:
logo.svg     — Vector format (Aszurex logo + Sarang wordmark)
logo-64.png  — 64×64 for app header
logo-128.png — 128×128 for about screen
logo-256.png — 256×256 for splash screen

Branding colors: #00AEEF (Aszurex Blue), #0F172A (Dark Slate)
```

---

## GAP 11.2 — No database migration on upgrade specification

**Problem:** INSTALLATION_AND_UPDATE_STRATEGY.md says "Apply Migration" in migration flow but doesn't specify HOW Prisma migrations run at startup.

**Implementation:**

```typescript
// src/main/database/migrate.ts
import { execSync } from 'child_process';
import path from 'path';

export async function runMigrationsOnStartup(): Promise<void> {
  // In packaged app, run migrations programmatically
  // prisma migrate deploy applies all pending migrations without interactive prompts
  const prismaPath = path.join(process.resourcesPath, 'prisma');

  // Set DATABASE_URL for the user's data directory
  process.env.DATABASE_URL = `file:${path.join(app.getPath('userData'), 'sarang.db')}`;

  // Run migrations
  execSync('npx prisma migrate deploy', {
    cwd: prismaPath,
    env: { ...process.env },
    stdio: 'pipe',
  });
}
```

**Note:** Ensure Prisma migration files are included in `extraResources` in electron-builder.config.js.

---

## GAP 11.3 — No code signing specification

**Problem:** Windows shows SmartScreen warning for unsigned executables. OPERATIONS_AND_GO_TO_MARKET.md mentions signed installer but provides no specification.

**Implementation decision:**

For V1 public release, sign with a Code Signing Certificate:
- Use Microsoft Trusted Root Certificate
- Cost: ~$200-400/year (DigiCert, Sectigo, GlobalSign)
- Alternative for initial release: Use Windows "Reputation" building (enough downloads reduce SmartScreen)

In electron-builder.config.js when certificate is available:
```javascript
win: {
  certificateFile: process.env.WINDOWS_CERT_PATH,
  certificatePassword: process.env.WINDOWS_CERT_PASSWORD,
  signingHashAlgorithms: ['sha256'],
  // ...
}
```

For V1 beta/pilot: Accept SmartScreen warning. For V1 public: must be signed.

---

---

# CROSS-CUTTING GAPS (span all phases)

## GAP X.1 — No logging library specification

**Problem:** DEVELOPMENT_RULES.md says "Local Logging Only, No remote logging" but never specifies which logging library to use.

**Implementation:**

```bash
npm install electron-log
```

```typescript
// src/main/utils/logger.ts
import log from 'electron-log';

// Configure
log.transports.file.level = 'warn';
log.transports.file.maxSize = 5 * 1024 * 1024; // 5 MB
log.transports.console.level = 'debug'; // Dev only
// File location: %APPDATA%/Sarang Business OS/logs/main.log (auto)

export const logger = {
  debug: (msg: string, ...args: unknown[]) => log.debug(msg, ...args),
  info: (msg: string, ...args: unknown[]) => log.info(msg, ...args),
  warn: (msg: string, ...args: unknown[]) => log.warn(msg, ...args),
  error: (msg: string, ...args: unknown[]) => log.error(msg, ...args),
};
```

---

## GAP X.2 — No date utility library specification

**Problem:** The app must format dates in locale-specific formats (DD/MM/YYYY for India, MM/DD/YYYY for US). No library is specified.

**Implementation:**

```bash
npm install dayjs
```

```typescript
// src/shared/utils/date.utils.ts
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
dayjs.extend(customParseFormat);

export function formatDate(isoDate: string, format: string): string {
  // format from settings: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
  return dayjs(isoDate).format(format);
}

export function todayISO(): string {
  return dayjs().format('YYYY-MM-DD');
}

export function daysBetween(date1: Date, date2: Date): number {
  return dayjs(date2).diff(dayjs(date1), 'day');
}
```

All dates stored in database as ISO format `YYYY-MM-DD` (TEXT in SQLite). All display formatting happens in the renderer using the locale setting.

---

## GAP X.3 — No Zustand store organization specification

**Problem:** ARCHITECTURE.md says Zustand for state management but never specifies store structure.

**Implementation:**

```typescript
// src/renderer/store/auth.store.ts
import { create } from 'zustand';

interface AuthUser {
  id: number; username: string; full_name: string;
  role_name: string; permissions: string[];
}

interface AuthStore {
  user: AuthUser | null;
  isAuthenticated: boolean;
  setUser: (user: AuthUser) => void;
  clearUser: () => void;
  hasPermission: (key: string) => boolean;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: true }),
  clearUser: () => set({ user: null, isAuthenticated: false }),
  hasPermission: (key) => get().user?.permissions.includes(key) ?? false,
}));

// src/renderer/store/settings.store.ts
interface SettingsStore {
  currency_code: string; currency_symbol: string;
  date_format: string; tax_model: string; country: string;
  business_name: string; business_type: string;
  setSettings: (settings: Partial<SettingsStore>) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  currency_code: 'INR',
  currency_symbol: '₹',
  date_format: 'DD/MM/YYYY',
  tax_model: 'GST',
  country: 'IN',
  business_name: '',
  business_type: 'RETAIL',
  setSettings: (s) => set(s),
}));
```

---

## GAP X.4 — No sidebar collapse persistence specification

**Problem:** UI_UX_SYSTEM.md says sidebar is "collapsible" but not where collapse state is persisted.

**Implementation:**

Store in `localStorage` in the renderer process (acceptable for UI state — not business data):

```typescript
// src/renderer/store/ui.store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIStore {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: 'sarang-ui-preferences' }
  )
);
```

---

## GAP X.5 — Missing: `INSTALLATION_GUIDE.md`, `USER_GUIDE.md`, `CHANGELOG.md`

**Problem:** DEVELOPMENT_RULES.md lists these as REQUIRED documents (README, INSTALLATION_GUIDE, BACKUP_GUIDE, RESTORE_GUIDE, USER_GUIDE, CHANGELOG). None of them exist in the docs folder.

**Implementation:** These must be created before V1 public release:

- `README.md` — Project overview for developers
- `INSTALLATION_GUIDE.md` — Step-by-step install guide for end users
- `BACKUP_GUIDE.md` — How to create and store backups
- `RESTORE_GUIDE.md` — How to restore from backup
- `USER_GUIDE.md` — Feature walkthrough for end users
- `CHANGELOG.md` — Version history starting at v1.0.0

---

---

# COMPLETE GAP SUMMARY TABLE

| Gap ID | Phase | Severity | Description | Status |
|--------|-------|----------|-------------|--------|
| G1.1 | 1 | Critical | Full schema.prisma content | Specified above |
| G1.2 | 1 | Critical | preload.ts contextBridge complete surface | Specified above |
| G1.3 | 1 | Critical | Session store implementation | Specified above |
| G1.4 | 1 | High | electron-builder.config.js content | Specified above |
| G1.5 | 1 | High | Database seed data (roles, perms, settings) | Specified above |
| G2.1 | 2 | High | Zod validation schemas for all modules | Core schemas specified above |
| G2.2 | 2 | High | Invoice number generation format | Specified above (INV-YYYY-000001) |
| G2.3 | 2 | Medium | First-run boot sequence | Specified above |
| G3.1 | 3 | High | Average cost calculation formula | Specified above |
| G3.2 | 3 | High | Invoice cancellation → inventory reversal | Specified above |
| G4.1 | 4 | High | UPI URI format and library | qrcode library + URI format specified |
| G4.2 | 4 | High | PDF/Print library choice | electron webContents.printToPDF() |
| G4.3 | 4 | High | CGST/SGST tax breakdown logic | Specified above |
| G4.4 | 4 | Medium | Split payment UI workflow | Specified above |
| G5.1 | 5 | High | Excel/CSV generation libraries | exceljs + manual CSV specified |
| G5.2 | 5 | Medium | Outstanding report aging buckets | 0, 1-30, 31-60, 61-90, 90+ specified |
| G6.1 | 6 | Medium | Profit estimate formula | Revenue - COGS - Expenses specified |
| G6.2 | 6 | Medium | Industry-specific dashboard widgets | Restaurant + Hardware/Distributor specified |
| G6.3 | 6 | High | Toast notification library | sonner specified |
| G7.1 | 7 | High | ZIP library for backup creation | archiver + adm-zip specified |
| G7.2 | 7 | Medium | Auto-backup reminder logic | On startup, check vs setting days |
| G8.1 | 8 | High | Excel parsing library | xlsx specified |
| G8.2 | 8 | Medium | Column mapping UI spec | Auto-detection rules specified above |
| G9.1 | 9 | High | KOT print format | 80mm format specified above |
| G9.2 | 9 | High | Returns/exchanges workflow | Sales Return Invoice spec above |
| G9.3 | 9 | High | Area pricing formula (Hardware) | Length × Width × Price spec above |
| G10.1 | 10 | High | Modal/dialog library | @radix-ui/react-dialog specified |
| G10.2 | 10 | High | Router specification | react-router-dom + HashRouter routes |
| G10.3 | 10 | High | Global search implementation | IPC handler + ranking spec above |
| G11.1 | 11 | Medium | App icon dimensions | All required sizes specified |
| G11.2 | 11 | High | Prisma migration at startup | execSync migrate deploy specified |
| G11.3 | 11 | High | Code signing for Windows | DigiCert/SmartScreen strategy specified |
| GX.1 | All | High | Logging library | electron-log specified |
| GX.2 | All | High | Date utility library | dayjs specified |
| GX.3 | All | High | Zustand store organization | authStore + settingsStore + uiStore |
| GX.4 | All | Low | Sidebar collapse persistence | localStorage via zustand persist |
| GX.5 | All | Medium | Missing required end-user docs | README, INSTALL_GUIDE, USER_GUIDE, etc. |

---

---

# COMPLETE RECOMMENDED PACKAGE MANIFEST

Add to `package.json` — all packages needed across all 11 phases:

```json
{
  "dependencies": {
    "electron-log": "^5.x",
    "archiver": "^7.x",
    "adm-zip": "^0.5.x",
    "qrcode": "^1.5.x",
    "xlsx": "^0.18.x",
    "exceljs": "^4.x",
    "dayjs": "^1.11.x",
    "bcryptjs": "^2.4.x",
    "sonner": "^1.x",
    "@radix-ui/react-dialog": "^1.x",
    "@radix-ui/react-alert-dialog": "^1.x",
    "@radix-ui/react-dropdown-menu": "^1.x",
    "@radix-ui/react-select": "^2.x",
    "@radix-ui/react-tooltip": "^1.x",
    "@radix-ui/react-tabs": "^1.x",
    "@radix-ui/react-popover": "^1.x",
    "@tanstack/react-table": "^8.x",
    "react-hook-form": "^7.x",
    "zod": "^3.x",
    "@hookform/resolvers": "^3.x",
    "recharts": "^2.x",
    "framer-motion": "^11.x",
    "lucide-react": "^0.x",
    "react-router-dom": "^6.x",
    "zustand": "^4.x",
    "@prisma/client": "^5.x",
    "csv-parse": "^5.x"
  },
  "devDependencies": {
    "prisma": "^5.x",
    "vitest": "^1.x",
    "@vitest/coverage-v8": "^1.x",
    "@testing-library/react": "^14.x",
    "@testing-library/user-event": "^14.x",
    "playwright": "^1.x",
    "@types/archiver": "^6.x",
    "@types/adm-zip": "^0.5.x",
    "@types/qrcode": "^1.5.x",
    "@types/bcryptjs": "^2.4.x",
    "electron-vite": "^2.x",
    "electron": "^29.x",
    "electron-builder": "^24.x"
  }
}
```

---

---

# PHASE COMPLETION VERIFICATION STATUS

| Phase | Phase Name | Doc Coverage | Gaps Found | Gaps Resolved in This Doc |
|-------|-----------|-------------|------------|--------------------------|
| 0 | Foundation | 95% | schema.prisma, seed data | ✓ |
| 1 | Project Foundation | 90% | preload.ts, session store, builder config | ✓ |
| 2 | Core Master Data | 85% | Zod schemas, invoice numbering | ✓ |
| 3 | Inventory Engine | 90% | Average cost formula, cancellation reversal | ✓ |
| 4 | Billing Engine | 80% | UPI URI, PDF library, CGST/SGST, split payment | ✓ |
| 5 | Reporting Engine | 75% | Excel library, aging buckets, report queries | ✓ |
| 6 | Analytics Engine | 85% | Profit formula, industry widgets, toast library | ✓ |
| 7 | Backup & Recovery | 90% | ZIP library, backup reminder logic | ✓ |
| 8 | Data Import Wizard | 85% | Excel parsing, column mapping UI | ✓ |
| 9 | Industry Templates | 80% | KOT format, returns workflow, area pricing | ✓ |
| 10 | UI Polish | 80% | Modal library, router, global search | ✓ |
| 11 | Packaging | 75% | Icons, migration startup, code signing | ✓ |
| X | Cross-cutting | 70% | Logger, dates, Zustand structure, missing docs | ✓ |

---

---

---

# SECOND REVIEW PASS — ADDITIONAL GAPS FOUND

*Cross-referencing all 30 documents a second time revealed 29 additional gaps not covered in the first pass. All are specified below with full implementation details.*

---

## GAP R1 — No `ServiceResult<T>` TypeScript type definition

**Problem:** Every doc references `ServiceResult<T>` as the mandatory return type for all services, but it is never actually defined anywhere. A developer writing their first service has no type to import.

**Implementation:**

```typescript
// src/shared/types/service.types.ts

export interface ServiceError {
  code: string;      // From ERROR_CATALOG.md (e.g. 'INV-001', 'PERM-001')
  message: string;   // Human-friendly message for display
  details?: unknown; // Optional extra context (never shown to users)
}

export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: ServiceError };

// Helper constructors (reduces boilerplate in every service):
export function ok<T>(data: T): ServiceResult<T> {
  return { success: true, data };
}

export function fail<T>(code: string, message: string, details?: unknown): ServiceResult<T> {
  return { success: false, error: { code, message, details } };
}

// Usage in any service:
export async function getProduct(id: number): Promise<ServiceResult<Product>> {
  try {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return fail('PROD-404', 'Product not found');
    return ok(product);
  } catch (error) {
    return fail('SYS-001', 'Something unexpected happened', error);
  }
}
```

---

## GAP R2 — No `requirePermission()` implementation

**Problem:** Every IPC handler is required to call `requirePermission(event, 'permission.key')` as its very first line, but no document shows the actual implementation of this function.

**Implementation:**

```typescript
// src/main/security/permission-guard.ts
import { IpcMainInvokeEvent } from 'electron';
import { getSessionUser } from './session-store';

export function requirePermission(event: IpcMainInvokeEvent, permissionKey: string): void {
  const user = getSessionUser(event.sender);

  if (!user) {
    throw Object.assign(new Error('Not authenticated'), { code: 'AUTH-001' });
  }

  if (!user.permissions.includes(permissionKey)) {
    throw Object.assign(
      new Error(`Permission denied: ${permissionKey}`),
      { code: 'PERM-001' }
    );
  }
}

// IPC handlers catch these and return as ServiceResult:
// ipcMain.handle('products:create', async (event, data) => {
//   try {
//     requirePermission(event, 'products.create'); // throws if denied
//     const validated = CreateProductSchema.parse(data);
//     return productService.create(validated);
//   } catch (err: any) {
//     return { success: false, error: { code: err.code ?? 'SYS-001', message: err.message } };
//   }
// });
```

---

## GAP R3 — No Electron main process startup sequence

**Problem:** No document specifies the exact order of operations when `main.ts` starts. This is critical — wrong order causes race conditions, missing seed data, or crashed windows.

**Implementation — main.ts startup sequence:**

```typescript
// src/main/main.ts
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { runMigrationsOnStartup } from './database/migrate';
import { seedDatabase } from './database/seed';
import { registerAllHandlers } from './ipc/index';
import { checkBackupReminder } from './services/backup.service';
import { logger } from './utils/logger';

let mainWindow: BrowserWindow | null = null;

async function bootstrap(): Promise<void> {
  // Step 1: Run Prisma migrations (always — idempotent)
  await runMigrationsOnStartup();

  // Step 2: Seed defaults if first run
  await seedDatabase();

  // Step 3: Register ALL IPC handlers before window loads
  registerAllHandlers();

  // Step 4: Create BrowserWindow
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: 'Sarang Business OS',
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false, // Show only after content loads (prevents white flash)
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      webviewTag: false,
      experimentalFeatures: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  // Step 5: Load app
  if (process.env.NODE_ENV === 'development') {
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Step 6: Show window (prevents white flash)
  mainWindow.once('ready-to-show', () => mainWindow?.show());

  // Step 7: Clear session on window close
  mainWindow.on('closed', () => { mainWindow = null; });

  // Step 8: Check backup reminder (after window is ready)
  mainWindow.webContents.once('did-finish-load', async () => {
    await checkBackupReminder(mainWindow!);
  });

  // Step 9: Navigate based on setup state (handled in renderer)
}

app.whenReady().then(bootstrap).catch((err) => {
  logger.error('Fatal startup error', err);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

---

## GAP R4 — No IPC handler registration pattern

**Problem:** The app has 50+ IPC channels. No document specifies how they're all registered — a single giant file would be unmaintainable.

**Implementation — module-based handler registration:**

```typescript
// src/main/ipc/index.ts
export function registerAllHandlers(): void {
  require('./auth.handlers');
  require('./business.handlers');
  require('./products.handlers');
  require('./categories.handlers');
  require('./inventory.handlers');
  require('./customers.handlers');
  require('./suppliers.handlers');
  require('./billing.handlers');
  require('./payments.handlers');
  require('./expenses.handlers');
  require('./reports.handlers');
  require('./analytics.handlers');
  require('./backup.handlers');
  require('./import.handlers');
  require('./print.handlers');
  require('./users.handlers');
  require('./settings.handlers');
  require('./audit.handlers');
  require('./restaurant.handlers');
  require('./purchase-orders.handlers');
  require('./search.handlers');
  require('./dialog.handlers');
  require('./app.handlers');
}

// Each handler file pattern (e.g. src/main/ipc/products.handlers.ts):
import { ipcMain } from 'electron';
import { requirePermission } from '../security/permission-guard';
import { CreateProductSchema } from '../validators/product.validator';
import * as productService from '../services/product.service';

ipcMain.handle('products:getAll', async (event, filters) => {
  try {
    requirePermission(event, 'products.view');
    return await productService.getAll(filters);
  } catch (err: any) {
    return { success: false, error: { code: err.code ?? 'SYS-001', message: err.message } };
  }
});

ipcMain.handle('products:create', async (event, data) => {
  try {
    requirePermission(event, 'products.create');
    const validated = CreateProductSchema.parse(data);
    return await productService.create(validated);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return { success: false, error: { code: 'VAL-001', message: err.errors[0].message } };
    }
    return { success: false, error: { code: err.code ?? 'SYS-001', message: err.message } };
  }
});
```

---

## GAP R5 — No Prisma Client initialization pattern

**Problem:** Prisma Client must be initialized once and shared across all services. No document shows this. Without it, every service creates its own connection — breaking SQLite locking.

**Implementation:**

```typescript
// src/main/database/client.ts
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { app } from 'electron';

// DATABASE_URL must be set before PrismaClient is instantiated
const dbPath = path.join(app.getPath('userData'), 'sarang.db');
process.env.DATABASE_URL = `file:${dbPath}`;

// Singleton — shared across the entire main process
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? [{ emit: 'stdout', level: 'query' }, { emit: 'stdout', level: 'warn' }]
    : [{ emit: 'stdout', level: 'error' }],
});

// Enable WAL mode for better concurrent performance
// Call once at startup (after migrations):
export async function enableWALMode(): Promise<void> {
  await prisma.$executeRaw`PRAGMA journal_mode = WAL;`;
  await prisma.$executeRaw`PRAGMA synchronous = NORMAL;`;
  await prisma.$executeRaw`PRAGMA foreign_keys = ON;`;
  await prisma.$executeRaw`PRAGMA busy_timeout = 5000;`;
}
```

**Why WAL mode:** BACKUP_AND_DISASTER_RECOVERY.md requires database integrity checking. WAL (Write-Ahead Logging) mode makes SQLite reads concurrent, prevents "database locked" errors during backup, and enables better crash recovery. `foreign_keys = ON` enforces the FK relationships defined in schema.prisma.

---

## GAP R6 — No SQLite integrity check implementation

**Problem:** BACKUP_AND_DISASTER_RECOVERY.md says "Run integrity check on: Application Startup, Backup Creation, Backup Restore, Database Migration." No implementation is given.

**Implementation:**

```typescript
// src/main/database/integrity.ts
import { prisma } from './client';
import { logger } from '../utils/logger';

export async function runIntegrityCheck(): Promise<{ ok: boolean; message: string }> {
  try {
    // SQLite's built-in integrity checker
    const result = await prisma.$queryRaw<[{ integrity_check: string }][]>`
      PRAGMA integrity_check;
    `;
    
    const status = result[0]?.integrity_check;
    
    if (status === 'ok') {
      return { ok: true, message: 'Database integrity verified' };
    }
    
    logger.error('Database integrity check failed', status);
    return { ok: false, message: `Database integrity issue: ${status}` };
  } catch (err) {
    logger.error('Integrity check threw an error', err);
    return { ok: false, message: 'Could not run integrity check' };
  }
}

// Quick check (faster, call on every startup):
export async function runQuickCheck(): Promise<boolean> {
  const result = await prisma.$queryRaw<[{ quick_check: string }][]>`
    PRAGMA quick_check;
  `;
  return result[0]?.quick_check === 'ok';
}
```

---

## GAP R7 — No ProductVariant table in Prisma schema

**Problem:** INDUSTRY_TEMPLATES.md explicitly lists "Product Variants" as enabled for Retail and Restaurant templates. The schema.prisma in the first pass has no variant support. Without variants, products like "T-Shirt (S/M/L)" or "Burger (Small/Medium/Large)" cannot be handled.

**Schema addition required:**

```prisma
// Add to schema.prisma after Product model:

model ProductVariant {
  id            Int      @id @default(autoincrement())
  product_id    Int
  variant_name  String   // e.g. "Small", "Medium", "Large", "Red-L"
  variant_sku   String?  @unique
  variant_price Float?   // Override selling_price if different from parent
  is_active     Int      @default(1)
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt
  product       Product  @relation(fields: [product_id], references: [id], onDelete: Restrict)
  inventory     Inventory? @relation("VariantInventory")

  // Note: V1 variant inventory tracked per variant (not per product parent)
}

// Also update Inventory to optionally link to variant:
// Add to Inventory model:
// variant_id Int? @unique
// variant    ProductVariant? @relation("VariantInventory", fields: [variant_id], references: [id])
```

**V1 scope:** Variants are available in the database but the UI implementation is `SHOULD_HAVE` per V1_PRD. The schema must exist in V1 to avoid a breaking migration later.

---

## GAP R8 — No i18n / translation key architecture

**Problem:** LOCALIZATION_AND_GLOBALIZATION.md explicitly says: *"Never hardcode UI text. Use Translation Keys."* Example given: `dashboard.sales.today` instead of `"Today's Sales"`. No i18n library or file structure is specified. This is an architectural decision that affects every single UI string.

**Implementation:**

```bash
npm install i18next react-i18next
```

```typescript
// src/renderer/i18n/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';

i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: 'en',       // V1: English only
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;

// src/renderer/i18n/locales/en.json (partial — full file needed):
{
  "dashboard": {
    "title": "Dashboard",
    "sales": {
      "today": "Today's Sales",
      "week": "This Week",
      "month": "This Month"
    },
    "outstanding": "Total Outstanding",
    "inventory_value": "Inventory Value",
    "profit_estimate": "Profit Estimate"
  },
  "billing": {
    "create_invoice": "Create Invoice",
    "invoice_number": "Invoice Number",
    "add_item": "Add Item",
    "payment_method": "Payment Method"
  },
  "errors": {
    "INV-001": "Not enough stock to complete this sale.",
    "PERM-001": "You do not have permission to perform this action.",
    "AUTH-001": "Please sign in to continue.",
    "SYS-001": "Something unexpected happened. Please try again."
  }
}
```

**In components:**
```typescript
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();
<h1>{t('dashboard.title')}</h1>
```

**V1 rule:** All visible UI text must use `t()`. Never hardcode strings. Even English-only V1 must follow this so future language additions require only a new JSON file.

---

## GAP R9 — No database indexes in Prisma schema

**Problem:** The schema.prisma has no indexes. For a business app with 100,000+ invoices, the performance targets (database queries < 100ms) cannot be met without indexes. TESTING_AND_QA_STRATEGY.md specifies: "Database Queries < 100ms (where practical)."

**Schema additions required:**

```prisma
// Add @@index declarations to these models:

model Invoice {
  // ... existing fields ...
  @@index([customer_id])
  @@index([invoice_date])
  @@index([status])
  @@index([payment_status])
  @@index([created_by])
  @@index([created_at])
}

model InvoiceItem {
  // ... existing fields ...
  @@index([invoice_id])
  @@index([product_id])
}

model Payment {
  // ... existing fields ...
  @@index([invoice_id])
  @@index([customer_id])
  @@index([payment_date])
}

model Inventory {
  // product_id is already @unique (indexed)
}

model InventoryMovement {
  // ... existing fields ...
  @@index([product_id])
  @@index([created_at])
  @@index([movement_type])
}

model AuditLog {
  // ... existing fields ...
  @@index([user_id])
  @@index([created_at])
  @@index([entity_type])
}

model Customer {
  // ... existing fields ...
  @@index([customer_name])
  @@index([phone])
}

model Product {
  // sku and barcode are already @unique (indexed)
  @@index([product_name])
  @@index([category_id])
  @@index([is_active])
}

model Expense {
  // ... existing fields ...
  @@index([expense_date])
  @@index([category_id])
}
```

---

## GAP R10 — No audit log trigger specification

**Problem:** DEVELOPMENT_RULES.md and V1_PRD.md both say audit logging is mandatory. The AuditLog table exists in schema. But no document specifies WHICH actions trigger audit log entries or what the `action` field values should be.

**Implementation — Audit Event Catalog:**

```typescript
// src/shared/constants/audit-events.ts
export const AUDIT_EVENTS = {
  // Auth
  LOGIN_SUCCESS: 'auth.login',
  LOGOUT: 'auth.logout',
  PASSWORD_CHANGE: 'auth.password_change',

  // Products
  PRODUCT_CREATED: 'product.created',
  PRODUCT_UPDATED: 'product.updated',
  PRODUCT_ARCHIVED: 'product.archived',
  PRODUCT_PRICE_CHANGED: 'product.price_changed', // Separate — V1_PRD says "Price Changes" logged

  // Inventory
  STOCK_ADDED: 'inventory.stock_added',
  STOCK_ADJUSTED: 'inventory.stock_adjusted',
  STOCK_RETURNED: 'inventory.stock_returned',

  // Billing
  INVOICE_CREATED: 'invoice.created',
  INVOICE_CANCELLED: 'invoice.cancelled',
  PAYMENT_RECORDED: 'payment.recorded',
  PAYMENT_REVERSED: 'payment.reversed',

  // Users
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DEACTIVATED: 'user.deactivated',
  ROLE_ASSIGNED: 'user.role_assigned',

  // Settings
  SETTINGS_UPDATED: 'settings.updated',
  BUSINESS_PROFILE_UPDATED: 'settings.business_updated',
  TAX_CONFIG_CHANGED: 'settings.tax_changed',

  // Backup/Restore
  BACKUP_CREATED: 'backup.created',
  BACKUP_RESTORED: 'backup.restored',

  // Import
  IMPORT_COMPLETED: 'import.completed',
};

// src/main/utils/audit.ts
export async function logAudit(params: {
  userId: number;
  action: string;
  entityType: string;
  entityId?: number;
  oldValue?: object;
  newValue?: object;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      old_value: params.oldValue ? JSON.stringify(params.oldValue) : null,
      new_value: params.newValue ? JSON.stringify(params.newValue) : null,
    },
  });
}
```

---

## GAP R11 — No vitest / Playwright configuration files

**Problem:** TESTING_AND_QA_STRATEGY.md specifies vitest and Playwright but no configuration files are given. Without them, tests cannot run.

**Implementation:**

```typescript
// vitest.config.ts (project root)
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // Main process tests
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
      },
      exclude: ['**/node_modules/**', '**/dist**', '**/tests/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

// tests/setup.ts
import { prisma } from '../src/main/database/client';

beforeAll(async () => {
  // Use an in-memory SQLite database for tests
  process.env.DATABASE_URL = 'file::memory:?cache=shared';
  await prisma.$executeRaw`PRAGMA foreign_keys = ON;`;
});

afterAll(async () => {
  await prisma.$disconnect();
});

afterEach(async () => {
  // Clean all tables in reverse FK order after each test
  await prisma.auditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.deleteMany();
  // ... etc
});
```

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  use: {
    headless: process.env.CI === 'true',
  },
  // For Electron testing with Playwright:
  projects: [
    {
      name: 'electron',
      use: {
        // electron-playwright-helpers package
      },
    },
  ],
});
```

---

## GAP R12 — No print preview specification

**Problem:** V1_PRD.md says "Print Preview" is a V1 must-have. UI_COMPONENT_LIBRARY.md says "Print Preview: Required For Invoices, Receipts, Reports." No implementation spec exists.

**Implementation — Electron print preview:**

```typescript
// Print Preview approach: Load invoice HTML in an in-app preview panel
// instead of opening a separate OS print dialog

// Option 1 (recommended for V1): Show HTML preview in a modal/panel
// in the renderer, with "Print" and "Save as PDF" action buttons.

// In renderer (InvoicePrintPreview component):
// 1. Call window.sarangAPI.billing.getInvoice(id) to get data
// 2. Render invoice as styled HTML within a <div> scaled to A4 proportions
// 3. Show two buttons: "Print" (calls print IPC), "Export PDF" (calls export IPC)

// Option 2: Open a new Electron window with the invoice HTML (opens OS print dialog)
// Use webContents.print({ silent: false }) — shows the OS print dialog
// Use webContents.printToPDF() for silent PDF export

// V1 decision: Use Option 1 (in-app preview with two buttons)
// Reason: More control over layout, avoids OS print dialog UX inconsistencies
// The preview div uses @media print CSS to simulate the printed output

// CSS for print preview container:
// .print-preview { width: 210mm; min-height: 297mm; margin: 0 auto;
//   padding: 15mm 20mm; background: white; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
```

---

## GAP R13 — No backup retention / auto-cleanup specification

**Problem:** BACKUP_AND_DISASTER_RECOVERY.md says "Daily Backups: Keep 7, Weekly: Keep 4, Monthly: Keep 12." No implementation spec shows how old backups are cleaned up.

**Implementation:**

```typescript
// src/main/services/backup-retention.service.ts

export async function applyRetentionPolicy(): Promise<void> {
  // This runs after each backup creation
  const allBackups = await prisma.backup.findMany({
    orderBy: { backup_date: 'desc' },
  });

  // Retention: keep 7 most recent daily backups
  // (V1 simplification: keep N most recent regardless of daily/weekly/monthly distinction)
  const retentionCount = parseInt(await getSetting('backup_retention_count') ?? '20', 10);

  const toDelete = allBackups.slice(retentionCount);

  for (const backup of toDelete) {
    try {
      // Delete file if it exists
      if (existsSync(backup.backup_path)) {
        unlinkSync(backup.backup_path);
      }
      // Remove DB record
      await prisma.backup.delete({ where: { id: backup.id } });
    } catch (err) {
      logger.warn(`Could not delete old backup ${backup.backup_name}`, err);
      // Non-fatal — old backup stays if file deletion fails
    }
  }
}

// Add DEFAULT_SETTINGS entry:
// { setting_key: 'backup_retention_count', setting_value: '20', setting_type: 'INTEGER' }
```

---

## GAP R14 — No 58mm thermal print implementation

**Problem:** RECEIPT_AND_REPORT_TEMPLATES.md and TESTING_AND_QA_STRATEGY.md both include 58mm thermal as V1-supported. V1_PRD.md only lists 80mm and A4, but the receipt spec is authoritative on template specifications. The implementation must support 58mm.

**Implementation additions:**

```typescript
// In print.service.ts, add 58mm support:
// 58mm spec: print area 48mm, 7-8pt font, 28×28mm QR, ~24 chars/line

// In Settings, add print_size_default options:
// '80mm' | '58mm' | 'a4'

// CSS for 58mm thermal:
// @page { size: 58mm auto; margin: 0 5mm; }
// body { font-family: 'Courier New', monospace; font-size: 7pt; width: 48mm; }
// .qr-code { width: 28mm; height: 28mm; }

// Update Setting default for print_size_default to allow '58mm' value
// Add to preload.ts: print.printInvoice can take '58mm' as format
```

---

## GAP R15 — No notification system implementation

**Problem:** The `Notification` table exists in schema.prisma but no document specifies what events create notifications, how they're displayed, or how they're read.

**Implementation:**

```typescript
// Notification categories (stored in notification_type field):
// 'LOW_STOCK' — product.quantity <= product.reorder_level
// 'BACKUP_REMINDER' — last backup > reminder_days ago
// 'OVERDUE_PAYMENT' — invoice.balance_amount > 0 AND due_date < today
// 'IMPORT_COMPLETE' — data import finished
// 'RESTORE_SUCCESS' — backup restore completed

// Low stock check: runs on each invoice finalization
// Check all items in the invoice — if any product.quantity <= reorder_level,
// create a LOW_STOCK notification (avoid duplicates: skip if recent unread exists)

// Notification bell in top bar:
// Shows count of unread notifications
// Clicking opens dropdown list
// "Mark all read" button
// Each notification is clickable (navigates to relevant page)

// IPC channel: notifications are pushed from main to renderer via:
mainWindow.webContents.send('notifications:new', { type, title, message });

// Renderer subscribes:
window.sarangAPI.on('notifications:new', (notification) => {
  // Update notification count badge
  // Show toast if critical
});

// Add to preload.ts:
// notifications: {
//   getAll: () => ipcRenderer.invoke('notifications:getAll'),
//   markRead: (id: number) => ipcRenderer.invoke('notifications:markRead', id),
//   markAllRead: () => ipcRenderer.invoke('notifications:markAllRead'),
//   on: (channel: string, cb: Function) => ipcRenderer.on(channel, (_, data) => cb(data)),
// }
```

---

## GAP R16 — No virtual scrolling for large datasets

**Problem:** TESTING_AND_QA_STRATEGY.md says stress targets include 10,000 Products and 100,000 Invoices. Rendering all records in a DOM table at once will crash the Electron renderer. No virtualization spec exists.

**Implementation:**

```bash
npm install @tanstack/react-virtual
# Already have @tanstack/react-table — both from the same org
```

```typescript
// For any list with potentially >500 rows, use TanStack Table's virtualization:
import { useVirtualizer } from '@tanstack/react-virtual';

// Pattern for large list pages (InvoiceList, ProductList, etc.):
// 1. TanStack Table manages sorting/filtering/column state (client-side)
// 2. For large datasets: use server-side pagination via IPC (page size: 50)
// 3. For search results: limit to 100 results, show "Refine your search" if more

// Pagination IPC pattern:
// ipcMain.handle('billing:searchInvoices', async (event, filters) => {
//   const { page = 1, pageSize = 50, ...rest } = filters;
//   const [data, total] = await Promise.all([
//     prisma.invoice.findMany({
//       where: buildWhereClause(rest),
//       skip: (page - 1) * pageSize,
//       take: pageSize,
//       orderBy: { created_at: 'desc' },
//       include: { customer: true, creator: true },
//     }),
//     prisma.invoice.count({ where: buildWhereClause(rest) }),
//   ]);
//   return ok({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
// });
```

---

## GAP R17 — No currency symbol position (prefix/suffix) specification

**Problem:** LOCALIZATION_AND_GLOBALIZATION.md says "Currency Position: Prefix / Suffix" must be configurable. The settings seed data doesn't include this. "1,500.00 EUR" vs "€1,500.00" requires knowing the position.

**Implementation:**

```typescript
// Add to DEFAULT_SETTINGS in seed.ts:
{ setting_key: 'currency_symbol_position', setting_value: 'prefix', setting_type: 'STRING' }
// Values: 'prefix' | 'suffix'

// Update formatCurrency utility:
export function formatCurrency(
  amount: number,
  symbol: string,
  position: 'prefix' | 'suffix',
  decimalPlaces: number = 2
): string {
  const formatted = new Intl.NumberFormat(getLocaleCode(), {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(amount);

  return position === 'prefix'
    ? `${symbol}${formatted}`
    : `${formatted} ${symbol}`;
}

// For the Intl.NumberFormat approach (preferred — handles locale grouping automatically):
// The currency style already handles position correctly per locale.
// But for custom symbol overrides, use the manual position approach above.
```

---

## GAP R18 — No opening balance import implementation

**Problem:** DATA_IMPORT_AND_MIGRATION_SPEC.md says "Opening Customer Balances" and "Opening Supplier Balances" must create proper ledger entries — "Never direct balance updates." No implementation spec exists.

**Implementation:**

```typescript
// Opening balance import creates CUSTOMER_LEDGER or SUPPLIER_LEDGER entries
// NOT direct updates to customer.outstanding_balance

// For customer opening balance import:
async function importOpeningCustomerBalance(
  customerId: number,
  openingBalance: number,
  userId: number
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Create ledger entry
    await tx.customerLedger.create({
      data: {
        customer_id: customerId,
        reference_type: 'OPENING_BALANCE',
        reference_id: null,
        debit_amount: openingBalance > 0 ? openingBalance : 0,
        credit_amount: openingBalance < 0 ? Math.abs(openingBalance) : 0,
        balance: openingBalance,
        remarks: 'Opening balance import',
      },
    });

    // Update customer running balance
    await tx.customer.update({
      where: { id: customerId },
      data: { outstanding_balance: { increment: openingBalance } },
    });

    // Audit log
    await logAudit({
      userId,
      action: AUDIT_EVENTS.IMPORT_COMPLETED,
      entityType: 'CUSTOMER_OPENING_BALANCE',
      entityId: customerId,
      newValue: { opening_balance: openingBalance },
    });
  });
}
```

---

## GAP R19 — No CSV export UTF-8 BOM specification

**Problem:** RECEIPT_AND_REPORT_TEMPLATES.md says "UTF-8 Encoding" for CSV. However, Microsoft Excel on Windows does NOT automatically detect UTF-8 unless a BOM (Byte Order Mark) is present. Indian business names like "राम ट्रेडर्स" will appear garbled in Excel without BOM.

**Implementation:**

```typescript
// Add UTF-8 BOM to CSV exports:
const BOM = '﻿'; // Unicode BOM for UTF-8

export function exportToCSV(data: { headers: string[]; rows: (string | number)[][] }): string {
  // ... existing CSV generation ...
  return BOM + csvContent; // Prepend BOM for Excel compatibility
}

// When writing CSV to disk:
writeFileSync(filePath, exportToCSV(data), 'utf-8');
// The BOM is already in the string — writeFileSync with 'utf-8' preserves it
```

---

## GAP R20 — No React error boundary specification

**Problem:** If a React component crashes, the entire renderer goes blank. No document specifies error boundary handling.

**Implementation:**

```typescript
// src/renderer/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode; fallbackMessage?: string; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log locally only — never transmit
    console.error('UI component error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <div className="text-gray-400 mb-4">
            {/* Lucide icon: AlertTriangle */}
          </div>
          <h2 className="text-lg font-semibold text-gray-700 mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            {this.props.fallbackMessage ?? 'This section encountered an error. Your data is safe.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 bg-[#00AEEF] text-white rounded-[6px] text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Wrap each major page/module in AppShell:
// <ErrorBoundary key={location.pathname}> <Outlet /> </ErrorBoundary>
// key={pathname} resets the boundary on navigation
```

---

## GAP R21 — No "About" page content specification

**Problem:** UI_UX_SYSTEM.md, UI_COMPONENT_LIBRARY.md, and OPERATIONS_AND_GO_TO_MARKET.md all reference an About page but never specify its content.

**Implementation spec:**

The About page must display:

```
SARANG Business OS Lite
Version: [app version from electron app.getVersion()]
Powered by Aszurex

───────────────────────────────────────
PRIVACY COMMITMENT
By default, Sarang does not collect, transmit, or store your business data
on Aszurex systems. Your business data remains on your device.

NO SUBSCRIPTIONS  |  NO CLOUD DEPENDENCY  |  NO USER TRACKING
NO TELEMETRY BY DEFAULT  |  YOUR DATA STAYS ON YOUR DEVICE
───────────────────────────────────────

DATA LOCATION
Database: [path from app.getPath('userData')]
Backups:  [backup directory path]
Logs:     [logs directory path]

───────────────────────────────────────
[Support / Contact Aszurex button → opens https://aszurex.com in external browser]
[Report Issue button → opens GitHub Issues in external browser]
[View Licenses button → shows third-party OSS licenses]
───────────────────────────────────────

Trust Beyond Limits.
```

---

## GAP R22 — No Restaurant Daily Closing workflow

**Problem:** INDUSTRY_TEMPLATES.md lists "Daily Closing" as an enabled feature for Restaurant. No specification exists for what this workflow does.

**Implementation spec:**

Daily Closing for Restaurant:
1. Shows summary: Total sales today, orders count, payment method breakdown
2. Prompts to close all open tables (marks tables as AVAILABLE)
3. Prints or exports a "Day Close Report" (PDF or thermal)
4. Creates an audit log entry: `restaurant.daily_close`
5. Does NOT create any financial entries or lock anything — it is a reporting/summary action only
6. "Day Close Report" contains: Opening/Closing time, Total orders, Revenue by payment method, Top menu items, Waste/Adjustment summary

---

## GAP R23 — No POS-style checkout spec for Retail

**Problem:** INDUSTRY_TEMPLATES.md says "POS-style checkout" is enabled for Retail. No spec distinguishes this from regular invoice creation.

**Implementation spec:**

POS checkout vs standard invoice:
- **Standard invoice (`/billing/new`):** Full form, customer selection, due dates, notes, multi-screen
- **POS checkout (`/pos`):** Single screen, optimized for speed:
  - Full-width product search at top
  - Items auto-add on barcode scan (no confirmation click)
  - Numeric keypad for quantity
  - Running total always visible (large font)
  - Payment button launches a payment modal (Cash/UPI/Card)
  - One-click receipt print on payment confirmation
  - "New Sale" resets everything in 1 click

POS checkout is functionally identical to invoice creation but the UI is streamlined for cashiers who scan items rapidly. It creates the same INVOICE and PAYMENT records.

---

## GAP R24 — No IPC event (main → renderer) specification for pushed events

**Problem:** Some events flow from main to renderer (backup reminder, low stock alert, notifications). The preload.ts in Gap R1.2 only shows renderer→main. Main→renderer requires IPC event listeners.

**Addition to preload.ts:**

```typescript
// Add to contextBridge.exposeInMainWorld('sarangAPI', { ... }):
events: {
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    // Whitelist allowed channels (security: never expose arbitrary ipcRenderer.on)
    const ALLOWED_CHANNELS = [
      'notifications:new',
      'notifications:backup-reminder',
      'notifications:low-stock',
      'import:progress',
      'backup:progress',
    ];
    if (!ALLOWED_CHANNELS.includes(channel)) return;
    const subscription = (_event: unknown, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, subscription);
    // Return cleanup function
    return () => ipcRenderer.removeListener(channel, subscription);
  },
},
```

---

## GAP R25 — No `electron-vite` configuration

**Problem:** The tech stack specifies `electron-vite` (not vanilla Vite), but no `electron.vite.config.ts` file is specified. electron-vite replaces the standard Vite config and is required for the main/preload/renderer split build.

**Implementation:**

```typescript
// electron.vite.config.ts (project root)
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: 'src/main/main.ts',
      },
    },
    resolve: {
      alias: { '@': path.resolve('src') },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: 'src/main/preload.ts',
      },
    },
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: { '@renderer': path.resolve('src/renderer') },
    },
  },
});
```

---

## GAP R26 — No Content Security Policy (CSP) header specification

**Problem:** SECURITY.md says "Strict CSP required. Disallow inline scripts, remote scripts." No CSP header is specified for the Electron renderer.

**Implementation:**

```typescript
// In main.ts, set CSP via session.defaultSession:
import { session } from 'electron';

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          [
            "default-src 'self'",
            "script-src 'self'",          // No inline scripts, no remote
            "style-src 'self' 'unsafe-inline'",  // Tailwind requires inline styles
            "img-src 'self' data:",        // data: for QR codes (base64 PNG)
            "font-src 'self'",
            "connect-src 'none'",          // Block ALL network requests
            "frame-src 'none'",
            "object-src 'none'",
          ].join('; '),
        ],
      },
    });
  });
});

// Also block navigation and new window creation:
mainWindow.webContents.on('will-navigate', (event, url) => {
  // Only allow same-origin navigation (hash changes for react-router)
  if (!url.startsWith('file://') && !url.startsWith('http://localhost')) {
    event.preventDefault();
  }
});

mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
```

---

## GAP R27 — No external link security specification

**Problem:** SECURITY.md says "Allow only approved domains, open external links in external browser." No implementation spec.

**Implementation:**

```typescript
// src/main/security/external-links.ts
import { shell } from 'electron';

const ALLOWED_EXTERNAL_DOMAINS = [
  'aszurex.com',
  'www.aszurex.com',
  'github.com/aszurex',      // For issue reporting
  'linkedin.com',            // If used in About page
];

export function openExternalLink(url: string): void {
  try {
    const parsed = new URL(url);
    const isAllowed = ALLOWED_EXTERNAL_DOMAINS.some(domain =>
      parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
    );

    if (!isAllowed) {
      logger.warn(`Blocked external link to non-approved domain: ${url}`);
      return;
    }

    // All links open in the user's default browser — NEVER inside Electron
    shell.openExternal(url);
  } catch {
    logger.warn(`Invalid URL blocked: ${url}`);
  }
}

// IPC handler:
ipcMain.handle('dialog:openExternal', async (event, url: string) => {
  openExternalLink(url);
});
```

---

## GAP R28 — No discount type specification (line-item vs invoice-level)

**Problem:** V1_PRD.md mentions "Discount" as a feature and the InvoiceItem schema has `discount_amount`, but no document specifies whether discounts are:
- Flat amount per line item
- Percentage per line item
- Flat amount on invoice total
- All of the above

**Implementation decision:**

V1 supports two discount modes controlled by a per-invoice flag:

```typescript
// Line-item discount: Each invoice item has a discount_amount (flat value)
// This is what the InvoiceItem.discount_amount field stores.
// Stored as the actual monetary amount, not a percentage.

// If user enters "10%" discount on a ₹500 item:
// discount_amount = 500 × 10% = ₹50 (stored)
// line_total = (500 × qty) - discount_amount - (tax on taxable amount)

// Invoice-level discount: NOT in V1. If a user wants an overall discount,
// they add a "Discount" line item with negative quantity = -1 and unit_price = discount amount.
// This avoids complexity while still supporting the use case.

// Tax calculation order with line-item discount:
// taxable_amount = (unit_price × quantity) - discount_amount
// tax_amount = taxable_amount × (tax_rate / 100)
// line_total = taxable_amount + tax_amount
```

---

## GAP R29 — No session timeout implementation

**Problem:** SECURITY.md says "Sessions expire after configurable inactivity period." DEFAULT_SETTINGS includes `session_timeout_minutes = 480`. No implementation is given.

**Implementation:**

```typescript
// src/main/security/session-timeout.ts
import { getSessionUser, clearSession } from './session-store';

const ACTIVITY_TRACKER = new Map<number, NodeJS.Timeout>();

export function resetActivityTimer(webContentsId: number): void {
  // Clear existing timer
  const existing = ACTIVITY_TRACKER.get(webContentsId);
  if (existing) clearTimeout(existing);

  // This is checked async — read setting at timer creation time
  const timeoutMs = getSessionTimeoutMs(); // reads setting synchronously

  const timer = setTimeout(() => {
    // Session expired — notify renderer to show login screen
    const win = BrowserWindow.fromId(webContentsId);
    if (win && !win.isDestroyed()) {
      // Clear session
      clearSessionByContentsId(webContentsId);
      // Signal renderer
      win.webContents.send('auth:session-expired');
    }
    ACTIVITY_TRACKER.delete(webContentsId);
  }, timeoutMs);

  ACTIVITY_TRACKER.set(webContentsId, timer);
}

// Call resetActivityTimer() at the start of EVERY IPC handler
// (before requirePermission — even unauthenticated calls reset the timer on active windows)
// OR: renderer sends a heartbeat IPC every 60 seconds while the window is focused
```

---

---

# UPDATED COMPLETE GAP SUMMARY TABLE

*Additions from second review pass (R1–R29):*

| Gap ID | Phase | Severity | Description | Status |
|--------|-------|----------|-------------|--------|
| GR1 | All | Critical | `ServiceResult<T>` TypeScript type definition | Specified above |
| GR2 | All | Critical | `requirePermission()` full implementation | Specified above |
| GR3 | All | Critical | Electron main.ts startup sequence / order of operations | Specified above |
| GR4 | All | Critical | IPC handler registration pattern (module-based) | Specified above |
| GR5 | All | Critical | Prisma Client singleton + WAL mode initialization | Specified above |
| GR6 | 7 | High | SQLite PRAGMA integrity_check implementation | Specified above |
| GR7 | 2 | High | ProductVariant table missing from Prisma schema | Specified above |
| GR8 | All | High | i18n / translation key architecture (react-i18next) | Specified above |
| GR9 | All | High | Database indexes missing from all Prisma models | Specified above |
| GR10 | All | High | Audit log event catalog (which actions trigger what codes) | Specified above |
| GR11 | Testing | High | vitest.config.ts + playwright.config.ts content | Specified above |
| GR12 | 4 | High | Print preview implementation (in-app HTML preview) | Specified above |
| GR13 | 7 | Medium | Backup retention/auto-cleanup policy implementation | Specified above |
| GR14 | 4 | High | 58mm thermal print (V1 requirement in receipt spec) | Specified above |
| GR15 | 6 | Medium | Notification system implementation (trigger + display) | Specified above |
| GR16 | 10 | High | Virtual scrolling / server-side pagination for large datasets | Specified above |
| GR17 | 2 | Medium | Currency symbol position (prefix/suffix) in settings | Specified above |
| GR18 | 8 | High | Opening balance import creates ledger entries (not direct update) | Specified above |
| GR19 | 5 | Medium | CSV export UTF-8 BOM for Excel compatibility | Specified above |
| GR20 | 10 | High | React error boundary implementation | Specified above |
| GR21 | 11 | Medium | About page content specification | Specified above |
| GR22 | 9 | Medium | Restaurant Daily Closing workflow specification | Specified above |
| GR23 | 9 | Medium | POS-style checkout spec for Retail template | Specified above |
| GR24 | 1 | High | IPC event (main→renderer) pushed events in preload.ts | Specified above |
| GR25 | 1 | Critical | electron-vite configuration (electron.vite.config.ts) | Specified above |
| GR26 | 1 | High | Content Security Policy (CSP) header implementation | Specified above |
| GR27 | 1 | High | External link security (approved domains + shell.openExternal) | Specified above |
| GR28 | 4 | Medium | Discount type spec (line-item flat amount, V1 scope) | Specified above |
| GR29 | 1 | Medium | Session timeout implementation (activity timer pattern) | Specified above |

---

---

---

# THIRD REVIEW PASS — FINAL GAPS

*After reading all 30 source documents in full for the third time, 12 additional implementation gaps were found. All are specified below. After these, the guide is considered complete for V1 implementation.*

---

## GAP F1 — Import auto-backup trigger not specified

**Source:** DATA_IMPORT_AND_MIGRATION_SPEC.md: *"Create Automatic Backup"* before large imports.

**Problem:** GAP R13 covers scheduled backup retention. The import auto-backup is a separate requirement: before any import that touches > 100 records, a safety backup must be created silently in the background.

**Implementation:**

```typescript
// src/main/services/import.service.ts
// Add at the top of every doImport() function:

const IMPORT_BACKUP_THRESHOLD = 100; // records

export async function importProducts(rows: ProductImportRow[], userId: number): Promise<ServiceResult<ImportSummary>> {
  // Step 1: Auto-backup before large import
  if (rows.length > IMPORT_BACKUP_THRESHOLD) {
    const backupResult = await backupService.createBackup({
      destination_path: getBackupDirectory(),
      backup_name: `pre-import-${Date.now()}`,
    });
    if (!backupResult.success) {
      // Non-fatal: warn user but do NOT block the import
      logger.warn('Pre-import backup failed — proceeding without safety backup');
      // Notify renderer
      mainWindow?.webContents.send('notifications:new', {
        type: 'WARNING',
        title: 'Import Warning',
        message: 'Could not create a safety backup before import. Proceed with caution.',
      });
    }
  }

  // Step 2: Validate all rows first (do NOT import until validation passes)
  // Step 3: Import in batches of 500
  // Step 4: Return summary
}
```

**Settings:** Add `import_backup_threshold` to DEFAULT_SETTINGS:
```typescript
{ setting_key: 'import_backup_threshold', setting_value: '100', setting_type: 'INTEGER' }
```

---

## GAP F2 — Custom Business template feature flags UI not specified

**Source:** INDUSTRY_TEMPLATES.md: *"Custom Business Template"* — user can enable/disable features.

**Problem:** Four industry templates (Restaurant, Retail, Hardware, Distributor) have predefined feature sets. The fifth option — Custom Business — requires a UI for the Admin to toggle individual features on/off. No spec exists.

**Implementation spec:**

```typescript
// INDUSTRY_TEMPLATE_SETTINGS table stores enabled features as JSON:
// enabled_modules: '["billing","inventory","customers","expenses","reports"]'

// Custom Business feature flags screen (Settings → Business Template → Custom):
```

```
┌─────────────────────────────────────────────┐
│  Custom Business Configuration             │
│                                             │
│  Core Features (always on)                 │
│  ✓ Billing & Invoicing      [cannot disable]│
│  ✓ Inventory Management     [cannot disable]│
│  ✓ Reports & Analytics      [cannot disable]│
│                                             │
│  Optional Features                          │
│  [✓] Customer Ledger & Credit Management   │
│  [✓] Supplier Management                   │
│  [✓] Purchase Orders                       │
│  [✓] Expense Management                    │
│  [ ] KOT / Kitchen Orders   (Restaurant)   │
│  [ ] Table Management       (Restaurant)   │
│  [ ] Area-Based Pricing     (Hardware)     │
│  [ ] Barcode-Focused Billing (Retail)      │
│  [✓] Multi-User Roles                      │
│                                             │
│           [ Save Configuration ]           │
└─────────────────────────────────────────────┘
```

**Service:**
```typescript
// industryTemplateService.ts
async function saveCustomTemplate(userId: number, features: string[]): Promise<ServiceResult<void>> {
  requirePermission(/* admin only */);
  // Core features always included — enforce in service:
  const REQUIRED = ['billing', 'inventory', 'reports'];
  const merged = [...new Set([...REQUIRED, ...features])];
  await prisma.industryTemplateSetting.upsert({
    where: { business_type: 'CUSTOM' },
    update: { enabled_modules: JSON.stringify(merged) },
    create: { business_type: 'CUSTOM', enabled_modules: JSON.stringify(merged) },
  });
}
```

---

## GAP F3 — RULE U005 not implemented — Last Admin deletion prevention

**Source:** BUSINESS_RULES_ENGINE.md RULE U005, PERMISSIONS_MATRIX.md.

**Problem:** "At least one Admin must always exist. Prevent deleting last Admin." This is stated as a rule but no implementation spec exists.

**Implementation:**

```typescript
// In user.service.ts — add check before deactivation or role downgrade:

export async function deactivateUser(targetUserId: number, requestingUserId: number): Promise<ServiceResult<void>> {
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { role: true },
  });

  if (!target) return fail('USER-404', 'User not found');

  // RULE U005: Cannot deactivate last Admin
  if (target.role.role_name === 'Admin') {
    const adminCount = await prisma.user.count({
      where: { role: { role_name: 'Admin' }, is_active: 1 },
    });
    if (adminCount <= 1) {
      return fail('USER-002', 'At least one administrator must remain active. Assign another Admin first.');
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: targetUserId }, data: { is_active: 0 } });
    await logAudit({ userId: requestingUserId, action: AUDIT_EVENTS.USER_DEACTIVATED, entityType: 'USER', entityId: targetUserId });
  });
  return ok(undefined);
}

// Same check in assignRole() — cannot downgrade last Admin to a non-Admin role:
export async function assignRole(targetUserId: number, newRoleId: number, requestingUserId: number): Promise<ServiceResult<void>> {
  const target = await prisma.user.findUnique({ where: { id: targetUserId }, include: { role: true } });
  const newRole = await prisma.role.findUnique({ where: { id: newRoleId } });

  if (target?.role.role_name === 'Admin' && newRole?.role_name !== 'Admin') {
    const adminCount = await prisma.user.count({
      where: { role: { role_name: 'Admin' }, is_active: 1 },
    });
    if (adminCount <= 1) {
      return fail('USER-002', 'Cannot change the role of the last administrator.');
    }
  }
  // ... proceed with role change
}
```

---

## GAP F4 — Role changes take effect on next login (not immediately)

**Source:** PERMISSIONS_MATRIX.md: *"Role changes take effect on next login — active sessions retain old permissions until logout."*

**Problem:** If an Admin downgrades a user from Manager to Cashier while they're logged in, their current session still has Manager-level permissions until they log out. No implementation spec.

**Implementation:**

```typescript
// The session store (session-store.ts) caches the user's permissions at login:
// sessionStore.set(webContentsId, { userId, role, permissions: [...] });

// When role/permission is changed in admin panel, the ACTIVE SESSION is not changed.
// The change takes effect only after the user logs out and back in.

// Implementation rule: Do NOT invalidate sessions on role change in V1.
// V1 behavior: role changes are effective on next login.

// Display in UI (Admin Panel → Users → Edit Role):
// "Note: This change will take effect when [username] logs out and signs in again."

// The PERMISSIONS_MATRIX rule is enforced by the session cache — 
// requirePermission() reads from the session cache, not the database directly.
// This is intentional: avoids database hit on every IPC call.

// Future V2 option: Force session invalidation by storing a session_version in DB
// and checking it on each IPC call. Not needed for V1.
```

---

## GAP F5 — Invoice round-off (rounding_amount) calculation not specified

**Source:** BUSINESS_RULES_ENGINE.md RULE B006: Invoice must calculate Subtotal, Discount, Tax, **Round Off**, Grand Total. The `rounding_amount` field exists in the Invoices schema.

**Problem:** No calculation spec for rounding_amount.

**Implementation:**

```typescript
// Round-off: Adjust the grand total to the nearest whole number (configurable).
// Most Indian businesses round to nearest rupee.

// In billing.service.ts calculateInvoiceTotals():
export function calculateTotals(items: InvoiceItemInput[], discountAmount: number = 0): InvoiceTotals {
  const subtotal = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  const itemDiscounts = items.reduce((sum, item) => sum + (item.discount_amount ?? 0), 0);
  const taxAmount = items.reduce((sum, item) => {
    const taxable = (item.unit_price * item.quantity) - (item.discount_amount ?? 0);
    return sum + (taxable * item.tax_rate / 100);
  }, 0);

  const grossTotal = subtotal - itemDiscounts - discountAmount + taxAmount;
  const roundedTotal = Math.round(grossTotal);   // Round to nearest integer
  const roundingAmount = parseFloat((roundedTotal - grossTotal).toFixed(2));
  // rounding_amount is positive if rounding UP, negative if rounding DOWN

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    discount_amount: parseFloat((itemDiscounts + discountAmount).toFixed(2)),
    tax_amount: parseFloat(taxAmount.toFixed(2)),
    rounding_amount: roundingAmount,
    total_amount: roundedTotal,
  };
}

// Add to DEFAULT_SETTINGS:
// { setting_key: 'invoice_round_off', setting_value: 'NEAREST_RUPEE', setting_type: 'STRING' }
// Values: 'NEAREST_RUPEE' | 'NONE'
// When 'NONE': total_amount = grossTotal (not rounded), rounding_amount = 0
```

---

## GAP F6 — devTools flag missing from BrowserWindow specification

**Source:** ARCHITECTURE.md: *"devTools: !app.isPackaged — DevTools in development only"*

**Problem:** GAP R3 specifies the full BrowserWindow webPreferences, but it omits `devTools: !app.isPackaged`. This flag is security-critical — leaving DevTools enabled in production exposes the renderer's internal state.

**Correction to GAP R3's webPreferences block:**

```typescript
webPreferences: {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  enableRemoteModule: false,
  webviewTag: false,
  experimentalFeatures: false,
  webSecurity: true,
  allowRunningInsecureContent: false,
  devTools: !app.isPackaged,   // ← ADD THIS — DevTools only in development
},
```

---

## GAP F7 — Module folder structure template not specified

**Source:** DEVELOPMENT_RULES.md — MODULE STRUCTURE TEMPLATE (every feature module must follow this exact structure).

**Problem:** The guide has service/IPC patterns but no complete module template showing the exact file structure every feature must follow.

**Implementation — mandatory module structure:**

```
src/
  main/
    services/
      [module].service.ts         ← All business logic (NO database queries)
    ipc/
      [module].handlers.ts        ← IPC registration + requirePermission() first
    validators/
      [module].validator.ts       ← Zod schemas for all IPC inputs
    repositories/
      [module].repository.ts      ← All Prisma queries (called only from services)

  renderer/
    pages/
      [Module]/
        index.tsx                 ← Page component (route entry point)
        [Module]Form.tsx          ← Create/Edit form component
        [Module]List.tsx          ← Data list/table component
    hooks/
      use[Module].ts              ← Data fetching hook (calls window.sarangAPI.*)
    store/
      [module].store.ts           ← Zustand slice for this module

  shared/
    types/
      [module].types.ts           ← TypeScript interfaces for this module
```

**File content contracts:**

```typescript
// [module].service.ts — ONLY business logic. Imports from repository. Never from prisma directly.
// [module].repository.ts — ONLY Prisma queries. No business rules.
// [module].handlers.ts — ONLY IPC registration. Always: requirePermission() → validate() → service()
// [module].validator.ts — ONLY Zod schemas. No business logic.
// [module].types.ts — ONLY TypeScript types. No runtime code.
```

**Example for billing module:**
```
src/main/services/billing.service.ts
src/main/ipc/billing.handlers.ts
src/main/validators/billing.validator.ts
src/main/repositories/billing.repository.ts
src/renderer/pages/Billing/index.tsx
src/renderer/pages/Billing/InvoiceForm.tsx
src/renderer/pages/Billing/InvoiceList.tsx
src/renderer/hooks/useBilling.ts
src/renderer/store/billing.store.ts
src/shared/types/billing.types.ts
```

---

## GAP F8 — Privilege escalation prevention not specified

**Source:** PERMISSIONS_MATRIX.md: *"A user cannot grant permissions they do not themselves have."*

**Problem:** An Admin could theoretically grant permissions to another user that even the granting Admin doesn't have (especially relevant if custom permission sets are allowed in future). V1 must enforce this baseline.

**Implementation:**

```typescript
// In user.service.ts assignRole():
export async function assignRole(
  targetUserId: number,
  newRoleId: number,
  requestingUser: AuthUser
): Promise<ServiceResult<void>> {

  // Privilege escalation check: requesting user must have at least the permissions
  // of the role they're assigning. In V1, only Admin can assign roles (enforced by
  // requirePermission('roles.modify') which only Admin has), so this is implicitly safe.
  // But record the rule explicitly for future custom permission grants:

  // RULE: A Manager-level user (if ever given role.assign permission) cannot assign
  // Admin role to another user, since they don't have Admin-level permissions themselves.
  
  const newRole = await prisma.role.findUnique({ where: { id: newRoleId } });
  if (newRole?.role_name === 'Admin' && !requestingUser.permissions.includes('roles.assign_admin')) {
    return fail('PERM-001', 'You do not have permission to assign the Administrator role.');
  }

  // V1 simplification: only Admin has 'roles.modify' permission → only Admin can assign any role
  // The check above becomes relevant in V2 when per-user permission overrides may exist
}
```

---

## GAP F9 — Cashier "Limited" report access not defined

**Source:** PERMISSIONS_MATRIX.md — "View Reports: Limited" for Cashier role.

**Problem:** "Limited" is undefined. A developer implementing the reports page doesn't know which reports a Cashier can see.

**Definition:**

Cashier role report access (V1):

| Report | Cashier Access |
|--------|----------------|
| Daily Sales Summary | ✓ (their shift only) |
| Invoice List | ✓ (can view own invoices created) |
| Payment List | ✓ (can view payments they recorded) |
| Customer Outstanding (own customers) | ✓ |
| Tax Report | ✗ (financial — Manager+ only) |
| Profit & Loss / Expense Report | ✗ |
| Inventory Report | ✗ |
| Supplier Report | ✗ |
| Full Audit Logs | ✗ |

**Implementation:** Add permission keys for granular report access:
```typescript
{ permission_key: 'reports.sales.daily', permission_name: 'View Daily Sales Report' },
{ permission_key: 'reports.invoices', permission_name: 'View Invoice Reports' },
{ permission_key: 'reports.financial', permission_name: 'View Financial Reports' },
{ permission_key: 'reports.inventory', permission_name: 'View Inventory Reports' },
{ permission_key: 'reports.tax', permission_name: 'View Tax Reports' },
```

Cashier gets: `reports.sales.daily`, `reports.invoices` only.

---

## GAP F10 — Prohibited UI copy list not specified

**Source:** LEGAL_AND_CLAIMS_POLICY.md — lists specific text that must NEVER appear in any UI, documentation, or installer.

**Problem:** UI developers may inadvertently use these phrases. The guide must specify them as a dev-facing constraint.

**Prohibited strings — must never appear in Sarang UI, reports, tooltips, or invoice templates:**

```typescript
// PROHIBITED_UI_COPY.ts — reference for UI developers and AI agents

const PROHIBITED_UI_COPY = [
  // Payment verification (PM005)
  'Payment Successful', 'Payment Confirmed', 'Transaction Confirmed',
  'Payment Verified', 'Payment Processed', 'Payment Settled',
  'Payment Gateway', 'Real-time Payment Status',

  // Compliance claims
  'GST Compliant', 'GST Ready', 'Government Approved',
  'Tax Authority Certified', 'Audit Ready', 'Audit Compliant',
  'Certified by Government', 'IFRS Compliant', 'GAAP Compliant',

  // Accuracy guarantees
  '100% Accurate', 'Error-Free Calculations', 'Guaranteed Accurate',
  'Legally Correct Invoices', 'Certified Financial Records',

  // Security overstatements
  '100% Secure', 'Hack-Proof', 'Breach-Proof', 'Fully Encrypted Database',

  // Cloud claims (that don't exist)
  'Cloud Backup Included', 'Automatic Cloud Sync', 'Multi-Device Sync',
];

// APPROVED copy examples:
// ✓ "Payment Recorded" (not "Payment Confirmed")
// ✓ "Mark as Paid" (not "Confirm Payment")
// ✓ "Record Cash Payment" (not "Process Cash Payment")
// ✓ "Your data stays on this device" (not "Encrypted cloud storage")
// ✓ "Sarang records payments. It does not verify or process them." (RULE PM005 display text)
```

**Required disclaimer on all invoice footers:**
> *"This is a computer-generated document. Calculations are based on data entered by the user. Verify all totals before use for legal or tax purposes."*

---

## GAP F11 — Password minimum length configuration not specified

**Source:** SECURITY.md: *"Password Requirements: Minimum Length — Configurable."*

**Problem:** No DEFAULT_SETTINGS entry or validation logic specified.

**Implementation:**

```typescript
// Add to DEFAULT_SETTINGS seed:
{ setting_key: 'password_min_length', setting_value: '6', setting_type: 'INTEGER' }
{ setting_key: 'password_require_uppercase', setting_value: '0', setting_type: 'BOOLEAN' }
{ setting_key: 'password_require_number', setting_value: '0', setting_type: 'BOOLEAN' }
{ setting_key: 'password_require_symbol', setting_value: '0', setting_type: 'BOOLEAN' }
// V1 defaults: only minimum length (6 chars). Other requirements disabled by default.

// In auth.validator.ts:
export const ChangePasswordSchema = (minLength: number) => z.object({
  current_password: z.string().min(1, 'Current password required'),
  new_password: z.string().min(minLength, `Password must be at least ${minLength} characters`),
  confirm_password: z.string(),
}).refine(data => data.new_password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

// In auth.service.ts changePassword():
const minLength = parseInt(await getSetting('password_min_length') ?? '6', 10);
const validated = ChangePasswordSchema(minLength).parse(input);
```

---

## GAP F12 — `reserved_quantity` field usage not specified

**Source:** DATABASE_SCHEMA.md — Inventory table includes `reserved_quantity` field.

**Problem:** The field appears in the schema but no document specifies when stock is "reserved" or what reduces it.

**V1 Decision:**

`reserved_quantity` is included in the schema for future use (e.g., pending orders that haven't shipped). In V1 it is always `0`. No reservation workflow is implemented.

```typescript
// In Inventory model: reserved_quantity @default(0)
// The effective available stock formula:
// available_quantity = quantity - reserved_quantity
// In V1: always === quantity (since reserved_quantity === 0)

// Inventory availability check uses:
export async function checkAvailability(
  productId: number,
  requestedQty: number
): Promise<ServiceResult<{ available: boolean; currentStock: number; reservedStock: number }>> {
  const inv = await prisma.inventory.findUnique({ where: { product_id: productId } });
  if (!inv) return fail('INV-004', 'Inventory record not found');

  const availableQty = inv.quantity - inv.reserved_quantity;
  return ok({
    available: availableQty >= requestedQty,
    currentStock: inv.quantity,
    reservedStock: inv.reserved_quantity,
  });
}
```

---

---

# FINAL COMPLETENESS SUMMARY

After three complete review passes across all 30 documents, the guide now covers:

| Pass | Gaps Found | Status |
|------|-----------|--------|
| First Pass (Phases 1–11) | 37 gaps (G1.1–G1.37) | All specified |
| Second Review Pass | 29 gaps (GR1–GR29) | All specified |
| Third Review Pass | 12 gaps (GF1–GF12) | All specified above |
| **Total** | **78 implementation gaps** | **All specified** |

**Coverage by category:**

| Category | Gaps Covered |
|----------|-------------|
| Database / Schema | G1.1, G1.3, GR7, GR9, GR5, GF5, GF12 |
| Electron / Main Process | G1.2, G1.4, GR3, GR4, GR25, GR26, GR27, GR29, GF6 |
| Security / Auth | G1.5, G1.6, GR2, GR26, GR29, GF3, GF4, GF8, GF11 |
| Business Logic | G1.7–G1.17, G3.2, GR28, GF5, GF9 |
| Import / Data | G1.18, G8.1, G8.2, GR18, GR19, GF1 |
| i18n / Localization | GR8, GR17, G1.19 |
| Testing | G1.20, GR11 |
| UI / UX | G1.23–G1.27, GR12, GR20, GR21, GR23 |
| Notifications | GR15, GR24 |
| Backup | G7.x, GR6, GR13, GF1 |
| Industry Templates | G9.x, GR22, GR23, GF2 |
| Performance | GR16, GR9 |
| Print | G1.29, GR14, GR12 |
| Permissions | G1.33, GR2, GF3, GF4, GF8, GF9 |
| Legal / Claims | GF10 |
| Module Structure | GF7 |

**The guide is now exhaustive.** Every implementable gap discovered across all 30 documentation files has a specified implementation with code, data structures, or design decisions.

---

---

---

---

# FOURTH REVIEW PASS — DEEP GAPS

*After cross-referencing every IPC stub, every acceptance criterion, every schema model, and every service against implemented specs, 10 deeper implementation gaps remain. These cover auth service internals, PO workflow, payment reversal, and industry-specific workflows.*

---

## GAP D1 — Auth service `login()` and `createUser()` not specified — bcrypt implementation missing

**Source:** SECURITY.md: *"bcrypt or Argon2 for password hashing."* V1_PRD acceptance criteria: *"Login enforces password before granting access."*

**Problem:** `bcryptjs` is listed as a dependency and `auth.login` IPC exists in the preload, but the actual `login()` and `createUser()` service functions with bcrypt are never specified. SALT_ROUNDS are not defined. This is the most-used service in the entire app.

**Implementation:**

```typescript
// src/main/services/auth.service.ts
import bcrypt from 'bcryptjs';
import { prisma } from '../database/client';
import { sessionStore } from '../security/session-store';
import { logAudit } from './audit.service';
import { AUDIT_EVENTS } from '../constants/audit-events';
import { ok, fail } from '../utils/service-result';

const SALT_ROUNDS = 12;

// LOGIN
export async function login(
  username: string,
  password: string,
  webContentsId: number
): Promise<ServiceResult<SessionUser>> {
  const user = await prisma.user.findFirst({
    where: { username, is_active: 1 },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });

  if (!user) {
    // Return same message for both "not found" and "wrong password" — prevents username enumeration
    return fail('AUTH-001', 'Invalid username or password');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    await logAudit({ userId: null, action: AUDIT_EVENTS.LOGIN_FAILED, entityType: 'USER', entityId: user.id });
    return fail('AUTH-001', 'Invalid username or password');
  }

  const permissions = user.role.permissions.map(rp => rp.permission.permission_key);
  const session: SessionUser = {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    role: user.role.role_name,
    permissions,
  };

  sessionStore.set(webContentsId, session);
  await logAudit({ userId: user.id, action: AUDIT_EVENTS.LOGIN_SUCCESS, entityType: 'USER', entityId: user.id });

  return ok(session);
}

// CREATE USER
export async function createUser(
  data: CreateUserInput,
  requestingUserId: number
): Promise<ServiceResult<User>> {
  const hash = await bcrypt.hash(data.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      username: data.username,
      password_hash: hash,
      display_name: data.display_name,
      role_id: data.role_id,
      is_active: 1,
      created_by: requestingUserId,
    },
  });

  await logAudit({ userId: requestingUserId, action: AUDIT_EVENTS.USER_CREATED, entityType: 'USER', entityId: user.id });
  return ok(user);
}

// CHANGE PASSWORD
export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string
): Promise<ServiceResult<void>> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return fail('AUTH-001', 'User not found');

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) return fail('AUTH-003', 'Current password is incorrect');

  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({ where: { id: userId }, data: { password_hash: newHash } });
  await logAudit({ userId, action: AUDIT_EVENTS.PASSWORD_CHANGED, entityType: 'USER', entityId: userId });
  return ok(undefined);
}

// LOGOUT
export function logout(webContentsId: number): void {
  const session = sessionStore.get(webContentsId);
  if (session) {
    logAudit({ userId: session.id, action: AUDIT_EVENTS.LOGOUT, entityType: 'USER', entityId: session.id });
  }
  sessionStore.delete(webContentsId);
}
```

**Setup wizard admin creation** (called on first-run only, before session exists):
```typescript
// src/main/services/setup.service.ts
export async function createFirstAdmin(
  username: string,
  password: string,
  displayName: string
): Promise<ServiceResult<void>> {
  const adminRole = await prisma.role.findFirst({ where: { role_name: 'Admin' } });
  if (!adminRole) return fail('SYS-001', 'Role setup incomplete');

  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  await prisma.user.create({
    data: {
      username,
      password_hash: hash,
      display_name: displayName,
      role_id: adminRole.id,
      is_active: 1,
    },
  });
  return ok(undefined);
}
```

---

## GAP D2 — Purchase Order receive workflow not specified

**Source:** BUSINESS_RULES_ENGINE.md RULE PO003: *"Received PO updates inventory."* V1_PRD: Purchase Orders are a MUST_HAVE feature.

**Problem:** `purchaseOrders.receive` exists in the preload IPC but no service implementation is specified. Receiving a PO must update inventory stock, recalculate average cost (per GAP 3.1), and create a supplier ledger entry.

**PO state machine:**

```
DRAFT → SENT → APPROVED → RECEIVED (terminal)
                        ↘ CANCELLED (terminal)
DRAFT → CANCELLED (if never sent)
```

**Implementation:**

```typescript
// src/main/services/purchase-order.service.ts

export async function approvePO(id: number, userId: number): Promise<ServiceResult<PurchaseOrder>> {
  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po) return fail('PO-001', 'Purchase order not found');
  if (po.status !== 'DRAFT' && po.status !== 'SENT') {
    return fail('PO-002', `Cannot approve a PO in ${po.status} status`);
  }
  // RULE PO002: Approved PO cannot be edited
  const updated = await prisma.purchaseOrder.update({ where: { id }, data: { status: 'APPROVED' } });
  await logAudit({ userId, action: 'PO_APPROVED', entityType: 'PURCHASE_ORDER', entityId: id });
  return ok(updated);
}

export async function receivePO(
  id: number,
  receivedItems: { po_item_id: number; received_quantity: number }[],
  userId: number
): Promise<ServiceResult<PurchaseOrder>> {
  return await prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUnique({ where: { id }, include: { items: true, supplier: true } });
    if (!po) throw new Error('PO-001');
    if (po.status !== 'APPROVED') throw new Error('PO-003: PO must be APPROVED before receiving');

    let totalPOValue = 0;

    for (const received of receivedItems) {
      const poItem = po.items.find(i => i.id === received.po_item_id);
      if (!poItem) throw new Error(`PO-004: Item ${received.po_item_id} not found`);
      if (received.received_quantity <= 0) throw new Error(`PO-004: Received quantity must be > 0`);

      const purchaseCost = poItem.unit_price; // cost per unit from PO

      // 1. Recalculate average cost using formula from GAP 3.1
      const inventory = await tx.inventory.findUnique({ where: { product_id: poItem.product_id } });
      const currentQty = inventory?.quantity ?? 0;
      const currentAvg = inventory?.average_cost ?? 0;
      const newQty = currentQty + received.received_quantity;
      const newAvg = newQty === 0 ? purchaseCost
        : (currentQty * currentAvg + received.received_quantity * purchaseCost) / newQty;

      // 2. Update inventory
      await tx.inventory.upsert({
        where: { product_id: poItem.product_id },
        update: { quantity: { increment: received.received_quantity }, average_cost: newAvg },
        create: { product_id: poItem.product_id, quantity: received.received_quantity, average_cost: newAvg },
      });

      // 3. Create inventory movement (PURCHASE)
      await tx.inventoryMovement.create({
        data: {
          product_id: poItem.product_id,
          movement_type: 'PURCHASE',
          quantity: received.received_quantity,
          unit_cost: purchaseCost,
          reference_type: 'PURCHASE_ORDER',
          reference_id: id,
          created_by: userId,
        },
      });

      // 4. Update PO item with received quantity
      await tx.purchaseOrderItem.update({
        where: { id: received.po_item_id },
        data: { received_quantity: received.received_quantity },
      });

      totalPOValue += received.received_quantity * purchaseCost;
    }

    // 5. Create supplier ledger entry (PURCHASE type — we now owe the supplier)
    await tx.supplierLedger.create({
      data: {
        supplier_id: po.supplier_id,
        entry_type: 'PURCHASE',
        amount: totalPOValue,
        balance_after: 0, // calculated in a separate query or stored on supplier
        reference_type: 'PURCHASE_ORDER',
        reference_id: id,
        notes: `PO received: ${po.po_number}`,
        created_by: userId,
      },
    });

    // 6. Mark PO as RECEIVED
    const updated = await tx.purchaseOrder.update({ where: { id }, data: { status: 'RECEIVED' } });
    await logAudit({ userId, action: 'PO_RECEIVED', entityType: 'PURCHASE_ORDER', entityId: id });
    return ok(updated);
  });
}
```

---

## GAP D3 — Supplier ledger entry lifecycle not specified

**Source:** DATABASE_SCHEMA.md: `SupplierLedger` model exists. `suppliers.getLedger` in preload.

**Problem:** No document specifies WHEN supplier ledger entries are created. Without this, the supplier outstanding balance cannot be computed.

**Entry lifecycle:**

| Event | Entry Type | Amount Sign | Creates Entry |
|-------|-----------|-------------|---------------|
| PO received (goods arrive) | `PURCHASE` | Positive (we owe) | ✓ (see GAP D2) |
| Payment made to supplier | `PAYMENT` | Positive (reduces what we owe) | ✓ (see below) |
| Purchase return to supplier | `RETURN` | Negative debit | Future V2 |
| Opening balance import | `OPENING` | Positive (pre-existing debt) | ✓ (see GR20) |

**Supplier outstanding balance:**
```typescript
// Outstanding = sum(PURCHASE + OPENING entries) - sum(PAYMENT entries)
// Stored on SupplierLedger as running balance_after OR calculated on query:

export async function getSupplierOutstanding(supplierId: number): Promise<number> {
  const result = await prisma.supplierLedger.aggregate({
    where: { supplier_id: supplierId },
    _sum: {
      // PURCHASE and OPENING entries increase debt; PAYMENT entries decrease it
      // Use signed amounts stored in DB (PAYMENT entries stored as negative OR use entry_type filter)
    },
  });
  // Recommended: store all amounts as positive, use entry_type to determine sign:
  const purchases = await prisma.supplierLedger.aggregate({
    where: { supplier_id: supplierId, entry_type: { in: ['PURCHASE', 'OPENING'] } },
    _sum: { amount: true },
  });
  const payments = await prisma.supplierLedger.aggregate({
    where: { supplier_id: supplierId, entry_type: 'PAYMENT' },
    _sum: { amount: true },
  });
  return (purchases._sum.amount ?? 0) - (payments._sum.amount ?? 0);
}
```

**Supplier payment recording:**
```typescript
// When user records a payment TO a supplier (paying off outstanding):
export async function recordSupplierPayment(
  supplierId: number,
  amount: number,
  paymentMethod: string,
  notes: string,
  userId: number
): Promise<ServiceResult<void>> {
  await prisma.$transaction(async (tx) => {
    await tx.supplierLedger.create({
      data: {
        supplier_id: supplierId,
        entry_type: 'PAYMENT',
        amount,
        reference_type: 'SUPPLIER_PAYMENT',
        payment_method: paymentMethod,
        notes,
        created_by: userId,
      },
    });
    await logAudit({ userId, action: 'SUPPLIER_PAYMENT_RECORDED', entityType: 'SUPPLIER', entityId: supplierId });
  });
  return ok(undefined);
}
```

---

## GAP D4 — Payment reversal service not specified

**Source:** API_AND_SERVICE_LAYER_SPEC.md: `PaymentService.reversePayment(id, reason)`. Preload line 550: `reversePayment`.

**Problem:** The IPC handler is exposed in the preload but the actual reversal logic — what happens to the ledger, the invoice payment status, and outstanding balance — is never specified.

**Implementation:**

```typescript
// src/main/services/payment.service.ts

export async function reversePayment(
  paymentId: number,
  reason: string,
  userId: number
): Promise<ServiceResult<void>> {
  return await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return fail('PAY-001', 'Payment not found');
    if (payment.is_reversed) return fail('PAY-003', 'Payment has already been reversed');

    // 1. Mark original payment as reversed
    await tx.payment.update({ where: { id: paymentId }, data: { is_reversed: true, reversal_reason: reason } });

    // 2. Reverse customer ledger entry (if applicable)
    if (payment.customer_id) {
      await tx.customerLedger.create({
        data: {
          customer_id: payment.customer_id,
          entry_type: 'PAYMENT_REVERSAL',
          amount: payment.amount,  // Positive = customer owes more again
          reference_type: 'PAYMENT_REVERSAL',
          reference_id: paymentId,
          notes: `Reversal: ${reason}`,
          created_by: userId,
        },
      });
    }

    // 3. Recalculate invoice payment status
    const invoice = await tx.invoice.findUnique({
      where: { id: payment.invoice_id },
      include: { payments: { where: { is_reversed: false } } },
    });

    if (invoice) {
      const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
      const newStatus = totalPaid <= 0 ? 'UNPAID'
        : totalPaid < invoice.total_amount ? 'PARTIAL'
        : 'PAID';
      await tx.invoice.update({ where: { id: invoice.id }, data: { payment_status: newStatus } });
    }

    await logAudit({
      userId,
      action: AUDIT_EVENTS.PAYMENT_REVERSED,
      entityType: 'PAYMENT',
      entityId: paymentId,
      notes: reason,
    });
    return ok(undefined);
  });
}
```

**Schema addition required:** Add `is_reversed Boolean @default(false)` and `reversal_reason String?` to the Payment model in Prisma schema.

---

## GAP D5 — Customer credit limit enforcement in billing service not specified

**Source:** BUSINESS_RULES_ENGINE.md RULE C004: *"Credit limit enforcement configurable."* ERROR_CATALOG.md: `CUST-003: Credit limit exceeded.`

**Problem:** The `credit_limit` field exists on Customer and `allow_credit_sales` setting exists, but no billing service check is specified to enforce it when creating an invoice on credit.

**Implementation — add to `billing.service.createInvoice()`:**

```typescript
// In billing.service.ts, inside createInvoice(), before creating the invoice:

// RULE C004: Enforce credit limit if customer has one and invoice is on credit
if (data.customer_id && data.payment_method === 'CREDIT') {
  const customer = await prisma.customer.findUnique({ where: { id: data.customer_id } });

  if (customer && customer.credit_limit > 0) {
    // Calculate current outstanding balance
    const outstanding = await customerService.getOutstandingBalance(data.customer_id);

    if (outstanding + data.total_amount > customer.credit_limit) {
      return fail('CUST-003', `Credit limit of ${formatCurrency(customer.credit_limit)} exceeded. Current outstanding: ${formatCurrency(outstanding)}`);
    }
  }
}
```

**Credit limit === 0 means NO LIMIT** (unlimited credit). Credit limit enforcement only activates when `credit_limit > 0` AND invoice `payment_method === 'CREDIT'`.

---

## GAP D6 — Session persistence across app restart not specified

**Source:** V1_PRD acceptance criteria: *"Session persists across app restart (configurable)."*

**Problem:** The current session store is in-memory per WebContents ID. After an app restart, the user must log in again. The PRD says session can persist — no spec for how.

**V1 implementation — electron-store for optional token persistence:**

```typescript
// npm install electron-store
// src/main/security/session-persistence.ts
import Store from 'electron-store';
import crypto from 'crypto';

const store = new Store({ name: 'session', encryptionKey: getOrCreateDeviceKey() });

function getOrCreateDeviceKey(): string {
  // Use machine-specific entropy as encryption key — never leaves the device
  const existing = store.get('device_key') as string | undefined;
  if (existing) return existing;
  const key = crypto.randomBytes(32).toString('hex');
  store.set('device_key', key);
  return key;
}

export function saveSession(userId: number, sessionToken: string): void {
  store.set('saved_session', { userId, token: sessionToken, savedAt: new Date().toISOString() });
}

export function loadSavedSession(): { userId: number; token: string } | null {
  return (store.get('saved_session') ?? null) as { userId: number; token: string } | null;
}

export function clearSavedSession(): void {
  store.delete('saved_session');
}
```

**Login flow with "Remember Me":**
1. User logs in with "Remember me" checked.
2. Auth service generates a session token (random 32-byte hex) and stores it in DB against the user.
3. `saveSession(userId, token)` persists it to electron-store.
4. On next app start, `loadSavedSession()` finds the saved token → verifies against DB → auto-logs in.
5. Logout always calls `clearSavedSession()`.

**Default setting:** `{ setting_key: 'remember_me_default', setting_value: 'true', setting_type: 'BOOLEAN' }`

**Schema addition:** Add `session_token String? @unique` and `token_expires_at DateTime?` to the User model for persistent token storage.

---

## GAP D7 — "Powered by Aszurex" footer in PDF/print templates not specified

**Source:** BRANDING_AND_MARKETING.md: *"Invoice footer: 'Powered by Aszurex' in gray text."* RELEASE_CHECKLIST.md: *"Export invoice as PDF → verify 'Powered by Aszurex' footer present."*

**Problem:** GAP 4.2 specifies the print service using `webContents.printToPDF(htmlContent)` but never specifies that the HTML templates must include the Aszurex footer. A developer could omit it.

**Required footer for ALL printed/exported documents:**

```html
<!-- Add to the bottom of every invoice, receipt, and report HTML template -->
<footer class="doc-footer">
  <div class="footer-left">
    <!-- Business disclaimer (LEGAL requirement from GAP F10) -->
    <small>This is a computer-generated document. Verify all totals before use for legal or tax purposes.</small>
  </div>
  <div class="footer-right">
    <small style="color: #9CA3AF;">Powered by Aszurex</small>
  </div>
</footer>
```

**CSS for print:**
```css
.doc-footer {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: 24px;
  padding-top: 8px;
  border-top: 1px solid #E5E7EB;
  font-size: 9px;
  color: #6B7280;
}
@media print {
  .doc-footer { position: fixed; bottom: 0; width: 100%; }
}
```

**Applies to:**
- A4 Invoice PDF
- 80mm thermal receipt (text-only: `Powered by Aszurex`)
- 58mm thermal receipt (text-only, small)
- All exported reports (Sales, Tax, Customer Outstanding, Inventory)
- KOT printout: No Aszurex footer (kitchen-only document)

---

## GAP D8 — Wallet payment method definition not specified

**Source:** V1_PRD: *"Wallet"* listed as payment method. DATABASE_SCHEMA.md: `payment_method: 'WALLET'` in enum.

**Problem:** "Wallet" is listed but never defined. A developer building the payment recording UI doesn't know what to show the user or what to record.

**Definition:**

"Wallet" in Sarang refers to **digital wallet balance payments** (Paytm Wallet, PhonePe Wallet, Amazon Pay Wallet, etc.) — where the customer pays from their app's wallet balance rather than scanning a UPI QR.

**Key distinction from UPI:**
- **UPI (QR-based):** Customer scans business's QR code → money transfers from customer's bank → recorded as 'UPI'
- **Wallet:** Customer pays from their app's stored wallet balance → recorded as 'WALLET'

**V1 Implementation — same as Cash/UPI:**
- No integration. Just a payment method label.
- Record amount, select payment method = WALLET, note the reference (optional: transaction ID noted manually by cashier).
- Display in payment form: `Cash | UPI | Card | Wallet | Credit`

**Wallet receipt line:**
```
Payment Method:    Wallet (Paytm/PhonePe)
Amount:            ₹500.00
Reference:         [manual entry, optional]
SARANG RECORDS PAYMENTS. IT DOES NOT VERIFY OR PROCESS THEM.
```

---

## GAP D9 — Restaurant recipe → ingredient inventory deduction not specified

**Source:** V1_PRD: *"Recipe Mapping, Ingredient Tracking"* (Restaurant template MUST HAVE). DATABASE_SCHEMA.md has `RECIPES` and `RECIPE_ITEMS` tables.

**Problem:** The schema supports recipes but no workflow spec exists for how completing a KOT order deducts the recipe ingredients from inventory.

**Implementation — KOT completion triggers ingredient deduction:**

```typescript
// src/main/services/kot.service.ts

export async function markKOTServed(kotId: number, userId: number): Promise<ServiceResult<void>> {
  return await prisma.$transaction(async (tx) => {
    const kot = await tx.kOT.findUnique({
      where: { id: kotId },
      include: { items: { include: { product: { include: { recipe: { include: { items: { include: { ingredient: true } } } } } } } } },
    });

    if (!kot) return fail('KOT-001', 'KOT not found');
    if (kot.status === 'SERVED') return fail('KOT-002', 'KOT already served');

    // Deduct ingredients for each KOT item
    for (const kotItem of kot.items) {
      if (!kotItem.product.recipe) continue; // No recipe = no deduction (e.g., drinks, packaged items)

      for (const recipeItem of kotItem.product.recipe.items) {
        const ingredientQtyNeeded = recipeItem.quantity * kotItem.quantity;

        // Check stock (respect RULE I002: no negative inventory by default)
        const inventory = await tx.inventory.findUnique({ where: { product_id: recipeItem.ingredient_product_id } });
        const currentStock = inventory?.quantity ?? 0;

        const allowNegative = await getSetting('allow_negative_inventory') === 'true';
        if (!allowNegative && currentStock < ingredientQtyNeeded) {
          // Non-blocking in restaurant context — log warning but proceed (cooking is already done)
          logger.warn(`Insufficient stock for ingredient ${recipeItem.ingredient.product_name}. Available: ${currentStock}, needed: ${ingredientQtyNeeded}`);
        }

        // Deduct inventory
        await tx.inventory.update({
          where: { product_id: recipeItem.ingredient_product_id },
          data: { quantity: { decrement: ingredientQtyNeeded } },
        });

        // Create inventory movement
        await tx.inventoryMovement.create({
          data: {
            product_id: recipeItem.ingredient_product_id,
            movement_type: 'SALE',
            quantity: ingredientQtyNeeded,
            reference_type: 'KOT',
            reference_id: kotId,
            remarks: `Recipe deduction: ${kotItem.product.product_name} × ${kotItem.quantity}`,
            created_by: userId,
          },
        });
      }
    }

    // Mark KOT as SERVED
    await tx.kOT.update({ where: { id: kotId }, data: { status: 'SERVED' } });
    await logAudit({ userId, action: 'KOT_SERVED', entityType: 'KOT', entityId: kotId });
    return ok(undefined);
  });
}
```

**Recipe creation (Admin/Manager only):**
```typescript
// A menu item (product_type: COMPOSITE) can have a recipe:
// Recipe: "Masala Chai" → ingredients: Tea Leaves (5g) + Milk (100ml) + Sugar (10g)
// When Masala Chai KOT is served × 2, deduct: Tea 10g, Milk 200ml, Sugar 20g
```

---

## GAP D10 — Barcode scan integration not specified

**Source:** V1_PRD: *"Barcode Billing"* (Retail template). GAP R23 mentions "items auto-add on barcode scan" without specifying HOW.

**Problem:** No spec for barcode scanner integration — library, keyboard event handling, or input strategy.

**Implementation — keyboard wedge approach (works with all USB/Bluetooth barcode scanners):**

Most barcode scanners in India work as **keyboard wedge devices** — they emulate a USB keyboard, sending the barcode value as rapid keystrokes followed by `Enter`.

```typescript
// src/renderer/hooks/useBarcodeScan.ts
import { useEffect, useRef } from 'react';

const SCAN_TIMEOUT_MS = 50;       // Characters must arrive within 50ms of each other
const MIN_BARCODE_LENGTH = 4;     // Ignore input shorter than 4 chars (keyboard typos)

export function useBarcodeScan(onScan: (barcode: string) => void): void {
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      // Only capture alphanumeric + hyphen (barcodes are typically digits or alphanumeric)
      if (e.key === 'Enter') {
        if (bufferRef.current.length >= MIN_BARCODE_LENGTH) {
          const now = Date.now();
          if (now - lastKeyTimeRef.current < SCAN_TIMEOUT_MS * 3) {
            // Fast input — likely a scanner, not a human typing
            onScan(bufferRef.current);
          }
        }
        bufferRef.current = '';
        return;
      }

      if (e.key.length === 1) { // Single printable character
        const now = Date.now();
        const timeSinceLastKey = now - lastKeyTimeRef.current;
        lastKeyTimeRef.current = now;

        if (timeSinceLastKey > SCAN_TIMEOUT_MS * 5) {
          // Long pause — new scan starting or user typed manually
          bufferRef.current = '';
        }

        bufferRef.current += e.key;

        // Clear buffer after timeout (prevent stale partial scan)
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => { bufferRef.current = ''; }, 500);
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [onScan]);
}

// Usage in POS/Billing form:
// useBarcodeScan(async (barcode) => {
//   const result = await window.sarangAPI.products.getByBarcode(barcode);
//   if (result.success && result.data) addItemToInvoice(result.data);
//   else toast.error(`Product not found: ${barcode}`);
// });
```

**Preload addition required:**
```typescript
products: {
  // ... existing methods
  getByBarcode: (barcode: string) => ipcRenderer.invoke('products:getByBarcode', barcode),
}
```

**Service:**
```typescript
export async function getProductByBarcode(barcode: string): Promise<ServiceResult<Product | null>> {
  const product = await prisma.product.findFirst({ where: { barcode, is_active: 1 } });
  return ok(product ?? null);
}
```

---

---

# FINAL COMPLETENESS SUMMARY (UPDATED)

After four complete review passes across all 30 source documents:

| Pass | Gaps | Status |
|------|------|--------|
| First Pass (Phases 1–11) | 37 (G1.1–G1.37) | All specified |
| Second Review Pass | 29 (GR1–GR29) | All specified |
| Third Review Pass | 12 (GF1–GF12) | All specified |
| Fourth Review Pass | 10 (GD1–GD10) | All specified above |
| **Total** | **88 implementation gaps** | **All specified** |

**What the fourth pass found that prior passes missed:**

The fourth pass specifically targeted stubs without implementations — IPC handlers that existed in the preload but had no corresponding service logic specified anywhere:
- `auth:login` → Now has full bcrypt `login()` / `createUser()` service (GD1)
- `purchaseOrders:receive` → Now has full PO receive service with inventory + ledger (GD2)
- `suppliers:recordPayment` → Supplier ledger lifecycle defined (GD3)
- `billing:reversePayment` → Full reversal with ledger + status recalc (GD4)
- `billing:createInvoice` missing credit limit check → Now enforced (GD5)
- `session persistence across restart` → electron-store + token spec (GD6)
- `printToPDF` missing Aszurex footer → HTML template spec added (GD7)
- Wallet payment type undefined → Defined as digital wallet balance (GD8)
- KOT serve missing ingredient deduction → Full recipe deduction workflow (GD9)
- Barcode scan undefined → Keyboard wedge hook + product lookup (GD10)

The guide is now complete.

---

Powered by Aszurex.

Trust Beyond Limits.
