import type { MatchTimeline } from "@mapachess/match/match-timeline"
import type { MoveFeedbackRecord } from "@mapachess/match/move-feedback"
import classifyAcceptedMove from "./classifiedMove.js"
import type {
  PositionEvaluationResult,
  PositionEvaluator,
} from "./positionEvaluator.js"

export type MoveFeedbackEvaluatorInput = Readonly<{
  matchId: string
  evaluate: PositionEvaluator
  timeline: () => MatchTimeline
  records: () => readonly MoveFeedbackRecord[]
  persist: (record: MoveFeedbackRecord, signal: AbortSignal) => Promise<boolean>
}>

export default function createMoveFeedbackEvaluator({
  matchId,
  evaluate,
  timeline,
  records,
  persist,
}: MoveFeedbackEvaluatorInput): PositionEvaluator {
  const evaluations = new Map<string, PositionEvaluationResult>()
  return async (request, signal) => {
    const result = await evaluate(request, signal)
    if (signal.aborted)
      throw new DOMException("Move analysis aborted.", "AbortError")
    if (
      result.requestId !== request.requestId ||
      result.positionFen !== request.position.fen
    )
      throw new Error("Rejected stale move feedback evaluation.")
    evaluations.set(result.positionFen, result)
    const accepted = timeline()
    for (const [index, transition] of accepted.transitions.entries()) {
      if (
        records().some(
          (record) =>
            record.ply === index + 1 &&
            record.moveId === transition.move.id &&
            record.beforeFen === transition.before.fen &&
            record.afterFen === transition.after.fen,
        )
      )
        continue
      const before = evaluations.get(transition.before.fen)
      const after = evaluations.get(transition.after.fen)
      if (before === undefined || after === undefined) continue
      const classified = classifyAcceptedMove({
        matchId,
        ply: index + 1,
        transition,
        before,
        after,
      })
      if (classified.status !== "classified") continue
      const record = classified.record
      await persist(
        {
          ply: record.ply,
          moveId: record.move.id,
          mover: record.mover,
          beforeFen: before.positionFen,
          afterFen: after.positionFen,
          before: before.evaluation,
          after: after.evaluation,
          ...record.classification,
        },
        signal,
      )
    }
    return result
  }
}
