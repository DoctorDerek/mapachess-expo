import firstArrivalCopy from "@mapachess/profile/first-arrival"
import {
  isShippedLocale,
  LOCALE_LABELS,
  SHIPPED_LOCALES,
  type ShippedLocale,
} from "@mapachess/profile/locale"

export default function LanguageChoice({
  locale,
  disabled = false,
  onChange,
}: Readonly<{
  locale: ShippedLocale
  disabled?: boolean
  onChange: (locale: ShippedLocale) => void
}>) {
  return (
    <label className="text-mapachito-charcoal relative mx-auto block w-full max-w-110 font-bold">
      <span className="sr-only">{firstArrivalCopy(locale).language}</span>
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-mapachito-deep-cyan pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
      >
        <circle cx="12" cy="12" r="10" />
        <ellipse cx="12" cy="12" rx="4" ry="10" />
        <path d="M2 12h20" />
      </svg>
      <select
        className="border-mapachito-deep-cyan bg-mapachito-white focus-visible:outline-mapachito-deep-cyan min-h-12 w-full min-w-0 cursor-pointer rounded-[0.75rem_0.25rem_0.75rem_0.25rem] border-2 py-2 pr-3 pl-11 [color-scheme:light] disabled:cursor-not-allowed"
        disabled={disabled}
        value={locale}
        onChange={(event) => {
          const selected = event.currentTarget.value
          if (isShippedLocale(selected)) onChange(selected)
        }}
      >
        {SHIPPED_LOCALES.map((option) => (
          <option key={option} value={option}>
            {LOCALE_LABELS[option]}
          </option>
        ))}
      </select>
    </label>
  )
}
