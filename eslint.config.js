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
    name: "mapachess/stable-text-control-character-rejection",
    files: ["packages/stockfish/src/engineValidation.ts"],
    rules: { "no-control-regex": "off" },
  },
  {
    name: "mapachess/aggregate-open-and-close-failures",
    files: [
      "apps/web/lib/gameplay/openWebMatchRuntime.ts",
      "apps/web/lib/gameplay/webMatchSession.ts",
    ],
    rules: { "preserve-caught-error": "off" },
  },
  {
    name: "mapachess/constructed-worker-test-capture",
    files: ["apps/web/lib/stockfish/webWorkerUciTransport.test.ts"],
    rules: {
      "@typescript-eslint/no-this-alias": [
        "error",
        { allowedNames: ["constructedWorker"] },
      ],
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
