// `pnpm lint` (CI) had no configuration to run against.
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2020, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { node: true, es2020: true },
  rules: {
    // `_name` marks a deliberately unused parameter throughout src/.
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    // Poll loops are written `while (true)` with an explicit return/break.
    'no-constant-condition': ['error', { checkLoops: false }],
  },
};
