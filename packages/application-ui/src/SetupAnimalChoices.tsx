import cx from "classix"
import { useId } from "react"
import type { MapachessCatalog } from "@mapachess/localization/catalog"
import type { MatchVariant } from "@mapachess/match/match-variant"
import stockfishOpponent, {
  STOCKFISH_OPPONENTS,
  type StockfishOpponentDefinition,
  type StockfishOpponentId,
} from "@mapachess/match/stockfish-opponent"
import {
  DEFAULT_PLAYER_APPEARANCE,
  eligiblePlayerAnimals,
} from "@mapachess/profile/player-appearance"
import {
  canPlayStoryOpponent,
  selectChallengeUnlockedOpponents,
  selectStoryCompletion,
  selectStoryLadder,
  type StoryProgress,
} from "@mapachess/profile/story-progress"
import type { SetupElements } from "./setupElements.js"

type Common = Readonly<{
  copy: MapachessCatalog
  elements: SetupElements
  active?: boolean
}>
const PLAYER_ANIMALS = Object.freeze([
  stockfishOpponent(DEFAULT_PLAYER_APPEARANCE.animal),
  ...STOCKFISH_OPPONENTS.filter(
    ({ id }) => id !== DEFAULT_PLAYER_APPEARANCE.animal,
  ),
])

export default function SetupAnimalChoices({
  copy,
  elements,
  active = true,
  presentation = "embedded",
  disabled,
  onSelected,
  selectedId,
  storyProgress,
}: Common &
  Readonly<{
    presentation?: "embedded" | "dialog"
    disabled: boolean
    onSelected: (id: StockfishOpponentId) => void
    selectedId: StockfishOpponentId
    storyProgress: StoryProgress
  }>) {
  const { Group, Text, Choice, Animal } = elements
  const name = useId()
  const messages = copy.interface.playerAnimalChoices
  const unlocked = eligiblePlayerAnimals(storyProgress)
  return (
    <Group
      kind="fieldset"
      disabled={disabled}
      className="text-mapachito-white min-w-0"
    >
      <Text
        kind="legend"
        className={
          presentation === "dialog"
            ? "sr-only"
            : "font-display text-xl font-bold"
        }
      >
        {messages.playAs}
      </Text>
      <Text className="text-mapachito-white mt-1 text-base">
        {messages.beatAnimalsInStoryToUnlockThem}
      </Text>
      <Group
        label={messages.playerAnimals}
        scroll={presentation === "embedded"}
        className={cx(
          "mt-2 flex flex-row flex-wrap gap-3 p-2",
          presentation === "embedded" && "max-h-96 overflow-y-auto",
        )}
      >
        {PLAYER_ANIMALS.map((opponent) => {
          const selected = selectedId === opponent.id
          const locked = !selected && !unlocked.includes(opponent.id)
          return (
            <Choice
              key={opponent.id}
              name={name}
              value={opponent.id}
              selected={selected}
              label={copy.animals.names[opponent.id]}
              disabled={disabled || locked}
              onSelected={() => onSelected(opponent.id)}
              concealed
              className={cx(
                "relative flex min-w-0 shrink grow basis-52 flex-col items-center gap-2 rounded-xl p-2 text-center",
                selected
                  ? "bg-mapachito-violet"
                  : locked
                    ? "bg-white/10"
                    : "bg-mapachito-blue",
              )}
            >
              {({ attended }) => (
                <>
                  <Animal
                    opponent={opponent}
                    active={active && !disabled && (selected || attended)}
                    attention={attended}
                    locked={locked}
                  />
                  <Text className="text-mapachito-white text-xl leading-snug font-bold">
                    {copy.animals.names[opponent.id]}
                    {locked ? (
                      <Text className="text-mapachito-white text-base font-normal">
                        {messages.locked}
                      </Text>
                    ) : null}
                  </Text>
                  {selected ? (
                    <Text className="text-mapachito-white absolute top-1 right-1 text-lg font-bold">
                      ✓<Text className="sr-only">{messages.selected}</Text>
                    </Text>
                  ) : null}
                </>
              )}
            </Choice>
          )
        })}
      </Group>
    </Group>
  )
}

