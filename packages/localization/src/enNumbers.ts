const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })
const ungroupedInteger = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
  useGrouping: false,
})
const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
})

export const formatInteger = (value: number): string => integer.format(value)
export const formatUngroupedInteger = (value: number): string =>
  ungroupedInteger.format(Math.round(value))
export const formatStoryPercentage = (value: number): string =>
  percent.format(value / 100)
