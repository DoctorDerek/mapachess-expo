export const CANDIDATE_LOCALES = Object.freeze([
  "en",
  "zh-Hans",
  "ru",
  "es-419",
  "pt-BR",
  "de",
  "ko",
  "fr",
  "ja",
  "tr",
  "pl",
  "zh-Hant",
  "es-ES",
  "it",
  "th",
] as const)

export type CandidateLocale = (typeof CANDIDATE_LOCALES)[number]

export const SHIPPED_LOCALES = Object.freeze(["en"] as const)
export type ShippedLocale = (typeof SHIPPED_LOCALES)[number]
export const DEFAULT_LOCALE = "en" satisfies ShippedLocale
export const LOCALE_LABELS = Object.freeze({
  en: "English (US)",
} satisfies Readonly<Record<ShippedLocale, string>>)

export const isShippedLocale = (value: unknown): value is ShippedLocale =>
  SHIPPED_LOCALES.some((locale) => locale === value)

const supportedLocale = (
  value: string | null | undefined,
): ShippedLocale | null => {
  if (value == null) return null
  const normalized = value.toLowerCase()
  const exact = SHIPPED_LOCALES.find(
    (locale) => locale.toLowerCase() === normalized,
  )
  if (exact !== undefined) return exact
  return normalized.startsWith("en-") ? DEFAULT_LOCALE : null
}

export default function resolveLocale({
  selection,
  route,
  preferences = [],
}: Readonly<{
  selection?: CandidateLocale | null
  route?: string
  preferences?: readonly string[]
}>): ShippedLocale {
  const explicit = supportedLocale(selection) ?? supportedLocale(route)
  if (explicit !== null) return explicit
  for (const preference of preferences) {
    const supported = supportedLocale(preference)
    if (supported !== null) return supported
  }
  return DEFAULT_LOCALE
}
