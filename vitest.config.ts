import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
export default defineConfig({
  resolve: { alias: { "@": resolve("src") } },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
