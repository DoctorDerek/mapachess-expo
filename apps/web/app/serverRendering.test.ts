import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import loadCatalog from "@mapachess/localization/catalog"
import sanitizeWebsiteAnalyticsEvent from "../lib/sanitizeWebsiteAnalyticsEvent"
import RootLayout, { metadata } from "./layout"
import HomePage from "./page"

const analytics = vi.hoisted(() => ({
  beforeSend: null as typeof sanitizeWebsiteAnalyticsEvent | null,
}))
vi.mock("next/font/local", () => ({
  default: () => ({ variable: "test-local-font" }),
}))
vi.mock("@vercel/analytics/next", () => ({
  Analytics: ({
    beforeSend,
  }: {
    beforeSend: typeof sanitizeWebsiteAnalyticsEvent
  }) => {
    analytics.beforeSend = beforeSend
    return null
  },
}))
afterEach(() => vi.unstubAllEnvs())

describe("server-rendered first arrival and site boundaries", () => {
  it("renders deterministic English restoration before browser storage or engine capabilities are available", () => {
    vi.stubEnv("VERCEL_ENV", "preview")
    const markup = renderToStaticMarkup(
      createElement(RootLayout, { children: createElement(HomePage) }),
    )
    expect(markup).toContain('<html lang="en"')
    expect(markup).toContain("Mapachess")
    expect(markup).toContain(loadCatalog("en").introduction.heading)
    expect(markup).not.toContain("iframe")
    expect(metadata.description).toBe(
      loadCatalog("en").presentation.metadataDescription,
    )
    expect(metadata.alternates?.canonical).toBe("/")
  })

  it("wires the privacy sanitizer to production analytics rather than exposing navigation query data", () => {
    vi.stubEnv("VERCEL_ENV", "production")
    renderToStaticMarkup(
      createElement(RootLayout, {
        children: createElement("main", null, "Owned page content"),
      }),
    )
    expect(analytics.beforeSend).toBe(sanitizeWebsiteAnalyticsEvent)
  })
})
