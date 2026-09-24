"use client"

import { Analytics } from "@vercel/analytics/next"
import sanitizeWebsiteAnalyticsEvent from "../lib/sanitizeWebsiteAnalyticsEvent"

export default function WebsiteAnalytics() {
  return <Analytics beforeSend={sanitizeWebsiteAnalyticsEvent} />
}
