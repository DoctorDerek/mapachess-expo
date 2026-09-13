import type { ComponentProps } from "react"

type MapachessButtonProps = ComponentProps<"button"> & {
  busyLabel?: string
  variant?: "primary" | "secondary" | "destructive" | "hint"
}

const variantClasses = {
  primary:
    "border-mapachito-charcoal bg-mapachito-raspberry text-mapachito-white shadow-mapachito-charcoal",
  secondary:
    "border-mapachito-charcoal bg-mapachito-violet text-mapachito-white shadow-mapachito-charcoal",
  destructive:
    "border-mapachito-red bg-mapachito-charcoal text-mapachito-white shadow-mapachito-red",
  hint: "border-mapachito-charcoal bg-mapachito-white text-mapachito-charcoal shadow-mapachito-green",
} satisfies Record<NonNullable<MapachessButtonProps["variant"]>, string>

export default function MapachessButton({
  busyLabel,
  children,
  className = "",
  type = "button",
  variant = "primary",
  ...props
}: MapachessButtonProps) {
  return (
    <button
      {...props}
      disabled={props.disabled || props["aria-busy"] === true}
      className={`min-h-12 cursor-pointer rounded-[0.75rem_0.25rem_0.75rem_0.25rem] border-3 px-[1.125rem] py-3 leading-[1.2] font-black shadow-[0.25rem_0.25rem_0] transition-[translate,box-shadow,background-color] duration-120 ease-[ease] enabled:hover:-translate-0.25 enabled:hover:shadow-[0.375rem_0.375rem_0] enabled:active:translate-[0.1875rem] enabled:active:shadow-[0.0625rem_0.0625rem_0] disabled:cursor-not-allowed disabled:not-aria-busy:opacity-48 motion-reduce:enabled:hover:translate-none motion-reduce:enabled:active:translate-none forced-colors:border-[CanvasText] forced-colors:shadow-none forced-colors:enabled:hover:shadow-none forced-colors:enabled:active:shadow-none ${variantClasses[variant]} ${className}`}
      type={type}
    >
      {busyLabel === undefined ? (
        children
      ) : (
        <span className="grid">
          <span
            aria-hidden={props["aria-busy"] === true}
            className={`col-start-1 row-start-1 ${props["aria-busy"] === true ? "invisible" : ""}`}
          >
            {children}
          </span>
          <span
            aria-hidden={props["aria-busy"] !== true}
            className={`col-start-1 row-start-1 ${props["aria-busy"] === true ? "" : "invisible"}`}
          >
            {busyLabel}
          </span>
        </span>
      )}
    </button>
  )
}
