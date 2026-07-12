# PHASE 38 UAT SCRIPT — Barcode System + Loose/Weight Billing

Manual click-through was **not** performed by the implementing agent, per standing project convention (rely on the automated suite + typecheck as the correctness net for implementation work; manual UI passes are user-triggered or reserved for the pre-release checklist). This script is for the user to run, or to explicitly approve having an agent run, as a real-world sanity check before shipping.

**Setup**: In Settings → Barcode & Loose Billing, turn on all three toggles (Barcode Generation & Scanning, Barcode Label Printing, Loose/Weight-Based Billing) — everything below assumes they're on. Confirm they're off by default on a fresh install first (should see none of this UI/behavior with all three off).

## 1 — Barcode generation
1. Create a new product, leave Barcode blank, save. Reopen it — a 13-digit barcode should now be present (starts with `20`).
2. Edit an existing product that has no barcode. Click the barcode-generate button next to the Barcode field. A barcode appears in the field; save.
3. Manually type a real product barcode (e.g. one off an actual grocery item) into the Barcode field on a new product. Save — should be accepted as-is (not overwritten by auto-generation, since a barcode was supplied).
4. Type a deliberately wrong 13-digit number (change the last digit of a known-valid one) into the Barcode field — should show a validation error about the check digit, not save silently.

## 2 — Bulk backfill
1. Go to Settings → Barcode & Loose Billing → "Generate Missing Barcodes". Run it once — note the count reported.
2. Run it again immediately — should report 0 generated (idempotent), no errors.
3. Spot-check 2-3 products that previously had no barcode — they should now have one, and any product that already had a barcode should be unchanged.

## 3 — Scanning at checkout
1. On the Billing screen, with the product-search box focused, scan (or manually type + Enter quickly) a product's barcode. It should look up and add that product to the cart directly (single-match auto-add), not just filter the search results.
2. Scan a barcode that doesn't match anything — should show a clear "not found" message, not a silent no-op or a crash.

## 4 — Loose/weight billing setup
1. Edit or create a product, check "Sell this product loose / by weight". Set unit to `kg`, price per unit to e.g. ₹80.
2. Try saving with the checkbox on but no unit/price selected — should show validation errors, not save.
3. Save with unit + price filled in — should succeed.

## 5 — Weigh and print
1. Go to Print Labels → "Weigh & Print a Loose Item". Search for the loose-billed product from step 4, enter a weight in grams (e.g. `250`), click Print Label.
2. Try entering `0` or a negative number — should be rejected with a clear message, no label generated.
3. Try entering `0.4` (sub-gram) — should be rejected (this was a real bug found and fixed during review: a sub-gram weight used to round to zero and produce an unscannable "phantom" label).
4. Print a label successfully, note the printed price.

## 6 — Scanning a weight-embedded label at checkout
1. Scan the label from step 5.4 at the Billing screen — it should add a cart line with the correct weight (e.g. "0.25 kg" or similar) and the price charged at print time.
2. Now go back to the product and change its price-per-unit (e.g. from ₹80 to ₹90/kg). Scan the *same, already-printed* label again.
   - The bill should charge the **old, printed price** (₹80-based), not the new ₹90 price.
   - A visible warning should appear telling staff the price may be outdated and to reprint the label.
3. Check that the cart line for this loose item shows real stock (not "only 0 available" — this was a real bug found and fixed: the stock lookup was previously missing on this exact path).

## 7 — Batch label printing
1. Go to Print Labels, search and add 2-3 products (mix of barcoded fixed-price and loose-billed products), set different copy counts for each.
2. Choose "A4 / Letter Sheet", click Preview — a grid of labels should render in the preview panel with barcode, name, and price for each.
3. Switch to "Thermal Label Printer" mode, Preview again — should show one label per (simulated) page instead of a grid.
4. Click Print on either mode — the OS print dialog should open (or, if no printer configured, produce a reasonable error rather than hanging indefinitely).
5. Try typing a very large copy count (e.g. 5000) into a line's copies field — should be capped at 500, not accepted as-is (fixed during review — this used to be enforceable only by the UI's decorative max, not actually enforced).

## 8 — Role/permission check
1. Log in as a Cashier-role user (not Admin/Manager). Navigate to Print Labels — should be reachable (assuming `barcode_printing` is enabled).
2. As Cashier, try the Weigh & Print flow and a batch Print — both should succeed (this was a real bug found and fixed: Cashier previously had view access to the screen but every actual action failed with a permission error).
3. Log in as Staff (no `products.printLabels`) — the Print Labels sidebar entry should not appear at all (module gate), separate from the permission check.

## 9 — Turning features off
1. In Settings, turn off Loose/Weight-Based Billing. Confirm: an already-configured loose-billed product's data is untouched (reopen it — sellByWeight/unit/price still there), but the checkbox/fields should no longer be offered on the product form for *new* configuration (or should reflect the module being off, per whatever the actual UI shows).
2. Turn off Barcode Generation & Scanning entirely (all three toggles off). Confirm the product form, POS screen, and sidebar look exactly as they did before this phase — no leftover UI, no broken layout.

## 10 — Non-adoption baseline
On a **fresh setup** (or a business that has never touched these settings), confirm: no Barcode & Loose Billing UI appears anywhere unrequested, no forced setup step, product creation/editing/billing works exactly as it did before Phase 38.

## 11 — Gram/millilitre pricing (regression check for a real bug found and fixed)
1. Create a loose-billed product priced **per gram**, e.g. saffron at ₹500/g.
2. Weigh & Print a label for 5 grams. The printed price should read **₹2,500** (5 × 500), not ₹2.50.
3. Scan that label at checkout — the cart should charge the same ₹2,500, matching the label exactly.
4. Repeat with a product priced **per millilitre** — confirm the same correct (not-divided-by-1000) math.
5. Confirm a `kg`- or `L`-priced product still divides by 1000 correctly (e.g. 250g of an ₹80/kg product = ₹20).

## 12 — Selling a loose product without a printed label
1. With a loose-billed product configured, go to Billing and search for it **by name** (not by scanning) and click to add it — do not use Weigh & Print at all.
2. It should be added priced at its per-unit price (e.g. ₹80/kg), not its (likely meaningless) fixed selling price, with a toast prompting you to adjust the quantity to the actual weight.
3. Adjust the quantity field to the real weighed amount and confirm the line total updates correctly.

## 13 — Double-scan of the same label
1. Weigh & print one weight-embedded label.
2. Scan it once at checkout — added normally.
3. Scan the **exact same physical label** again in the same bill — a warning should appear ("Label already scanned"), but it should still be added as a second line (not silently blocked) in case that's genuinely intended.

## 14 — Reports reflect loose units
1. Sell some quantity of a loose-billed product.
2. Open the Inventory report — the loose product's stock should show in its actual unit (e.g. "12.5 kg"), not a generic "PCS".
3. Open the Sales report — the "Items" column should show a sensible count, not a confusing fractional number mixing weights with piece-counts from other lines on the same invoice.

## 15 — Reprint-at-changed-price warning
1. Weigh & print a label for a loose product at exactly 250g.
2. Change that product's price per unit.
3. Weigh & print a label for the **same product at exactly 250g again**. A second warning should appear alongside "Label Printed" — something like "Check the shelf for an old label" — telling you a label at that exact weight was printed before at a different price.
4. Repeat step 3 immediately (reprint at the same, already-changed price) — this time the extra warning should **not** appear, since the price hasn't changed since the last print.
