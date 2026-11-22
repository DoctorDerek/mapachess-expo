import cx from "classix"
import type { ComponentProps } from "react"

type MapachessButtonProps = ComponentProps<"button"> & {
  density?: "compact" | "match"
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
  className,
  density,
  type = "button",
  variant = "primary",
  ...props
}: MapachessButtonProps) {
  return (
    <button
      {...props}
      disabled={props.disabled || props["aria-busy"] === true}
      className={cx(
        "rounded-mapachess-action shadow-mapachess-button enabled:hover:shadow-mapachess-raised enabled:active:shadow-mapachess-pressed cursor-pointer border-3 font-black transition-[translate,box-shadow,background-color] duration-120 ease-[ease] enabled:hover:-translate-0.25 enabled:active:translate-0.75 disabled:cursor-not-allowed disabled:not-aria-busy:opacity-48 motion-reduce:enabled:hover:translate-none motion-reduce:enabled:active:translate-none forced-colors:border-[CanvasText] forced-colors:shadow-none forced-colors:enabled:hover:shadow-none forced-colors:enabled:active:shadow-none",
        density === "match"
          ? "inline-flex min-h-11 min-w-11 flex-wrap items-center justify-center gap-x-1 px-1 py-0.5 text-sm leading-tight"
          : density === "compact"
            ? "min-h-12 min-w-0 px-1 py-1 text-sm leading-tight wrap-normal whitespace-normal xl:px-2 xl:py-1.5 xl:text-base"
            : "min-h-12 px-4.5 py-3 leading-[1.2]",
        variantClasses[variant],
        className,
      )}
      type={type}
    >
      {busyLabel === undefined ? (
        children
      ) : (
        <span className="grid min-w-0 grid-cols-1">
          <span
            aria-hidden={props["aria-busy"] === true}
            className={cx(
              "col-start-1 row-start-1",
              props["aria-busy"] === true &&
                (density === "compact" ? "invisible sr-only" : "invisible"),
            )}
          >
            {children}
          </span>
          <span
            aria-hidden={props["aria-busy"] !== true}
            className={cx(
              "col-start-1 row-start-1",
              props["aria-busy"] !== true &&
                (density === "compact" ? "invisible sr-only" : "invisible"),
            )}
          >
            {busyLabel}
          </span>
        </span>
      )}
    </button>
  )
}
