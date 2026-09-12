import { useId } from "react"
import type { ImplementedDurableOpponentId } from "@mapachess/match/durable-match-record"
import type { MatchVariant } from "@mapachess/match/match-variant"
import {
  canPlayStoryOpponent,
  formatStoryCompletion,
  selectChallengeUnlockedOpponents,
  selectStoryCompletion,
  selectStoryLadder,
  STORY_PROGRESS_COPY,
  type StoryProgress,
} from "@mapachess/profile/story-progress"
import MedalSymbol from "../presentation/MedalSymbol"
import StoryOpponentPortrait from "./StoryOpponentPortrait"

export type StoryLadderProgressProps = Readonly<{
  progress: StoryProgress
  variant: MatchVariant
  selection?: Readonly<{
    disabled: boolean
    opponentId: ImplementedDurableOpponentId
    onSelected: (opponentId: ImplementedDurableOpponentId) => void
  }>
}>

export default function StoryLadderProgress({
  progress,
  variant,
  selection,
}: StoryLadderProgressProps) {
  const headingId = useId()
  const ladder = selectStoryLadder(progress, variant)
  const completion = selectStoryCompletion(progress)
  const nextOpponent = ladder.find(({ status }) => status === "unlocked")

  return (
    <section
      aria-labelledby={headingId}
      className="border-mapachito-charcoal bg-mapachito-white text-mapachito-charcoal mb-6 rounded-xl border-3 p-[clamp(1.25rem,3vw,2rem)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            className="font-display text-mapachito-violet text-2xl font-black"
            id={headingId}
          >
            {STORY_PROGRESS_COPY.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed">
            {STORY_PROGRESS_COPY.independence}
          </p>
        </div>
        <p className="border-mapachito-violet rounded-lg border-2 px-4 py-2 font-bold">
          {STORY_PROGRESS_COPY.completedCount}: {progress[variant].length} /{" "}
          {ladder.length}
        </p>
      </div>
      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm">
        {(["standard", "chess960", "overall"] as const).map((scope) => (
          <div key={scope}>
            <dt>{STORY_PROGRESS_COPY[scope]}</dt>
            <dd className="font-display mt-1 text-2xl font-black">
              {formatStoryCompletion(completion[scope])}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 font-bold">
        {nextOpponent === undefined
          ? STORY_PROGRESS_COPY.allDefeated
          : `${STORY_PROGRESS_COPY.nextOpponent}: ${nextOpponent.opponent.displayName}`}
      </p>
      <ol
        aria-label={STORY_PROGRESS_COPY.opponents}
        className="border-mapachito-charcoal/30 focus-visible:outline-mapachito-violet mt-5 grid max-h-80 gap-2 overflow-y-auto rounded-lg border-2 p-3 focus-visible:outline-3 focus-visible:outline-offset-4"
        tabIndex={0}
      >
        {ladder.map(({ opponent, highestMedal, status }) => {
          const playable = canPlayStoryOpponent(progress, variant, opponent.id)
          const Row = selection !== undefined && playable ? "label" : "div"
          return (
            <li key={opponent.id}>
              <Row className="border-mapachito-charcoal/30 has-checked:border-mapachito-violet has-checked:bg-mapachito-violet/10 has-focus-visible:outline-mapachito-violet flex min-h-24 flex-wrap items-center justify-between gap-x-5 gap-y-2 rounded-lg border-2 p-3 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-[input]:cursor-pointer">
                <div className="flex min-w-0 items-center gap-3">
                  {selection !== undefined && playable ? (
                    <input
                      type="radio"
                      name={headingId}
                      checked={selection.opponentId === opponent.id}
                      disabled={selection.disabled}
                      onChange={() => {
                        if (
                          !selection.disabled &&
                          canPlayStoryOpponent(progress, variant, opponent.id)
                        )
                          selection.onSelected(opponent.id)
                      }}
                      value={opponent.id}
                      className="accent-mapachito-violet size-5 shrink-0"
                    />
                  ) : null}
                  <StoryOpponentPortrait
                    opponent={opponent}
                    locked={status === "locked"}
                  />
                  <div>
                    <p className="font-display font-black">
                      {status === "locked"
                        ? `${STORY_PROGRESS_COPY.lockedOpponent} ${String(opponent.storyPosition)}`
                        : opponent.displayName}
                    </p>
                    <p className="mt-1 text-xs">
                      {STORY_PROGRESS_COPY.targetElo}: {opponent.storyTargetElo}
                    </p>
                  </div>
                </div>
                <p
                  className={
                    status === "locked"
                      ? "border-mapachito-charcoal rounded border-2 border-dashed px-3 py-1 text-sm font-bold"
                      : "border-mapachito-violet text-mapachito-violet rounded border-2 px-3 py-1 text-sm font-black"
                  }
                >
                  {highestMedal !== null ? (
                    <MedalSymbol medal={highestMedal} />
                  ) : null}
                  {highestMedal === null
                    ? STORY_PROGRESS_COPY[status]
                    : `${STORY_PROGRESS_COPY.defeated} · ${STORY_PROGRESS_COPY.medals[highestMedal]}`}
                </p>
              </Row>
            </li>
          )
        })}
      </ol>
      <p className="mt-3 text-sm">{STORY_PROGRESS_COPY.replay}</p>
      <p className="mt-2 text-sm leading-relaxed">
        {STORY_PROGRESS_COPY.challengeUnlocked}:{" "}
        {selectChallengeUnlockedOpponents(progress)
          .map(({ displayName }) => displayName)
          .join(", ")}
      </p>
    </section>
  )
}
