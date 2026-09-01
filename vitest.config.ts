import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [".homeybuild/**", "node_modules/**"],
  },
});
