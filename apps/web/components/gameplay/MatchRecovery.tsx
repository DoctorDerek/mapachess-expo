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
            Your last action is paused because its local save was not verified.
          </p>
          <MapachessButton
            onClick={() =>
              actor.send({ type: "MATCH.PERSISTENCE_RETRY_REQUESTED" })
            }
            type="button"
          >
            Retry local save
          </MapachessButton>
        </div>
      )}
    </>
  )
}
