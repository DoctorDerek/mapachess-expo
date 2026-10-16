export type EvaluationBound = "exact" | "lower" | "upper"

type NumberFormatters = Readonly<{
  formatInteger: (value: number) => string
  formatUngroupedInteger: (value: number) => string
  formatStoryPercentage: (value: number) => string
  formatCentipawns: (value: number, bound: EvaluationBound) => string
}>

export default function createNumberFormatters(
  locale: "en-US" | "es-MX",
): NumberFormatters {
  let integer: Intl.NumberFormat | undefined
  let ungroupedInteger: Intl.NumberFormat | undefined
  let percent: Intl.NumberFormat | undefined
  let decimal: Intl.NumberFormat | undefined

  return Object.freeze({
    formatInteger: (value: number): string => {
      integer ??= new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
      return integer.format(value)
    },
    formatUngroupedInteger: (value: number): string => {
      ungroupedInteger ??= new Intl.NumberFormat(locale, {
        maximumFractionDigits: 0,
        useGrouping: false,
      })
      return ungroupedInteger.format(Math.round(value))
    },
    formatStoryPercentage: (value: number): string => {
      percent ??= new Intl.NumberFormat(locale, {
        style: "percent",
        maximumFractionDigits: 1,
      })
      return percent.format(value / 100)
    },
    formatCentipawns: (value: number, bound: EvaluationBound): string => {
      decimal ??= new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: false,
      })
      const sign = value > 0 ? "+" : value < 0 ? "−" : ""
      const score = `${sign}${decimal.format(Math.abs(value) / 100)}`
      return bound === "exact"
        ? score
        : `${bound === "lower" ? "≥" : "≤"} ${score}`
    },
  })
}
