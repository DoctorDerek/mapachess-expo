import { useRef, type ReactNode, type Ref } from "react"
import type { ActorRefFrom } from "xstate"
import matchMachine, {
  selectCanOfferDraw,
  selectCanRedo,
  selectCanResign,
  selectCanUndo,
  selectDrawOfferResponse,
  selectHasRedoHistory,
  selectHasUndoHistory,
  selectIsPersistingMutation,
  selectMatchConclusion,
  selectMatchPosition,
  type MatchMachineSnapshot,
} from "@mapachess/match/match-machine"
import InputPrompt from "../input/InputPrompt"
import { usePlayerInputScope } from "../input/PlayerInputProvider"
import MapachessButton from "../presentation/MapachessButton"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"

export default function MatchCommands({
  actor,
  onBoardFocusRequested,
  hints,
  coach,
  menuActions,
  menuSummaryRef,
  drawAvailable,
  onOfferDraw,
  onMenuOpened,
  onMenuClosed,
  menuOpen,
  snapshot,
  opponentName,
}: Readonly<{
  hints: ReactNode
  onBoardFocusRequested: () => void
  coach: ReactNode
  menuActions?: ReactNode
  menuSummaryRef?: Ref<HTMLElement>
  actor: ActorRefFrom<typeof matchMachine>
  drawAvailable: boolean
  onOfferDraw: () => void
  onMenuOpened: () => void
  onMenuClosed: () => void
  menuOpen: boolean
  snapshot: MatchMachineSnapshot
  opponentName: string
}>) {
  const copy = useMapachessCopy()
  const messages = copy.interface.matchCommands

  const persisting = selectIsPersistingMutation(snapshot)
  const menu = useRef<HTMLDetailsElement>(null)
  usePlayerInputScope({
    root: menu,
    enabled: menuOpen,
    handle: (action) => {
      if (action !== "cancel" && action !== "menu") return false
      onMenuClosed()
      return true
    },
  })
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {coach}
        <MapachessButton
          variant="secondary"
          aria-label={messages.focusBoard}
          data-player-action="controls"
          className="flex min-h-14 min-w-min flex-1 basis-12 flex-col items-center justify-center px-1! py-1! text-base"
          onClick={onBoardFocusRequested}
        >
          <InputPrompt action="controls" fallback="▦" />
          {messages.board}
        </MapachessButton>
        <MapachessButton
          aria-busy={persisting && selectHasUndoHistory(snapshot)}
          className="flex min-h-14 min-w-min flex-1 basis-12 flex-col items-center justify-center px-1! py-1! text-base"
          disabled={!selectCanUndo(snapshot)}
          data-player-action="undo"
          onClick={() => actor.send({ type: "MATCH.UNDO_REQUESTED" })}
          type="button"
          variant="secondary"
        >
          <InputPrompt action="undo" fallback="↶" />
          {messages.undo}
        </MapachessButton>
        <MapachessButton
          aria-busy={persisting && selectHasRedoHistory(snapshot)}
          className="flex min-h-14 min-w-min flex-1 basis-12 flex-col items-center justify-center px-1! py-1! text-base"
          disabled={!selectCanRedo(snapshot)}
          data-player-action="redo"
          onClick={() => actor.send({ type: "MATCH.REDO_REQUESTED" })}
          type="button"
          variant="secondary"
        >
          <InputPrompt action="redo" fallback="↷" />
          {messages.redo}
        </MapachessButton>
        <details
          className="relative z-40 min-w-min flex-1 basis-12"
          open={menuOpen}
          ref={menu}
          data-player-input-layer={menuOpen ? "match-menu" : undefined}
        >
          <summary
            aria-label={messages.matchMenu}
            data-player-action="menu"
            className="border-mapachito-charcoal bg-mapachito-violet text-mapachito-white flex min-h-14 cursor-pointer flex-col items-center justify-center rounded-lg border-3 px-1 py-1 leading-[1.2] font-black focus-visible:outline-2"
            ref={menuSummaryRef}
            onClick={(event) => {
              event.preventDefault()
              if (menuOpen) onMenuClosed()
              else onMenuOpened()
            }}
          >
            <InputPrompt action="menu" fallback="☰" />
            {messages.menu}
          </summary>
          <div className="border-mapachito-white/30 bg-mapachito-charcoal absolute right-0 bottom-full mb-2 grid max-h-[65dvh] w-64 max-w-[calc(100vw-1rem)] gap-3 overflow-auto rounded-lg border p-3 shadow-xl xl:top-full xl:bottom-auto xl:mt-2 xl:mb-0">
            {menuActions}
            <MapachessButton
              aria-busy={persisting && drawAvailable}
              className="px-1! text-base"
              disabled={!selectCanOfferDraw(snapshot) || !drawAvailable}
              onClick={onOfferDraw}
              type="button"
              variant="secondary"
            >
              <span aria-hidden="true" className="block text-xl">
                ½
              </span>
              {messages.offerDraw}
            </MapachessButton>
            {selectDrawOfferResponse(snapshot) === "rejected" ? (
              <p role="status" className="text-mapachito-white">
                {copy.gameplay.drawDeclined(opponentName)}
              </p>
            ) : null}
            <MapachessButton
              aria-busy={
                persisting &&
                selectMatchConclusion(snapshot) === null &&
                selectMatchPosition(snapshot).status.type === "playing"
              }
              className="px-1! text-base"
              disabled={!selectCanResign(snapshot)}
              onClick={() => actor.send({ type: "MATCH.RESIGN_REQUESTED" })}
              type="button"
              variant="destructive"
            >
              <span aria-hidden="true" className="block text-xl">
                ⚑
              </span>
              {messages.resign}
            </MapachessButton>
          </div>
        </details>
      </div>
      {hints}
    </div>
  )
}
