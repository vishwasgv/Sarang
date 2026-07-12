# ARCHITECTURE.md

## SARANG BUSINESS OS LITE

### Powered by Aszurex

### Trust Beyond Limits

Version: 1.0

Document Type: Technical Architecture Specification

## PURPOSE

This document defines the technical architecture of Sarang Business OS Lite.

The architecture must prioritize:

- Offline First
- Security
- Performance
- Simplicity
- Scalability
- Maintainability
- Reliability

The architecture must minimize:

- Support Requirements
- Infrastructure Requirements
- Legal Risk
- Operational Complexity

## ARCHITECTURE PRINCIPLES

All architectural decisions must follow:

### 1. OFFLINE FIRST

Internet is optional.

The application must continue functioning when:

- Internet is unavailable
- DNS is unavailable
- External APIs are unavailable
- Aszurex website is unavailable

Business operations must never depend on online services.

### 2. LOCAL FIRST

User data remains local.

Database remains local.

Backups remain local.

Reports remain local.

No cloud dependency.

### 3. PRIVACY FIRST

No hidden telemetry.

No hidden tracking.

No analytics collection.

No customer data transmission.

No business data transmission.

No behavioral tracking.

### 4. SELF-SERVICE FIRST

Users should be able to:

Install

Configure

Operate

Backup

Restore

Upgrade

Without contacting Aszurex.

### 5. MODULAR FIRST

The platform should support:

Restaurant

Retail

Hardware

Distributor

Manufacturing

Service Businesses

using one common engine.

## HIGH LEVEL ARCHITECTURE

┌──────────────────────────────┐

│      Electron Desktop        │

└──────────────┬───────────────┘

               │

               ▼

┌──────────────────────────────┐

│       React Frontend         │

└──────────────┬───────────────┘

               │

               ▼

┌──────────────────────────────┐

│       IPC Communication      │

└──────────────┬───────────────┘

               │

               ▼

┌──────────────────────────────┐

│      Node.js Service Layer   │

└──────────────┬───────────────┘

               │

               ▼

┌──────────────────────────────┐

│         SQLite DB            │

└──────────────────────────────┘

## TECHNOLOGY STACK

### Desktop Application

Electron

Reason:

- Mature
- Cross Platform
- Offline Friendly
- Large Ecosystem

### Frontend

React

TypeScript

Reason:

- Maintainability
- Scalability
- Type Safety

### Styling

TailwindCSS

Reason:

- Small Bundle Size
- Fast Development
- Consistency

### Animations

Framer Motion

Reason:

- Premium UX
- Lightweight
- Modern Interactions

### Backend Layer

Node.js

Reason:

- Shared Language
- Rich Ecosystem
- Easy Packaging

### Database

SQLite

Reason:

- Embedded
- No Server Required
- Reliable
- Fast
- Easy Backup

## ORM

Prisma

Reason:

- Type Safety
- Migrations
- Maintainability

## APPLICATION LAYERS

### Layer 1

Presentation Layer

Responsibilities:

UI

Forms

Dashboard

Reports

Charts

Navigation

User Experience

### Layer 2

Application Layer

Responsibilities:

Business Logic

Permissions

Validation

Workflows

Rules

### Layer 3

Domain Layer

Responsibilities:

Products

Inventory

Billing

Customers

Suppliers

Expenses

Reports

Analytics

Tax

Industry Templates

### Layer 4

Data Layer

Responsibilities:

SQLite

Queries

Backups

Migrations

Storage

## MODULE STRUCTURE

Core Modules:

Authentication

Dashboard

Billing

Inventory

Customers

Suppliers

Products

Expenses

Reports

Analytics

Backup

Settings

Audit Logs

Notifications

Industry Modules:

Restaurant

Retail

Hardware

Distributor

Future:

Manufacturing

Service Business

Pharmacy

Electronics

## FOLDER STRUCTURE

src/

├── app/

├── modules/

│

├── auth/

├── billing/

├── inventory/

├── products/

├── customers/

├── suppliers/

├── reports/

├── analytics/

├── expenses/

├── backup/

├── settings/

│

├── industry/

│   ├── restaurant/

│   ├── retail/

│   ├── hardware/

│   ├── distributor/

│

├── shared/

│   ├── ui/

│   ├── hooks/

│   ├── utils/

│   ├── types/

│

├── database/

│

├── services/

│

└── assets/

## DATABASE ARCHITECTURE

Database Type:

SQLite

Database File:

Local

Encrypted Sensitive Values

No external database.

Core Tables:

Users

Roles

Products

Categories

Inventory

InventoryMovements

Customers

Suppliers

Invoices

InvoiceItems

Payments

Expenses

PurchaseOrders

AuditLogs

Settings

TaxConfigurations

BusinessProfiles

## BUSINESS CONFIGURATION ENGINE

During onboarding:

Business Type

Country

Currency

Tax System

Language

These settings dynamically configure:

Reports

Taxes

Currency Display

Industry Features

Invoice Layouts

## TAX ENGINE

Must Support:

GST

VAT

Sales Tax

Custom Tax

No Tax

Tax rules must be configurable.

Not hardcoded.

## CURRENCY ENGINE

Support:

All ISO-4217 currencies.

Examples:

USD

EUR

GBP

AUD

CAD

NZD

SGD

INR

AED

SAR

ZAR

Formatting should be locale aware.

## REPORTING ENGINE

Reports generated locally.

