import cx from "classix"
import type { ReactNode } from "react"

export default function ScrollActions({
  children,
  actions,
  className,
  edgeToEdge = false,
}: Readonly<{
  children: ReactNode
  actions: ReactNode
  className?: string
  edgeToEdge?: boolean
}>) {
  return (
    <div
      className={cx(
        "grid h-full min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto]",
        className,
      )}
    >
      <div
        className={cx(
          "min-h-0 min-w-0 overflow-y-auto overscroll-contain pb-4",
          !edgeToEdge && "px-1",
        )}
      >
        {children}
      </div>
      <footer className="min-w-0 px-2 pt-3 pb-2">{actions}</footer>
    </div>
  )
}
