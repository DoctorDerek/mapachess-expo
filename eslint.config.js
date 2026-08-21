import js from "@eslint/js"
import gitignore from "eslint-config-flat-gitignore"
import eslintConfigPrettier from "eslint-config-prettier/flat"
import { defineConfig } from "eslint/config"

export default defineConfig([
  gitignore({ root: true }),
  {
    ...js.configs.recommended,
    name: "mapachess/javascript",
    files: ["**/*.{cjs,js,mjs}"],
    linterOptions: {
      reportUnusedDisableDirectives: "error",
      reportUnusedInlineConfigs: "error",
    },
  },
  eslintConfigPrettier,
])
