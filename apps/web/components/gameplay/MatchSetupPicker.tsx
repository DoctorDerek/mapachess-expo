import { useLayoutEffect, useRef, type ReactNode } from "react"
import MapachessButton from "../presentation/MapachessButton"
import MapachessDialog from "../presentation/MapachessDialog"
import ScrollActions from "../presentation/ScrollActions"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"

export default function MatchSetupPicker({
  children,
  onCancel,
  onDone,
  disabled,
  title,
}: Readonly<{
  children: ReactNode
  onCancel: () => void
  onDone: () => void
  disabled: boolean
  title: string
}>) {
  const copy = useMapachessCopy().setup
  const heading = useRef<HTMLHeadingElement>(null)
  useLayoutEffect(() => heading.current?.focus({ preventScroll: true }), [])
  return (
    <MapachessDialog label={title} onClose={onCancel} fixedContent>
      <ScrollActions
        actions={
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))] gap-2">
            <MapachessButton
              className="min-w-0 px-2!"
              onClick={onCancel}
              variant="secondary"
            >
              {copy.cancel}
            </MapachessButton>
            <MapachessButton
              className="min-w-0 px-2!"
              disabled={disabled}
              onClick={onDone}
              type="button"
            >
              <span aria-hidden="true">✓ </span>
              {copy.done}
            </MapachessButton>
          </div>
        }
      >
        <h2
          className="font-display mb-4 text-2xl font-black"
          ref={heading}
          tabIndex={-1}
        >
          {title}
        </h2>
        {children}
      </ScrollActions>
    </MapachessDialog>
  )
}
