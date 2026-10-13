import type { CandidateLocale } from "@mapachess/localization/locale"

export type FirstArrivalPreferences = Readonly<{
  introductionCompleted: boolean
  locale: CandidateLocale | null
}>
