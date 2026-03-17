// @ts-check
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['.next/', 'node_modules/', 'public/'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
)
