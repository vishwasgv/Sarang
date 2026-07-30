import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['node_modules', 'out', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/main/services/**', 'src/main/utils/**'],
      exclude: ['node_modules', '**/*.test.ts']
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      // Renderer-side aliases, matching electron.vite.config.ts's `renderer`
      // target exactly — added 2026-07-30 alongside the first renderer-side
      // unit test (manual-match.util.ts). No main-process file uses these
      // alias names (they import via relative paths instead), so this is
      // additive and doesn't affect any existing main-process test.
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      '@shared': resolve(__dirname, 'src/renderer/src/shared'),
      '@modules': resolve(__dirname, 'src/renderer/src/modules'),
      '@app': resolve(__dirname, 'src/renderer/src/app'),
      '@assets': resolve(__dirname, 'src/renderer/src/assets')
    }
  }
})
