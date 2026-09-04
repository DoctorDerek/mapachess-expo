import type { ReactNode } from "react"

type MapachessShellProps = Readonly<{
  as?: "div" | "main"
  children: ReactNode
  className?: string
}>

export default function MapachessShell({
  as: Element = "div",
  children,
  className = "",
}: MapachessShellProps) {
  return (
    <Element
      className={`after:border-mapachito-deep-gold/12 relative isolate min-h-dvh overflow-x-clip px-[clamp(1rem,4vw,3rem)] py-[clamp(1.5rem,4vw,3.5rem)] before:absolute before:inset-x-0 before:top-0 before:-z-10 before:h-2.5 before:bg-[repeating-linear-gradient(90deg,var(--color-mapachito-raspberry)_0_3rem,var(--color-mapachito-orange)_3rem_6rem,var(--color-mapachito-deep-gold)_6rem_9rem,var(--color-mapachito-green)_9rem_12rem,var(--color-mapachito-deep-cyan)_12rem_15rem,var(--color-mapachito-blue)_15rem_18rem,var(--color-mapachito-violet)_18rem_21rem)] after:fixed after:-right-36 after:-bottom-40 after:-z-20 after:size-96 after:rounded-full after:border-[4rem] ${className}`}
    >
      {children}
    </Element>
  )
}
