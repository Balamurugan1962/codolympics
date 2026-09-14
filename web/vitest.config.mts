import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Runs first, and refuses a database that is not a test database. See the
    // note in tests/guard.ts for why this is not left to whoever runs them.
    setupFiles: ["./tests/guard.ts"],
    include: ["tests/**/*.test.ts"],
    fileParallelism: false, // the database tests share one schema
    testTimeout: 30_000,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
