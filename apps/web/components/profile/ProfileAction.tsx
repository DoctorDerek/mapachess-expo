import cx from "classix"
import type { ComponentProps } from "react"

export default function ProfileAction({
  className,
  size = "default",
  ...props
}: ComponentProps<"button"> &
  Readonly<{ size?: "default" | "home-card" | "home-mode" | "compact" }>) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        "text-mapachito-white rounded-mapachess-action cursor-pointer leading-snug font-bold transition-transform focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-white enabled:active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 motion-safe:enabled:hover:-translate-y-0.5 motion-safe:enabled:active:translate-y-1 motion-reduce:transition-none",
        size === "compact"
          ? "min-h-[48px] px-[4px] py-[8px] text-base"
          : "min-h-12 py-3",
        size === "home-mode"
          ? "px-3 text-lg"
          : size === "home-card"
            ? "px-2.5 text-xl"
            : size !== "compact" && "px-4 text-xl",
        className,
      )}
    />
  )
}
