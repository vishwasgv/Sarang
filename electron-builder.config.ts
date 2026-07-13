import type { Configuration } from 'electron-builder'

const config: Configuration = {
  appId: 'com.aszurex.sarang',
  productName: 'Sarang Business OS Lite',
  copyright: 'Copyright © 2026 Aszurex. Trust Beyond Limits.',

  directories: {
    output: 'release',
    buildResources: 'resources'
  },

  // ── File packaging ──────────────────────────────────────────────────────────
  // Include the electron-vite build output + the Prisma generated client.
  // All packages listed in package.json "dependencies" are automatically
  // bundled by electron-builder alongside the ASAR (production dep pruning).
  // .prisma/client is generated (not a package) so it must be explicit.
  files: [
    'out/**/*',
    '!out/**/*.map',
    // Generated Prisma client (not in dependencies — must be explicit)
    'node_modules/.prisma/client/**/*',
    '!node_modules/.prisma/client/*.tmp*',
    // @prisma/client ships WASM query engines + compilers for every database
    // Prisma supports (cockroachdb, postgresql, mysql, sqlserver, sqlite) —
    // ~54MB uncompressed. db.ts sets PRISMA_QUERY_ENGINE_LIBRARY to force the
    // native binary engine (query_engine-windows.dll.node, unpacked via
    // asarUnpack below), so none of these WASM engines are ever loaded —
    // not even the sqlite one. Pure dead weight in every installer otherwise.
    '!node_modules/@prisma/client/runtime/query_engine_bg.*.wasm-base64.*',
    '!node_modules/@prisma/client/runtime/query_compiler_bg.*.wasm-base64.*',
    '!node_modules/@prisma/client/runtime/*.wasm',
    // Phase 57 — AI Assistant. node-llama-cpp ships prebuilt native binaries
    // for 5 platform/GPU variants (~695MB combined on a plain npm install);
    // only the Windows CPU-only build is ever used (Section 3 of the master
    // prompt requires gpu:false explicitly — GPU auto-detection crashes with
    // an out-of-VRAM error on real integrated-GPU hardware). Excluding the
    // other 4 saves ~650MB of dead weight in every installer. Validated via
    // a real isolated packaged build (Phase 57.1) before writing this.
    '!node_modules/@node-llama-cpp/win-arm64',
    '!node_modules/@node-llama-cpp/win-x64-cuda',
    '!node_modules/@node-llama-cpp/win-x64-cuda-ext',
    '!node_modules/@node-llama-cpp/win-x64-vulkan'
  ],

  // Unpack native addons from the ASAR — Node.js cannot dlopen() from inside
  // an ASAR archive. The DLL ends up in app.asar.unpacked/ at runtime.
  asarUnpack: ['**/*.node'],

  // ── Extra resources (copied to process.resourcesPath) ───────────────────────
  extraResources: [
    // Migration SQL files — read by the production migration runner in db.ts
    {
      from: 'prisma/migrations',
      to: 'prisma/migrations'
    },
    // Prisma schema — kept alongside migrations for reference
    {
      from: 'prisma/schema.prisma',
      to: 'prisma/schema.prisma'
    },
    // Splash screen HTML — loaded from process.resourcesPath in production
    {
      from: 'resources/splash.html',
      to: 'splash.html'
    },
    // App window icon
    {
      from: 'resources/icon.png',
      to: 'icon.png'
    },
    // Aszurex partnership mark — embedded (base64) into print/export document
    // footers by print.service.ts / export.service.ts (Phase 39)
    {
      from: 'resources/aszurex-mark.png',
      to: 'aszurex-mark.png'
    },
    // Phase 47 — customer-facing QR ordering page, served by the local LAN
    // HTTP server (qr-order-server.ts) at process.resourcesPath, not the ASAR
    {
      from: 'resources/qr-menu',
      to: 'qr-menu'
    },
    // Noto Sans fonts for Indian scripts are bundled via Vite (@fontsource packages)
    // and land in the ASAR under out/renderer/assets/ — no extraResources needed
    // Phase 57 — AI Assistant's bundled local model (Qwen2.5-1.5B-Instruct,
    // Apache 2.0 — see AI_ASSISTANT_MASTER_PROMPT.md for the full model/
    // license/benchmark decision record). Shipped inside the installer, never
    // downloaded on first run, per the founder's explicit "internet should
    // never be required, even if it's 2GB" instruction. The .gguf file itself
    // is not tracked in git (resources/models/README.md) — a real installer
    // build requires placing it manually first.
    {
      from: 'resources/models/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf',
      to: 'models/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf'
    }
  ],

  // ── Windows ─────────────────────────────────────────────────────────────────
  // G11.3: Code signing — set WINDOWS_CERT_PATH and WINDOWS_CERT_PASSWORD env
  // vars in CI to enable signing. Without them the build succeeds unsigned
  // (acceptable for V1 beta internal distribution; required for public releases).
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'resources/icon.ico',
    artifactName: 'Sarang-Business-OS-Lite-Setup-${version}.exe',
    ...(process.env.WINDOWS_CERT_PATH ? {
      certificateFile: process.env.WINDOWS_CERT_PATH,
      certificatePassword: process.env.WINDOWS_CERT_PASSWORD ?? '',
      signingHashAlgorithms: ['sha256'],
      signAndEditExecutable: true
    } : {})
  },

  // ── NSIS installer ──────────────────────────────────────────────────────────
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Sarang Business OS Lite',
    installerHeaderIcon: 'resources/icon.ico',
    installerIcon: 'resources/icon.ico',
    uninstallerIcon: 'resources/icon.ico',
    // Explicit, not relying on electron-builder's auto-detection-by-filename —
    // without this (or a license.txt present at all), the spec-required
    // Welcome -> License -> Path -> Install -> Launch flow silently falls
    // back to a blank placeholder license page instead of real terms.
    license: 'resources/license.txt',
    // Custom hooks: upgrade detection, data preservation messaging, uninstall notice
    include: 'resources/installer.nsh',
    // NEVER delete AppData on uninstall — the DB lives there
    deleteAppDataOnUninstall: false
  },

  // LZMA compression — reduces installer size by ~20-30% vs the ZLIB default
  compression: 'maximum',

  // No auto-update — fully offline, no telemetry, no cloud
  publish: null
}

export default config
