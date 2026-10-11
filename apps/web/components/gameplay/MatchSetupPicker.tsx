import type { ReactNode } from "react"
import MapachessButton from "../presentation/MapachessButton"
import MapachessDialog from "../presentation/MapachessDialog"

export default function MatchSetupPicker({
  children,
  onDone,
  title,
}: Readonly<{
  children: ReactNode
  onDone: () => void
  title: string
}>) {
  return (
    <MapachessDialog label={title} onClose={onDone}>
      <header className="bg-mapachito-white sticky top-0 z-20 mb-4 flex flex-wrap items-center justify-between gap-3 py-2">
        <h2 className="font-display text-2xl font-black">{title}</h2>
        <MapachessButton onClick={onDone} type="button">
          <span aria-hidden="true">✓ </span>Done
        </MapachessButton>
      </header>
      {children}
    </MapachessDialog>
  )
}
