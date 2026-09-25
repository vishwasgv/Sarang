# Guide: Tax Outside India (VAT, Sales Tax and Other Taxes)

Sarang works for businesses in any country. This guide explains how tax works when your business is not on India's GST, and how to set it up. Tax rules differ by country and change, so confirm your rates, tax number format and returns with your local accountant or tax authority. Sarang stores the rates you use; it does not decide them for you.

## Country rules apply only to your country

Sarang loads tax rates and labels **only for the country you choose as your business country**. If your business is in Germany, you see Germany's rates and terms and nothing from any other country. India works exactly as it always has unless you choose another country. You choose the country at first setup, or later in **Settings → Business Profile**.

**Language.** Sarang's screens are available in 13 languages (English, Hindi, Marathi, Gujarati, Kannada, Tamil, Telugu, Malayalam, Spanish, French, Portuguese, Arabic and Indonesian). For a country whose language is not one of these, the country's tax names and notes are shown in **English**, whatever language the rest of the screen uses.

## Step 1: choose your country

At setup, type your country. Sarang recognises about 50 countries and, for each, suggests the tax model, the currency, the tax number label, the standard rates, whether shelf prices usually include tax, and the cash rounding customary there. You confirm each suggestion; nothing is applied silently.

Countries with built-in rates (as of 25 September 2026): India, the United Kingdom, Ireland, Germany, France, Italy, Spain, the Netherlands, Portugal, Belgium, Austria, Poland, Sweden, Denmark, Switzerland, the United Arab Emirates, Saudi Arabia, Oman, Bahrain, Qatar, Kuwait, Egypt, Turkey, Israel, Australia, New Zealand, Singapore, Malaysia, Thailand, Indonesia, the Philippines, Vietnam, Japan, South Korea, China, Hong Kong, Pakistan, Bangladesh, Sri Lanka, Nepal, South Africa, Kenya, Nigeria, Ghana, Canada, the United States, Mexico, Argentina, Chile and Colombia. Qatar, Kuwait and Hong Kong have no VAT or sales tax, so they start with no tax. The United States has no national sales tax and its state rates vary, so you add your own. Brazil has several taxes on one sale and is not included: add your rates by hand. **Rates change**, and the list shows the date it was last checked; always confirm with your tax authority.

If your country is not in the list, the tax rate list starts with a single "No tax" row and a note asking you to add your rates by hand.

## Step 2: check your tax model and rates

| Tax model | Used for | What prints |
|---|---|---|
| **GST** | India | CGST and SGST, or IGST, or one GST line, with your GSTIN |
| **VAT** | Countries with a value-added tax or a GST-style tax (the UK, the EU, the Gulf, Australia, New Zealand, Singapore, Canada and others). The line uses your country's own name for the tax, for example GST in Australia | One line named after your tax |
| **Sales Tax** | The United States and other sales-tax countries | One line named **Sales Tax** |
| **Custom** | Any other tax with its own name | One line named **Tax** |
| **None** | No tax charged | No tax line |

Open **Settings → Tax Configuration**. It lists the rates you charge. If your business country has built-in rates, a button **Load tax rates for {your country}** adds any that are missing (it never deletes or changes the ones you have, and never changes past documents). The screen shows the date the rates were last checked and any notes, for example where a country has provincial or state rates on top. Mark your usual rate as the default, and add any rate that is missing. Then set the right rate on each product (Products → Tax Rate %) or pick it from your saved rates. Sarang warns you gently if a rate you type is not one of your saved rates.

Choose each product's **Tax category**: standard, reduced, zero-rated, exempt, nil-rated or out of scope. A **zero-rated** item (charged at 0 percent but still reportable) is different from an **exempt** one. An exempt customer can be marked tax exempt on the customer's page; their invoices then carry no tax.

## Step 3: prices with tax or without

Shops in many countries show shelf prices that already include tax. At setup Sarang suggests whether prices in your country usually include tax, and you confirm. You can change it any time in **Settings → Currency & Locale → Prices include tax**, and on every document there is a **Prices include tax** switch with the price column labelled **(incl. tax)** or **(excl. tax)**.

Before tax, tax is added on top:

```
taxable value = quantity x price - discount
tax           = taxable value x rate
total         = taxable value + tax
```

Example: 3 items at 10.00, 10 percent discount, VAT 20 percent. Line 30.00, taxable 27.00, VAT 5.40, total 32.40.

Including tax, the tax is taken out of the price you typed: a price of 12.00 including 20 percent VAT gives taxable 10.00, VAT 2.00, total 12.00. The total is always the price the customer sees.

Amounts keep the exact decimals your currency uses (two for dollars, pounds, euros and dirhams; three for dinar; none for yen).

## Step 4: cash rounding

**Settings → Currency & Locale → Invoice rounding** offers None, nearest 0.05, 0.10, 0.50 or 1. Many countries round cash totals (for example to 0.05 in Switzerland, Australia and New Zealand). At setup Sarang suggests your country's usual rule and you confirm. The rounding shows as its own line on the invoice.

## Step 5: tax numbers

Enter your **tax number** in **Settings → Business Profile**; it prints on invoices. The field takes the name your country uses (VAT number, TRN, ABN, EIN, GST number and so on). Customers and suppliers have the same field. Where Sarang is certain of a country's number format it shows a gentle hint if the number looks wrong; it never blocks you from saving. Sarang checks the strict format of Indian GSTIN, PAN and IFSC only.

## Selling to other countries

- **Foreign currency:** on a sales document tick the foreign-currency option, enter the currency code and today's exchange rate. Sarang shows the converted amount and keeps your books in your own currency. When the customer pays, **Settle in {currency}** records any exchange gain or loss.
- **Tax on exports:** many countries zero-rate exports. Use a 0 percent rate with the **Zero-rated** category for those sales and keep your evidence. Ask your accountant which sales qualify.
- **Overseas suppliers:** record a **Supplier Bill** in foreign currency the same way. If you must account for the tax yourself on an import or a service from abroad (reverse charge), tick **Reverse Charge** on the bill.

## Credit notes and debit notes

Each has **Add tax to this note**: skip it and the note total is the amount only; add it and the tax is calculated on the note like any document. See *Guide: Tax and GST, How Sarang Calculates It* for the details.

## Reports you can use for your return

- **Reports → Tax Report:** tax charged on sales, by rate and by tax category, for any date range. Works for every tax model.
- **Reports → Purchase Register:** what you bought, with the tax on each bill, so your accountant can work out the tax you can reclaim.
- **Reports → Profit and Loss**, **Balance Sheet**, **Trial Balance** and **Cash Book** for the period.
- Country-specific return layouts (for example the UK VAT return boxes, the UAE VAT return or Australia's BAS) are not built in yet. Send the Tax Report and the Purchase Register to your accountant or use them to fill your return by hand.

## Limits to know about today

- One tax rate per line. If your country charges two taxes on one sale (for example Canada's federal plus provincial tax, or US state plus county tax), enter the combined rate as one rate for now.
- The GST-specific items (PF and ESI statutory rates, e-way bill and HSN fields) still appear in some screens for non-India businesses; you can ignore them.
- Country return layouts and government e-invoicing submissions are not included.
