import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    ".next-phone/**",
    ".pnpm-store/**",
    ".demo/**",
    ".demo-phone/**",
    ".private-backups/**",
    "node_modules/**",
    "next-env.d.ts",
  ]),
]);
