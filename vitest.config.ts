import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      '@config': new URL('./src/config', import.meta.url).pathname,
      '@middleware': new URL('./src/middleware', import.meta.url).pathname,
      '@utils': new URL('./src/utils', import.meta.url).pathname,
      '@types': new URL('./src/types', import.meta.url).pathname,
      '@routes': new URL('./src/routes', import.meta.url).pathname,
      '@controllers': new URL('./src/controllers', import.meta.url).pathname,
      '@services': new URL('./src/services', import.meta.url).pathname,
    },
  },
});