export function SetupOpponentChoices({
  copy,
  elements,
  active = true,
  disabled,
  onSelected,
  unlockedOpponents,
  selectedId,
}: Common &
  Readonly<{
    disabled: boolean
    onSelected: (id: StockfishOpponentId) => void
    unlockedOpponents: readonly StockfishOpponentDefinition[]
    selectedId: StockfishOpponentId
  }>) {
  const { Group, Text, Choice, Animal } = elements
  const name = useId()
  const unlockedIds = new Set(unlockedOpponents.map(({ id }) => id))
  return (
    <Group kind="fieldset" disabled={disabled} className="min-w-0">
      <Text kind="legend" className="sr-only">
        {copy.setup.chooseAnimal}
      </Text>
      {unlockedIds.size < STOCKFISH_OPPONENTS.length ? (
        <Text className="text-mapachito-charcoal mb-3 text-base">
          {copy.setup.challengeAvailability}
        </Text>
      ) : null}
      <Group kind="list" className="flex flex-row flex-wrap gap-2">
        {STOCKFISH_OPPONENTS.map((opponent) => {
          const unlocked = unlockedIds.has(opponent.id)
          return (
            <Group
              kind="item"
              key={opponent.id}
              className="min-w-0 shrink grow basis-52"
            >
              <Choice
                name={name}
                value={opponent.id}
                selected={selectedId === opponent.id}
                disabled={disabled || !unlocked}
                onSelected={
                  unlocked ? () => onSelected(opponent.id) : undefined
                }
                label={copy.animals.opponent(opponent.id)}
                concealed
                className="border-mapachito-charcoal/30 relative flex h-full min-w-0 flex-col items-center gap-1 rounded-lg border-2 px-1.5 py-2 text-center"
              >
                {({ attended }) => (
                  <>
                    <Animal
                      opponent={opponent}
                      active={active && !disabled && unlocked}
                      attention={attended}
                      locked={!unlocked}
                      silhouette={!unlocked}
                      framed={false}
                    />
                    <Text className="text-mapachito-charcoal text-sm leading-tight font-bold">
                      {copy.animals.names[opponent.id]}
                      {unlocked ? null : (
                        <Text className="sr-only">
                          {" "}
                          · {copy.shared.story.locked}
                        </Text>
                      )}
                    </Text>
                    {!unlocked || selectedId === opponent.id ? (
                      <Text
                        decorative
                        className="text-mapachito-charcoal absolute top-1 right-1.5 text-xs font-black"
                      >
                        {unlocked ? "✓" : "🔒"}
                      </Text>
                    ) : null}
                  </>
                )}
              </Choice>
            </Group>
          )
        })}
      </Group>
    </Group>
  )
}

