# Barcode & Loose/Weight Billing

Barcode generation, barcode label printing, and loose/weight-based billing are optional features for product-selling businesses (retail, pharmacy, general stores, and similar). All three are off by default for every business type — nothing changes about how you bill until you turn them on.

## Turning it on

Go to **Settings → Barcode & Loose Billing** and switch on the features you need, independently of each other:

- **Barcode Generation & Scanning** — auto-generates barcodes for products and enables scanning barcodes at checkout and stock lookup.
- **Barcode Label Printing** — lets you print barcode + price labels, on either a thermal label printer or a regular A4/letter printer.
- **Loose / Weight-Based Billing** — lets you sell a product by weight (e.g. per kg) instead of, or alongside, a fixed pack price.

Turning any of these off later doesn't affect existing barcodes or loose-billed products already set up.

## Setting up a product to sell by weight

In the product's edit form (**Products**), check **Sell by Weight**, then choose a unit (kg, g, L, or mL) and set the **Price per Unit** (e.g. ₹80 per kg). A product is either sold in fixed packs at its normal selling price, or sold loose by weight at this per-unit price — not both at once.

## Generating barcodes

With Barcode Generation on, editing an existing product without a barcode shows a **Generate** button next to the Barcode field — click it to assign one immediately. New products get a barcode automatically at save time if you didn't type one in yourself. Internally generated barcodes are standard 13-digit EAN-13 codes that any ordinary scanner reads, using a reserved number range that real manufacturer barcodes never use, so they can never collide with a scanned-in product code.

If you turned on barcoding after already having products in the system, go to **Settings → Barcode & Loose Billing → Generate Missing Barcodes** to assign a barcode to every product that doesn't have one yet in a single click — safe to run more than once, since it never touches a product that already has a barcode.

## Printing labels

Open **Print Labels** (reachable once Barcode Label Printing is on). Search for or scan a product to add it to the label batch, set how many copies of each label you need (up to 500 per line), choose **A4 / Letter Sheet** or **Thermal Label Printer** as the output, then **Preview** or **Print** directly. If any product in the batch has no barcode yet, Sarang tells you which ones and stops — generate a barcode for them first (from the Products screen or the bulk backfill above).

The thermal label's physical size (width and height in millimetres) is configured once under **Settings → Barcode & Loose Billing → Thermal Label Size** to match your printer's stickers; it doesn't affect A4/sheet printing.

By default, printing labels opens the normal print dialog so you pick a printer each time — this keeps label printing completely separate from your billing/receipt printer, and Windows automatically lists any newly connected USB label printer there the moment it's installed, no setup needed in Sarang. If you'd rather not pick a printer every time, set **Settings → Barcode & Loose Billing → Label Printer** to your label printer once — after that, labels print straight away without a dialog, the same way Kitchen Printer works for restaurants.

## Weighing and printing a loose item

On the same **Print Labels** screen, under **Weigh & Print a Loose Item**: search for a loose-billed product, weigh it on any scale, enter the weight in grams, and click **Print Label**. Sarang works out the price for that exact weight and prints a one-off label with a special barcode that encodes both the product and the weighed amount. Scanning that label at checkout adds it to the bill in a single scan, already priced correctly — no manual weight entry needed at the till.

If you reprint a label for the same product at exactly the same weight after its price has changed, Sarang warns you on screen so you can go find and remove the old sticker — an old physical label scanned later would otherwise charge the outdated price with no way to tell it apart from a fresh one.

## Selling loose items at the counter

At **Billing**, you can either scan a printed weight label (added to the cart instantly at its printed price and weight) or search for a loose-billed product by name and add it manually — it's added at a starting quantity of 1 of its configured unit, which you then adjust to the actual weighed amount before checkout. If a scanned label's printed price no longer matches the product's current price, Sarang still charges what's printed on the label (since that's what the customer sees) but shows a warning so you know to reprint remaining labels at the new price.

Scanning the exact same physical label twice on one bill is flagged with a warning (in case it was an accidental double-scan), though it's still added — genuinely selling two identically-weighed parcels of the same item is a real scenario the system allows.
