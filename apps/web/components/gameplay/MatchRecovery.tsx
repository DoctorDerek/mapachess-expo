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
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"

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
  const copy = useMapachessCopy()
  const messages = copy.interface.matchRecovery

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
          {messages.retryEvaluation}
        </MapachessButton>
      ) : null}
      {opponentFailure === null ? null : (
        <div className="grid gap-2">
          <p role="status" className="text-mapachito-white">
            {opponentFailure.type === "MATCH.OPPONENT_MOVE_ILLEGAL"
              ? copy.gameplay.opponentMoveInvalid(opponentName)
              : copy.gameplay.opponentTurnFailed(opponentName)}
          </p>
          <MapachessButton
            onClick={() =>
              actor.send({ type: "MATCH.OPPONENT_RETRY_REQUESTED" })
            }
            type="button"
          >
            {copy.gameplay.retryTurn(opponentName)}
          </MapachessButton>
        </div>
      )}
      {persistenceFailure === null ? null : (
        <div className="grid gap-2">
          <p role="status" className="text-mapachito-white">
            <LocalSaveError />
            <span className="mt-1 block">
              {messages.yourPendingChangeIsRetainedButNot}
            </span>
          </p>
          <MapachessButton
            onClick={() =>
              actor.send({ type: "MATCH.PERSISTENCE_RETRY_REQUESTED" })
            }
            type="button"
          >
            {messages.retrySave}
          </MapachessButton>
        </div>
      )}
    </>
  )
}
