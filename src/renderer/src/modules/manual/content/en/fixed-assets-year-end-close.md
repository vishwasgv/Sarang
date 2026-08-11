# Fixed Assets & Year-End Close

## The Fixed Asset register

Open **Fixed Assets** from the sidebar and click **New Asset** to record something your business owns and uses over time — a vehicle, equipment, furniture, a laptop — rather than something bought to resell. Enter its purchase date, cost, useful life (in months), depreciation method, and salvage value (what it'll likely be worth once fully depreciated, often zero).

Adding an asset here doesn't post a purchase entry of its own — the purchase itself was already recorded through a Bill or Expense when you actually bought it. This register exists to track what you own and depreciate it correctly over time, not to record the purchase a second time.

## Running depreciation

Open an asset's own detail screen and click **Run Depreciation** for a period. Sarang supports two methods:

- **Straight-Line** — the same amount every period: (cost − salvage) ÷ useful life.
- **WDV (Written-Down Value)** — a declining percentage of the asset's current book value each period, so the depreciation amount is largest early on and shrinks over time.

Each run posts a real Journal Entry (Debit Depreciation Expense, Credit Fixed Assets) and updates the asset's accumulated depreciation. Running depreciation twice for the same period is blocked outright — Sarang won't let you accidentally double-post it.

## Disposing of an asset

When you sell, scrap, or write off an asset, open it and click **Dispose**. Enter the disposal date and (if sold) the amount received. Sarang compares that to the asset's current book value and posts the difference as a real gain or loss — a sale above book value is a gain, below is a loss — so the disposal is reflected correctly in your books, not just marked inactive.

## Closing your financial year

At year end, open **Ledger Settings** and use **Year-End Close**. This is a real, permanent action: it computes every account's balance as of the closing date, folds the year's net income or loss into Owner's Capital (the standard accounting practice of resetting income and expense accounts to zero each year while carrying forward what they actually earned or spent into equity), and posts a single opening entry carrying every balance into the new year.

The closing date is then locked automatically via the same Transaction Locking mechanism described in the Ledger & Journal Entries chapter — nothing in the closed year can be edited afterward, while every closed year's data itself stays fully intact and viewable, never deleted or archived out of reach.

Year-End Close refuses to run again on an already-closed period, and refuses to run on a period with no real activity to carry forward — so it's never accidentally run twice, and never posts an empty or meaningless entry.
