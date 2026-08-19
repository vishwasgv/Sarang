# Retail

Choosing **Retail** as your business type turns on **Returns** plus the shared **Logistics** module set. Everything else — Billing, Products, Customers, Inventory, Reports — works exactly as described in those chapters; this chapter covers what's specific to a retail shop.

## Returns

Open **Returns** from the sidebar to process a customer return or exchange against a past sale. Search for the original invoice by its invoice number, and Sarang loads its items with a **Max Return** quantity for each one — this is the original quantity minus anything already returned against that same invoice on an earlier visit, so you can never accidentally return more of an item than the customer actually bought (Sarang checks and blocks this on save too, not just in the quantity stepper).

Pick the quantity to return for each item using the +/− steppers, enter a reason (required), and submit. This creates a proper **return invoice** (its own invoice number, prefixed `RET-`) that reverses the original sale's revenue, discount, and tax proportionally — it isn't a silent inventory adjustment, it's a real linked transaction you can find later from either invoice.

## Logistics & Supply Chain

Because Retail's default template includes the Logistics modules, you also get **Fleet**, **Carriers**, **Shipments**, **GRN**, **Delivery Challan**, **Freight Ledger**, and **Logistics Analytics** for tracking your own delivery vehicles and supplier shipments — see the Logistics screens under those names in the sidebar.

## Reports

Open **Reports → Dead-Stock Clearance List** to see every product still sitting in stock with no sale in the last 90 days — a bar chart plus a full table, sorted so the products tying up the most money sit at the top, not just the oldest. Each row shows the product's current stock, its cost, and the resulting **capital locked** (stock × cost) — the real rupee amount doing nothing on your shelf. A product that has never sold at all shows "Never Sold" instead of a last-sale date, an honest distinction from one that simply hasn't sold recently. Use this list to decide what genuinely needs a markdown, a bundle, or a clearance push — not a guess based on which shelf looks dusty.

Open **Reports → Category Sell-Through Rate** to see, month by month, how much of each product category's available stock is actually moving — a grouped bar chart plus a full table, one bar per category per month. Each bar is the share of that category's sold-plus-in-stock units that sold in that month: a fast-moving category sits high, one quietly piling up sits low. Every month shown is compared against your CURRENT stock on hand rather than that month's own historical stock level, so read it as a trend view of what's selling right now, not an exact month-by-month history — genuinely useful for spotting which categories deserve more shelf space or a bigger reorder, and which ones need to slow down, without eyeballing dozens of individual products one at a time.

Open **Reports → Basket Composition** to see which products your customers most often buy together in the same sale — a bar chart plus a full table listing every product pair, sorted by how many baskets contained both. The summary alongside it shows your total number of baskets in the period, the average number of different items per basket, and the average basket value. Use this to decide what to place side by side on the shelf, or which combo deal is actually backed by real buying behavior rather than a guess.

## Price Markdowns

Open **Price Markdowns** from the sidebar to cut a product's price for a limited time and have it revert on its own — no need to remember to change it back. Pick a product, set the markdown price, and choose the date it should end; the new price applies to the product immediately, and Sarang automatically restores the original price once that date passes (checked on app startup and roughly every hour, so you don't need the app open at the exact moment). Only one markdown can be active on a product at a time — cancel the current one first if you need to change the terms.

If you change that product's selling price yourself while a markdown is still running, Sarang notices: the automatic revert is skipped rather than overwriting your manual change, and the markdown simply closes out marked "Manually Changed" instead of "Reverted" — so a markdown can never silently undo a price decision you made on purpose. Use **Cancel** on an active markdown to end it early — if the price hasn't been touched since the markdown started, it reverts to the original immediately; if it has, cancelling just stops tracking the markdown without touching the price. **Check Now** on this screen runs the same revert check on demand, in case you don't want to wait for the next automatic pass.

## Loyalty Program

Open **Loyalty Program** from the sidebar to run a simple punch-card reward — set how many visits earn a reward and what that reward is (a free item, a percentage off, anything you'd offer). Once it's turned on, a punch is added automatically to a customer's card on every qualifying sale — there's no extra step at checkout, and you can set a minimum purchase amount if you only want punches on sales above a certain size.

This screen shows every customer's current progress toward their next reward, along with how many they've earned in total and how many rewards they've already redeemed. Once a customer reaches the target, **Redeem** here to give them their reward — this uses up exactly the punches needed, so any extra punches beyond the target carry over toward their next one rather than being lost.

## What's shared with every business

Billing, invoicing, payments, Customers, Products, Reports, Backup, and Users & Permissions all work exactly as described in their own chapters. A retail shop can also turn on cross-cutting extras independently from **Settings → Additional Business Features** — Barcode generation/printing and Loose/Weight billing are common choices for a retail store, but are off by default and not specific to the Retail business type.
