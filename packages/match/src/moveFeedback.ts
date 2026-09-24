import type { MatchMoveId } from "./matchMove.js"
import type { MatchColor } from "./matchPosition.js"

export const MOVE_GRADES = [
  "brilliant",
  "genius",
  "best",
  "good",
  "inaccuracy",
  "mistake",
  "blunder",
] as const
export type MoveGrade = (typeof MOVE_GRADES)[number]
export const MOVE_GRADE_LABELS: Readonly<Record<MoveGrade, string>> =
  Object.freeze({
    brilliant: "Brilliant !!",
    genius: "Genius !",
    best: "Best ★",
    good: "Good ✓",
    inaccuracy: "Inaccuracy ?!",
    mistake: "Mistake ?",
    blunder: "Blunder ??",
  })
export type PositionEvaluationBound = "exact" | "lower" | "upper"
export type PositionEvaluation =
  | Readonly<{ kind: "draw" }>
  | Readonly<{
      kind: "centipawns"
      bound: PositionEvaluationBound
      whiteCentipawns: number
    }>
  | Readonly<{
      kind: "mate"
      bound: PositionEvaluationBound
      moves: number
      winner: MatchColor
    }>

export type MoveFeedbackRecord = Readonly<{
  ply: number
  moveId: MatchMoveId
  mover: MatchColor
  beforeFen: string
  afterFen: string
  before: PositionEvaluation
  after: PositionEvaluation
  grade: MoveGrade
  reason: "Lost forced mate" | null
  policyId: string
}>
