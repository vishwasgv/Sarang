# Rental Business

## What's different about this business type

Rental Business is deliberately generic — it's built to cover any short-term checkout-and-return rental, whether that's tents and utensils for a wedding, clothing, cars or bikes, a short-stay home, jewellery-for-a-day, gaming stations, electronics, or furniture. What all of these share is the same booking → checkout → return lifecycle, billed by a time-based rate rather than a one-time sale price. This is distinct from Real Estate's Property module, which is for long-term leases with no checkout/return cycle at all.

## UNIT vs. BULK tracking

Each rentable product is tracked one of two ways:

- **UNIT** — for individually distinct assets, like one specific car, one particular wedding gown, or a numbered gaming console. Each physical item gets its own entry in **Rental Units** with a unit label and condition notes, and a booking claims one specific unit for its date range.
- **BULK** — for pooled, interchangeable quantity, like "50 plastic chairs" or "20 dinner plates." There's no per-item identity, just a total quantity owned and how much of it is already committed to overlapping bookings.

## Setting rental rates

A rentable product can have a rate for any combination of **HOUR, DAY, WEEK, MONTH, or YEAR** — set whichever apply when you mark a product rentable. A booking picks one rate basis per item; the duration is calculated in that unit and rounded up (a booking of just over one day still bills as one full day, never a fraction).

## The booking lifecycle

Open **Rental Bookings** in the sidebar. A booking moves through:

1. **Reserved** — created for a customer, a date/time range, and one or more items, with an optional security deposit collected up front.
2. **Checked Out** — the item(s) physically leave with the customer. For UNIT items, the specific unit's status becomes Rented.
3. **Returned** — the item(s) come back. You record any damage charge and how much of the security deposit is refunded (by default, the deposit minus any damage charge). If the return is late, a late fee is calculated automatically from each item's own rate, normalized to a per-day figure, times a configurable late-fee multiplier (1.5× by default).

A Reserved booking can also be **Cancelled** (before checkout) or **Extended** to a later end date/time (as long as the item stays available through the new range).

## Availability is always live, never a stock decrement

Sarang never decrements a stock quantity when a rental is checked out. Instead, availability — for both UNIT and BULK items — is computed live from every currently Reserved or Checked-Out booking that overlaps the requested date range. This matters because a reservation has to block availability *before* checkout: two customers trying to reserve the same last tent for overlapping dates must not both succeed, which a "decrement only at checkout" model would miss.

## Billing

Generating an invoice from a completed booking creates line items for each rented item's charge, plus separate lines for any late fee and damage charge. The security deposit is deliberately **not** part of the invoice — it's tracked only as a collected/refunded amount on the booking itself, since it's a holding, not revenue.

## Reports

**Reports** includes a Rental Status report (what's currently checked out, and what's overdue) and a Rental Revenue report by product, including a utilization percentage for UNIT-tracked assets.

## Language

Rental Business is not one of Sarang's service-business templates — it's a product-category business type, so it is **not** language-locked. The full interface is available in all 13 supported languages.
