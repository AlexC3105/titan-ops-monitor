import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Test config kept separate from vite.config.ts so the PWA plugin and dev proxy
// stay out of the test run. Tests never touch the network: adapters are fed
// recorded fixtures from test/fixtures through a stubbed global fetch.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
    unstubGlobals: true,
  },
})
