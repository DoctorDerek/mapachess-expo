"use client"

import type {
  BetterHint,
  BetterHintsResult,
} from "@mapachess/match/better-hints"
import type { MatchHintStage } from "@mapachess/match/match-machine"

type HintControlAction = "move-hints" | "piece-hints"

type HintControlPresentation = Readonly<{
  action: HintControlAction | null
  label: string
}>

export type BetterHintsControlProps = Readonly<{
  hints: BetterHintsResult | null
  matchComplete: boolean
  onMoveHintsRequested: () => void
  onPieceHintsRequested: () => void
  stage: MatchHintStage
}>

const HINT_CONTROLS = Object.freeze({
  failure: Object.freeze({
    action: "piece-hints",
    label: "Retry Piece Hints",
  }),
  hidden: Object.freeze({
    action: null,
    label: "Hints available on your turn",
  }),
  loading: Object.freeze({ action: null, label: "Finding Piece Hints…" }),
  "move-hints": Object.freeze({ action: null, label: "Move Hints Shown" }),
  "piece-hints": Object.freeze({
    action: "move-hints",
    label: "Show Move Hints",
  }),
  ready: Object.freeze({
    action: "piece-hints",
    label: "Show Piece Hints",
  }),
  unavailable: Object.freeze({ action: null, label: "Hints unavailable" }),
}) satisfies Readonly<Record<MatchHintStage, HintControlPresentation>>

const COMPLETED_HINT_CONTROL: HintControlPresentation = Object.freeze({
  action: null,
  label: "Hints unavailable after game",
})

const HINT_GUIDANCE = Object.freeze({
  failure: "Piece Hints could not be calculated. Your position is unchanged.",
  hidden: "Piece Hints return when it is your turn.",
  loading: "Analyzing this unchanged board for Player and Opponent pieces.",
  "move-hints":
    "Solid green arrows show Player moves. Dashed red arrows show Opponent moves.",
  "piece-hints":
    "Solid green borders mark Player pieces. Dashed red borders mark Opponent pieces.",
  ready: "Start by finding the most important Player and Opponent pieces.",
  unavailable: "This runtime has no Better Hints analyst.",
}) satisfies Readonly<Record<MatchHintStage, string>>

const describeHintPieces = (
  owner: "Opponent" | "Player",
  hints: readonly BetterHint[],
): string =>
  `${owner} Piece Hints: ${hints.length === 0 ? "none" : hints.map((hint) => hint.from).join(", ")}.`

const describeHintMoves = (
  owner: "Opponent" | "Player",
  hints: readonly BetterHint[],
): string =>
  `${owner} Move Hints: ${hints.length === 0 ? "none" : hints.map((hint) => `${hint.from} to ${hint.to}`).join("; ")}.`

const hintAnnouncement = (
  stage: MatchHintStage,
  hints: BetterHintsResult | null,
): string => {
  if (stage === "loading") {
    return "Finding Piece Hints for Player and Opponent."
  }
  if (stage === "failure") {
    return "Piece Hints could not be calculated. The board is unchanged."
  }
  if (stage === "piece-hints" && hints !== null) {
    return `Piece Hints shown. ${describeHintPieces("Player", hints.player)} ${describeHintPieces("Opponent", hints.opponent)}`
  }
  if (stage === "move-hints" && hints !== null) {
    return `Move Hints shown. ${describeHintMoves("Player", hints.player)} ${describeHintMoves("Opponent", hints.opponent)}`
  }
  return ""
}

export default function BetterHintsControl({
  hints,
  matchComplete,
  onMoveHintsRequested,
  onPieceHintsRequested,
  stage,
}: BetterHintsControlProps) {
  const control = matchComplete ? COMPLETED_HINT_CONTROL : HINT_CONTROLS[stage]
  const guidance = matchComplete
    ? "Better Hints are available only while the match is in progress."
    : HINT_GUIDANCE[stage]
  const visibleHints =
    stage === "piece-hints" || stage === "move-hints" ? hints : null
  const activate =
    control.action === "piece-hints"
      ? onPieceHintsRequested
      : control.action === "move-hints"
        ? onMoveHintsRequested
        : undefined

  return (
    <section aria-labelledby="better-hints-title" className="mt-5">
      <h2 className="mapa-subheading" id="better-hints-title">
        Better Hints
      </h2>
      <button
        aria-busy={stage === "loading"}
        aria-describedby="better-hints-guidance"
        className="mapa-button mapa-button--mint mt-3 min-h-12 w-full px-4 py-3"
        data-hint-stage={matchComplete ? "complete" : stage}
        disabled={control.action === null}
        onClick={activate}
        type="button"
      >
        {control.label}
      </button>
      <p
        className="mapa-muted mt-2 text-sm leading-relaxed"
        id="better-hints-guidance"
      >
        {guidance}
      </p>
      <p aria-atomic="true" aria-live="polite" className="sr-only">
        {hintAnnouncement(stage, hints)}
      </p>

      {visibleHints === null ? null : (
        <ul
          aria-label="Better Hints legend"
          className="mt-3 grid gap-2 text-xs font-bold text-[var(--mapa-ink)] sm:grid-cols-2 xl:grid-cols-1"
        >
          <li className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-6 rounded-md border-[3px] border-emerald-500"
            />
            Player Piece Hint
          </li>
          <li className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-6 rounded-md border-[3px] border-dashed border-red-500"
            />
            Opponent Piece Hint
          </li>
          {stage === "move-hints" ? (
            <>
              <li className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="grid size-6 place-items-center font-black text-emerald-400"
                >
                  →
                </span>
                Player Move Hint
              </li>
              <li className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="grid size-6 place-items-center border-t-2 border-dashed border-red-400 font-black text-red-400"
                >
                  →
                </span>
                Opponent Move Hint
              </li>
            </>
          ) : null}
        </ul>
      )}
    </section>
  )
}
