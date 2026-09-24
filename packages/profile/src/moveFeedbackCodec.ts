import { MATCH_COLORS } from "@mapachess/match/match-position"
import type { MatchTimeline } from "@mapachess/match/match-timeline"
import {
  MOVE_GRADES,
  type MoveFeedbackRecord,
  type PositionEvaluation,
} from "@mapachess/match/move-feedback"
import {
  failData,
  requireEnumValue,
  requireExactKeys,
  requireObject,
  requireSafeRevision,
  requireString,
} from "./decodePrimitives.js"

export const canonicalFeedbackEvaluation = (
  value: PositionEvaluation,
): readonly (string | number)[] =>
  value.kind === "draw"
    ? [value.kind]
    : value.kind === "mate"
      ? [value.kind, value.bound, value.moves, value.winner]
      : [value.kind, value.bound, value.whiteCentipawns]

export const canonicalMoveFeedback = (
  entry: MoveFeedbackRecord,
): readonly unknown[] => [
  entry.ply,
  entry.moveId,
  entry.mover,
  entry.beforeFen,
  entry.afterFen,
  canonicalFeedbackEvaluation(entry.before),
  canonicalFeedbackEvaluation(entry.after),
  entry.grade,
  entry.reason,
  entry.policyId,
]

const decodeEvaluation = (
  received: unknown,
  path: string,
): PositionEvaluation => {
  const value = requireObject(received, path)
  if (value.kind === "draw") {
    requireExactKeys(value, ["kind"], path)
    return { kind: "draw" }
  }
  const bound = requireEnumValue(
    value.bound,
    ["exact", "lower", "upper"],
    `${path}.bound`,
  )
  if (value.kind === "centipawns") {
    requireExactKeys(value, ["kind", "bound", "whiteCentipawns"], path)
    if (
      typeof value.whiteCentipawns !== "number" ||
      !Number.isSafeInteger(value.whiteCentipawns)
    )
      return failData(path)
    return { kind: "centipawns", bound, whiteCentipawns: value.whiteCentipawns }
  }
  if (value.kind === "mate") {
    requireExactKeys(value, ["kind", "bound", "moves", "winner"], path)
    return {
      kind: "mate",
      bound,
      moves: requireSafeRevision(value.moves, `${path}.moves`),
      winner: requireEnumValue(value.winner, MATCH_COLORS, `${path}.winner`),
    }
  }
  return failData(path)
}

export default function decodeMoveFeedback(
  received: unknown,
  timeline: MatchTimeline,
  path: string,
): readonly MoveFeedbackRecord[] {
  if (!Array.isArray(received) || received.length > timeline.transitions.length)
    return failData(path)
  let previousPly = 0
  return Object.freeze(
    received.map((entry: unknown, index) => {
      const entryPath = `${path}[${String(index)}]`
      const value = requireObject(entry, entryPath)
      requireExactKeys(
        value,
        [
          "ply",
          "moveId",
          "mover",
          "beforeFen",
          "afterFen",
          "before",
          "after",
          "grade",
          "reason",
          "policyId",
        ],
        entryPath,
      )
      const ply = requireSafeRevision(value.ply, `${entryPath}.ply`)
      const transition = timeline.transitions[ply - 1]
      if (
        ply <= previousPly ||
        transition === undefined ||
        value.moveId !== transition.move.id ||
        value.mover !== transition.before.turn ||
        value.beforeFen !== transition.before.fen ||
        value.afterFen !== transition.after.fen
      )
        return failData(entryPath)
      previousPly = ply
      if (value.reason !== null && value.reason !== "Lost forced mate")
        return failData(`${entryPath}.reason`)
      return Object.freeze({
        ply,
        moveId: transition.move.id,
        mover: transition.before.turn,
        beforeFen: transition.before.fen,
        afterFen: transition.after.fen,
        before: decodeEvaluation(value.before, `${entryPath}.before`),
        after: decodeEvaluation(value.after, `${entryPath}.after`),
        grade: requireEnumValue(value.grade, MOVE_GRADES, `${entryPath}.grade`),
        reason: value.reason,
        policyId: requireString(value.policyId, `${entryPath}.policyId`),
      })
    }),
  )
}
