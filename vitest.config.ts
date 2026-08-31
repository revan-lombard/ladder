import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts on purpose: the unit tests cover pure
// functions (money, dates, insight rules) and need none of the app's Vite
// plugins — and vitest 2.x bundles Vite 5 types that clash with Vite 6's.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
})
