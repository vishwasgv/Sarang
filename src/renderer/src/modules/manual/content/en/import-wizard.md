# Data Import Wizard

Open **Import** from the sidebar to bulk-load Products, Customers, Suppliers, Inventory (opening stock), or Opening Balances from a CSV or Excel (.xlsx) file — useful when switching to Sarang from another system or a spreadsheet, instead of typing hundreds of records in one at a time.

## Step 1 — Choose a module

Pick exactly one of the five import types: **Products**, **Customers**, **Suppliers**, **Inventory**, or **Opening Balances**. Each has its own expected column list, shown once you continue.

## Step 2 — Upload your file

Drag and drop a `.csv` or `.xlsx` file onto the drop zone, or tap **Browse File** to pick one from a dialog. If you don't already have a file ready, tap **Download Template** first — it generates a starter spreadsheet with the correct column headers for the module you picked.

The **Expected columns** panel lists every column the import understands for this module, fetched live so it can never go out of date with what the app actually accepts. A red dot and asterisk mark a column as required; everything else is optional.

**Leading-zero warning**: if any of your SKU, Barcode, or Phone values have leading zeros (like `0012`), format that column as **Text** in Excel before saving. Excel silently strips leading zeros from any column left as General or Number format, and once that happens the original value can't be recovered — Sarang never sees the zero at all.

## Step 3 — Map columns

For each field Sarang expects, pick which column from your file supplies it, using the dropdown next to each field name. Sarang pre-fills a best-guess mapping automatically by matching your file's header names, so most imports only need a quick check rather than mapping every field by hand. A field can only be mapped from one column at a time — picking a new column for a field automatically clears whichever column was mapped to it before.

## Step 4 — Preview

Sarang validates the first 20 rows of your file and shows each one as **Valid**, **Duplicate** (will be skipped — a matching record already exists), or **Error** (will be skipped, with the specific reason shown, like a missing required field or a badly-formatted value). This is a sample, not a full validation — the summary explicitly says only the first 20 rows were checked, and the remaining rows are validated as they're actually processed on import, so final counts can differ slightly from what the preview showed.

## Step 5 — Confirm and run

Before the import actually runs, Sarang always ensures a safety backup exists — either reusing one from the last 15 minutes, or creating a fresh one if none exists. No import proceeds without this backup in place.

Import mode is always **Create Only**: a row whose key (SKU, phone, name — depending on the module) already matches an existing record is skipped, never overwritten. This makes an import safe to re-run on the same file without risk of duplicating or corrupting existing data, but it also means fixing a typo in an already-imported row means editing that record directly afterward, not re-importing.

Tap **Run Import** to start. A progress bar tracks rows processed against the file's total while it runs.

## Step 6 — Results

When the import finishes, you see exactly how many rows were **Imported**, **Skipped** (duplicates), **Failed** (errors), and how many **Warnings** were raised along the way, plus a scrollable list of every specific row error if any occurred. From here, **Import Another File** takes you back to Step 1 for a fresh import, or **Done** closes out the wizard.

## If something goes wrong

Because a safety backup is always taken first, an import that goes badly can be undone by restoring that backup from **Settings → Backup & Restore** — see the Backup & Restore chapter of this Manual.
