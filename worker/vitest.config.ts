import { defineConfig } from 'vitest/config'

// Worker logic runs under Node in tests: handler dependencies (fetch, clock,
// edge cache) are injected, so no Workers runtime or network is needed.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
})
