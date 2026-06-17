import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = fileURLToPath(new URL('./src', import.meta.url));
const config = fileURLToPath(new URL('./src/config', import.meta.url));
const middleware = fileURLToPath(new URL('./src/middleware', import.meta.url));
const utils = fileURLToPath(new URL('./src/utils', import.meta.url));
const types = fileURLToPath(new URL('./src/types', import.meta.url));
const routes = fileURLToPath(new URL('./src/routes', import.meta.url));
const controllers = fileURLToPath(new URL('./src/controllers', import.meta.url));
const services = fileURLToPath(new URL('./src/services', import.meta.url));

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
      '@': src,
      '@config': config,
      '@middleware': middleware,
      '@utils': utils,
      '@types': types,
      '@routes': routes,
      '@controllers': controllers,
      '@services': services,
    },
  },
});
