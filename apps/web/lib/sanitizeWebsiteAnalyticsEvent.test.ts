import type { BeforeSendEvent } from "@vercel/analytics/next"
import { describe, expect, it } from "vitest"
import sanitizeWebsiteAnalyticsEvent from "./sanitizeWebsiteAnalyticsEvent"

describe("sanitizeWebsiteAnalyticsEvent", () => {
  it("retains an ordinary page view", () => {
    const event: BeforeSendEvent = {
      type: "pageview",
      url: "https://mapachess.com/",
    }

    expect(sanitizeWebsiteAnalyticsEvent(event)).toEqual(event)
  })

  it("removes URL credentials, query values, and fragments without mutating input", () => {
    const url =
      "https://name:password@mapachess.com/?profile=private&fen=position#saved-match"
    const event: BeforeSendEvent = { type: "pageview", url }

    expect(sanitizeWebsiteAnalyticsEvent(event)).toEqual({
      type: "pageview",
      url: "https://mapachess.com/",
    })
    expect(event.url).toBe(url)
  })

  it("preserves the public page path while removing its query and fragment", () => {
    expect(
      sanitizeWebsiteAnalyticsEvent({
        type: "pageview",
        url: "https://mapachess.com/about?source=link#credits",
      }),
    ).toEqual({ type: "pageview", url: "https://mapachess.com/about" })
  })

  it("returns only the page-view fields even if an input carries additional data", () => {
    const event: BeforeSendEvent & { profile: string } = {
      type: "pageview",
      url: "https://mapachess.com/",
      profile: "private",
    }

    expect(sanitizeWebsiteAnalyticsEvent(event)).toEqual({
      type: "pageview",
      url: "https://mapachess.com/",
    })
  })

  it("discards custom events", () => {
    expect(
      sanitizeWebsiteAnalyticsEvent({
        type: "event",
        url: "https://mapachess.com/",
      }),
    ).toBeNull()
  })

  it("accepts HTTP page views without URL query data", () => {
    expect(
      sanitizeWebsiteAnalyticsEvent({
        type: "pageview",
        url: "http://localhost:3106/?private=value",
      }),
    ).toEqual({ type: "pageview", url: "http://localhost:3106/" })
  })

  it.each([
    "https://www.mapachess.com",
    "https://mapachess-expo-web-git-example.vercel.app",
    "http://127.0.0.1:3106",
  ])("preserves the actual origin instead of relabeling it: %s", (origin) => {
    expect(
      sanitizeWebsiteAnalyticsEvent({
        type: "pageview",
        url: `${origin}/about?private=value#saved-match`,
      }),
    ).toEqual({ type: "pageview", url: `${origin}/about` })
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
