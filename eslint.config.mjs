import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [".homeybuild/**", "coverage/**", "node_modules/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: [
      "api.ts",
      "app.ts",
      "src/**/*.ts",
      "widgets/**/*.ts",
      "drivers/**/*.ts",
      "tests/**/*.ts",
      "scripts/garage-demo/**/*.ts",
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.test.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    ...tseslint.configs.disableTypeChecked,
    files: ["scripts/create-garage-demo.mjs"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly", URL: "readonly" },
    },
  },
  {
    ...tseslint.configs.disableTypeChecked,
    files: ["assets/heating-editor.js"],
    languageOptions: {
      globals: { window: "readonly" },
    },
  },
);
