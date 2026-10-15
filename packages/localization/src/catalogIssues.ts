import type { CandidateLocale } from "./locale.js"
import type { MessageFailure } from "./messageRecovery.js"

export type CatalogIssue = Readonly<{
  locale: CandidateLocale
  path: string
  source: "selected" | "english"
  reason: MessageFailure
  recovery: "english" | "emergency"
}>

export const MAX_CATALOG_ISSUES = 128

export type CatalogHealth = Readonly<{
  issues: readonly CatalogIssue[]
  limitReached: boolean
}>

export default function createCatalogIssues(): Readonly<{
  record: (issue: CatalogIssue) => void
  snapshot: () => CatalogHealth
}> {
  const issues = new Map<string, CatalogIssue>()
  let limitReached = false
  return {
    record(issue) {
      const identity = `${issue.locale}:${issue.path}:${issue.source}:${issue.reason}:${issue.recovery}`
      if (issues.has(identity)) return
      if (issues.size === MAX_CATALOG_ISSUES) {
        limitReached = true
        return
      }
      issues.set(identity, Object.freeze(issue))
    },
    snapshot: () =>
      Object.freeze({
        issues: Object.freeze([...issues.values()]),
        limitReached,
      }),
  }
}
