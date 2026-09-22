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
  drawAvailable,
  onOfferDraw,
  snapshot,
}: Readonly<{
  actor: ActorRefFrom<typeof matchMachine>
  drawAvailable: boolean
  onOfferDraw: () => void
  snapshot: MatchMachineSnapshot
}>) {
  const persisting = selectIsPersistingMutation(snapshot)
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(5rem,100%),1fr))] gap-2">
      <MapachessButton
        aria-busy={persisting && selectHasUndoHistory(snapshot)}
        className="px-1! text-base"
        disabled={!selectCanUndo(snapshot)}
        onClick={() => actor.send({ type: "MATCH.UNDO_REQUESTED" })}
        type="button"
        variant="secondary"
      >
        <span aria-hidden="true" className="block text-xl">
          ↶
        </span>
        Undo
      </MapachessButton>
      <MapachessButton
        aria-busy={persisting && selectHasRedoHistory(snapshot)}
        className="px-1! text-base"
        disabled={!selectCanRedo(snapshot)}
        onClick={() => actor.send({ type: "MATCH.REDO_REQUESTED" })}
        type="button"
        variant="secondary"
      >
        <span aria-hidden="true" className="block text-xl">
          ↷
        </span>
        Redo
      </MapachessButton>
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
  )
}
