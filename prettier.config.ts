import type { Config } from "prettier"

const config: Config = {
  semi: false,
  plugins: [
    "@ianvs/prettier-plugin-sort-imports",
    "prettier-plugin-tailwindcss",
  ],
  importOrder: ["^@mapachess/(.*)$", "^@/(.*)$", "^[./]"],
}

export default config
