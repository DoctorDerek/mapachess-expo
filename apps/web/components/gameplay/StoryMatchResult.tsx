import type { MatchSetup } from "@mapachess/match/match-setup"
import stockfishOpponent from "@mapachess/match/stockfish-opponent"
import {
  selectStoryLadder,
  STORY_PROGRESS_COPY,
  storyVictoryMedal,
  type StoryMatchResult as SavedStoryMatchResult,
  type StoryProgress,
} from "@mapachess/profile/story-progress"
import MapachessButton from "../presentation/MapachessButton"
import MedalSymbol from "../presentation/MedalSymbol"

export default function StoryMatchResult({
  match,
  progress,
  disabled,
  opening,
  onSetupRequested,
}: Readonly<{
  match: SavedStoryMatchResult
  progress: StoryProgress
  disabled: boolean
  opening: boolean
  onSetupRequested: (setup: MatchSetup) => void
}>) {
  if (match.mode !== "story" || match.conclusion === null) return null
  const variant = match.startingPosition.variant
  const medal = storyVictoryMedal(match)
  const ladder = selectStoryLadder(progress, variant)
  const next = ladder.find((step) => step.status === "unlocked")
  const best = progress[variant].find(
    (victory) => victory.opponentId === match.opponentId,
  )?.highestMedal
  const opponent = stockfishOpponent(match.opponentId)
  const setup = (opponentId = match.opponentId): void =>
    onSetupRequested({ mode: "story", variant, opponentId })

  return (
    <section
      aria-label="Saved Story result"
      className="bg-mapachito-white text-mapachito-charcoal grid gap-3 rounded-lg p-4"
    >
      <div className="flex items-center gap-3">
        {medal === null ? null : (
          <span className="text-3xl">
            <MedalSymbol medal={medal} />
          </span>
        )}
        <div>
          <h2 className="font-display text-xl font-black">
            {medal !== null
              ? next === undefined
                ? "Story complete!"
                : "You won!"
              : "Match complete"}
          </h2>
          <p className="text-sm">
            {medal === null
              ? "No new medal"
              : `${STORY_PROGRESS_COPY.medals[medal]} this match`}{" "}
            · Saved
          </p>
        </div>
      </div>
      {medal === null ? (
        <p className="text-sm">Your Story progress is unchanged.</p>
      ) : (
        <p className="text-sm">
          {medal === "gold"
            ? "No hints used."
            : medal === "silver"
              ? "Piece Hints used · no Move Hints."
              : "Move Hints used."}
          {best === undefined || best === medal
            ? ""
            : ` Your best: ${STORY_PROGRESS_COPY.medals[best]}.`}
        </p>
      )}
      {medal !== null ? (
        <p className="text-sm">
          {opponent.displayName} is available in both Challenge modes.
          {next === undefined
            ? ` All ${ladder.length} opponents in this Story defeated.`
            : ` Up next: ${next.opponent.displayName}.`}
        </p>
      ) : null}
      {medal !== null && next !== undefined ? (
        <MapachessButton
          disabled={disabled}
          aria-busy={opening}
          busyLabel="Opening setup…"
          onClick={() => setup(next.opponent.id)}
        >
          Next opponent
        </MapachessButton>
      ) : null}
      {medal !== null && next === undefined ? (
        <MapachessButton
          disabled={disabled}
          aria-busy={opening}
          busyLabel="Opening setup…"
          onClick={() => onSetupRequested({ mode: "story", variant })}
        >
          Story ladder
        </MapachessButton>
      ) : null}
      <MapachessButton
        variant="secondary"
        disabled={disabled}
        aria-busy={opening}
        busyLabel="Opening setup…"
        onClick={() => setup()}
      >
        Replay opponent
      </MapachessButton>
      <p className="text-xs">Choose your settings before playing again.</p>
    </section>
  )
}
