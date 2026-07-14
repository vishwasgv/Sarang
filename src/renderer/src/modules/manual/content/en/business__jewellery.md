# Jewellery

## What's different about this business type

A jewellery item's real selling price isn't a fixed number you set once — it's calculated fresh at the moment of sale, from the item's own net weight, today's market rate for its exact metal and purity, and a making charge. No other pricing mechanism in Sarang covers this, including loose/weight billing — that feature (used for things like rice or spices sold by weight) prices by a fixed per-unit-weight rate that *you* set and that stays put until you change it. Jewellery pricing is different specifically because the rate genuinely fluctuates day to day with the metal market, and has to be looked up fresh each time.

## Setting up a jewellery product

When creating or editing a product, set its **Metal Type** (Gold, Silver, or Platinum) and **Purity** (e.g. "22K", "18K", "999"). Enter its gross weight and, if it has stones or other non-metal material, a stone weight to deduct — Sarang always calculates net weight as gross minus stone weight itself; it's never trusted as a value typed directly on the product, the same way a barcode label's price is never trusted from outside input.

Then choose how the making charge is calculated:

- **Fixed amount** — a flat making charge regardless of weight.
- **Per gram (of net weight)** — a rate multiplied by the item's net weight.
- **Percentage of metal value** — a percentage of (net weight × today's rate).

## Metal Rates

Open **Metal Rates** in the sidebar to set today's rate per gram for each metal-type-and-purity combination you stock (22K gold and 18K gold genuinely trade at different rates, so each combination gets its own row). There's no automatic internet rate feed — consistent with Sarang's offline-first design, you look up today's rate wherever you normally do and type it in. Update this whenever the rate changes; every sale from that point on uses the current value.

## How a sale is priced

At billing time, adding a jewellery item to the cart looks up its metal type and purity's current rate, computes metal value (net weight × rate), adds the making charge, and uses that as the line's unit price. If no rate has been set yet for that item's metal/purity combination, Sarang will not let you bill it at zero — you'll be prompted to set today's rate first.

## Old-metal exchange

Open **Old-Metal Exchange** to record a customer trading in old gold or silver against a new purchase. Enter the gross weight, a deduction weight (for any non-metal content), metal type, and purity — Sarang looks up today's rate for that combination and calculates the value to give the customer (net weight × rate). This is standalone record-keeping: the computed value isn't wired automatically into an invoice. Staff apply it manually as a discount on the customer's new-purchase invoice, then link the exchange record back to that invoice afterward so the two stay connected for your records.

## Returns

Jewellery has the Returns module enabled, the same return-processing workflow used by Retail, Clothing, and Footwear.

## Reports

**Reports** includes a jewellery stock report showing net weight, current rate, and total valuation grouped by metal type and purity.

## Language

Jewellery is not one of Sarang's service-business templates — it's a product-category business type, so it is **not** language-locked. The full interface is available in all 13 supported languages.
