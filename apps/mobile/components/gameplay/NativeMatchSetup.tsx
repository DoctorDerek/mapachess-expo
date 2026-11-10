import cx from "classix"
import { useCallback, useRef, useState } from "react"
import { TextInput, View } from "react-native"
import challengeDifficultyGrid, {
  createChallengeDifficultyDraft,
  editChallengeDifficulty,
  projectChallengeDifficulty,
  type ChallengeDifficultyDraft,
  type ChallengeDifficultyEdit,
} from "@mapachess/gameplay/challenge-difficulty"
import { AUTO_HINT_MODES } from "@mapachess/match/auto-hint-mode"
import type { ChallengePositionSetup } from "@mapachess/match/challenge-setup"
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
  type StockfishOpponentId,
} from "@mapachess/match/stockfish-opponent"
import {
  TIME_CONTROL_PRESETS,
  timeControlLabel,
  timeControlsEqual,
  UNTIMED,
  type TimeControl,
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
import NativeChallengeDifficulty from "./NativeChallengeDifficulty"
import NativeChessboard from "./NativeChessboard"

type SetupDraft =
  | Extract<MatchSetup, { mode: "story" }>
  | Readonly<{
      mode: "challenge"
      challengeSetup: ChallengePositionSetup &
        Readonly<{ opponentId: StockfishOpponentId }>
      timeControl: TimeControl
      difficulty: ChallengeDifficultyDraft
    }>

function createSetupDraft(initial: MatchSetup): SetupDraft {
  if (initial.mode === "story") return initial
  const { difficultyTargetElo, ...challengeSetup } = initial.challengeSetup
  return {
    mode: "challenge",
    challengeSetup,
    timeControl: initial.timeControl ?? UNTIMED,
    difficulty: createChallengeDifficultyDraft(
      challengeDifficultyGrid(challengeSetup.variant),
      difficultyTargetElo,
    ),
  }
}

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
  const [draft, setDraft] = useState(() => createSetupDraft(initial))
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
  const chess960Challenge =
    draft.mode === "challenge" && draft.challengeSetup.variant === "chess960"
  const difficultyControl =
    draft.mode === "challenge"
      ? projectChallengeDifficulty(
          variant,
          draft.difficulty,
          data.challengeHistory,
        )
      : null
  const difficultyStart = difficultyControl?.start
  const difficultyInput = useRef<TextInput>(null)
  const changeDifficulty = useCallback((edit: ChallengeDifficultyEdit) => {
    setDraft((current) =>
      current.mode === "story"
        ? current
        : {
            ...current,
            difficulty: editChallengeDifficulty(
              challengeDifficultyGrid(current.challengeSetup.variant),
              current.difficulty,
              edit,
            ),
          },
    )
  }, [])
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
        difficultyStart !== undefined &&
        difficultyStart.type !== "unavailable"
  const position = parseChess960PositionId(
    positionNumber.trim() === "" ? NaN : Number(positionNumber),
  )
  const valid =
    available &&
    (draft.mode === "story" || variant === "standard" || position.ok)
  const startMatch = (): void => {
    if (disabled || !valid) return
    if (draft.mode === "story") {
      onStart({ ...draft, opponentId })
      return
    }
    if (difficultyStart?.type !== "ready") {
      difficultyInput.current?.focus()
      changeDifficulty({ type: "committed" })
      return
    }
    onStart({
      mode: "challenge",
      timeControl,
      challengeSetup: {
        ...draft.challengeSetup,
        difficultyTargetElo: difficultyStart.targetElo,
      },
      ...(variant === "chess960" && position.ok
        ? { displayedChess960PositionId: position.positionId }
        : {}),
    })
  }
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
              onPress={startMatch}
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
        <View
          className={cx(
            "min-w-0 gap-4",
            chess960Challenge && "xl:flex-row xl:items-start",
          )}
        >
          <View
            className={cx("min-w-0 gap-4", chess960Challenge && "xl:flex-1")}
          >
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
              draft.mode === "story"
                ? copy.gameplay.opponentAndElo(
                    copy.animals.opponent(opponentId),
                    opponent.storyTargetElo,
                  )
                : copy.animals.opponent(opponentId),
              () => navigation.open("setup-opponent"),
              opponentId,
            )}
            {draft.mode === "challenge" && difficultyControl !== null ? (
              <>
                <NativeChallengeDifficulty
                  control={difficultyControl}
                  disabled={disabled}
                  exactInput={difficultyInput}
                  onEdit={changeDifficulty}
                />
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
                        setDraft((current) =>
                          current.mode === "story"
                            ? current
                            : {
                                ...current,
                                challengeSetup: {
                                  ...current.challengeSetup,
                                  playerColor: color,
                                },
                              },
                        )
                      }
                    >
                      {copy.setup[color]}
                    </NativeButton>
                  ))}
                </View>
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
          </View>
          {chess960Challenge ? (
            <View className="border-mapachito-white/30 min-w-0 gap-2 border-t pt-3 xl:w-80 xl:shrink-0 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-4">
              <NativeText className="font-bold">
                {copy.setup.position}
              </NativeText>
              <View className="flex-row flex-wrap items-end gap-2">
                <TextInput
                  className="border-mapachito-blue bg-mapachito-surface font-native text-mapachito-white min-h-12 min-w-0 flex-1 basis-24 rounded-lg border-2 px-4 text-xl"
                  accessibilityLabel={copy.setup.positionNumber(
                    CHESS960_POSITION_COUNT - 1,
                  )}
                  keyboardType="number-pad"
                  value={positionNumber}
                  onChangeText={(value) => {
                    setPositionNumber(value)
                    const parsed = parseChess960PositionId(
                      value.trim() === "" ? NaN : Number(value),
                    )
                    if (parsed.ok)
                      setDraft((current) =>
                        current.mode === "challenge" &&
                        current.challengeSetup.variant === "chess960"
                          ? {
                              ...current,
                              challengeSetup: {
                                ...current.challengeSetup,
                                chess960PositionId: parsed.positionId,
                              },
                            }
                          : current,
                      )
                  }}
                />
                <NativeButton
                  variant="secondary"
                  disabled={disabled}
                  onPress={() => {
                    setPositionNumber(String(generateNativeChess960Position()))
                    setDraft((current) =>
                      current.mode === "challenge" &&
                      current.challengeSetup.variant === "chess960"
                        ? {
                            ...current,
                            challengeSetup: {
                              ...current.challengeSetup,
                              chess960PositionId: null,
                            },
                          }
                        : current,
                    )
                  }}
                >
                  {copy.setup.randomize}
                </NativeButton>
              </View>
              {position.ok ? (
                <View
                  className="w-full max-w-80 self-center"
                  accessible
                  accessibilityRole="image"
                  accessibilityLabel={copy.setup.positionPreview(
                    position.positionId,
                  )}
                >
                  <View
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    pointerEvents="none"
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
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
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
            setDraft((current) =>
              current.mode === "story"
                ? { ...current, opponentId: animal }
                : {
                    ...current,
                    challengeSetup: {
                      ...current.challengeSetup,
                      opponentId: animal,
                    },
                  },
            )
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
              setDraft((current) => ({
                ...current,
                timeControl: selected.control,
              }))
            navigation.back()
          }}
        />
      ) : null}
    </View>
  )
}
