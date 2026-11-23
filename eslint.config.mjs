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
      // New in eslint-plugin-react-hooks 7 (comes with Next 16), written for the React
      // Compiler, which this app doesn't use. The code they flag worked before the
      // upgrade; warn so they show up, and fix them in their own PRs.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "extension/**", "eval-results/**", "coverage/**",
    // `next lint` only checked src/; one-off Node scripts and config files stay out.
    "scripts/**/*.js", "tailwind.config.ts", "postcss.config.*"]),
]);
