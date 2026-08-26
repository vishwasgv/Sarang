# Footwear

Choosing **Footwear** as your business type turns on the same base module set as Clothing: **size/colour variant tracking**, **Returns**, and the shared **Logistics** module set. Most of it works identically — see the *Clothing* chapter for the full walkthrough of Manage Variants, how a variant is selected in Billing, and how Returns works. The size field's suggestions lean toward shoe sizing (5, 6, 6.5, 7 … up to 12) instead of clothing sizes (XS–3XL), but the size field itself accepts any text either way. Footwear also gets one real differentiator of its own, described below.

## Half-Size & Width Matrix

Shoes have a dimension Clothing doesn't need to track: **width** (Narrow, Regular, Wide, Extra Wide, or whatever fit terms you actually use — it's free text). On **Manage Variants**, a Footwear product's table gets a third **Width** column alongside Size and Colour, and **Generate Size × Width × Colour Matrix** grows a third input field so you can generate every combination in one go — e.g. Sizes "8, 9, 10" × Widths "Regular, Wide" × Colours "Black, Brown" creates 12 variants at once, the same way the two-dimensional version already works for Clothing. Leave the Width field blank on any row (or in the matrix generator) and it behaves exactly like a Clothing product — width is entirely optional, never required.

Width carries through everywhere a variant's identity shows up: the **Select Variant** picker in Billing, printed price labels, the Returns/Exchange screens, and the Suggested Reorder Split table all show it alongside size and colour (e.g. "9 / Wide / Black") — so two pairs of the same size and colour but different width are never confused with each other, on screen or on a printed label.

## Brand-Wise Margin & Return-Rate Report

Assign a **Vendor/Supplier** to your products (the same field used for purchasing) and open **Reports → Brand-Wise Margin & Return-Rate** to see, for each brand, margin and return rate side by side on one chart. This is deliberately not just another margin report — footwear returns tend to run higher than apparel (a pair that doesn't fit is a return, not an exchange for a different colour), so a brand that looks profitable on margin alone can still be quietly losing money to an above-average return rate. The chart shows each brand's margin as a bar and its return rate as an overlaid line, so you can spot that pattern at a glance rather than cross-referencing two separate reports. A brand with a negative margin is shown honestly as a loss, never hidden or floored at zero. Products with no vendor/supplier assigned are left out of this report entirely — assign the ones you want to track.

## Trial-Pair Counter

A shoe sale usually means a customer tries on several sizes before buying one — or none at all — and that pattern is worth tracking on its own, separate from what actually sold. In Billing's **Select Variant** picker, turn on **Track Trial (multiple sizes tried on)** and tap every pair the customer tried instead of the one they're buying. Nothing is deducted from stock at this point — trying on a pair was never a stock movement in Sarang to begin with, only an actual sale is — so there's no "restock" step needed afterward either. Once at least two pairs are marked, either tap **Purchased: [size]** to both record the session and add that exact pair to the cart in one step, or tap **No purchase — record trial only** if the customer walked away empty-handed.

Ask the AI Assistant "what's our trial conversion rate?" for a running summary: what share of trial sessions end in a sale, and on average how many pairs get tried before someone buys (or before they give up). A shop with a low conversion rate but a high average-pairs-tried is a useful signal on its own — it usually means the right size or width isn't in stock, not that customers aren't interested.

## Size Availability Heatmap

Open **Reports → Size Availability Heatmap** for a live, at-a-glance grid of every style (down the left) against every size (across the top) — each cell shows the current combined stock across all colours/widths for that size, coloured red if it's completely out, amber if it's running low, and green if it's healthy. This is a different question from the Size × Style Heatmap covered in the Clothing chapter — that one shows what *sold*; this one shows what's *available right now*, so you can see which sizes need reordering before a customer asks for one you don't have. Styles with the most out-of-stock sizes are listed first, so the most urgent gaps are the first thing you see, not buried in an alphabetical list. Ask the AI Assistant "which sizes are out of stock?" for the same answer as a quick sentence.

## Seasonal Reorder Calendar

Generic reorder logic just looks at recent sales velocity — it has no idea that Monsoon starts in six weeks, or that wedding-season sandals need to be on the shelf before the first booking. Open **Reports → Seasonal Reorder Calendar** and click **Manage Seasons** to define your own buying cycles: a name (Monsoon, Wedding/Formal, Sports, or whatever you actually stock for), a start and end date that repeats every year, and a lead time — how many days before the season starts you need stock in hand. Tag a product to a season the same way you already tag it with a Season/Collection on the ordinary product form.

The calendar itself shows every season you've defined, colour-coded: green if it's currently in season, red if you're inside its lead-time window and should be reordering right now, and neutral if it's still further off. Each card also shows how many of its tagged products are currently low or out of stock, so a red "Reorder Now" card with a high count is your actual to-do list, not just a date reminder. Ask the AI Assistant "what's our seasonal reorder status?" for the same answer as a quick sentence.

## What's shared with every business

Billing, invoicing, payments, Customers, Products, Reports, Backup, and Users & Permissions all work exactly as described in their own chapters.
