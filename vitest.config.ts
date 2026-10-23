import { defineConfig } from 'vitest/config';
import { alias } from './electron.vite.config.ts';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  resolve: { alias },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
