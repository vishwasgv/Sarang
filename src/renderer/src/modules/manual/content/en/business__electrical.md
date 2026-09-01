# Electrical

## What's different about this business type

An electrical store sells a mix of piece-counted items (switches, MCBs, fittings) and wire or cable that's cut to length off a coil — the same coil is one stock item, but each sale is a different length. Electrical also turns on serial and warranty tracking (for switchgear and other individually-identifiable units), job-site running accounts for contractors, and variant tracking (for wire gauges, fitting sizes, and other specs sold under one product name).

## Meter-based wire/cable billing

When creating or editing a product, turn on **Sell by Length** and choose a unit (metres or feet) and a price per unit. At billing time, adding that product to the cart adds it at a quantity of one length-unit rather than one piece, with a fine-grained (0.1-step) quantity input so a cashier can enter exactly how much was cut off the coil — 4.5 metres, not "5 pieces."

## Job-Site Accounts

Open **Job-Site Accounts** in the sidebar to open a running account for a contractor working a specific site — useful when the same electrician is buying material for one job across several visits and you want to track what that job owes as its own thread, separate from the contractor's general customer ledger. Create an account with a name (e.g. "Sharma Residence — Wing B"), the contractor it bills against, and an optional site address.

While billing a CREDIT sale to that contractor, a **Job-Site Account** picker appears — select the account to tag the invoice to it. Open an account from the list to see every invoice tagged to it and the running total billed and outstanding. An account can only be closed once its outstanding balance is fully settled.

## Job Kit Builder

When editing a product and marking it as a kit (see the Inventory chapter for how kits work generally), Electrical products get an extra **Suggest from past orders** button in the kit-component editor. It looks at real invoice history for what's actually been bought alongside this product before — a ceiling fan sold together with wire, a switch, and a junction box, for instance — and pre-fills the component list with the most frequent companions and their typical quantities. Review, adjust, or remove any suggested row before saving; nothing is added to the kit until you save it.

## Reports

Alongside the standard Sales, Inventory, and Financial reports, Electrical gets:

- **Coil Wastage & Yield** — for every length-sold product, how much was received (from purchase records), how much was actually sold by length, and how much was recorded as a stock write-off/adjustment. The yield percentage and estimated wastage make it easy to spot a coil that's losing more material to offcuts than expected.
- **Spec-Wise Fast Movers** — the same fast-mover/slow-mover velocity-versus-margin matrix Hardware stores use, read for Electrical: under variant tracking, a product's name and SKU already carry its spec (wire gauge, fitting size), so this ranks which specs are actually moving fast and which are sitting.
- **ISI/BIS Safety Register** — a traceability register of every serial-tracked unit: which product, its serial/batch number, when it was received, its warranty, and when and to which invoice it was sold — the record you'd need on hand for a safety-compliance check or a recall.

## Language

Electrical is not one of Sarang's service-business templates — it's a product-category business type, so it is **not** language-locked. The core interface is available in all 13 supported languages.
