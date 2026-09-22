import type { ReactNode } from "react"
import type { ActorRefFrom } from "xstate"
import matchMachine, {
  selectCanOfferDraw,
  selectCanRedo,
  selectCanResign,
  selectCanUndo,
  selectHasRedoHistory,
  selectHasUndoHistory,
  selectIsPersistingMutation,
  selectMatchConclusion,
  selectMatchPosition,
  type MatchMachineSnapshot,
} from "@mapachess/match/match-machine"
import MapachessButton from "../presentation/MapachessButton"

export default function MatchCommands({
  actor,
  hints,
  coach,
  menuActions,
  drawAvailable,
  onOfferDraw,
  snapshot,
}: Readonly<{
  hints: ReactNode
  coach: ReactNode
  menuActions?: ReactNode
  actor: ActorRefFrom<typeof matchMachine>
  drawAvailable: boolean
  onOfferDraw: () => void
  snapshot: MatchMachineSnapshot
}>) {
  const persisting = selectIsPersistingMutation(snapshot)
  return (
    <div className="grid grid-cols-[auto_repeat(4,minmax(0,1fr))] items-center gap-2">
      {coach}
      <MapachessButton
        aria-busy={persisting && selectHasUndoHistory(snapshot)}
        className="flex min-h-14 flex-col items-center justify-center px-1! py-1! text-base"
        disabled={!selectCanUndo(snapshot)}
        onClick={() => actor.send({ type: "MATCH.UNDO_REQUESTED" })}
        type="button"
        variant="secondary"
      >
        <span aria-hidden="true" className="text-lg leading-none">
          ↶
        </span>
        Undo
      </MapachessButton>
      <MapachessButton
        aria-busy={persisting && selectHasRedoHistory(snapshot)}
        className="flex min-h-14 flex-col items-center justify-center px-1! py-1! text-base"
        disabled={!selectCanRedo(snapshot)}
        onClick={() => actor.send({ type: "MATCH.REDO_REQUESTED" })}
        type="button"
        variant="secondary"
      >
        <span aria-hidden="true" className="text-lg leading-none">
          ↷
        </span>
        Redo
      </MapachessButton>
      {hints}
      <details className="relative z-40 min-w-0">
        <summary
          aria-label="Match menu"
          className="border-mapachito-charcoal bg-mapachito-violet text-mapachito-white flex min-h-14 cursor-pointer flex-col items-center justify-center rounded-lg border-3 px-1 py-1 leading-[1.2] font-black focus-visible:outline-2"
        >
          <span aria-hidden="true">☰</span>Menu
        </summary>
        <div className="border-mapachito-white/30 bg-mapachito-charcoal absolute right-0 bottom-full mb-2 grid max-h-[65dvh] w-64 max-w-[calc(100vw-1rem)] gap-3 overflow-auto rounded-lg border p-3 shadow-xl">
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
            Offer Draw
          </MapachessButton>
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
            Resign
          </MapachessButton>
        </div>
      </details>
    </div>
  )
}
