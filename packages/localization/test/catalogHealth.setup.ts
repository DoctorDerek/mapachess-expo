import { afterEach, expect } from "vitest"
import { getCatalogHealth as compiledHealth } from "@mapachess/localization/catalog"
import { getCatalogHealth as sourceHealth } from "../src/catalog.js"

afterEach(() => {
  for (const health of [sourceHealth, compiledHealth]) {
    expect(health(), "Unexpected localization recovery").toEqual({
      issues: [],
      limitReached: false,
    })
  }
})
