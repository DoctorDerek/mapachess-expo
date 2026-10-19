import { useEffect, useId, useRef, type ReactNode } from "react"
import MapachessButton from "../presentation/MapachessButton"

export default function SettingsView({
  children,
  title,
  closeLabel,
  closeAccessibleLabel,
  onClose,
  hidden = false,
  focusHeading = false,
}: Readonly<{
  children: ReactNode
  title: string
  closeLabel: string
  closeAccessibleLabel?: string
  onClose: () => void
  hidden?: boolean
  focusHeading?: boolean
}>) {
  const titleId = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const target = focusHeading ? heading.current : closeButton.current
    target?.focus({ preventScroll: true })
  }, [focusHeading])

  return (
    <section
      aria-labelledby={titleId}
      className="h-full min-h-0"
      hidden={hidden}
    >
      <div className="grid h-full grid-rows-[minmax(0,1fr)_auto]">
        <div className="-mx-1 min-h-0 overflow-y-auto overscroll-contain px-1 pb-5">
          <h2
            className="font-display text-mapachito-charcoal focus-visible:outline-mapachito-violet text-2xl leading-tight font-black focus-visible:outline-2 focus-visible:-outline-offset-2"
            id={titleId}
            ref={heading}
            tabIndex={focusHeading ? 0 : -1}
          >
            {title}
          </h2>
          {children}
        </div>
        <footer className="border-mapachito-charcoal/15 flex justify-end border-t px-1 pt-3 pb-1">
          <MapachessButton
            aria-label={closeAccessibleLabel}
            onClick={onClose}
            ref={closeButton}
            variant="secondary"
          >
            {closeLabel}
          </MapachessButton>
        </footer>
      </div>
    </section>
  )
}
