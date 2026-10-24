import type { MatchSetup } from "@mapachess/match/match-setup"
import stockfishOpponent from "@mapachess/match/stockfish-opponent"
import {
  selectStoryLadder,
  storyVictoryMedal,
  type StoryMatchResult as SavedStoryMatchResult,
  type StoryProgress,
} from "@mapachess/profile/story-progress"
import MapachessButton from "../presentation/MapachessButton"
import MedalSymbol from "../presentation/MedalSymbol"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"
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
  const copy = useMapachessCopy()
  const animalCopy = copy.animals
  const messages = copy.interface.storyMatchResult

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
    <section aria-label={messages.storyResult} className="grid gap-3">
      <div>
        {medal !== null && next === undefined ? (
          <h3 className="font-display text-xl font-black">
            {messages.storyComplete}
          </h3>
        ) : null}
        <p className="text-base">
          {medal === null ? (
            copy.gameplay.noNewMedal
          ) : (
            <MedalWithHintUse medal={medal} />
          )}
        </p>
      </div>
      {medal === null ? (
        <p className="text-sm">{messages.yourStoryProgressIsUnchanged}</p>
      ) : best !== undefined && best !== medal ? (
        <p className="text-sm">
          <MedalSymbol medal={best} />
          {copy.gameplay.bestMedal(copy.shared.story.medals[best])}
        </p>
      ) : null}
      {medal !== null ? (
        <p className="text-sm">
          {copy.gameplay.challengeUnlocked(animalCopy.opponent(opponent.id))}
          {next === undefined
            ? ` ${copy.gameplay.storyDefeated(ladder.length)}`
            : ""}
        </p>
      ) : null}
      {medal !== null && next !== undefined ? (
        <MapachessButton
          disabled={disabled}
          aria-busy={opening}
          busyLabel={messages.openingSetup}
          onClick={() => setup(next.opponent.id)}
        >
          {messages.nextOpponent}
          <span className="mt-1 block text-base font-normal">
            {copy.gameplay.opponentAndElo(
              animalCopy.opponent(next.opponent.id),
              next.opponent.storyTargetElo,
            )}
          </span>
        </MapachessButton>
      ) : null}
      {medal !== null && next === undefined ? (
        <MapachessButton
          disabled={disabled}
          aria-busy={opening}
          busyLabel={messages.openingSetup}
          onClick={() => onSetupRequested({ mode: "story", variant })}
        >
          {messages.storyLadder}
        </MapachessButton>
      ) : null}
      <MapachessButton
        variant="secondary"
        disabled={disabled}
        aria-busy={opening}
        busyLabel={messages.openingSetup}
        onClick={() => setup()}
      >
        {messages.replayOpponent}
        <span className="mt-1 block text-base font-normal">
          {copy.gameplay.opponentAndElo(
            animalCopy.opponent(opponent.id),
            opponent.storyTargetElo,
          )}
        </span>
      </MapachessButton>
      <p className="text-xs">{messages.chooseYourSettingsBeforePlayingAgain}</p>
    </section>
  )
}
