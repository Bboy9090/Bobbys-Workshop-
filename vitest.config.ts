// Vitest configuration
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: [{ find: /(?:.*\/core\/lib\/|\.\.\/lib\/)(adb|fastboot|ios|shadow-logger|workflow-validator)\.js$/, replacement: fileURLToPath(new URL('./src-tauri/resources/core/lib/$1.js', import.meta.url)) }] },
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '*.config.{js,ts}',
        'scripts/',
        'server/'
      ]
    },
    include: ['tests/**/*.test.{js,ts}'],
    testTimeout: 10000
  }
});
