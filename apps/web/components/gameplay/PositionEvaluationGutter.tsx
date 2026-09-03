"use client"

import { useSelector } from "@xstate/react"
import type { CSSProperties } from "react"
import type { ActorRefFrom } from "xstate"
import type { PositionEvaluation } from "@mapachess/evaluation/position-evaluation"
import positionEvaluationMachine, {
  selectPositionEvaluation,
  selectPositionEvaluationStage,
} from "@mapachess/evaluation/position-evaluation-machine"
import type { MatchColor } from "@mapachess/match/match-position"

const FULL_GUTTER_ADVANTAGE_CENTIPAWNS = 1_000

type EvaluationGutterStyle = CSSProperties &
  Readonly<{ "--white-share": string }>

export type PositionEvaluationGutterProps = Readonly<{
  actor: ActorRefFrom<typeof positionEvaluationMachine>
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
    stage === "analyzing"
      ? acceptedText === null
        ? "Evaluating…"
        : `Evaluating… · ${acceptedText}`
      : stage === "failure"
        ? "Evaluation unavailable"
        : (acceptedText ?? "Evaluation waiting")
  const whiteShare = whiteSharePercent(evaluation)
  const style: EvaluationGutterStyle = {
    "--white-share": `${String(whiteShare)}%`,
  }
  const topColor = orientation === "white" ? "Black" : "White"
  const bottomColor = orientation === "white" ? "White" : "Black"

  return (
    <div
      aria-label="Stockfish evaluation"
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(whiteShare)}
      aria-valuetext={statusText}
      className="relative h-10 w-full overflow-hidden rounded-[0.65rem_0.15rem_0.65rem_0.15rem] border-[3px] border-[var(--mapachito-charcoal)] bg-[var(--mapachito-charcoal)] shadow-[0.25rem_0.25rem_0_var(--mapachito-raspberry),0.45rem_0.45rem_0_var(--mapachito-orange)] xl:h-full xl:w-[clamp(2rem,2.75vw,3rem)]"
      data-evaluation-orientation="horizontal-below-xl-vertical-at-xl"
      role="meter"
      style={style}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-[var(--white-share)] bg-[var(--mapachito-white)] transition-[width,height] duration-300 motion-reduce:transition-none xl:inset-x-0 xl:inset-y-auto xl:h-[var(--white-share)] xl:w-auto ${orientation === "white" ? "xl:bottom-0" : "xl:top-0"}`}
      />
      <span
        aria-hidden="true"
        className="absolute top-1/2 left-2 -translate-y-1/2 rounded bg-slate-950/80 px-1 font-mono text-[0.625rem] font-black text-white xl:hidden"
      >
        W
      </span>
      <span
        aria-hidden="true"
        className="absolute top-1/2 right-2 -translate-y-1/2 rounded bg-slate-950/80 px-1 font-mono text-[0.625rem] font-black text-white xl:hidden"
      >
        B
      </span>
      <span
        aria-hidden="true"
        className="absolute top-2 left-1/2 hidden -translate-x-1/2 rounded bg-slate-950/80 px-1 font-mono text-[0.625rem] font-black text-white xl:block"
      >
        {topColor.slice(0, 1)}
      </span>
      <span
        aria-hidden="true"
        className="absolute bottom-2 left-1/2 hidden -translate-x-1/2 rounded bg-slate-950/80 px-1 font-mono text-[0.625rem] font-black text-white xl:block"
      >
        {bottomColor.slice(0, 1)}
      </span>
      <span
        aria-atomic="true"
        aria-live="polite"
        className="absolute inset-0 z-10 grid place-items-center px-10 text-center font-mono text-[0.6875rem] font-black whitespace-nowrap text-white [text-shadow:0_1px_3px_rgb(30_30_30),0_0_4px_rgb(30_30_30)] xl:rotate-180 xl:px-0 xl:[writing-mode:vertical-rl]"
      >
        {statusText}
      </span>
    </div>
  )
}
