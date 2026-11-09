import { useState } from "react"
import { TextInput, View } from "react-native"
import { challengeDifficultyTargets } from "@mapachess/gameplay/opponent-policy"
import { AUTO_HINT_MODES } from "@mapachess/match/auto-hint-mode"
import {
  CHESS960_POSITION_COUNT,
  parseChess960PositionId,
} from "@mapachess/match/chess960-position"
import type {
  MatchNavigationCommands,
  MatchNavigationOverlay,
} from "@mapachess/match/match-navigation"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import type { MatchSetup } from "@mapachess/match/match-setup"
import stockfishOpponent, {
  STOCKFISH_OPPONENTS,
} from "@mapachess/match/stockfish-opponent"
import {
  TIME_CONTROL_PRESETS,
  timeControlLabel,
  timeControlsEqual,
  UNTIMED,
} from "@mapachess/match/time-control"
import { eligiblePlayerAnimals } from "@mapachess/profile/player-appearance"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import type { ProfileActor } from "@mapachess/profile/profile-runtime"
import {
  canPlayStoryOpponent,
  selectChallengeUnlockedOpponents,
  selectDefaultStoryOpponent,
} from "@mapachess/profile/story-progress"
import { generateNativeChess960Position } from "@/lib/gameplay/nativeCryptography"
import useNativePresentationActivity from "@/lib/presentation/useNativePresentationActivity"
import NativeAnimal from "../presentation/NativeAnimal"
import NativeButton from "../presentation/NativeButton"
import NativeChoicePanel, {
  type NativeChoicePreviewState,
} from "../presentation/NativeChoicePanel"
import { NativeScrollActions } from "../presentation/NativePanel"
import NativeText from "../presentation/NativeText"
import { useNativeLocale } from "../profile/NativeLocaleProvider"
import NativeChessboard from "./NativeChessboard"

