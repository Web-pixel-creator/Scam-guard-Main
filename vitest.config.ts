// Standalone Vitest config for server-side logic (risk engine, Telegram bot core).
// Keep Vitest on a small standalone config instead of the app's full
// TanStack Start + Nitro production pipeline; unit/property tests only need
// server-side TypeScript and path aliases.
// Path aliases (`@/...`) are resolved via vite-tsconfig-paths, reading tsconfig.json.
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // Server logic runs on Node, not in a browser/jsdom environment.
    environment: "node",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // No tests exist yet (this is the setup task); also avoids spurious
    // failures when a run is filtered to a path that matches no tests.
    passWithNoTests: true,
  },
});
