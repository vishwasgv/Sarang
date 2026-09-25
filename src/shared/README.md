# Shared code (main + renderer)

Pure functions and data only, no I/O. `utils/money.ts` (`@money`) is the single place for amount arithmetic; `utils/gst-presentation.ts` (`@gst`) for tax presentation; `data/tax-presets.ts` (`@taxpresets`) for country tax data. Anything here needs table/property tests in `__tests__`.
