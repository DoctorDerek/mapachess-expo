"use client"

import { useSelector } from "@xstate/react"
import type { CSSProperties } from "react"
import type { ActorRefFrom } from "xstate"
import {
  positionEvaluationLabel,
  type PositionEvaluation,
} from "@mapachess/evaluation/position-evaluation"
import positionEvaluationMachine, {
  selectPositionEvaluation,
  selectPositionEvaluationStage,
} from "@mapachess/evaluation/position-evaluation-machine"
import type { MapachessCatalog } from "@mapachess/localization/catalog"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"

const FULL_GUTTER_ADVANTAGE_CENTIPAWNS = 1_000

type EvaluationGutterStyle = CSSProperties &
  Readonly<{ "--white-share": string }>

export type PositionEvaluationGutterProps = Readonly<{
  actor: ActorRefFrom<typeof positionEvaluationMachine>
}>

const evaluationText = (
  evaluation: PositionEvaluation,
  copy: MapachessCatalog["evaluation"],
): string => {
  const label = positionEvaluationLabel(evaluation, copy)
  if (evaluation.kind !== "centipawns")
    return evaluation.kind === "draw" ? copy.even : label
  if (evaluation.bound === "exact" && evaluation.whiteCentipawns === 0)
    return copy.even
  return copy.whiteRelative(label)
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
}: PositionEvaluationGutterProps) {
  const catalog = useMapachessCopy()
  const copy = catalog.evaluation
  const messages = catalog.interface.positionEvaluationGutter

  const snapshot = useSelector(actor, (current) => current)
  const evaluation = selectPositionEvaluation(snapshot)
  const stage = selectPositionEvaluationStage(snapshot)
  if (stage === "ready" && evaluation === null) {
    throw new Error("Ready position evaluation has no accepted score.")
  }
  const acceptedText =
    evaluation === null ? null : evaluationText(evaluation, copy)
  const statusText =
    acceptedText ?? (stage === "failure" ? copy.unavailable : copy.waiting)
  const whiteShare = whiteSharePercent(evaluation)
  const style: EvaluationGutterStyle = {
    "--white-share": `${String(whiteShare)}%`,
  }
  const score =
    evaluation === null ? "…" : positionEvaluationLabel(evaluation, copy)
  return (
    <div
      className="bg-mapachito-charcoal relative isolate grid min-h-8 w-full place-items-center px-1 py-1 font-mono text-base font-bold text-white"
      style={style}
      aria-label={messages.stockfishEvaluation}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(whiteShare)}
      aria-valuetext={statusText}
      role="meter"
    >
      <div
        aria-hidden="true"
        className="bg-mapachito-white absolute inset-y-0 left-0 w-[var(--white-share)] transition-[width] duration-300 motion-reduce:transition-none"
      />
      <span
        aria-hidden="true"
        className="bg-mapachito-charcoal relative rounded px-2 text-center tabular-nums"
      >
        {score}
      </span>
    </div>
  )
}
