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

Need to negotiate the making charge for one particular sale without changing the product's own configured rate? Edit it directly on the cart line — the line's price recomputes immediately, and an overridden line is visually flagged so it's obvious at a glance that it's not using the standard charge.

If the item has a **hallmark/HUID number** recorded on the product, it's captured on the sale and printed on the invoice automatically.

## Old-metal exchange

Open **Old-Metal Exchange** to record a customer trading in old gold or silver against a new purchase. Enter the gross weight, a deduction weight (for any non-metal content), metal type, and purity — Sarang looks up today's rate for that combination and calculates the value to give the customer (net weight × rate).

To use it, click **Apply Old-Metal Exchange** while billing that customer — Sarang shows the credit and folds it straight into the invoice's discount as the sale is created, and marks the exchange as used so it can never accidentally be applied a second time to a different invoice.

Each exchange record also shows a **pure-equivalent weight** alongside its raw weight — the net weight normalized by purity (a 24g piece at 22K is 22g of pure gold), so a 22K exchange and an 18K exchange are directly comparable at a glance rather than only in raw grams.

## Gold Savings

Open **Gold Savings** in the sidebar to run a customer chit scheme — fixed monthly deposits toward a future purchase. Create a scheme with a monthly amount, a tenure in months, and a start date, then record each **installment** as the customer pays it; the scheme's total deposited updates automatically.

When the customer is ready to buy, **Redeem** the scheme — optionally adding a bonus amount if the scheme's own terms include one (e.g. "pay 11 months, get the 12th free") — then apply the redeemed total as a discount on the customer's purchase invoice yourself in Billing, the same way an old-metal exchange credit is applied.

## Returns

Jewellery has the Returns module enabled, the same return-processing workflow used by Retail, Clothing, and Footwear.

## Reports

**Reports** includes a jewellery stock report showing net weight, current rate, and total valuation grouped by metal type and purity, plus four more: **Making-Charge vs. Metal-Value Margin** breaks down the true margin per sale — how much of each invoice is metal value versus making charge, rather than one blended number across the whole period. **Hallmarking / HUID Compliance Register** lists every active jewellery item and flags which ones are missing a BIS hallmark/HUID number, so a gap can be found and fixed before an inspection rather than after one. **Metal Rate vs. Sales Volume** correlates rate swings with how much you actually sold, auto-picking whichever metal and purity moved the most in the period. **Purity-Adjusted Exchange Analytics** takes old-metal exchange further than the raw log — normalizing every exchange to its pure-metal-equivalent weight so exchanges of different purities can be compared and trended fairly.

## Language

Jewellery is not one of Sarang's service-business templates — it's a product-category business type, so it is **not** language-locked. The full interface is available in all 13 supported languages.
