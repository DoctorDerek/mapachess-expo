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
import MedalWithHintUse from "./MedalWithHintUse"

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
    <section aria-label="Story result" className="grid gap-3">
      <div>
        {medal !== null && next === undefined ? (
          <h3 className="font-display text-xl font-black">Story complete!</h3>
        ) : null}
        <p className="text-base">
          {medal === null ? "No new medal" : <MedalWithHintUse medal={medal} />}
        </p>
      </div>
      {medal === null ? (
        <p className="text-sm">Your Story progress is unchanged.</p>
      ) : best !== undefined && best !== medal ? (
        <p className="text-sm">
          Your best: {STORY_PROGRESS_COPY.medals[best]}.
        </p>
      ) : null}
      {medal !== null ? (
        <p className="text-sm">
          {opponent.displayName} is available in both Challenge modes.
          {next === undefined
            ? ` All ${ladder.length} opponents in this Story defeated.`
            : ""}
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
          <span className="mt-1 block text-base font-normal">
            {next.opponent.displayName} · {next.opponent.storyTargetElo} Elo
          </span>
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
        <span className="mt-1 block text-base font-normal">
          {opponent.displayName} · {opponent.storyTargetElo} Elo
        </span>
      </MapachessButton>
      <p className="text-xs">Choose your settings before playing again.</p>
    </section>
  )
}
