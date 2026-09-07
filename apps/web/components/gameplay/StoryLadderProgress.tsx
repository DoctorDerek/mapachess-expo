import { useId } from "react"
import type { MatchVariant } from "@mapachess/match/match-variant"
import {
  formatStoryCompletion,
  selectChallengeUnlockedOpponents,
  selectStoryCompletion,
  selectStoryLadder,
  STORY_PROGRESS_COPY,
  type StoryProgress,
} from "@mapachess/profile/story-progress"

export type StoryLadderProgressProps = Readonly<{
  progress: StoryProgress
  variant: MatchVariant
}>

export default function StoryLadderProgress({
  progress,
  variant,
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
      <p className="mt-2 text-sm leading-relaxed">
        {STORY_PROGRESS_COPY.availability}
      </p>
      <ol
        aria-label={STORY_PROGRESS_COPY.opponents}
        className="border-mapachito-charcoal/30 focus-visible:outline-mapachito-violet mt-5 grid max-h-80 gap-2 overflow-y-auto rounded-lg border-2 p-3 focus-visible:outline-3 focus-visible:outline-offset-4"
        tabIndex={0}
      >
        {ladder.map(({ opponent, highestMedal, status }) => (
          <li
            className="border-mapachito-charcoal/30 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-b py-3 last:border-b-0"
            key={opponent.id}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden="true"
                className="border-mapachito-charcoal grid size-10 shrink-0 place-items-center rounded-full border-2 font-mono font-bold"
              >
                {opponent.storyPosition}
              </span>
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
              {highestMedal === null
                ? STORY_PROGRESS_COPY[status]
                : `${STORY_PROGRESS_COPY.defeated} · ${STORY_PROGRESS_COPY.medals[highestMedal]}`}
            </p>
          </li>
        ))}
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
