# DATABASE_SCHEMA.md

## SARANG BUSINESS OS LITE

### Powered by Aszurex

### Trust Beyond Limits

Version: 1.0

Document Type: Database Schema Specification

## PURPOSE

This document defines:

- Database Architecture
- Table Structure
- Relationships
- Constraints
- Indexing Strategy
- Future Expansion Strategy

Database Engine:

SQLite

ORM:

Prisma

## DATABASE DESIGN PRINCIPLES

The schema must be:

Offline First

Modular

Scalable

Industry Agnostic

Future Proof

Normalized

Easy To Backup

Easy To Restore

## CORE ENTITIES

Business

Users

Roles

Permissions

Products

Categories

Inventory

Customers

Suppliers

Invoices

Payments

Expenses

Purchase Orders

Audit Logs

Settings

Taxes

Reports

Backups

Notifications

## BUSINESS_PROFILE

Stores company information.

Fields:

id

business\_name

business\_type

owner\_name

email

phone

address

city

state

country

postal\_code

currency\_code

currency\_symbol

tax\_model

tax\_number

upi\_id

website

logo\_path

timezone

created\_at

updated\_at

## USERS

Stores system users.

Fields:

id

full\_name

email

phone

username

password\_hash

role\_id

is\_active

last\_login

created\_at

updated\_at

## ROLES

Stores role definitions.

Examples:

Admin

Manager

Cashier

Staff

Kitchen Staff

Fields:

id

role\_name

description

created\_at

updated\_at

## PERMISSIONS

Stores permissions.

Examples:

create\_invoice

delete\_invoice

manage\_inventory

manage\_users

view\_reports

restore\_backup

Fields:

id

permission\_key

permission\_name

description

created\_at

## ROLE_PERMISSIONS

Many-to-many relationship.

Fields:

id

role\_id

permission\_id

created\_at

## PRODUCT_CATEGORIES

Fields:

id

name

description

parent\_category\_id

is\_active

created\_at

updated\_at

## PRODUCTS

Fields:

id

category\_id

sku

barcode

product\_name

description

product\_type

unit

cost\_price

selling\_price

tax\_rate

image\_path

is\_active

created\_at

updated\_at

## PRODUCT_VARIANTS

Future support:

Size

Color

Weight

Flavor

Variant Pricing

Fields:

id

product\_id

variant\_name

sku

barcode

selling\_price

cost\_price

created\_at

updated\_at

## INVENTORY

Current stock state.

Fields:

id

product\_id

quantity

reserved\_quantity

reorder\_level

reorder\_quantity

updated\_at

## INVENTORY_MOVEMENTS

Tracks stock changes.

Fields:

id

product\_id

movement\_type

quantity

reference\_type

reference\_id

remarks

created\_by

created\_at

Movement Types:

Purchase

Sale

Adjustment

Return

Damage

Opening Stock

Transfer

## CUSTOMERS

Fields:

id

customer\_code

customer\_name

phone

email

address

city

state

country

tax\_number

credit\_limit

outstanding\_balance

notes

created\_at

updated\_at

## CUSTOMER_LEDGER

Tracks credits and debits.

Fields:

id

customer\_id

reference\_type

reference\_id

debit\_amount

credit\_amount

balance

remarks

created\_at

## SUPPLIERS

Fields:

id

supplier\_code

supplier\_name

phone

email

address

city

state

country

tax\_number

notes

created\_at

updated\_at

## SUPPLIER_LEDGER

Fields:

id

supplier\_id

reference\_type

reference\_id

debit\_amount

credit\_amount

balance

remarks

created\_at

## PURCHASE_ORDERS

Fields:

id

po\_number

supplier\_id

order\_date

expected\_date

status

subtotal

tax\_amount

total\_amount

notes

created\_by

created\_at

updated\_at

## PURCHASE_ORDER_ITEMS

Fields:

id

purchase\_order\_id

product\_id

quantity

unit\_cost

tax\_rate

total

created\_at

## INVOICES

Core billing table.

Fields:

id

invoice\_number

invoice\_type

customer\_id

invoice\_date

due\_date

status

subtotal

discount\_amount

tax\_amount

rounding\_amount

total\_amount

paid\_amount

balance\_amount

payment\_status

notes

created\_by

created\_at

updated\_at

Invoice Types:

Retail

Wholesale

Restaurant

Takeaway

Purchase Return

Sales Return

## INVOICE_ITEMS

Fields:

id

invoice\_id

product\_id

quantity

unit\_price

discount\_amount

tax\_rate

tax\_amount

line\_total

created\_at

## PAYMENTS

Stores payment records.

Fields:

id

invoice\_id

customer\_id

payment\_method

amount

reference\_number

payment\_date

remarks

recorded\_by

created\_at

Payment Methods:

Cash

UPI

Card

Wallet

Bank Transfer

Credit

Mixed

## EXPENSE_CATEGORIES

Fields:

id

