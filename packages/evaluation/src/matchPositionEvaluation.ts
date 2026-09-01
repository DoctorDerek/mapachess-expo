import {
  selectMatchPosition,
  selectMatchTimeline,
  type MatchMachineSnapshot,
} from "@mapachess/match/match-machine"
import type { PositionEvaluationMachineEvent } from "./positionEvaluationMachine.js"

export type MatchPositionEvaluationSource = Readonly<{
  getSnapshot: () => MatchMachineSnapshot
  subscribe: (
    listener: (snapshot: MatchMachineSnapshot) => void,
  ) => Readonly<{ unsubscribe: () => void }>
}>

export type PositionEvaluationEventSink = Readonly<{
  send: (event: PositionEvaluationMachineEvent) => void
}>

export type MatchPositionEvaluationBinding = Readonly<{
  disconnect: () => void
}>

export default function bindMatchPositionEvaluation(
  source: MatchPositionEvaluationSource,
  sink: PositionEvaluationEventSink,
): MatchPositionEvaluationBinding {
  let requestedPositionFen: string | null = null

  const requestAcceptedPosition = (snapshot: MatchMachineSnapshot): void => {
    const position = selectMatchPosition(snapshot)
    if (position.fen === requestedPositionFen) return

    requestedPositionFen = position.fen
    const timeline = selectMatchTimeline(snapshot)
    sink.send(
      Object.freeze({
        request: Object.freeze({
          position,
          requestId: `${snapshot.context.matchId}/evaluation/cursor/${String(timeline.cursor)}/fen/${position.fen}`,
        }),
        type: "EVALUATION.POSITION_REQUESTED" as const,
      }),
    )
  }

  requestAcceptedPosition(source.getSnapshot())
  const subscription = source.subscribe(requestAcceptedPosition)

  return Object.freeze({
    disconnect: () => subscription.unsubscribe(),
  })
}
