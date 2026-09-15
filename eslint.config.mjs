import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import { defineConfig, globalIgnores } from "eslint/config";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

export default defineConfig([
  js.configs.recommended,
  ...compat.extends("next/core-web-vitals"),
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // The base JavaScript rule reports TypeScript interface signatures and
      // parameter properties as runtime-unused values.
      "no-unused-vars": "off",
    },
  },
  globalIgnores([".next/**", ".pytest_cache/**", "coverage/**", "node_modules/**"]),
]);
