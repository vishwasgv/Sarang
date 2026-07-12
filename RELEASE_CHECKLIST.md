# Sarang Business OS Lite — Release Checklist

**App:** Sarang Business OS Lite  
**Company:** Aszurex · Trust Beyond Limits  
**Platform:** Windows 10/11 x64  
**Target installer size:** < 150 MB

---

## Pre-Build Sign-Off

### Assets (REQUIRED before any customer release)
- [x] `resources/icon.png` / `resources/icon.ico` use the founder-approved brand design (Phase 39, 2026-07-03) — no longer a placeholder gradient+glyph
  - To regenerate after a future logo update: place the new source PNGs in `resources/branding-v2/`, update the bounding-box coordinates in `scripts/prepare-brand-assets.js` (measured by direct pixel inspection, see that script's header comment), then run `node scripts/prepare-brand-assets.js && node scripts/generate-icons.js` in that order — the first script writes every consumption location (icon source, renderer assets, print-footer mark) directly, the second regenerates `icon.ico`/`icon.png` from its output
- [x] Splash screen (`resources/splash.html`) uses the real wordmark logo (Phase 39)
- [ ] Confirm `package.json` version is correct (follows semantic versioning: MAJOR.MINOR.PATCH)

### Code Quality
- [ ] `npm run typecheck` passes with 0 renderer errors
- [ ] `npm run lint` passes with 0 warnings
- [ ] All Phase COMPLETION_REPORT.md files are present and marked ✅

### Security Rules (NON-NEGOTIABLE — verify each one)
- [ ] `contextIsolation: true` on all BrowserWindows ← verify in `src/main/index.ts`
- [ ] `sandbox: true` on all BrowserWindows ← verify in `src/main/index.ts`
- [ ] `nodeIntegration: false` on all BrowserWindows ← verify in `src/main/index.ts`
- [ ] Every IPC handler calls `requirePermission()` ← spot-check `src/main/ipc/index.ts`
- [ ] No payment verification or processing logic ← grep for "verify", "process payment"
- [ ] No telemetry, tracking, or external API calls ← `publish: null` in electron-builder config
- [ ] `webSecurity: true` on all BrowserWindows

---

## Build Steps

```bash
# 1. Install/update dependencies
npm install

# 2. Generate Prisma client (must be done after any schema change)
npm run db:generate

# 3. Run TypeScript checks
npm run typecheck

# 4. Build (vite + electron-vite)
npm run build

# 5. Package as NSIS installer
npm run dist:win
```

Output: `release/Sarang-Business-OS-Lite-Setup-{version}.exe`

---

## Post-Build Verification

### Installer
- [ ] Installer file exists at `release/Sarang-Business-OS-Lite-Setup-*.exe`
- [ ] Installer size is under 150 MB
- [ ] Installer signature: `electron-builder` produces unsigned builds by default — sign before distribution if needed
- [ ] Run installer on a CLEAN Windows 10/11 VM (no Node.js, no dev tools)

### Fresh Install Test (target: first invoice in < 15 minutes)
- [ ] App installs without error
- [ ] App launches, splash screen appears, then main window loads
- [ ] Setup Wizard appears (first-run business profile setup)
- [ ] Complete Setup Wizard: business name, type, currency
- [ ] Create first customer
- [ ] Create first product
- [ ] Create first invoice (add product to cart, select customer, confirm)
- [ ] Invoice appears in Invoices list with correct total
- [ ] Record a payment on the invoice
- [ ] **Total time from installer start to first recorded invoice: < 15 minutes** ← PASS/FAIL

### Upgrade Test (from previous version)
- [ ] Install v1.0.0 (or prior version)
- [ ] Create test data (customer, invoice, payment)
- [ ] Note the database path: `%APPDATA%\Sarang Business OS Lite\sarang.db`
- [ ] Run new installer over the old installation
- [ ] Launch app — check console for `[DB] Pre-upgrade backup saved:`
- [ ] Verify backup exists in `%APPDATA%\Sarang Business OS Lite\backups\pre-upgrade-*.db`
- [ ] Verify all test data (customer, invoice, payment) is intact
- [ ] Verify new features from the new version work

### Uninstall Test
- [ ] Note `%APPDATA%\Sarang Business OS Lite\` exists with data
- [ ] Uninstall via Add/Remove Programs (or Control Panel)
- [ ] Verify app is removed from Start Menu and Desktop
- [ ] Verify `%APPDATA%\Sarang Business OS Lite\` STILL EXISTS (data preserved)
- [ ] Verify `sarang.db` and `backups/` folder are still present

### Feature Smoke Test
- [ ] Dark mode toggle works (TopBar Sun/Moon icon)
- [ ] Ctrl+K opens Command Palette with live search
- [ ] Dashboard KPIs load (Today / Week / Month / Year tabs)
- [ ] Billing: create invoice → add items → apply discount → confirm
- [ ] Inventory: create product, update stock
- [ ] Customers: create, view ledger, mark outstanding
- [ ] Suppliers: create, add purchase
- [ ] Reports: Profit & Loss exports to PDF/Excel
- [ ] Settings: change business profile, add user (Owner role)
- [ ] Backup: trigger manual backup, verify file in backups folder
- [ ] Restore: restore from backup, verify data

---

## Known Limitations (Document for customers)
- Windows x64 only (no 32-bit, no macOS, no Linux)
- Requires Windows 10 version 1903 or later
- Minimum 4 GB RAM, 500 MB free disk space
- Icons in this build are placeholders — replace before customer-facing release
- No automatic software updates (customer must run new installer manually)
- UPI QR codes are generated for display only — payment verification is NOT performed
  (this is by design: Sarang records payments, it does not process them)

---

## Release Artifacts
- `release/Sarang-Business-OS-Lite-Setup-{version}.exe` — NSIS installer for distribution
- The installer includes all required runtime files (Electron, Prisma, app code)
- No internet access required for installation or operation
