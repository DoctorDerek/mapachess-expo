import { useId, type ReactNode } from "react"
import MapachessButton from "../presentation/MapachessButton"

export default function CustomizationChoice({
  label,
  value,
  preview,
  open,
  onToggle,
  children,
}: Readonly<{
  label: string
  value: string
  preview: ReactNode
  open: boolean
  onToggle: () => void
  children: ReactNode
}>) {
  const choicesId = useId()
  return (
    <div className="min-w-0">
      <div className="bg-mapachito-violet/8 text-mapachito-charcoal flex flex-wrap items-center gap-3 rounded-xl p-3">
        <span
          aria-hidden="true"
          className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-md"
        >
          {preview}
        </span>
        <div className="min-w-0 flex-1 basis-16 wrap-anywhere">
          <h3 className="font-display text-xl font-black">{label}</h3>
          <p className="text-sm leading-snug">{value}</p>
        </div>
        <MapachessButton
          aria-controls={choicesId}
          aria-expanded={open}
          aria-label={
            open
              ? `Done choosing ${label.toLowerCase()}`
              : `Change ${label.toLowerCase()}`
          }
          className="min-w-22 px-3! py-2! text-base"
          onClick={(event) => {
            event.currentTarget.focus({ preventScroll: true })
            onToggle()
          }}
          type="button"
          variant="secondary"
        >
          {open ? "Done" : "Change"}
        </MapachessButton>
      </div>
      <div id={choicesId} hidden={!open}>
        {open ? children : null}
      </div>
    </div>
  )
}
