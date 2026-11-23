import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Same as before the Next 16 upgrade: these warn, they don't fail CI.
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "prefer-const": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "extension/**", "eval-results/**", "coverage/**",
    // `next lint` only checked src/; one-off Node scripts and config files stay out.
    "scripts/**/*.js", "tailwind.config.ts", "postcss.config.*"]),
]);
