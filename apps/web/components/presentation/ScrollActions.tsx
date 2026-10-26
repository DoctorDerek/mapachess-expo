import cx from "classix"
import type { ReactNode } from "react"

export default function ScrollActions({
  children,
  actions,
  className,
}: Readonly<{
  children: ReactNode
  actions: ReactNode
  className?: string
}>) {
  return (
    <div
      className={cx(
        "grid h-full min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_fit-content(45%)]",
        className,
      )}
    >
      <div className="min-h-0 min-w-0 overflow-y-auto overscroll-contain px-1 pb-4">
        {children}
      </div>
      <footer className="min-h-0 min-w-0 overflow-y-auto overscroll-contain px-2 pt-3 pb-2">
        {actions}
      </footer>
    </div>
  )
}
