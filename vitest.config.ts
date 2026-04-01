import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'packages/**/__tests__/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@zure/rule-engine': resolve(__dirname, 'packages/rule-engine/src'),
    },
  },
});
