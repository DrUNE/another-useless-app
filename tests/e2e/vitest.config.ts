import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.e2e.test.ts"],
    // Запуск браузера и загрузка WASM медленнее обычных тестов.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
