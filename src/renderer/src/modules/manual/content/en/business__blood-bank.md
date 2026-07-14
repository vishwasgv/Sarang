# Blood Bank

## What's different about this business type

A Blood Bank tracks donors, donations, screening, stock, and issue — a workflow with no real equivalent anywhere else in Sarang. It deliberately does **not** use the generic Batch Management screen that Pharmacy and Agricultural Inputs use, even though every usable blood unit becomes a batch record underneath. The generic screen has a fixed 30-day "expiring soon" window and no concept of blood group — both wrong for blood, where a platelet unit is only usable for about 5 days and a whole-blood unit for about 35. So Blood Bank gets its own dedicated **Blood Stock** screen with expiry rules built for blood specifically, while still reusing the same underlying stock ledger everything else uses.

## Donor registry

Open **Donors** in the sidebar to register a new donor — name, phone, date of birth, gender, blood group, and weight. Each donor gets a sequential donor code (e.g. `DNR-202607-0001`). A donor can be marked **deferred** (temporarily or indefinitely ineligible to donate, with a reason), which blocks recording a new donation from them until the deferral period has genuinely passed. You can send a WhatsApp recall reminder to a donor once they become eligible again — Sarang estimates a 90-day recovery interval after a whole-blood donation as a conservative default; always follow your own local medical/regulatory guidance for the real eligibility window.

## Donations & camps

Record each donation under **Donations & Screening** — donor, blood group, component type (Whole Blood, Packed RBC, Platelets, Plasma, or Cryoprecipitate), and volume. You can optionally organize donations under a donation camp (name, location, date, organizer) for camps run away from your own premises.

## Screening

Every donation starts **Pending** screening. Only a **Passed** result creates real, usable stock — it's at that point a batch record is created with an expiry date calculated from the component type's actual shelf life (35 days for Whole Blood, 42 for Packed RBC, 5 for Platelets, 365 for Plasma and Cryoprecipitate). A **Failed** result never enters stock at all. This gate is deliberate: an unscreened or failed unit should never be issuable.

## Blood Stock

Open **Blood Stock** to see every available unit grouped by blood group and component type, with days-to-expiry and an "expiring soon" flag using a per-component alert window (as little as 2 days for platelets, up to 30 for plasma) rather than one generic threshold.

## Issue — compatibility-aware

When issuing units to a recipient, Sarang checks ABO/Rh compatibility between the recipient's blood group and each unit's donor group, using standard rules for whole blood / packed RBC (and the reverse rule for plasma, where AB is the universal donor). This is an advisory safety check shown at the point of selection — it is never a substitute for your lab's own real crossmatch procedure. Platelets and cryoprecipitate have no hard compatibility rule enforced, consistent with common blood-bank practice for those components. Issuing a unit permanently marks it used and reduces the stock ledger; cancelling an un-invoiced issue restores the units.

## Billing

Generate an invoice from a blood issue once every issued unit has a price set and the issue is linked to a customer.

## Language

Blood Bank is not one of Sarang's service-business templates — it's a product-category business type, so it is **not** language-locked. The full interface is available in all 13 supported languages.
