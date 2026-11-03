/** Shared Vitest defaults; each package re-exports via `defineConfig(shared)`. */
/** @type {import("vitest/config").ViteUserConfig} */
export const shared = {
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    passWithNoTests: true,
    testTimeout: 30_000,
  },
};
