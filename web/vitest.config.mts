import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false, // the database tests share one schema
    testTimeout: 30_000,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
