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
      "packages/gameplay/src/runtimeLifetime.ts",
      "packages/gameplay/src/matchSession.ts",
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
  {
    name: "mapachess/exported-gifenc-source-ambient-contract",
    files: ["packages/match-presentation/src/profileCardGif.ts"],
    rules: {
      "@typescript-eslint/triple-slash-reference": [
        "error",
        { path: "always" },
      ],
    },
  },
  {
    name: "mapachess/web-component-styling",
    files: ["apps/web/**/*.{js,jsx,ts,tsx}"],
    ignores: ["**/*.test.*", "**/*.spec.*", "**/generated/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@mui/*",
                "@emotion/*",
                "styled-components",
                "styled-components/*",
              ],
              message:
                "Use the project’s Tailwind utilities for component styling.",
            },
            {
              group: ["*.css", "**/*.css", "!./globals.css"],
              message:
                "Import the shared Tailwind entry point and style components with utilities.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: [
            "",
            ":matches(TSAsExpression, TSSatisfiesExpression, ConditionalExpression, LogicalExpression) > ",
          ]
            .map(
              (wrapper) =>
                `JSXOpeningElement[name.type='JSXIdentifier'][name.name=/^[a-z]/] > JSXAttribute[name.name='style'] > JSXExpressionContainer > ${wrapper}ObjectExpression > Property[computed=false]:matches([key.type='Identifier'], [key.type='Literal'][key.value!=/^--/])`,
            )
            .join(", "),
          message:
            "Express DOM appearance with Tailwind utilities. Pass runtime data through CSS custom properties.",
        },
      ],
    },
  },
  eslintConfigPrettier,
])
