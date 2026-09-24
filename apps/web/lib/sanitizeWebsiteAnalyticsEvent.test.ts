import type { BeforeSendEvent } from "@vercel/analytics/next"
import { describe, expect, it } from "vitest"
import sanitizeWebsiteAnalyticsEvent from "./sanitizeWebsiteAnalyticsEvent"

describe("sanitizeWebsiteAnalyticsEvent", () => {
  it("retains an ordinary page view", () => {
    const event: BeforeSendEvent = {
      type: "pageview",
      url: "https://www.mapachess.com/",
    }

    expect(sanitizeWebsiteAnalyticsEvent(event)).toEqual(event)
  })

  it("removes URL credentials, query values, and fragments without mutating input", () => {
    const url =
      "https://name:password@www.mapachess.com/?profile=private&fen=position#saved-match"
    const event: BeforeSendEvent = { type: "pageview", url }

    expect(sanitizeWebsiteAnalyticsEvent(event)).toEqual({
      type: "pageview",
      url: "https://www.mapachess.com/",
    })
    expect(event.url).toBe(url)
  })

  it("preserves the public page path while removing its query and fragment", () => {
    expect(
      sanitizeWebsiteAnalyticsEvent({
        type: "pageview",
        url: "https://www.mapachess.com/about?source=link#credits",
      }),
    ).toEqual({ type: "pageview", url: "https://www.mapachess.com/about" })
  })

  it("returns only the page-view fields even if an input carries additional data", () => {
    const event: BeforeSendEvent & { profile: string } = {
      type: "pageview",
      url: "https://www.mapachess.com/",
      profile: "private",
    }

    expect(sanitizeWebsiteAnalyticsEvent(event)).toEqual({
      type: "pageview",
      url: "https://www.mapachess.com/",
    })
  })

  it("discards custom events", () => {
    expect(
      sanitizeWebsiteAnalyticsEvent({
        type: "event",
        url: "https://www.mapachess.com/",
      }),
    ).toBeNull()
  })

  it("accepts HTTP page views without URL query data", () => {
    expect(
      sanitizeWebsiteAnalyticsEvent({
        type: "pageview",
        url: "http://www.mapachess.com/?private=value",
      }),
    ).toEqual({ type: "pageview", url: "http://www.mapachess.com/" })
  })

  it.each([
    "not a URL",
    "/?private=value",
    "data:text/plain,private",
    "file:///save.json",
  ])("drops an invalid or unsupported URL: %s", (url) => {
    expect(sanitizeWebsiteAnalyticsEvent({ type: "pageview", url })).toBeNull()
  })
})
