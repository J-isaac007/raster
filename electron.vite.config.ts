import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';
import type { Plugin } from 'vite';
import pkg from './package.json' with { type: 'json' };

const here = (path: string) => resolve(import.meta.dirname, path);

/** Import aliases, one per layer. Mirrored in the tsconfigs; see docs/architecture.md. */
const sharedAlias = { '@shared': here('src/shared') };
export const alias = {
  ...sharedAlias,
  '@core': here('src/renderer/src/core'),
  '@editor': here('src/renderer/src/editor'),
  '@platform': here('src/renderer/src/platform'),
  '@app': here('src/renderer/src/app'),
  '@ui': here('src/renderer/src/ui'),
  '@assets': here('src/renderer/src/assets'),
};

/**
 * Locks the packaged app down to its own files. Only added to production
 * builds, because the dev server injects inline scripts for hot reload.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self' data: blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const contentSecurityPolicy = (): Plugin => ({
  name: 'raster-csp',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace(
      '<meta charset="UTF-8" />',
      `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
    ),
});

export default defineConfig({
  main: {
    resolve: { alias: sharedAlias },
  },
  preload: {
    resolve: { alias: sharedAlias },
    build: {
      // Sandboxed preload scripts can't be ES modules.
      rolldownOptions: { output: { format: 'cjs', entryFileNames: '[name].cjs' } },
    },
  },
  renderer: {
    resolve: { alias },
    plugins: [react(), contentSecurityPolicy()],
    // Relative paths so the build loads from the app's files (file://).
    base: './',
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
  },
});
