import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Runs scripts/eval-tailor.ts (npm run eval:tailor). Uses vitest only as a TS runner
// with the same "@/..." alias as the app, so the real tailor code runs unchanged.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, '../src') },
  },
  test: {
    root: path.resolve(__dirname, '..'),
    include: ['scripts/eval-tailor.ts'],
    environment: 'node',
    testTimeout: 180_000,
    reporters: ['verbose'],
  },
})
