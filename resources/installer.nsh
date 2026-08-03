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
  ; Ask for confirmation on Cancel instead of quitting immediately — small
  ; touch that avoids an accidental cancel wiping out the user's clicks so far.
  !define MUI_ABORTWARNING
!macroend

; ─────────────────────────────────────────────────────────────────────────────
; Welcome page.
;
; REAL BUG found+fixed while adding this: electron-builder's assisted
; (non-oneClick, non-per-machine) NSIS flow never calls MUI_PAGE_WELCOME at
; all — it jumps straight from customWelcomePage (only if WE define it) to
; the "choose install mode" page. The previous MUI_WELCOMEPAGE_TITLE/TEXT
; defines lived in `customHeader`, which is inserted into the generated
; script AFTER assistedInstaller.nsh has already been !include'd — so those
; defines were set too late to affect anything and the Welcome page never
; rendered. Defining customWelcomePage ourselves (checked FIRST, before
; electron-builder's default page sequence) is the only extension point that
; actually renders. Confirmed by reading the real template chain:
; installer.nsi -> assistedInstaller.nsh -> Modern UI 2's Pages/Welcome.nsh.
!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to Sarang Business OS Lite"
  !define MUI_WELCOMEPAGE_TEXT "Sarang is an offline-first business management system powered by Aszurex.$\n$\nYour data is stored securely on this computer — no cloud, no internet required. Free for your first 12 months.$\n$\nNote: Windows may show a SmartScreen notice for this installer since Sarang is newly released. If you downloaded it from the official Aszurex website, click 'More info' then 'Run anyway' — that's expected and safe.$\n$\nClick Next to continue."
  !insertmacro MUI_PAGE_WELCOME
!macroend

; ─────────────────────────────────────────────────────────────────────────────
; Finish page — same "never actually renders our text" issue as the Welcome
; page above applies here too, and for the same reason. Defining
; customFinishPage replaces electron-builder's default finish-page block
; entirely, so the StartApp/MUI_FINISHPAGE_RUN section below is copied
; verbatim from assistedInstaller.nsh to preserve the existing "Launch Sarang"
; checkbox behavior (already covered by tests/e2e/packaged-fresh-install-flow.js).
!macro customFinishPage
  !define MUI_FINISHPAGE_TITLE "Setup Complete"
  !define MUI_FINISHPAGE_TEXT_LARGE
  !define MUI_FINISHPAGE_TEXT "Setup is complete — Sarang Business OS Lite is ready to use.$\n$\nFirst launch note: if Windows SmartScreen shows a blue notice, click 'More info' then 'Run anyway'. This is expected for a newly released, independently distributed app and appears only once."

  !ifndef HIDE_RUN_AFTER_FINISH
    Function StartApp
      ${if} ${isUpdated}
        StrCpy $1 "--updated"
      ${else}
        StrCpy $1 ""
      ${endif}
      ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
    FunctionEnd

    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !endif

  !insertmacro MUI_PAGE_FINISH
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