export default function NativeMatchSetup({
  initial,
  data,
  profileActor,
  disabled,
  navigation,
  overlay,
  onStart,
}: Readonly<{
  initial: MatchSetup
  data: MapachessPlayerData
  profileActor: ProfileActor
  disabled: boolean
  navigation: MatchNavigationCommands
  overlay: MatchNavigationOverlay | undefined
  onStart: (setup: MatchSetup) => void
}>) {
  const { copy } = useNativeLocale()
  const motion = useNativePresentationActivity()
  const [draft, setDraft] = useState(initial)
  const [positionNumber, setPositionNumber] = useState(() =>
    String(
      initial.mode === "challenge" &&
        initial.challengeSetup.variant === "chess960"
        ? (initial.challengeSetup.chess960PositionId ??
            initial.displayedChess960PositionId ??
            generateNativeChess960Position())
        : "",
    ),
  )
  const variant =
    draft.mode === "story" ? draft.variant : draft.challengeSetup.variant
  const opponentId =
    draft.mode === "story"
      ? (draft.opponentId ??
        selectDefaultStoryOpponent(data.storyProgress, variant))
      : draft.challengeSetup.opponentId
  const opponent = stockfishOpponent(opponentId)
  const timeControl = draft.timeControl ?? UNTIMED
  const timePreset = TIME_CONTROL_PRESETS.find(({ control }) =>
    timeControlsEqual(control, timeControl),
  )
  const eligibleAnimals = eligiblePlayerAnimals(data.storyProgress)
  const challengeAnimals = selectChallengeUnlockedOpponents(data.storyProgress)
  const available =
    draft.mode === "story"
      ? canPlayStoryOpponent(data.storyProgress, variant, opponentId)
      : challengeAnimals.some(({ id }) => id === opponentId) &&
        challengeDifficultyTargets(variant).includes(
          draft.challengeSetup.difficultyTargetElo,
        )
  const position = parseChess960PositionId(
    positionNumber.trim() === "" ? NaN : Number(positionNumber),
  )
  const valid =
    available &&
    (draft.mode === "story" || variant === "standard" || position.ok)
  const animalPreview =
    (animal: typeof opponentId, enabled: boolean) =>
    ({ selected, attended }: NativeChoicePreviewState) => (
      <NativeAnimal
        animal={animal}
        motion={
          enabled && (selected || attended)
            ? { ...motion, attention: attended }
            : undefined
        }
      />
    )
  const choice = (
    label: string,
    value: string,
    onPress: () => void,
    animal?: typeof opponentId,
  ) => (
    <View className="bg-mapachito-surface flex-row items-center gap-3 rounded-xl p-3">
      {animal === undefined ? null : (
        <View className="size-16 shrink-0">
          <NativeAnimal
            animal={animal}
            motion={{
              ...motion,
              active: motion.active && overlay === undefined && !disabled,
            }}
          />
        </View>
      )}
      <View className="min-w-0 flex-1">
        <NativeText className="text-sm">{label}</NativeText>
        <NativeText className="font-native text-lg">{value}</NativeText>
      </View>
      <NativeButton
        variant="secondary"
        disabled={disabled}
        accessibilityLabel={`${label}: ${value}. ${copy.setup.change}`}
        onPress={onPress}
      >
        {copy.setup.change}
      </NativeButton>
    </View>
  )
  return (
    <View className="flex-1">
      <NativeScrollActions
        actions={
          <View className="flex-row gap-2">
            <NativeButton
              className="flex-1"
              variant="secondary"
              disabled={disabled}
              onPress={navigation.back}
            >
              {copy.setup.allModes}
            </NativeButton>
            <NativeButton
              className="flex-1"
              disabled={disabled || !valid}
              onPress={() => {
                if (
                  draft.mode === "challenge" &&
                  variant === "chess960" &&
                  position.ok
                )
                  onStart({
                    ...draft,
                    displayedChess960PositionId: position.positionId,
                  })
                else
                  onStart(
                    draft.mode === "story" ? { ...draft, opponentId } : draft,
                  )
              }}
            >
              {copy.setup.startMatch}
            </NativeButton>
          </View>
        }
      >
        <NativeText accessibilityRole="header" className="font-native text-3xl">
          {copy.setup.presentations[variant][draft.mode].title}
        </NativeText>
        <NativeText>
          {copy.setup.presentations[variant][draft.mode].description}
        </NativeText>
        {draft.mode === "story"
          ? choice(
              copy.interface.playerAnimalChoices.playAs,
              copy.animals.names[data.appearance.animal],
              () => navigation.open("setup-player"),
              data.appearance.animal,
            )
          : null}
        {choice(
          copy.setup.opponent,
          copy.gameplay.opponentAndElo(
            copy.animals.opponent(opponentId),
            draft.mode === "story"
              ? opponent.storyTargetElo
              : draft.challengeSetup.difficultyTargetElo,
          ),
          () => navigation.open("setup-opponent"),
          opponentId,
        )}
        {draft.mode === "challenge" ? (
          <>
            {choice(
              copy.setup.difficultyLabel,
              copy.setup.elo(
                copy.gameplay.elo(draft.challengeSetup.difficultyTargetElo),
              ),
              () => navigation.open("setup-difficulty"),
            )}
            <NativeText>{copy.setup.color}</NativeText>
            <View className="flex-row flex-wrap gap-2">
              {(["white", "black", "random"] as const).map((color) => (
                <NativeButton
                  key={color}
                  className="flex-1"
                  disabled={disabled}
                  variant={
                    draft.challengeSetup.playerColor === color
                      ? "primary"
                      : "secondary"
                  }
                  accessibilityState={{
                    selected: draft.challengeSetup.playerColor === color,
                  }}
                  onPress={() =>
                    setDraft({
                      ...draft,
                      challengeSetup: {
                        ...draft.challengeSetup,
                        playerColor: color,
                      },
                    })
                  }
                >
                  {copy.setup[color]}
                </NativeButton>
              ))}
            </View>
            {variant === "chess960" ? (
              <>
                <NativeText>
                  {copy.setup.positionNumber(CHESS960_POSITION_COUNT - 1)}
                </NativeText>
                <TextInput
                  className="border-mapachito-blue bg-mapachito-surface font-native text-mapachito-white min-h-12 rounded-lg border-2 px-4 text-xl"
                  accessibilityLabel={copy.setup.position}
                  keyboardType="number-pad"
                  value={positionNumber}
                  onChangeText={(value) => {
                    setPositionNumber(value)
                    const parsed = parseChess960PositionId(
                      value.trim() === "" ? NaN : Number(value),
                    )
                    if (
                      parsed.ok &&
                      draft.challengeSetup.variant === "chess960"
                    )
                      setDraft({
                        ...draft,
                        challengeSetup: {
                          ...draft.challengeSetup,
                          chess960PositionId: parsed.positionId,
                        },
                      })
                  }}
                />
                <NativeButton
                  variant="secondary"
                  disabled={disabled}
                  onPress={() => {
                    setPositionNumber(String(generateNativeChess960Position()))
                    if (draft.challengeSetup.variant === "chess960")
                      setDraft({
                        ...draft,
                        challengeSetup: {
                          ...draft.challengeSetup,
                          chess960PositionId: null,
                        },
                      })
                  }}
                >
                  {copy.setup.randomize}
                </NativeButton>
                <NativeText>
                  {draft.challengeSetup.chess960PositionId === null
                    ? copy.setup.freshPosition
                    : copy.setup.pinnedPosition}
                </NativeText>
                {position.ok ? (
                  <View
                    className="w-full max-w-80 self-center"
                    accessible
                    accessibilityRole="image"
                    accessibilityLabel={copy.setup.position}
                  >
                    <NativeChessboard
                      position={createInitialMatchPosition({
                        variant: "chess960",
                        chess960PositionId: position.positionId,
                      })}
                      orientation={
                        draft.challengeSetup.playerColor === "black"
                          ? "black"
                          : "white"
                      }
                      legalMoves={[]}
                      disabled
                      appearance={data.settings.chessAppearance}
                      hints={null}
                      showMoveHints={false}
                      lastMove={null}
                      onMove={() => undefined}
                    />
                  </View>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}
        {choice(
          copy.gameplay.clock.timeControl,
          timeControlLabel(timeControl, copy.gameplay.clock),
          () => navigation.open("setup-time-control"),
        )}
        <NativeText>
          {timeControl.type === "untimed"
            ? copy.gameplay.clock.untimedExplanation
            : copy.gameplay.clock.explanation(
                timeControl.baseSeconds / 60,
                timeControl.incrementSeconds,
              )}
        </NativeText>
        {choice(
          copy.setup.betterHints,
          copy.setup.autoHints[data.settings.autoHintMode].label,
          () => navigation.open("setup-hints"),
        )}
        <NativeText>{copy.setup.hintMedalExplanation}</NativeText>
        {!valid ? (
          <NativeText accessibilityRole="alert">
            {copy.setup.invalidSetup}
          </NativeText>
        ) : null}
      </NativeScrollActions>
      {overlay === "setup-player" ? (
        <NativeChoicePanel
          title={copy.setup.chooseAnimal}
          value={data.appearance.animal}
          onCancel={navigation.back}
          choices={STOCKFISH_OPPONENTS.map(({ id }) => {
            const enabled = eligibleAnimals.includes(id)
            return {
              value: id,
              label: copy.animals.names[id],
              disabled: !enabled,
              description: enabled
                ? undefined
                : copy.setup.challengeAvailability,
              preview: animalPreview(id, enabled),
            }
          })}
          onAccept={(animal) => {
            navigation.back()
            profileActor.send({
              type: "PROFILE.APPEARANCE_SAVE_REQUESTED",
              appearance: { ...data.appearance, animal },
            })
          }}
        />
      ) : null}
      {overlay === "setup-opponent" ? (
        <NativeChoicePanel
          title={copy.setup.chooseOpponent}
          value={opponentId}
          onCancel={navigation.back}
          choices={STOCKFISH_OPPONENTS.map(({ id, storyTargetElo }) => {
            const enabled =
              draft.mode === "story"
                ? canPlayStoryOpponent(data.storyProgress, variant, id)
                : challengeAnimals.some((animal) => animal.id === id)
            return {
              value: id,
              label: copy.animals.opponent(id),
              disabled: !enabled,
              description:
                draft.mode === "story"
                  ? copy.gameplay.targetElo(storyTargetElo)
                  : undefined,
              preview: animalPreview(id, enabled),
            }
          })}
          onAccept={(animal) => {
            setDraft(
              draft.mode === "story"
                ? { ...draft, opponentId: animal }
                : {
                    ...draft,
                    challengeSetup: {
                      ...draft.challengeSetup,
                      opponentId: animal,
                    },
                  },
            )
            navigation.back()
          }}
        />
      ) : null}
      {overlay === "setup-difficulty" && draft.mode === "challenge" ? (
        <NativeChoicePanel
          title={copy.setup.chooseDifficulty}
          value={draft.challengeSetup.difficultyTargetElo}
          onCancel={navigation.back}
          choices={challengeDifficultyTargets(variant).map((target) => ({
            value: target,
            label: copy.setup.elo(copy.gameplay.elo(target)),
          }))}
          onAccept={(difficultyTargetElo) => {
            setDraft({
              ...draft,
              challengeSetup: { ...draft.challengeSetup, difficultyTargetElo },
            })
            navigation.back()
          }}
        />
      ) : null}
      {overlay === "setup-hints" ? (
        <NativeChoicePanel
          title={copy.setup.betterHints}
          value={data.settings.autoHintMode}
          onCancel={navigation.back}
          choices={AUTO_HINT_MODES.map((value) => ({
            value,
            label: copy.setup.autoHints[value].label,
            description: copy.setup.autoHints[value].description,
          }))}
          onAccept={(autoHintMode) => {
            navigation.back()
            profileActor.send({
              type: "PROFILE.AUTO_HINT_MODE_CHANGED",
              autoHintMode,
            })
          }}
        />
      ) : null}
      {overlay === "setup-time-control" ? (
        <NativeChoicePanel
          title={copy.gameplay.clock.timeControl}
          value={timePreset?.id ?? "untimed"}
          onCancel={navigation.back}
          choices={TIME_CONTROL_PRESETS.map(({ id, control }) => ({
            value: id,
            label: timeControlLabel(control, copy.gameplay.clock),
            description:
              control.type === "untimed"
                ? copy.gameplay.clock.untimedExplanation
                : copy.gameplay.clock.explanation(
                    control.baseSeconds / 60,
                    control.incrementSeconds,
                  ),
          }))}
          onAccept={(id) => {
            const selected = TIME_CONTROL_PRESETS.find(
              (preset) => preset.id === id,
            )
            if (selected !== undefined)
              setDraft({ ...draft, timeControl: selected.control })
            navigation.back()
          }}
        />
      ) : null}
    </View>
  )
}
