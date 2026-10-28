"use client"

import type { MapachessCatalog } from "@mapachess/localization/catalog"
import type {
  BetterHint,
  BetterHintsResult,
} from "@mapachess/match/better-hints"
import type { MatchHintStage } from "@mapachess/match/match-machine"
import InputPrompt from "../input/InputPrompt"
import MapachessButton from "../presentation/MapachessButton"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"

type HintControlAction = "move-hints" | "piece-hints"

export type BetterHintsControlProps = Readonly<{
  busy?: boolean
  disabled?: boolean
  hints: BetterHintsResult | null
  matchComplete: boolean
  onMoveHintsRequested: () => void
  onPieceHintsRequested: () => void
  stage: MatchHintStage
  nextMedal?: Readonly<{ label: string; description: string }> | null
}>

const HINT_ACTIONS = {
  failure: "piece-hints",
  hidden: null,
  loading: null,
  "move-hints": null,
  "piece-hints": "move-hints",
  ready: "piece-hints",
  unavailable: null,
} as const satisfies Readonly<Record<MatchHintStage, HintControlAction | null>>

type HintCopy = MapachessCatalog["gameplay"]["hints"]

const describeHintMove = (hint: BetterHint, copy: HintCopy): string =>
  hint.castling === undefined
    ? copy.move(hint.from, hint.to)
    : copy.castle(
        hint.castling.side,
        hint.to,
        hint.castling.rookFrom,
        hint.castling.rookTo,
      )

const hintAnnouncement = (
  stage: MatchHintStage,
  hints: BetterHintsResult | null,
  copy: HintCopy,
): string => {
  if (stage === "loading") {
    return copy.loading
  }
  if (stage === "failure") {
    return copy.failed
  }
  if (stage === "piece-hints" && hints !== null) {
    return copy.piecesShown(
      hints.player.map((hint) => hint.from),
      hints.opponent.map((hint) => hint.from),
    )
  }
  if (stage === "move-hints" && hints !== null) {
    return copy.movesShown(
      hints.player.map((hint) => describeHintMove(hint, copy)),
      hints.opponent.map((hint) => describeHintMove(hint, copy)),
    )
  }
  return ""
}

export default function BetterHintsControl({
  busy = false,
  disabled = false,
  hints,
  matchComplete,
  onMoveHintsRequested,
  onPieceHintsRequested,
  stage,
  nextMedal = null,
}: BetterHintsControlProps) {
  const copy = useMapachessCopy()
  const messages = copy.interface.betterHintsControl

  const control = {
    action: matchComplete ? null : HINT_ACTIONS[stage],
    label: copy.gameplay.hints.controls[matchComplete ? "complete" : stage],
  }
  const guidance =
    copy.gameplay.hints.guidance[matchComplete ? "complete" : stage]
  const activate =
    control.action === "piece-hints"
      ? onPieceHintsRequested
      : control.action === "move-hints"
        ? onMoveHintsRequested
        : undefined

  return (
    <section
      aria-labelledby="better-hints-title"
      className="relative flex min-w-0 flex-col"
    >
      <h2 className="sr-only" id="better-hints-title">
        {messages.betterHints}
      </h2>
      <MapachessButton
        variant="hint"
        aria-label={control.label}
        aria-busy={(busy && control.action !== null) || stage === "loading"}
        aria-describedby="better-hints-guidance better-hints-medal"
        className="flex h-full min-h-20 w-full min-w-0 flex-col items-center justify-center gap-1 px-2! py-2! text-base"
        data-hint-stage={matchComplete ? "complete" : stage}
        data-player-action="hints"
        disabled={disabled || busy || control.action === null}
        onClick={activate}
        type="button"
      >
        <span className="grid max-w-full min-w-0 wrap-anywhere">
          {Object.entries(copy.gameplay.hints.controls).map(
            ([stage, label]) => (
              <span
                aria-hidden="true"
                className="invisible col-start-1 row-start-1"
                key={stage}
              >
                {label}
              </span>
            ),
          )}
          <span className="col-start-1 row-start-1">{control.label}</span>
        </span>
        <span className="flex items-center justify-center gap-1">
          <InputPrompt action="hints" />
          <span className="grid text-sm font-semibold">
            {(["silver", "bronze"] as const).map((tier) => (
              <span
                key={tier}
                aria-hidden="true"
                className="invisible col-start-1 row-start-1"
              >
                → {copy.shared.story.medals[tier]}
              </span>
            ))}
            {nextMedal === null ? null : (
              <span className="col-start-1 row-start-1">
                <span aria-hidden="true">→ {nextMedal.label}</span>
              </span>
            )}
          </span>
        </span>
      </MapachessButton>
      <span id="better-hints-medal" className="sr-only">
        {nextMedal?.description}
      </span>
      <p aria-atomic="true" aria-live="polite" className="sr-only">
        {hintAnnouncement(stage, hints, copy.gameplay.hints)}
      </p>
      <p
        className={
          stage === "failure" || stage === "unavailable"
            ? "text-mapachito-white w-full text-base font-semibold"
            : "sr-only"
        }
        id="better-hints-guidance"
      >
        {guidance}
      </p>
    </section>
  )
}