category\_name

description

created\_at

Examples:

Rent

Salary

Electricity

Fuel

Maintenance

Supplies

Marketing

Miscellaneous

## EXPENSES

Fields:

id

category\_id

expense\_name

amount

expense\_date

payment\_method

remarks

created\_by

created\_at

## TAX_CONFIGURATIONS

Fields:

id

tax\_name

tax\_type

rate

country

is\_default

created\_at

updated\_at

Examples:

GST

VAT

Sales Tax

No Tax

## SETTINGS

Stores system settings.

Fields:

id

setting\_key

setting\_value

setting\_type

updated\_at

## AUDIT_LOGS

Tracks system activity.

Fields:

id

user\_id

action

entity\_type

entity\_id

old\_value

new\_value

ip\_address

created\_at

Note:

IP address should remain optional.

No tracking requirements.

## NOTIFICATIONS

Fields:

id

notification\_type

title

message

is\_read

created\_at

## REPORT_CONFIGURATIONS

Stores custom report settings.

Fields:

id

report\_name

configuration\_json

created\_at

updated\_at

## BACKUPS

Tracks backup metadata.

Fields:

id

backup\_name

backup\_path

backup\_size

backup\_date

backup\_version

created\_at

## ATTACHMENTS

Future use.

Fields:

id

entity\_type

entity\_id

file\_name

file\_path

file\_size

uploaded\_at

## INDUSTRY_TEMPLATE_SETTINGS

Stores template configuration.

Fields:

id

business\_type

enabled\_modules

dashboard\_layout

report\_layout

created\_at

updated\_at

## RESTAURANT MODULE TABLES

## TABLES

Restaurant tables.

Fields:

id

table\_number

table\_name

status

created\_at

## KOTS

Kitchen Orders.

Fields:

id

invoice\_id

table\_id

status

created\_at

updated\_at

## RECIPES

Fields:

id

product\_id

recipe\_name

created\_at

## RECIPE_ITEMS

Fields:

id

recipe\_id

ingredient\_product\_id

quantity

created\_at

## INDEXING STRATEGY

Create indexes for:

invoice\_number

customer\_name

supplier\_name

product\_name

barcode

sku

invoice\_date

payment\_date

created\_at

## DATA RETENTION STRATEGY

No automatic deletion.

Users control:

Backups

Exports

Cleanup

Retention

## FUTURE MODULE COMPATIBILITY

Database must support future modules:

CRM

Helpdesk

CrebitX

Manufacturing

Workflow Automation

Document Management

Android Synchronization

Business Intelligence

Without major schema redesign.

## DATABASE SUCCESS CRITERIA

The database should:

Remain Fast

Remain Simple

Remain Reliable

Remain Scalable

Support Multiple Industries

Support Global Usage

Support Future Expansion

Support Offline First Operations

Require Minimal Maintenance

## SQLITE DATA TYPE CONVENTIONS

SQLite uses five storage classes: NULL, INTEGER, TEXT, REAL, BLOB.

All Sarang tables follow these type conventions:

| Purpose | SQLite Type | Notes |
|---------|------------|-------|
| Primary keys | INTEGER | AUTOINCREMENT |
| Foreign keys | INTEGER | NOT NULL where mandatory |
| Short strings (name, code, status) | TEXT | NOT NULL where required |
| Long strings (address, notes, remarks) | TEXT | Nullable allowed |
| Monetary amounts | REAL | 2 decimal places minimum |
| Percentages and rates | REAL | 0.00 to 100.00 |
| Timestamps | TEXT | ISO 8601 — `YYYY-MM-DDTHH:MM:SS.sssZ` |
| Dates only | TEXT | ISO 8601 — `YYYY-MM-DD` |
| Boolean flags | INTEGER | 0 = false, 1 = true |
| Binary data / files | BLOB | Only for small embedded assets |
| JSON payloads | TEXT | Stored as TEXT, parsed in application layer |
| Enum values | TEXT | Enforced via CHECK constraint in Prisma |

## COLUMN NAMING CONVENTIONS

All columns follow snake_case.

Standard suffixes:
- `_id` — foreign key reference
- `_at` — timestamp field (created_at, updated_at)
- `_date` — date-only field (invoice_date, expense_date)
- `_amount` — monetary value
- `_rate` — percentage rate (tax_rate, discount_rate)
- `_path` — file system path
- `_code` — short identifier code
- `_hash` — hashed value (password_hash)
- `is_` prefix — boolean flag (is_active, is_default)

## ENTITY RELATIONSHIP MAP

