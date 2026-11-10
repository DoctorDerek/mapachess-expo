import type { MatchSetup } from "@mapachess/match/match-setup"
import { storyResultPresentation } from "@mapachess/profile/match-result-presentation"
import type {
  StoryMatchResult as SavedStoryMatchResult,
  StoryProgress,
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

  const result = storyResultPresentation(match, progress)
  if (result === null) return null
  const { best, medal, next, opponentCount, replay, storyComplete } = result
  const variant = match.startingPosition.variant
  const setup = (opponentId = match.opponentId): void =>
    onSetupRequested({ mode: "story", variant, opponentId })

  return (
    <section aria-label={messages.storyResult} className="grid gap-3">
      <div>
        {storyComplete ? (
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
          {copy.gameplay.challengeUnlocked(animalCopy.opponent(replay.id))}
          {storyComplete
            ? ` ${copy.gameplay.storyDefeated(opponentCount)}`
            : ""}
        </p>
      ) : null}
      {medal !== null && next !== null ? (
        <MapachessButton
          disabled={disabled}
          aria-busy={opening}
          busyLabel={messages.openingSetup}
          onClick={() => setup(next.id)}
        >
          {messages.nextOpponent}
          <span className="mt-1 block text-base font-normal">
            {copy.gameplay.opponentAndElo(
              animalCopy.opponent(next.id),
              next.elo,
            )}
          </span>
        </MapachessButton>
      ) : null}
      {storyComplete ? (
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
            animalCopy.opponent(replay.id),
            replay.elo,
          )}
        </span>
      </MapachessButton>
      <p className="text-xs">{messages.chooseYourSettingsBeforePlayingAgain}</p>
    </section>
  )
}
