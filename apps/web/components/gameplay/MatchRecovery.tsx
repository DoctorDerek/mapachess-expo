import type { ActorRefFrom } from "xstate"
import positionEvaluationMachine, {
  selectPositionEvaluationStage,
  type PositionEvaluationMachineSnapshot,
} from "@mapachess/evaluation/position-evaluation-machine"
import matchMachine, {
  selectOpponentFailure,
  selectPersistenceFailure,
  type MatchMachineSnapshot,
} from "@mapachess/match/match-machine"
import LocalSaveError from "../presentation/LocalSaveError"
import MapachessButton from "../presentation/MapachessButton"

export default function MatchRecovery({
  actor,
  snapshot,
  evaluationActor,
  evaluationSnapshot,
  opponentName,
}: Readonly<{
  actor: ActorRefFrom<typeof matchMachine>
  snapshot: MatchMachineSnapshot
  evaluationActor: ActorRefFrom<typeof positionEvaluationMachine>
  evaluationSnapshot: PositionEvaluationMachineSnapshot
  opponentName: string
}>) {
  const opponentFailure = selectOpponentFailure(snapshot)
  const persistenceFailure = selectPersistenceFailure(snapshot)
  return (
    <>
      {selectPositionEvaluationStage(evaluationSnapshot) === "failure" ? (
        <MapachessButton
          onClick={() =>
            evaluationActor.send({ type: "EVALUATION.RETRY_REQUESTED" })
          }
          type="button"
        >
          Retry Evaluation
        </MapachessButton>
      ) : null}
      {opponentFailure === null ? null : (
        <div className="grid gap-2">
          <p role="status" className="text-mapachito-white">
            {opponentName}{" "}
            {opponentFailure.type === "MATCH.OPPONENT_MOVE_ILLEGAL"
              ? "returned an invalid move."
              : "could not finish its turn."}{" "}
            Retry or undo.
          </p>
          <MapachessButton
            onClick={() =>
              actor.send({ type: "MATCH.OPPONENT_RETRY_REQUESTED" })
            }
            type="button"
          >
            Retry {opponentName} turn
          </MapachessButton>
        </div>
      )}
      {persistenceFailure === null ? null : (
        <div className="grid gap-2">
          <p role="status" className="text-mapachito-white">
            <LocalSaveError />
            <span className="mt-1 block">
              Your pending change is retained but not yet saved. Retry save to
              continue.
            </span>
          </p>
          <MapachessButton
            onClick={() =>
              actor.send({ type: "MATCH.PERSISTENCE_RETRY_REQUESTED" })
            }
            type="button"
          >
            Retry save
          </MapachessButton>
        </div>
      )}
    </>
  )
}
