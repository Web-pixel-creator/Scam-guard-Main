// Standalone Vitest config for server-side logic (risk engine, Telegram bot core).
// Keep Vitest on a small standalone config instead of the app's full
// TanStack Start + Nitro production pipeline; unit/property tests only need
// server-side TypeScript and path aliases.
// Path aliases (`@/...`) are resolved via vite-tsconfig-paths, reading tsconfig.json.
import path from "node:path";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // Explicit alias ensures @/ resolves for ALL imported files (including
      // scripts/ which sits outside tsconfig's `include` array).
      "@/": path.resolve(__dirname, "src") + "/",
    },
  },
  test: {
    // Server logic runs on Node, not in a browser/jsdom environment.
    environment: "node",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Large in-process dialogue corpora are CPU-bound. Bound file concurrency
    // on high-core hosts; keep each test's deadline and isolation unchanged.
    maxWorkers: 2,
    // Preserve the existing behavior for optional, narrowly filtered runs.
    passWithNoTests: true,
  },
});
