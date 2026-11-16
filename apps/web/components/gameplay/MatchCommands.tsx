import { useRef, type ReactNode, type RefObject } from "react"
import type { ActorRefFrom } from "xstate"
import MatchMenuActions, {
  type MatchMenuSessionActions,
} from "@mapachess/application-ui/match-menu-actions"
import matchMachine, {
  selectCanRedo,
  selectCanUndo,
  selectHasRedoHistory,
  selectHasUndoHistory,
  selectIsPersistingMutation,
  type MatchMachineSnapshot,
} from "@mapachess/match/match-machine"
import InputPrompt from "../input/InputPrompt"
import MapachessButton from "../presentation/MapachessButton"
import MapachessDialog from "../presentation/MapachessDialog"
import ScrollActions from "../presentation/ScrollActions"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"
import webRecoveryElements from "../profile/WebRecoveryElements"
import webSetupElements from "./WebSetupElements"

const historyActionClassName =
  "flex min-w-0 scroll-mb-1 flex-wrap items-center justify-center gap-1 px-1! py-1! text-sm leading-[1.1] xl:leading-tight wrap-break-word"

export default function MatchCommands({
  actor,
  hints,
  coach,
  menuActions,
  details,
  menuSummaryRef,
  drawAvailable,
  onOfferDraw,
  onMenuOpened,
  onMenuClosed,
  onBack,
  menuOpen,
  snapshot,
  opponentName,
}: Readonly<{
  hints: ReactNode
  coach: ReactNode
  menuActions?: MatchMenuSessionActions | undefined
  details: ReactNode
  menuSummaryRef?: RefObject<HTMLButtonElement | null>
  actor: ActorRefFrom<typeof matchMachine>
  drawAvailable: boolean
  onOfferDraw: () => void
  onMenuOpened: () => void
  onMenuClosed: () => void
  onBack: () => void
  menuOpen: boolean
  snapshot: MatchMachineSnapshot
  opponentName: string
}>) {
  const copy = useMapachessCopy()
  const messages = copy.interface.matchCommands
  const closeButton = useRef<HTMLButtonElement>(null)

  const persisting = selectIsPersistingMutation(snapshot)
  return (
    <div className="grid gap-1 xl:gap-1.5">
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-stretch gap-x-1.5 gap-y-1 xl:flex xl:flex-wrap xl:items-center xl:gap-1.5">
        {coach}
        {hints}
      </div>
      <div className="grid min-w-0 grid-cols-[minmax(0,0.7fr)_repeat(2,minmax(0,1.15fr))] items-stretch gap-1.5 xl:grid-cols-3">
        <MapachessButton
          aria-label={messages.matchMenu}
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          data-player-action="menu"
          className={historyActionClassName}
          ref={menuSummaryRef}
          onClick={onMenuOpened}
          variant="secondary"
        >
          <InputPrompt action="menu" />
          <span className="min-w-0 wrap-anywhere">{messages.menu}</span>
        </MapachessButton>
        <div className="contents">
          <MapachessButton
            aria-busy={persisting && selectHasUndoHistory(snapshot)}
            className={historyActionClassName}
            disabled={!selectCanUndo(snapshot)}
            data-player-action="undo"
            onClick={() => actor.send({ type: "MATCH.UNDO_REQUESTED" })}
            variant="secondary"
          >
            <InputPrompt action="undo" />
            <span className="min-w-0">{messages.undo}</span>
          </MapachessButton>
          <MapachessButton
            aria-busy={persisting && selectHasRedoHistory(snapshot)}
            className={historyActionClassName}
            disabled={!selectCanRedo(snapshot)}
            data-player-action="redo"
            onClick={() => actor.send({ type: "MATCH.REDO_REQUESTED" })}
            variant="secondary"
          >
            <InputPrompt action="redo" />
            <span className="min-w-0">{messages.redo}</span>
          </MapachessButton>
        </div>
      </div>
      {menuOpen ? (
        <MapachessDialog
          label={messages.matchMenu}
          onClose={onBack}
          placement="bottom"
          fixedContent
          closeOnMenu
          initialFocus={closeButton}
          returnFocus={menuSummaryRef}
        >
          <ScrollActions
            actions={
              <MapachessButton
                ref={closeButton}
                className="w-full min-w-0 wrap-anywhere"
                onClick={onMenuClosed}
                variant="secondary"
              >
                {copy.shared.settingsControls.close}
              </MapachessButton>
            }
          >
            <h2 className="font-display mb-4 text-2xl font-black wrap-anywhere">
              {messages.matchMenu}
            </h2>
            <MatchMenuActions
              actor={actor}
              snapshot={snapshot}
              copy={copy}
              elements={{
                Action: webRecoveryElements.Action,
                Group: webSetupElements.Group,
                Text: webSetupElements.Text,
              }}
              sessionActions={menuActions}
              details={details}
              drawAvailable={drawAvailable}
              opponentName={opponentName}
              onOfferDraw={onOfferDraw}
              onMenuClosed={onMenuClosed}
            />
          </ScrollActions>
        </MapachessDialog>
      ) : null}
    </div>
  )
}
