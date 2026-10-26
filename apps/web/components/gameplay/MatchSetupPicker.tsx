import { useLayoutEffect, useRef, type ReactNode } from "react"
import MapachessButton from "../presentation/MapachessButton"
import MapachessDialog from "../presentation/MapachessDialog"
import ScrollActions from "../presentation/ScrollActions"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"

export default function MatchSetupPicker({
  children,
  onDone,
  title,
}: Readonly<{
  children: ReactNode
  onDone: () => void
  title: string
}>) {
  const copy = useMapachessCopy().setup
  const heading = useRef<HTMLHeadingElement>(null)
  useLayoutEffect(() => heading.current?.focus({ preventScroll: true }), [])
  return (
    <MapachessDialog label={title} onClose={onDone} fixedContent>
      <ScrollActions
        actions={
          <div className="flex justify-end">
            <MapachessButton onClick={onDone} type="button">
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
