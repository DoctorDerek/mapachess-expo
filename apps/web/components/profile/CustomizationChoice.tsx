import { type ReactNode } from "react"
import MapachessButton from "../presentation/MapachessButton"
import MapachessDialog from "../presentation/MapachessDialog"
import { useMapachessCopy } from "./MapachessLocaleProvider"
import SettingsView from "./SettingsView"

export default function CustomizationChoice({
  kind,
  value,
  preview,
  open,
  onToggle,
  children,
}: Readonly<{
  kind: "coach" | "pieces" | "board"
  value: string
  preview: ReactNode
  open: boolean
  onToggle: () => void
  children: ReactNode
}>) {
  const copy = useMapachessCopy()
  const field = copy.profile.customization[kind]
  return (
    <div className="min-w-0">
      <div className="bg-mapachito-violet/8 text-mapachito-charcoal flex flex-wrap items-center gap-3 rounded-xl p-3">
        <span
          aria-hidden="true"
          className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-md"
        >
          {preview}
        </span>
        <div className="min-w-0 flex-1 basis-24 wrap-break-word">
          <h3 className="font-display text-xl font-black">{field.label}</h3>
          <p className="text-sm leading-snug">{value}</p>
        </div>
        <MapachessButton
          aria-haspopup="dialog"
          aria-label={field.change}
          className="ml-auto min-w-22 px-3! py-2! text-base"
          onClick={(event) => {
            event.currentTarget.focus({ preventScroll: true })
            onToggle()
          }}
          type="button"
          variant="secondary"
        >
          {copy.setup.change}
        </MapachessButton>
      </div>
      {open ? (
        <MapachessDialog label={field.label} onClose={onToggle} fixedContent>
          <SettingsView
            title={field.label}
            closeLabel={copy.setup.done}
            closeAccessibleLabel={field.done}
            onClose={onToggle}
            focusHeading
          >
            {children}
          </SettingsView>
        </MapachessDialog>
      ) : null}
    </div>
  )
}
