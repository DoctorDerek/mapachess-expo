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
import { MOVE_GRADE_LABELS } from "@mapachess/match/move-feedback"

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
  const reaction = useSelector(
    reactionActor,
    (current) => current.context.visible,
  )
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
      className="border-mapachito-charcoal bg-mapachito-charcoal relative min-h-8 w-full border xl:h-full xl:w-[clamp(2rem,2.75vw,3rem)]"
      data-evaluation-orientation="horizontal-below-xl-vertical-at-xl"
      style={style}
    >
      <div
        aria-label="Stockfish evaluation"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(whiteShare)}
        aria-valuetext={statusText}
        role="meter"
        className="absolute inset-0"
      >
        <div
          aria-hidden="true"
          className={`bg-mapachito-white absolute inset-y-0 left-0 w-[var(--white-share)] transition-[width,height] duration-300 motion-reduce:transition-none xl:inset-x-0 xl:inset-y-auto xl:h-[var(--white-share)] xl:w-auto ${orientation === "white" ? "xl:bottom-0" : "xl:top-0"}`}
        />
      </div>
      {reaction === null ? (
        <>
          <span
            aria-hidden="true"
            className="absolute top-1/2 left-2 -translate-y-1/2 rounded bg-slate-950/80 px-1 font-mono text-[0.625rem] font-black text-white xl:hidden"
          >
            White
          </span>
          <span
            aria-hidden="true"
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded bg-slate-950/80 px-1 font-mono text-[0.625rem] font-black text-white xl:hidden"
          >
            Black
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
        </>
      ) : null}
      <span
        aria-atomic="true"
        aria-live="polite"
        className={`relative z-10 grid min-h-8 place-items-center px-14 py-1 text-center font-mono text-base font-black text-white [text-shadow:0_1px_3px_rgb(30_30_30),0_0_4px_rgb(30_30_30)] xl:absolute xl:inset-0 xl:rotate-180 xl:px-0 xl:[writing-mode:vertical-rl] ${reaction === null ? "" : "sr-only"}`}
      >
        {statusText}
      </span>
      {reaction === null ? null : (
        <div className="relative z-20 flex min-h-8 items-center justify-between gap-1 px-1 font-mono text-sm font-bold text-white [text-shadow:0_1px_3px_rgb(30_30_30),0_0_4px_rgb(30_30_30)] xl:absolute xl:inset-0 xl:flex-col xl:justify-center xl:[writing-mode:vertical-rl]">
          <span
            className={`bg-mapachito-charcoal rounded px-1 ${evaluation?.kind === "mate" ? (evaluation.winner === "black" ? "order-last" : "") : evaluation?.kind === "centipawns" && evaluation.whiteCentipawns < 0 ? "order-last" : ""}`}
            aria-label={statusText}
          >
            {acceptedText ?? "Evaluating…"}
          </span>
          <button
            type="button"
            className="bg-mapachito-charcoal min-h-8 min-w-0 flex-1 rounded px-1 leading-4 focus-visible:outline-2"
            onClick={() =>
              reactionActor.send({
                type: "MOVE_REACTION.DISMISSED",
                id: reaction.id,
              })
            }
            aria-label={`Dismiss ${reaction.mover === "white" ? "White" : "Black"} ${reaction.san}: ${MOVE_GRADE_LABELS[reaction.classification.grade]}${reaction.classification.reason === null ? "" : `, ${reaction.classification.reason}`}`}
          >
            <span role="status" aria-atomic="true">
              {reaction.mover === "white" ? "White" : "Black"} {reaction.san} ·{" "}
              {MOVE_GRADE_LABELS[reaction.classification.grade]}
              {reaction.classification.reason === null ? null : (
                <span className="block">{reaction.classification.reason}</span>
              )}
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
