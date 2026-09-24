"use client"

import { useSelector } from "@xstate/react"
import type { CSSProperties } from "react"
import type { ActorRefFrom } from "xstate"
import moveReactionMachine from "@mapachess/evaluation/move-reaction-machine"
import type { PositionEvaluation } from "@mapachess/evaluation/position-evaluation"
import positionEvaluationMachine, {
  selectPositionEvaluation,
  selectPositionEvaluationStage,
} from "@mapachess/evaluation/position-evaluation-machine"
import type { MatchColor } from "@mapachess/match/match-position"
import MoveReactionFeedback from "./MoveReactionFeedback"

const FULL_GUTTER_ADVANTAGE_CENTIPAWNS = 1_000

type EvaluationGutterStyle = CSSProperties &
  Readonly<{ "--white-share": string }>

export type PositionEvaluationGutterProps = Readonly<{
  actor: ActorRefFrom<typeof positionEvaluationMachine>
  reactionActor: ActorRefFrom<typeof moveReactionMachine>
  orientation: MatchColor
}>

const evaluationBoundText = (
  evaluation: Exclude<PositionEvaluation, { kind: "draw" }>,
): string =>
  evaluation.bound === "exact" ? "" : ` · ${evaluation.bound} bound`

const evaluationText = (evaluation: PositionEvaluation): string => {
  if (evaluation.kind === "draw") return "Even"
  if (evaluation.kind === "mate") {
    const result =
      evaluation.moves === 0
        ? `${evaluation.winner === "white" ? "White" : "Black"} checkmate`
        : `${evaluation.winner === "white" ? "White" : "Black"} M${String(evaluation.moves)}`
    return `${result}${evaluationBoundText(evaluation)}`
  }
  if (evaluation.whiteCentipawns === 0) return "Even"

  const signedPawns = `${evaluation.whiteCentipawns > 0 ? "+" : ""}${(
    evaluation.whiteCentipawns / 100
  ).toFixed(2)}`
  if (evaluation.bound !== "exact") {
    return `White ${evaluation.bound === "lower" ? "≥" : "≤"} ${signedPawns}`
  }

  const leader = evaluation.whiteCentipawns > 0 ? "White" : "Black"
  const pawns = (Math.abs(evaluation.whiteCentipawns) / 100).toFixed(2)
  return `${leader} +${pawns}`
}

const whiteSharePercent = (evaluation: PositionEvaluation | null): number => {
  if (evaluation === null || evaluation.kind === "draw") return 50
  if (evaluation.kind === "mate") {
    return evaluation.winner === "white" ? 100 : 0
  }

  const boundedCentipawns = Math.max(
    -FULL_GUTTER_ADVANTAGE_CENTIPAWNS,
    Math.min(FULL_GUTTER_ADVANTAGE_CENTIPAWNS, evaluation.whiteCentipawns),
  )
  return 50 + (boundedCentipawns / FULL_GUTTER_ADVANTAGE_CENTIPAWNS) * 50
}

export default function PositionEvaluationGutter({
  actor,
  reactionActor,
  orientation,
}: PositionEvaluationGutterProps) {
  const snapshot = useSelector(actor, (current) => current)
  const evaluation = selectPositionEvaluation(snapshot)
  const stage = selectPositionEvaluationStage(snapshot)
  if (stage === "ready" && evaluation === null) {
    throw new Error("Ready position evaluation has no accepted score.")
  }
  const acceptedText = evaluation === null ? null : evaluationText(evaluation)
  const statusText =
    acceptedText ??
    (stage === "failure" ? "Evaluation unavailable" : "Evaluation waiting")
  const whiteShare = whiteSharePercent(evaluation)
  const style: EvaluationGutterStyle = {
    "--white-share": `${String(whiteShare)}%`,
  }
  const blackLeading =
    evaluation?.kind === "mate"
      ? evaluation.winner === "black"
      : evaluation?.kind === "centipawns" && evaluation.whiteCentipawns < 0
  const score =
    evaluation === null
      ? "…"
      : evaluation.kind === "draw"
        ? "0.00"
        : evaluation.kind === "mate"
          ? `M${String(evaluation.moves)}`
          : `+${(Math.abs(evaluation.whiteCentipawns) / 100).toFixed(2)}`
  const scoreBound =
    evaluation === null ||
    evaluation.kind === "draw" ||
    evaluation.bound === "exact"
      ? ""
      : evaluation.bound === (blackLeading ? "upper" : "lower")
        ? "≥"
        : "≤"
  return (
    <>
      <div
        className="bg-mapachito-charcoal relative col-start-1 row-start-1 h-10 w-full xl:row-start-2 xl:h-full xl:w-6"
        data-evaluation-orientation="horizontal-below-xl-vertical-at-xl"
        style={style}
        aria-label="Stockfish evaluation"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(whiteShare)}
        aria-valuetext={statusText}
        role="meter"
      >
        <div
          aria-hidden="true"
          className={`bg-mapachito-white absolute inset-y-0 left-0 w-[var(--white-share)] transition-[width,height] duration-300 motion-reduce:transition-none xl:inset-x-0 xl:inset-y-auto xl:h-[var(--white-share)] xl:w-auto ${orientation === "white" ? "xl:bottom-0" : "xl:top-0"}`}
        />
      </div>
      <div className="relative col-start-1 row-start-1 grid h-10 min-w-0 grid-cols-[minmax(0,1fr)_max-content_minmax(0,1fr)] items-center px-1 font-mono text-base font-bold text-white xl:col-start-2">
        <span
          aria-label={statusText}
          className={`bg-mapachito-charcoal w-fit rounded px-1 text-sm tabular-nums ${blackLeading ? "col-start-3 row-start-1 justify-self-end" : "col-start-1 row-start-1"}`}
        >
          {scoreBound}
          {score}
        </span>
        <div
          className="col-start-2 row-start-1"
          role="status"
          aria-atomic="true"
        >
          <MoveReactionFeedback actor={reactionActor} />
        </div>
      </div>
    </>
  )
}