No cloud generation.

Export:

PDF

Excel

CSV

Print

## ANALYTICS ENGINE

Local Analytics Only.

Data Sources:

Invoices

Inventory

Customers

Expenses

Purchases

No external analytics.

## BACKUP ARCHITECTURE

One Click Backup

One Click Restore

Automatic Backup Suggestions

Database Export

Database Import

Integrity Validation

Version Compatibility Checks

## UPDATE STRATEGY

Version 1:

Manual Updates

User downloads installer.

User installs update.

No forced updates.

No update servers required.

Future:

Optional update checker.

Must be user-controlled.

Disabled by default.

## ERROR RECOVERY

Unexpected Shutdown Recovery

Database Integrity Checks

Backup Verification

Safe Rollbacks

Crash Logging (Local Only)

No automatic crash reporting.

## PERFORMANCE TARGETS

Application Startup:

< 3 seconds

Invoice Creation:

Instant

Database Queries:

< 100 ms

Report Generation:

< 3 seconds

Memory Usage:

Optimized

Installer Size:

< 150 MB

## PRINTING ARCHITECTURE

Support:

80mm Thermal

58mm Thermal

A4

PDF

Print Preview

Industry Templates

Restaurant Receipts

Retail Invoices

Distributor Invoices

Hardware Invoices

## INDUSTRY TEMPLATE ENGINE

Shared Core Engine

Industry-specific features enabled through configuration.

Example:

Restaurant

Enables:

KOT

Recipes

Tables

Retail

Enables:

Returns

Barcode Support

Hardware

Enables:

Area Pricing

Customer Ledger

Distributor

Enables:

Bulk Orders

Outstanding Tracking

## FUTURE EXPANSION STRATEGY

Architecture must support future modules without major rewrites.

Future Modules:

CRM

Helpdesk

CrebitX Integration

Manufacturing ERP

Workflow Automation

Document Management

Business Intelligence

Vendor Portal

Customer Portal

Android Application

## DEPLOYMENT ARCHITECTURE

Version 1:

Local Desktop Only

No Servers

No Hosting

No Cloud Infrastructure

No Backend Deployment

Everything packaged into one installer.

## FINAL ARCHITECTURAL OBJECTIVE

The architecture should ensure:

Reliability

Privacy

Security

Performance

Maintainability

Scalability

Minimal Support Dependency

Minimal Operational Burden

Maximum User Ownership

Maximum Trust

Sarang should remain:

Offline First

Privacy First

Ownership First

## LAYERED ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                    ELECTRON MAIN PROCESS                         │
│                                                                   │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  IPC Handlers   │→ │  Service Layer   │  │  Permission   │  │
│  │  (ipc/*.ts)     │  │  (services/*.ts) │  │  Guard        │  │
│  └─────────────────┘  └────────┬─────────┘  └───────────────┘  │
│                                 │                                 │
│  ┌──────────────────────────────▼─────────────────────────────┐ │
│  │                     PRISMA ORM                              │ │
│  └──────────────────────────────┬─────────────────────────────┘ │
│                                  │                                │
│  ┌───────────────────────────────▼────────────────────────────┐ │
│  │              SQLITE DATABASE  (sarang.db)                   │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                  ▲  ipcMain.handle / ipcRenderer.invoke
                  │
┌─────────────────▼───────────────────────────────────────────────┐
│                  ELECTRON RENDERER PROCESS                        │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    REACT APPLICATION                       │  │
│  │                                                            │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │  │
│  │  │  Pages   │  │ Zustand  │  │  Custom  │  │   Zod    │  │  │
│  │  │   (UI)   │→ │  Store   │← │  Hooks   │  │ Schemas  │  │  │
│  │  └──────────┘  └──────────┘  └────┬─────┘  └──────────┘  │  │
│  │                                    │                        │  │
│  │  ┌─────────────────────────────────▼──────────────────┐   │  │
│  │  │           contextBridge (window.sarangAPI.*)        │   │  │
│  │  └─────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

Full data flow:
  User Action → Zustand Store → Hook → sarangAPI.*() →
  IPC → requirePermission() → Service → Prisma → SQLite →
  Result → IPC → Hook → Store → UI Re-render
```

## PROCESS ISOLATION RULES

The Renderer process (React) and Main process (Node.js) are strictly isolated.

Renderer MUST NOT:
- Import or use Prisma
- Access Node.js modules (fs, path, crypto, etc.)
- Read or write files directly
- Connect to the database directly

Renderer MAY ONLY:
- Call `window.sarangAPI.*` functions exposed via contextBridge
- Receive plain data objects via IPC return values
- Render UI based on received data

Main process is the exclusive layer for:
- Business logic
- Database reads and writes
- File system access
- Permission validation

## ELECTRON SECURITY BASELINE

```javascript
// Required on ALL BrowserWindow instances
{
  webPreferences: {
    nodeIntegration: false,           // No Node.js APIs in renderer
    contextIsolation: true,           // Preload and renderer isolated
    sandbox: true,                    // OS-level process sandboxing
    webSecurity: true,                // Enforce same-origin policy
    allowRunningInsecureContent: false,
    enableRemoteModule: false,        // remote module permanently disabled
    experimentalFeatures: false,      // No unstable Chromium APIs
    webviewTag: false,                // No <webview> elements
    devTools: !app.isPackaged         // DevTools in development only
  }
}
```

Powered by Aszurex

Trust Beyond Limits.
