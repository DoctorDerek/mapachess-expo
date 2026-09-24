import type { BeforeSendEvent } from "@vercel/analytics/next"

export default function sanitizeWebsiteAnalyticsEvent(
  event: BeforeSendEvent,
): BeforeSendEvent | null {
  if (event.type !== "pageview") return null

  try {
    const url = new URL(event.url)
    if (url.protocol !== "https:" && url.protocol !== "http:") return null

    return { type: "pageview", url: `${url.origin}${url.pathname}` }
  } catch {
    return null
  }
}
