; ─────────────────────────────────────────────────────────────────────────────
; Sarang Business OS Lite — Custom NSIS installer hooks
; Included by electron-builder into the generated NSIS installer script.
;
; RULES:
;   • NEVER delete %APPDATA%\Sarang Business OS Lite\ (database lives here)
;   • On upgrade: inform user that data is preserved; app handles backup
;   • On uninstall: leave user data intact; inform user where it is
;
; NOTE: All conditional jumps use named labels (not relative +N offsets) to
;       avoid off-by-one errors when NSIS instruction counts change.
; ─────────────────────────────────────────────────────────────────────────────

; Called at the very top of the generated installer script (global defines)
!macro customHeader
  !define MUI_WELCOMEPAGE_TITLE "Welcome to Sarang Business OS Lite"
  !define MUI_WELCOMEPAGE_TEXT "Sarang is an offline-first business management system powered by Aszurex.$\n$\nYour data is stored securely on this computer — no cloud, no subscription, no internet required.$\n$\nClick Next to continue."
!macroend

; Called during installer .onInit (runs before any page is shown)
; Detects whether this is an upgrade or a fresh install by checking for an
; existing database in %APPDATA%. Result is stored in $0 for use in customInstall.
!macro customInit
  IfFileExists "$APPDATA\Sarang Business OS Lite\sarang.db" sarang_isUpgrade sarang_isFresh
  sarang_isUpgrade:
    StrCpy $0 "upgrade"
    Goto sarang_initDone
  sarang_isFresh:
    StrCpy $0 "fresh"
  sarang_initDone:
!macroend

; Called after the app files have been copied to the install directory.
; Shows data directory info in the detail log, and an upgrade notice if applicable.
!macro customInstall
  DetailPrint ""
  DetailPrint "Data directory: $APPDATA\Sarang Business OS Lite\"
  DetailPrint "Your invoices, inventory, and backups are stored there."
  DetailPrint "This folder is NEVER removed by the uninstaller."
  DetailPrint ""

  StrCmp $0 "upgrade" sarang_showUpgradeNotice sarang_installDone
  sarang_showUpgradeNotice:
    DetailPrint "Upgrade detected — existing data will be preserved."
    DetailPrint "A pre-upgrade backup is created automatically on first launch."
  sarang_installDone:
!macroend

; Called during uninstall, before app files are removed.
; %APPDATA%\Sarang Business OS Lite\ is NOT in the install directory, so it is
; NEVER removed by the generated uninstaller. We show an informational message
; so the user knows their data is safe.
!macro customUnInstall
  IfFileExists "$APPDATA\Sarang Business OS Lite\sarang.db" sarang_hasData sarang_noData
  sarang_hasData:
    MessageBox MB_ICONINFORMATION|MB_OK \
      "Sarang has been uninstalled.$\n$\nYour business data is preserved at:$\n$\n  $APPDATA\Sarang Business OS Lite\$\n$\nYou can safely delete this folder if you no longer need your data." \
      /SD IDOK
  sarang_noData:
!macroend