```
BUSINESS_PROFILE (1)
    └── (1) SETTINGS
    └── (1) INDUSTRY_TEMPLATE_SETTINGS

USERS (N) ── ROLES (1) ── ROLE_PERMISSIONS (N) ── PERMISSIONS (1)

PRODUCT_CATEGORIES (1)
    └── (N) PRODUCTS
              └── (1) INVENTORY
              └── (N) INVENTORY_MOVEMENTS
              └── (N) PRODUCT_VARIANTS
              └── (N) INVOICE_ITEMS
              └── (N) PURCHASE_ORDER_ITEMS
              └── (N) RECIPE_ITEMS

CUSTOMERS (1)
    └── (N) INVOICES
    └── (N) PAYMENTS
    └── (N) CUSTOMER_LEDGER

SUPPLIERS (1)
    └── (N) PURCHASE_ORDERS
    └── (N) SUPPLIER_LEDGER

INVOICES (1)
    └── (N) INVOICE_ITEMS
    └── (N) PAYMENTS

PURCHASE_ORDERS (1)
    └── (N) PURCHASE_ORDER_ITEMS

EXPENSE_CATEGORIES (1)
    └── (N) EXPENSES

TAX_CONFIGURATIONS (1)
    └── (N) PRODUCTS (via tax_rate)
    └── (N) INVOICE_ITEMS (via tax_rate)

TABLES (1) ── (N) KOTS ── (N) INVOICES [Restaurant Module]

RECIPES (1) ── (N) RECIPE_ITEMS ── PRODUCTS (ingredients)
```

## FOREIGN KEY REFERENCE

Complete list of all foreign key relationships:

| Table | Column | References |
|-------|--------|-----------|
| USERS | role_id | ROLES.id |
| ROLE_PERMISSIONS | role_id | ROLES.id |
| ROLE_PERMISSIONS | permission_id | PERMISSIONS.id |
| PRODUCT_CATEGORIES | parent_category_id | PRODUCT_CATEGORIES.id (self-ref) |
| PRODUCTS | category_id | PRODUCT_CATEGORIES.id |
| PRODUCT_VARIANTS | product_id | PRODUCTS.id |
| INVENTORY | product_id | PRODUCTS.id (UNIQUE) |
| INVENTORY_MOVEMENTS | product_id | PRODUCTS.id |
| INVENTORY_MOVEMENTS | created_by | USERS.id |
| CUSTOMER_LEDGER | customer_id | CUSTOMERS.id |
| SUPPLIER_LEDGER | supplier_id | SUPPLIERS.id |
| PURCHASE_ORDERS | supplier_id | SUPPLIERS.id |
| PURCHASE_ORDERS | created_by | USERS.id |
| PURCHASE_ORDER_ITEMS | purchase_order_id | PURCHASE_ORDERS.id |
| PURCHASE_ORDER_ITEMS | product_id | PRODUCTS.id |
| INVOICES | customer_id | CUSTOMERS.id (nullable) |
| INVOICES | created_by | USERS.id |
| INVOICE_ITEMS | invoice_id | INVOICES.id |
| INVOICE_ITEMS | product_id | PRODUCTS.id |
| PAYMENTS | invoice_id | INVOICES.id |
| PAYMENTS | customer_id | CUSTOMERS.id (nullable) |
| PAYMENTS | recorded_by | USERS.id |
| EXPENSES | category_id | EXPENSE_CATEGORIES.id |
| EXPENSES | created_by | USERS.id |
| AUDIT_LOGS | user_id | USERS.id |
| KOTS | invoice_id | INVOICES.id |
| KOTS | table_id | TABLES.id |
| RECIPES | product_id | PRODUCTS.id |
| RECIPE_ITEMS | recipe_id | RECIPES.id |
| RECIPE_ITEMS | ingredient_product_id | PRODUCTS.id |

All foreign keys use ON DELETE RESTRICT unless noted. No cascade deletes allowed — data preservation is mandatory.

## KEY CONSTRAINTS

```sql
-- Inventory: one record per product
UNIQUE (product_id) ON INVENTORY

-- Invoice numbering: unique per business
UNIQUE (invoice_number) ON INVOICES

-- Products: SKU unique if provided
UNIQUE (sku) ON PRODUCTS WHERE sku IS NOT NULL

-- Products: Barcode unique if provided
UNIQUE (barcode) ON PRODUCTS WHERE barcode IS NOT NULL

-- Users: username unique
UNIQUE (username) ON USERS

-- Permissions: key unique
UNIQUE (permission_key) ON PERMISSIONS

-- Settings: key unique
UNIQUE (setting_key) ON SETTINGS
```

## PRISMA SCHEMA CONVENTIONS

All migrations use Prisma Migrate. Follow these Prisma-specific rules:

- Use `@id @default(autoincrement())` for all primary keys
- Use `@default(now())` for `created_at`
- Use `@updatedAt` for `updated_at`
- Use `@unique` for unique constraints
- Use `@relation` for all foreign key declarations
- Use `@@index` for multi-column indexes
- Never use `@map` unless overriding a naming conflict

## FINAL DATABASE OBJECTIVE

One Database.

One Core Engine.

Multiple Industries.

Global Support.

Offline First.

Future Ready.

Powered by Aszurex.

Trust Beyond Limits.
