# Services

One `<area>.service.ts` per area; business logic only, no UI or IPC knowledge. Full map: `docs/CODE-MAP.md`; rules: `docs/CODE-STANDARDS.md`.

Groups (by file name):
- Sales and documents: `billing`, `quotation`, `sales-order`, `credit-note`, `debit-note`, `returns`, `held-sale`, `recurring-profile`, `payment`, `payment-overdue`
- Purchases: `purchase-order`, `bill`, `supplier`, `supplier-payment`, `supplier-ledger`, `landed-cost`, `logistics-grn`
- Tax and money: `tax`, `tax-preset`, `india-gst-slabs`, `tax-category-backfill`, `gst-type.util`, `note-tax.util`, `currency`, `valuation`
- Books: `journal-entry`, `chart-of-accounts`, `financial-statements`, `report`, `customer-ledger`, `bank-*`, `fixed-asset`, `year-end-close`, `budget`
- Inventory: `product`, `inventory`, `batch`, `serial`, `variant`, `location`, `kit`, `bom`, `production-order`
- People: `customer`, `hr`, `payroll`, `auth`, `license`
- Messaging: `notification*`, `khata-reminder`, `message-template*`, `share`
- Ask Sarang: `ai-*`
- Verticals (business-type features): everything else, one service per feature (hotel, restaurant, clinic, legal, tours, ...)

All money arithmetic uses `@money`. Tests live in `__tests__/`.
