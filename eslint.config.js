import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

/**
 * Layer boundaries (see docs/architecture.md). Each renderer layer imports
 * other layers by alias only, and only the ones listed here; `ui` and
 * `main.tsx` may import any of them.
 */
const RENDERER_LAYERS = ['@core', '@editor', '@platform', '@app', '@ui', '@assets'];
const ALL_LAYERS = [...RENDERER_LAYERS, '@shared'];
const REACT = ['react', 'react-dom', 'react-dom/*', 'lucide-react'];

const layer = (name, allowed) => {
  const forbidden = ALL_LAYERS.filter((alias) => alias !== `@${name}` && !allowed.includes(alias));
  return {
    files: [`src/renderer/src/${name}/**/*.ts`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*'],
              message: 'Import other layers by alias (e.g. @core/color), not by relative path.',
            },
            {
              group: forbidden.map((alias) => `${alias}/*`),
              message: allowed.length
                ? `${name}/ may only import ${allowed.join(', ')}.`
                : `${name}/ imports nothing outside itself.`,
            },
            { group: REACT, message: 'React belongs in ui/.' },
          ],
        },
      ],
    },
  };
};

export default tseslint.config(
  { ignores: ['out', 'coverage', 'release'] },
  {
    files: ['**/*.cjs'],
    extends: [js.configs.recommended],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },
  {
    files: ['scripts/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022 },
  },
  {
    // Main process, preload script and build configs run in Node.
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts', '*.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  layer('core', []),
  layer('editor', ['@core']),
  layer('platform', ['@core', '@shared']),
  layer('app', ['@core', '@editor', '@platform']),
  {
    // The main process and preload script share types with the page, nothing else.
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts', 'src/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: RENDERER_LAYERS.map((alias) => `${alias}/*`),
              message: 'Only @shared is common to all processes.',
            },
            { group: ['**/renderer/**'], message: 'Only @shared is common to all processes.' },
          ],
        },
      ],
    },
  },
);
