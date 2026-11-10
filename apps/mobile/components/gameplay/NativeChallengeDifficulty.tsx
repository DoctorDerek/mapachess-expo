import cx from "classix"
import { useCallback, useMemo, useRef, type RefObject } from "react"
import { PanResponder, Pressable, TextInput, View } from "react-native"
import {
  challengeEloAtFraction,
  type ChallengeDifficultyControlState,
  type ChallengeDifficultyEdit,
} from "@mapachess/gameplay/challenge-difficulty"
import { useNativeInputControl } from "../input/NativeInputProvider"
import NativeMedal from "../presentation/NativeMedal"
import NativeText from "../presentation/NativeText"
import { useNativeLocale } from "../profile/NativeLocaleProvider"

const ELO_DRAG_THRESHOLD = 6

export default function NativeChallengeDifficulty({
  control,
  disabled,
  exactInput,
  onEdit,
}: Readonly<{
  control: ChallengeDifficultyControlState
  disabled: boolean
  exactInput: RefObject<TextInput | null>
  onEdit: (edit: ChallengeDifficultyEdit) => void
}>) {
  const { copy } = useNativeLocale()
  const setup = copy.setup
  const { grid, rangeValue, exactText, showError, history } = control
  const { minimum, maximum, step } = grid
  const slider = useRef<View>(null)
  const trackWidth = useRef(0)
  const progress =
    `${((rangeValue - minimum) / (maximum - minimum)) * 100}%` as const
  const record = history.type === "played" ? history.record : null
  const error = showError
    ? setup.invalidOpponentElo(minimum, maximum, step)
    : undefined

  const selectAt = useCallback(
    (locationX: number) => {
      if (disabled || trackWidth.current <= 0 || !Number.isFinite(locationX))
        return
      onEdit({
        type: "selected",
        targetElo: challengeEloAtFraction(grid, locationX / trackWidth.current),
      })
    },
    [disabled, grid, onEdit],
  )
  const { panHandlers } = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          !disabled &&
          gesture.numberActiveTouches === 1 &&
          Math.abs(gesture.dx) >= ELO_DRAG_THRESHOLD &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: (event) => selectAt(event.nativeEvent.locationX),
        onPanResponderMove: (event, gesture) => {
          if (gesture.numberActiveTouches === 1)
            selectAt(event.nativeEvent.locationX)
        },
      }),
    [disabled, selectAt],
  )
  const focused = useNativeInputControl(
    slider,
    () => slider.current?.focus(),
    !disabled,
    (action) => {
      if (action !== "left" && action !== "right") return false
      onEdit({ type: "stepped", direction: action === "left" ? -1 : 1 })
      return true
    },
  )

  return (
    <View className="bg-mapachito-surface min-w-0 gap-1 rounded-xl p-3">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <NativeText
          accessibilityElementsHidden
          importantForAccessibility="no"
          className="font-bold"
        >
          {setup.opponentElo}
        </NativeText>
        <TextInput
          ref={exactInput}
          accessibilityLabel={setup.opponentElo}
          accessibilityHint={error}
          autoCorrect={false}
          className={cx(
            "bg-mapachito-charcoal font-native text-mapachito-white min-h-12 w-24 max-w-full rounded-lg border-2 px-2 text-center text-lg",
            error === undefined
              ? "border-mapachito-blue"
              : "border-mapachito-orange",
          )}
          editable={!disabled}
          keyboardType="number-pad"
          onBlur={() => onEdit({ type: "committed" })}
          onChangeText={(text) => onEdit({ type: "typed", text })}
          onSubmitEditing={() => onEdit({ type: "committed" })}
          value={exactText}
        />
      </View>
      <View className="px-3">
        <View
          accessible
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          accessibilityLabel={setup.adjustOpponentElo}
          accessibilityRole="adjustable"
          accessibilityState={{ disabled }}
          accessibilityValue={{ min: minimum, max: maximum, now: rangeValue }}
          className={cx(
            "rounded-lg border-2",
            focused ? "border-mapachito-orange" : "border-transparent",
          )}
          onAccessibilityAction={(event) => {
            const { actionName } = event.nativeEvent
            if (
              !disabled &&
              (actionName === "increment" || actionName === "decrement")
            )
              onEdit({
                type: "stepped",
                direction: actionName === "increment" ? 1 : -1,
              })
          }}
          ref={slider}
        >
          <View {...panHandlers}>
            <Pressable
              accessible={false}
              className="min-h-12 justify-center"
              disabled={disabled}
              importantForAccessibility="no"
              onLayout={(event) => {
                trackWidth.current = event.nativeEvent.layout.width
              }}
              onPress={(event) => selectAt(event.nativeEvent.locationX)}
            >
              <View
                pointerEvents="none"
                className="bg-mapachito-white/30 relative h-2 justify-center rounded-full"
              >
                <View
                  className="bg-mapachito-blue absolute inset-y-0 left-0 rounded-full"
                  style={{ width: progress }}
                />
                <View
                  className="bg-mapachito-blue border-mapachito-white absolute size-5 -translate-x-1/2 rounded-full border-2"
                  style={{ left: progress }}
                />
              </View>
            </Pressable>
          </View>
        </View>
      </View>
      <View aria-hidden className="flex-row justify-between px-3">
        <NativeText className="text-sm">{minimum}</NativeText>
        <NativeText className="text-sm">{maximum}</NativeText>
      </View>
      {error === undefined ? null : (
        <NativeText
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          className="text-sm font-bold"
        >
          {error}
        </NativeText>
      )}
      {record !== null ? (
        <View className="flex-row flex-wrap items-start gap-x-5 gap-y-1 pt-1">
          {record.highestMedal === null ? null : (
            <View className="min-w-0">
              <NativeText className="text-sm">
                {setup.bestDifficultyMedal}
              </NativeText>
              <View className="flex-row items-center gap-1">
                <NativeMedal medal={record.highestMedal} />
                <NativeText className="font-bold">
                  {copy.shared.story.medals[record.highestMedal]}
                </NativeText>
              </View>
            </View>
          )}
          <View className="min-w-0">
            <NativeText className="text-sm">
              {setup.lastDifficultyOpponent}
            </NativeText>
            <NativeText className="font-bold">
              {copy.animals.opponent(record.lastPlayedAnimal)}
            </NativeText>
          </View>
        </View>
      ) : history.type === "unplayed" ? (
        <NativeText className="pt-1 text-sm">
          {setup.noDifficultyHistory}
        </NativeText>
      ) : null}
    </View>
  )
}
