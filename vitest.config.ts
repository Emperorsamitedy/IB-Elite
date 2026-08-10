import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    // Component suites opt into jsdom with a @vitest-environment docblock.
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Next resolves this marker itself; outside next it has nothing to load.
      "server-only": path.resolve(__dirname, "test/server-only-stub.ts"),
    },
  },
});
