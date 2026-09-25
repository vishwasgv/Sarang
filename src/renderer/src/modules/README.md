# Renderer modules

One folder per area (`billing`, `accounting`, `inventory`, verticals, ...), screens under `<area>/ui`. Shared UI and hooks live in `../shared`. Text comes from i18n keys (`../i18n/locales`); service-vertical screens are deliberately English-only. Amounts use `@money`, never raw arithmetic. Full map: `docs/CODE-MAP.md`.
