// ESLint com a configuração oficial do Expo (https://docs.expo.dev/guides/using-eslint/).
// No CI ele só AVISA (continue-on-error em .github/workflows/ci.yml): o código antigo ainda tem
// avisos e a ideia é ir limpando aos poucos, não consertar tudo de uma vez.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'web-build/*', 'android/*', 'ios/*', 'coverage/*', '.expo/*', '.claude/*', 'scripts/arquivo/*'],
  },
  {
    rules: {
      // Aspas e apóstrofos em <Text> são texto normal no React Native; a regra é pensada para HTML.
      'react/no-unescaped-entities': 'off',
    },
  },
  {
    // Scripts de manutenção e testes do emulador rodam no Node.
    files: ['scripts/**/*.mjs', 'test/**/*.mjs'],
    languageOptions: { globals: { Buffer: 'readonly', process: 'readonly', console: 'readonly' } },
  },
]);
