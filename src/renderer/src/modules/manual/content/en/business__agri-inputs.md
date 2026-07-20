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

## Category-specific expiry alerts

Different agri-input categories need different advance warning — seeds and fertilizer often need a longer heads-up than a fast-moving item. Set an **expiry alert lead time** (in days) per product to override the standard 30-day warning window; batches of that product then show their warning badge based on its own configured lead time.

## Combined Dashboard

Open **Agri Dashboard** for a single-screen view across both halves of the business at once — low-stock consumables, expiring/expired batches, total equipment count, and equipment with warranties expiring soon — instead of checking two separate screens.

## Logistics & Supply Chain

Because agri-input retailers routinely receive formal supplier deliveries (fertilizer sacks and equipment arriving by truck), the full Logistics & Supply Chain module set is enabled by default — Fleet, Carriers, Shipments, GRN (goods receipt), Delivery Challan, Freight Ledger, and Logistics Analytics all appear in the sidebar without needing to turn them on separately.

## Everything else

Billing, Customers & Suppliers, Reports, Backup, and Users & Permissions all work exactly as described in their own chapters — nothing about this business type changes how you invoice a sale or take a payment.

## Language

Agricultural Inputs & Equipment is not one of Sarang's professional-service verticals, so it is not language-locked — the full interface is available in all 13 of Sarang's supported languages, the same as Retail, Pharmacy, or any other product-category business type.
