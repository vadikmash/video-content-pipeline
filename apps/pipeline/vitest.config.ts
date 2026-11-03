import { defineConfig } from "vitest/config";
import { shared } from "../../vitest.shared.mjs";

export default defineConfig({
  ...shared,
  test: {
    ...shared.test,
    testTimeout: 180_000,
    hookTimeout: 180_000,
  },
});
