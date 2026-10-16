let integer: Intl.NumberFormat | undefined
let ungroupedInteger: Intl.NumberFormat | undefined
let percent: Intl.NumberFormat | undefined

export const formatInteger = (value: number): string => {
  integer ??= new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })
  return integer.format(value)
}
export const formatUngroupedInteger = (value: number): string => {
  ungroupedInteger ??= new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    useGrouping: false,
  })
  return ungroupedInteger.format(Math.round(value))
}
export const formatStoryPercentage = (value: number): string => {
  percent ??= new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1,
  })
  return percent.format(value / 100)
}
