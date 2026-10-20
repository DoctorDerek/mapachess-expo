import cx from "classix"
import type { ButtonHTMLAttributes } from "react"

export default function ProfileAction({
  className,
  size = "default",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> &
  Readonly<{ size?: "default" | "home-card" | "home-mode" }>) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        "text-mapachito-white min-h-12 cursor-pointer rounded-[0.75rem_0.25rem_0.75rem_0.25rem] py-3 leading-snug font-bold transition-transform focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-white enabled:active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 motion-safe:enabled:hover:-translate-y-0.5 motion-safe:enabled:active:translate-y-1 motion-reduce:transition-none",
        size === "home-mode"
          ? "px-3 text-lg"
          : size === "home-card"
            ? "px-2.5 text-xl"
            : "px-4 text-xl",
        className,
      )}
    />
  )
}
