import type { ReactNode } from "react"
import MapachessButton from "../presentation/MapachessButton"
import MapachessDialog from "../presentation/MapachessDialog"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"

export default function MatchSetupPicker({
  children,
  onDone,
  title,
  contentSized = false,
}: Readonly<{
  children: ReactNode
  onDone: () => void
  title: string
  contentSized?: boolean
}>) {
  const copy = useMapachessCopy().setup
  return (
    <MapachessDialog label={title} onClose={onDone} contentSized={contentSized}>
      <header className="bg-mapachito-white sticky top-0 z-20 mb-4 flex flex-wrap items-center justify-between gap-3 py-2">
        <h2 className="font-display text-2xl font-black">{title}</h2>
        <MapachessButton onClick={onDone} type="button">
          <span aria-hidden="true">✓ </span>
          {copy.done}
        </MapachessButton>
      </header>
      {children}
    </MapachessDialog>
  )
}
