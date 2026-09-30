import { defineConfig } from 'vitest/config'

// Worker logic runs under Node in tests: handler dependencies (fetch, clock,
// edge cache) are injected, so no Workers runtime or network is needed.
export default defineConfig({
  // Inline (empty) PostCSS config stops Vite searching parent directories and
  // picking up the app's Tailwind setup, which the Worker does not install.
  css: { postcss: {} },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
})
