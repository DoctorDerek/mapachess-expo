import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react"
import type { ActorRefFrom } from "xstate"
import MatchMenuActions, {
  type MatchMenuDecision,
  type MatchMenuSessionActions,
} from "@mapachess/application-ui/match-menu-actions"
import matchMachine, {
  selectCanOfferDraw,
  selectCanRedo,
  selectCanResign,
  selectCanUndo,
  selectHasRedoHistory,
  selectHasUndoHistory,
  selectIsPersistingMutation,
  selectMatchConclusion,
  type MatchMachineSnapshot,
} from "@mapachess/match/match-machine"
import type { MatchNavigationOverlay } from "@mapachess/match/match-navigation"
import InputPrompt from "../input/InputPrompt"
import MapachessButton from "../presentation/MapachessButton"
import MapachessDialog from "../presentation/MapachessDialog"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"
import webRecoveryElements from "../profile/WebRecoveryElements"
import MatchConfirmation from "./MatchConfirmation"
import webSetupElements from "./WebSetupElements"

export default function MatchCommands({
  actor,
  hints,
  menuActions,
  details,
  menuSummaryRef,
  drawAvailable,
  onOfferDraw,
  onMenuOpened,
  onMenuClosed,
  onBack,
  menuOpen,
  topOverlay,
  onDecisionRequested,
  onConsumeOverlay,
  snapshot,
  opponentName,
}: Readonly<{
  hints: ReactNode
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
  topOverlay: MatchNavigationOverlay | undefined
  onDecisionRequested: (decision: MatchMenuDecision) => void
  onConsumeOverlay: (overlay: MatchNavigationOverlay) => void
  snapshot: MatchMachineSnapshot
  opponentName: string
}>) {
  const copy = useMapachessCopy()
  const messages = copy.interface.matchCommands
  const closeButton = useRef<HTMLButtonElement>(null)

  const [retainMenu, setRetainMenu] = useState(menuOpen)
  const finishExit = useCallback(() => setRetainMenu(false), [])
  const trigger = useRef<HTMLElement>(null)
  const decision =
    topOverlay === "confirm-draw"
      ? "draw"
      : topOverlay === "confirm-resign"
        ? "resign"
        : topOverlay === "confirm-restart"
          ? "restart"
          : null
  useLayoutEffect(() => {
    if (!menuOpen) return
    // A confirmation already covered the menu. Its exit must release the board.
    setRetainMenu(decision === null)
    if (!decision && trigger.current?.isConnected) {
      trigger.current.focus({ preventScroll: true })
      trigger.current = null
    }
  }, [decision, menuOpen])
  const available =
    decision === "draw"
      ? drawAvailable && selectCanOfferDraw(snapshot)
      : decision === "resign"
        ? selectCanResign(snapshot)
        : !!menuActions &&
          !menuActions.restarting &&
          selectMatchConclusion(snapshot) === null
  const persisting = selectIsPersistingMutation(snapshot)
  return (
    <div className="grid gap-1">
      <div className="flex min-w-0 flex-wrap gap-1">
        <div className="flex min-w-min flex-1">
          <MapachessButton
            aria-label={messages.matchMenu}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            data-player-action="menu"
            density="match"
            className="min-w-min flex-1 scroll-mb-1"
            ref={menuSummaryRef}
            onClick={onMenuOpened}
            variant="secondary"
          >
            <InputPrompt action="menu" />
            <span>{messages.menu}</span>
          </MapachessButton>
        </div>
        <div className="flex min-w-min grow-2 basis-1 gap-1">
          <MapachessButton
            aria-busy={persisting && selectHasUndoHistory(snapshot)}
            density="match"
            className="min-w-min flex-1 scroll-mb-1"
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
            density="match"
            className="min-w-min flex-1 scroll-mb-1"
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
      {hints}
      {menuOpen || retainMenu ? (
        <MapachessDialog
          label={messages.matchMenu}
          animateSheet
          leaving={!menuOpen}
          onExitComplete={finishExit}
          suspended={decision !== null}
          onClose={onBack}
          onBackdrop={onMenuClosed}
          placement="bottom-to-center"
          fixedContent="fit"
          closeOnMenu
          initialFocus={closeButton}
          returnFocus={menuSummaryRef}
        >
          <div
            onClickCapture={(event) => {
              const origin =
                event.target instanceof Element
                  ? event.target.closest("button")
                  : null
              if (origin) origin.focus({ preventScroll: true })
            }}
          >
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
              onDecisionRequested={(action) => {
                trigger.current =
                  document.activeElement instanceof HTMLElement
                    ? document.activeElement
                    : null
                onDecisionRequested(action)
              }}
              closeAction={
                <MapachessButton
                  ref={closeButton}
                  density="compact"
                  data-back-to-board
                  className="w-full scroll-my-2"
                  onClick={onMenuClosed}
                  variant="secondary"
                >
                  {messages.backToBoard}
                </MapachessButton>
              }
              details={details}
              drawAvailable={drawAvailable}
              opponentName={opponentName}
              onOfferDraw={onOfferDraw}
              onMenuClosed={onMenuClosed}
            />
          </div>
          <h2 className="font-display mt-2 text-center text-2xl leading-tight font-black wrap-anywhere @max-[18.5rem]:mt-1 @max-[18.5rem]:text-lg">
            {messages.matchMenu}
          </h2>
        </MapachessDialog>
      ) : null}
      {menuOpen && decision && (
        <MatchConfirmation
          key={decision}
          action={decision}
          disabled={!available}
          returnFocus={trigger}
          onCancel={onBack}
          onConfirm={() => {
            if (!available) return
            onConsumeOverlay(
              decision === "resign" ? "match-menu" : `confirm-${decision}`,
            )
            if (decision === "restart") menuActions?.onRestartRequested()
            else if (decision === "resign")
              actor.send({ type: "MATCH.RESIGN_REQUESTED" })
            else onOfferDraw()
          }}
        />
      )}
    </div>
  )
}
