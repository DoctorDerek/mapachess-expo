import type { ComponentProps } from "react"

type MapachessNoticeProps = ComponentProps<"p"> & {
  tone?: "information" | "warning"
}

export default function MapachessNotice({
  className = "",
  tone = "information",
  ...props
}: MapachessNoticeProps) {
  return (
    <p
      {...props}
      className={`border-mapachito-charcoal bg-mapachito-white text-mapachito-charcoal rounded-[1rem_0.25rem_1rem_0.25rem] border-3 p-4 leading-[1.55] font-bold inset-shadow-[0.5rem_0_0] ${tone === "warning" ? "inset-shadow-mapachito-deep-gold" : "inset-shadow-mapachito-blue"} ${className}`}
    />
  )
}
