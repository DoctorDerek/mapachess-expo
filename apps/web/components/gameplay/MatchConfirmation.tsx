import { useId, useRef, type RefObject } from "react"
import type { MatchMenuDecision } from "@mapachess/application-ui/match-menu-actions"
import MapachessButton from "../presentation/MapachessButton"
import MapachessDialog from "../presentation/MapachessDialog"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"

export default function MatchConfirmation({
  action,
  disabled = false,
  onCancel,
  onConfirm,
  returnFocus,
}: Readonly<{
  action: MatchMenuDecision | "replace"
  disabled?: boolean
  onCancel: () => void
  onConfirm: () => void
  returnFocus: RefObject<HTMLElement | null>
}>) {
  const copy = useMapachessCopy()
  const commands = copy.interface.matchCommands
  const { question, consequence } = commands.confirmation[action]
  const description = useId()
  const cancel = useRef<HTMLButtonElement>(null)
  const accepted = useRef(false)
  const label = {
    restart: copy.interface.webGame.restartMatch,
    resign: commands.resign,
    draw: commands.offerDraw,
    replace: commands.startReplacement,
  }[action]
  return (
    <MapachessDialog
      label={question}
      descriptionId={description}
      alert
      placement="bottom-to-center"
      fixedContent="fit"
      onClose={onCancel}
      initialFocus={cancel}
      returnFocus={returnFocus}
    >
      <div className="mapachess-confirmation grid min-w-0 gap-2.5">
        <h2 className="font-display text-xl leading-tight font-black">
          {question}
        </h2>
        <p id={description} className="leading-tight">
          {consequence}
        </p>
        <div
          className={
            action === "replace"
              ? "mapachess-replace-actions grid grid-cols-2 gap-2"
              : "grid grid-cols-2 gap-2 @max-[19rem]:grid-cols-1"
          }
        >
          <MapachessButton
            disabled={disabled}
            onClick={() => {
              if (!accepted.current) {
                accepted.current = true
                onConfirm()
              }
            }}
            variant={action === "draw" ? "secondary" : "destructive"}
          >
            {label}
          </MapachessButton>
          <MapachessButton ref={cancel} onClick={onCancel} variant="secondary">
            {copy.interface.profileSettingsPanel.cancel}
          </MapachessButton>
        </div>
      </div>
    </MapachessDialog>
  )
}
