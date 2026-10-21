import js from "@eslint/js"
import gitignore from "eslint-config-flat-gitignore"
import eslintConfigPrettier from "eslint-config-prettier/flat"
import { defineConfig } from "eslint/config"
import tseslint from "typescript-eslint"
import "eslint-plugin-only-warn"

export default defineConfig([
  gitignore({ root: true }),
  {
    name: "mapachess/linter-options",
    linterOptions: {
      reportUnusedDisableDirectives: "error",
      reportUnusedInlineConfigs: "error",
    },
  },
  {
    ...js.configs.recommended,
    name: "mapachess/javascript",
    files: ["**/*.{cjs,js,mjs}"],
  },
  {
    name: "mapachess/typescript",
    files: ["**/*.{ts,tsx,mts,cts}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          ignoreRestSiblings: true,
          reportUsedIgnorePattern: true,
        },
      ],
      "prefer-const": ["error", { ignoreReadBeforeAssign: true }],
    },
  },
  {
    name: "mapachess/mobile-metro",
    files: ["apps/mobile/metro.config.js"],
    languageOptions: {
      globals: {
        __dirname: "readonly",
        module: "readonly",
        require: "readonly",
      },
    },
  },
  eslintConfigPrettier,
])
