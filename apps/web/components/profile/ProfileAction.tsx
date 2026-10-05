import type { ButtonHTMLAttributes } from "react"

export default function ProfileAction({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`text-mapachito-white min-h-12 cursor-pointer rounded-[0.75rem_0.25rem_0.75rem_0.25rem] px-4 py-3 text-xl leading-snug font-bold transition-transform focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-white enabled:hover:-translate-y-0.5 enabled:active:translate-y-1 enabled:active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none motion-reduce:transition-none ${className}`}
    />
  )
}