export type SetupStorySelection = Readonly<{
  disabled: boolean
  opponentId: StockfishOpponentId
  onSelected: (id: StockfishOpponentId) => void
}>
export function SetupStoryChoices({
  copy,
  elements,
  active = true,
  progress,
  variant,
  selection,
}: Common &
  Readonly<{
    progress: StoryProgress
    variant: MatchVariant
    selection?: SetupStorySelection | undefined
  }>) {
  const { Group, Text, Choice, Animal, Medal } = elements
  const name = useId()
  const ladder = selectStoryLadder(progress, variant)
  const completion = selectStoryCompletion(progress)
  const next = ladder.find(({ status }) => status === "unlocked")
  return (
    <Group
      kind="section"
      label={copy.shared.story.title}
      className={
        selection === undefined
          ? "border-mapachito-charcoal bg-mapachito-white text-mapachito-charcoal mb-6 rounded-xl border-3 p-5"
          : "text-mapachito-charcoal"
      }
    >
      <Group className="flex flex-row flex-wrap items-start justify-between gap-4">
        <Group className="min-w-0">
          <Text
            kind="heading"
            className="font-display text-mapachito-violet text-2xl font-black"
          >
            {copy.shared.story.title}
          </Text>
          <Text
            className={
              selection === undefined
                ? "text-mapachito-charcoal mt-2 text-sm leading-relaxed"
                : "sr-only"
            }
          >
            {copy.shared.story.independence}
          </Text>
        </Group>
        <Text className="border-mapachito-violet text-mapachito-charcoal rounded-lg border-2 px-4 py-2 font-bold">
          {copy.gameplay.defeatedCount(progress[variant].length, ladder.length)}
        </Text>
      </Group>
      <Group
        className={
          selection === undefined
            ? "mt-4 flex flex-row flex-wrap gap-x-8 gap-y-3"
            : "sr-only"
        }
      >
        {(["standard", "chess960", "overall"] as const).map((scope) => (
          <Group key={scope} className="min-w-0">
            <Text className="text-mapachito-charcoal text-sm">
              {copy.shared.story[scope]}
            </Text>
            <Text className="font-display text-mapachito-charcoal mt-1 text-2xl font-black">
              {copy.gameplay.storyCompletion(completion[scope])}
            </Text>
          </Group>
        ))}
      </Group>
      <Text className="text-mapachito-charcoal mt-5 font-bold">
        {next === undefined
          ? copy.shared.story.allDefeated
          : copy.gameplay.nextUnlocked(copy.animals.opponent(next.opponent.id))}
      </Text>
      <Group
        kind="ordered-list"
        label={copy.shared.story.opponents}
        scroll={selection === undefined}
        className={
          selection === undefined
            ? "border-mapachito-charcoal/30 mt-5 flex max-h-80 flex-col gap-2 overflow-y-auto rounded-lg border-2 p-3"
            : "mt-4 flex flex-row flex-wrap gap-3"
        }
      >
        {ladder.map(({ opponent, highestMedal, status }) => {
          const playable = canPlayStoryOpponent(progress, variant, opponent.id)
          return (
            <Group
              kind="item"
              key={opponent.id}
              className={
                selection === undefined
                  ? "min-w-0"
                  : "min-w-0 shrink grow basis-48"
              }
            >
              <Choice
                name={name}
                value={opponent.id}
                selected={selection?.opponentId === opponent.id}
                label={
                  status === "locked"
                    ? copy.gameplay.lockedOpponent(opponent.storyPosition)
                    : copy.animals.opponent(opponent.id)
                }
                disabled={selection?.disabled === true || !playable}
                onSelected={
                  selection !== undefined && playable
                    ? () => selection.onSelected(opponent.id)
                    : undefined
                }
                className="border-mapachito-charcoal/30 flex min-h-24 flex-row flex-wrap items-center justify-between gap-x-5 gap-y-2 rounded-lg border-2 p-3"
              >
                {({ attended }) => (
                  <>
                    <Group className="flex min-w-0 flex-row flex-wrap items-center gap-3">
                      <Animal
                        opponent={opponent}
                        active={
                          active &&
                          selection !== undefined &&
                          status !== "locked"
                        }
                        attention={attended}
                        locked={status === "locked"}
                        silhouette={status === "locked"}
                      />
                      <Group className="min-w-0">
                        <Text className="font-display text-mapachito-charcoal font-black">
                          {status === "locked"
                            ? copy.gameplay.lockedOpponent(
                                opponent.storyPosition,
                              )
                            : copy.animals.opponent(opponent.id)}
                        </Text>
                        <Text className="text-mapachito-charcoal mt-1 text-base">
                          {copy.gameplay.targetElo(opponent.storyTargetElo)}
                        </Text>
                      </Group>
                    </Group>
                    <Group
                      className={
                        status === "locked"
                          ? "border-mapachito-charcoal rounded border-2 border-dashed px-3 py-1"
                          : "border-mapachito-violet rounded border-2 px-3 py-1"
                      }
                    >
                      {highestMedal === null ? null : (
                        <Medal medal={highestMedal} />
                      )}
                      <Text className="text-mapachito-violet text-sm font-bold">
                        {highestMedal === null
                          ? copy.shared.story[status]
                          : copy.gameplay.defeatedMedal(
                              copy.shared.story.medals[highestMedal],
                            )}
                      </Text>
                    </Group>
                  </>
                )}
              </Choice>
            </Group>
          )
        })}
      </Group>
      <Text className="text-mapachito-charcoal mt-3 text-sm">
        {copy.shared.story.replay}
      </Text>
      <Text
        className={
          selection === undefined
            ? "text-mapachito-charcoal mt-2 text-sm leading-relaxed"
            : "sr-only"
        }
      >
        {copy.gameplay.challengeList(
          selectChallengeUnlockedOpponents(progress).map(({ id }) =>
            copy.animals.opponent(id),
          ),
        )}
      </Text>
    </Group>
  )
}
