import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: [
      "lib/game/**/*.test.ts",
      "lib/game/**/__tests__/**/*.test.ts",
      "lib/swap/**/__tests__/**/*.test.ts",
      "lib/ui/**/__tests__/**/*.test.ts",
    ],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "test/server-only-stub.ts"),
    },
  },
});
