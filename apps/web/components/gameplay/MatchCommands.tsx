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
    <div className="grid gap-1.5">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {coach}
        {hints}
      </div>
      <div className="grid min-w-0 grid-cols-3 items-stretch gap-1.5">
        <details
          className="relative z-40 min-w-0"
          open={menuOpen}
          ref={menu}
          data-player-input-layer={menuOpen ? "match-menu" : undefined}
        >
          <summary
            aria-label={messages.matchMenu}
            data-player-action="menu"
            className="border-mapachito-charcoal bg-mapachito-violet text-mapachito-white rounded-mapachess-action shadow-mapachess-button shadow-mapachito-charcoal hover:shadow-mapachess-raised active:shadow-mapachess-pressed flex h-full min-h-12 cursor-pointer flex-wrap items-center justify-center gap-1 border-3 px-1 py-1 text-sm leading-tight font-black transition-[translate,box-shadow] duration-120 ease-[ease] hover:-translate-0.25 active:translate-0.75 motion-reduce:transition-none motion-reduce:hover:translate-none motion-reduce:active:translate-none forced-colors:border-[CanvasText] forced-colors:shadow-none"
            ref={menuSummaryRef}
            onClick={(event) => {
              event.preventDefault()
              if (menuOpen) onMenuClosed()
              else onMenuOpened()
            }}
          >
            <InputPrompt action="menu" />
            <span className="min-w-0 wrap-anywhere">{messages.menu}</span>
          </summary>
          <div className="border-mapachito-white/30 bg-mapachito-charcoal fixed inset-x-3 bottom-[max(--spacing(3),env(safe-area-inset-bottom))] flex max-h-[calc(100dvh-max(--spacing(3),env(safe-area-inset-top))-max(--spacing(3),env(safe-area-inset-bottom)))] flex-col gap-3 rounded-lg border p-3 shadow-xl xl:inset-x-auto xl:bottom-3 xl:max-h-[65dvh] xl:w-96 xl:max-w-[calc(100vw---spacing(6))]">
            <div className="grid min-h-0 auto-rows-max grid-cols-1 gap-3 overflow-y-auto overscroll-contain px-1 pb-2">
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
            <MapachessButton
              className="shrink-0 px-1!"
              onClick={onMenuClosed}
              variant="secondary"
            >
              {copy.shared.settingsControls.close}
            </MapachessButton>
          </div>
        </details>
        <MapachessButton
          aria-busy={persisting && selectHasUndoHistory(snapshot)}
          className="flex min-w-0 flex-wrap items-center justify-center gap-1 px-1! py-1! text-sm leading-tight"
          disabled={!selectCanUndo(snapshot)}
          data-player-action="undo"
          onClick={() => actor.send({ type: "MATCH.UNDO_REQUESTED" })}
          variant="secondary"
        >
          <InputPrompt action="undo" />
          <span className="min-w-0 wrap-anywhere">{messages.undo}</span>
        </MapachessButton>
        <MapachessButton
          aria-busy={persisting && selectHasRedoHistory(snapshot)}
          className="flex min-w-0 flex-wrap items-center justify-center gap-1 px-1! py-1! text-sm leading-tight"
          disabled={!selectCanRedo(snapshot)}
          data-player-action="redo"
          onClick={() => actor.send({ type: "MATCH.REDO_REQUESTED" })}
          variant="secondary"
        >
          <InputPrompt action="redo" />
          <span className="min-w-0 wrap-anywhere">{messages.redo}</span>
        </MapachessButton>
      </div>
    </div>
  )
}
