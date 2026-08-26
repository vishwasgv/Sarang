# Agricultural Inputs & Equipment

## What's different about this business type

Agricultural Inputs & Equipment covers stores that sell both consumable farm inputs (fertilizers, pesticides, seeds) and durable farm equipment (tractors, sprayers, pumps) side by side. Rather than inventing a new screen for this, Sarang gives it exactly the tracking each half of the business genuinely needs, borrowed from the two verticals that already solve each half correctly: batch and expiry tracking (the same safety-critical shape Pharmacy uses for medicines) for the consumables, and serial-number and warranty tracking (the same shape Electronics uses for phones) for the equipment — minus IMEI, which is phone-specific and has no equivalent on a tractor or sprayer.

## Fertilizers & Pesticides — batch and expiry tracking

Every fertilizer, pesticide, or seed product you stock in as a batch gets a batch number, manufacturing date, and expiry date, exactly like a pharmacy stocking medicine. Open **Batch Tracking** in the sidebar to record incoming batches and see what's nearing expiry. This matters for the same reason it matters in a pharmacy: agrochemicals genuinely degrade and can become unsafe or ineffective past their expiry date, and a shopkeeper needs to be able to answer "which of my stock expires soonest" at a glance rather than guessing from memory.

## Farm Equipment — serial numbers and warranty

Tractors, power sprayers, water pumps, and other durable equipment are tracked individually by serial number rather than as an undifferentiated quantity, with a warranty period recorded against each unit. Open **Serial Tracking** in the sidebar for this. Unlike Electronics (which also tracks IMEI for mobile phones), Agricultural Inputs deliberately does not enable IMEI tracking — it's a phone-specific identifier that has no meaning for a tractor or sprayer, so that field simply doesn't apply here.

## Equipment Servicing — Job Cards

When a customer brings in a piece of equipment for repair or scheduled servicing, open a job card from **Job Cards** in the sidebar — the same generic job-card workflow Sarang's Repair business type uses. Record what was brought in, the work to be done, parts used, and labor charges, and the job card can be billed once the work is complete.

## Harvest-tied credit terms

A farmer customer often needs to pay after the harvest, not at the time of purchase. When billing a Credit sale, set a real **due date** — Sarang shows an overdue badge on the invoice once that date passes (not the sale date), and the Outstanding Analytics aging report bucket it by the actual due date too, so a deferred-until-harvest payment doesn't get flagged as overdue just because time has passed since the sale.

Typing a flat date is a guess, though — a real farmer's credit terms follow the harvest calendar, not a fixed day count. On a Credit sale, instead of (or alongside) the manual due date, you can **link the invoice to a Crop Season** — a real harvest occurrence you define once (e.g. "Wheat Harvest" on 15 April) and reuse across every credit sale for that crop. Pick it from the dropdown that appears under the due date field, or add a new one there via **Manage Seasons**. Sarang computes the invoice's actual due date from that season's own next harvest occurrence — this year's if it hasn't passed yet, otherwise next year's — so the due date is always tied to a real farming event, not an arbitrary count of days.

## Crop-Linked Product Advisory

If you tag a product with the crop it's meant for (e.g. "Wheat", "Cotton", "Paddy" — any name your own region uses, not a fixed list) via its product record's Recommended Crop field, that product becomes browsable by crop at the point of sale. In Billing, a **Browse by Crop** row of chips appears above the product search once any products are tagged — tap a crop to see every fertilizer, pesticide, or seed recommended for it, with live stock and price, and add straight to the cart. This turns "which fertiliser goes with this crop?" from something a cashier has to remember into something they can look up in two taps.

## Category-specific expiry alerts

Different agri-input categories need different advance warning — seeds and fertilizer often need a longer heads-up than a fast-moving item. Set an **expiry alert lead time** (in days) per product to override the standard 30-day warning window; batches of that product then show their warning badge based on its own configured lead time.

## Combined Dashboard

Open **Agri Dashboard** for a single-screen view across both halves of the business at once — low-stock consumables, expiring/expired batches, total equipment count, and equipment with warranties expiring soon — instead of checking two separate screens.

The same dashboard also tracks **equipment service due dates** — a tractor or sprayer's next scheduled service, separate from its warranty expiry. Set a service date for any piece of equipment on file directly from the dashboard's Equipment Service Due panel, and Sarang flags it there once it's due soon or overdue. Tap **Remind** on a flagged unit to send the customer a WhatsApp reminder with the due date.

## Seasonal Credit Exposure & Farmer Repayment Reports

Two reports in the Reports screen are specific to this business type. **Seasonal Credit Exposure** shows every currently-outstanding credit invoice bucketed by its due month across the calendar year, plus a separate breakdown by linked Crop Season — so you can see at a glance when across the year your credit exposure peaks, which for most agri-input shops clusters tightly around harvest months. **Farmer-Wise Purchase & Repayment History** ranks every credit customer by how reliably they actually repay, riskiest first, distinct from the single-customer Customer Ledger — this is the cross-farmer comparison that tells you who to extend easy credit to next season and who to collect from first.

## Logistics & Supply Chain

Because agri-input retailers routinely receive formal supplier deliveries (fertilizer sacks and equipment arriving by truck), the full Logistics & Supply Chain module set is enabled by default — Fleet, Carriers, Shipments, GRN (goods receipt), Delivery Challan, Freight Ledger, and Logistics Analytics all appear in the sidebar without needing to turn them on separately.

## Everything else

Billing, Customers & Suppliers, Reports, Backup, and Users & Permissions all work exactly as described in their own chapters — nothing about this business type changes how you invoice a sale or take a payment.

## Language

Agricultural Inputs & Equipment is not one of Sarang's professional-service verticals, so it is not language-locked — the full interface is available in all 13 of Sarang's supported languages, the same as Retail, Pharmacy, or any other product-category business type.
