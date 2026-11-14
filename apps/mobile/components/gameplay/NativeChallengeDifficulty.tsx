import cx from "classix"
import { useCallback, useMemo, useRef, type RefObject } from "react"
import { PanResponder, Pressable, TextInput, View } from "react-native"
import type { SetupInputProps } from "@mapachess/application-ui/setup-elements"
import { challengeEloAtFraction } from "@mapachess/gameplay/challenge-difficulty"
import { useNativeInputControl } from "@/components/input/NativeInputProvider"
import { useNativeLocale } from "@/components/profile/NativeLocaleProvider"

const ELO_SLIDER_DRAG_ACTIVATION_DISTANCE_DP = 6

export function NativeEloInput({
  control,
  disabled,
  onEdit,
  exactInput,
}: SetupInputProps &
  Readonly<{ exactInput: RefObject<TextInput | null> | null }>) {
  const { copy } = useNativeLocale()
  return (
    <TextInput
      ref={exactInput}
      accessibilityLabel={copy.setup.opponentElo}
      accessibilityHint={
        control.showError
          ? copy.setup.invalidOpponentElo(
              control.grid.minimum,
              control.grid.maximum,
              control.grid.step,
            )
          : undefined
      }
      autoCorrect={false}
      className={cx(
        "bg-mapachito-white font-native text-mapachito-charcoal min-h-12 w-24 max-w-full rounded-lg border-2 px-2 text-center text-lg",
        control.showError
          ? "border-mapachito-orange"
          : "border-mapachito-charcoal",
      )}
      editable={!disabled}
      keyboardType="number-pad"
      onBlur={() => onEdit({ type: "committed" })}
      onChangeText={(text) => onEdit({ type: "typed", text })}
      onSubmitEditing={() => onEdit({ type: "committed" })}
      value={control.exactText}
    />
  )
}

export function NativeEloSlider({
  control,
  disabled,
  onEdit,
}: SetupInputProps) {
  const { copy } = useNativeLocale()
  const { grid, rangeValue } = control
  const { minimum, maximum } = grid
  const slider = useRef<View>(null)
  const trackWidth = useRef(0)
  const progress =
    `${((rangeValue - minimum) / (maximum - minimum)) * 100}%` as const
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
          Math.abs(gesture.dx) >= ELO_SLIDER_DRAG_ACTIVATION_DISTANCE_DP &&
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
    <View className="px-3">
      <View
        accessible
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        accessibilityLabel={copy.setup.adjustOpponentElo}
        accessibilityRole="adjustable"
        accessibilityState={{ disabled }}
        accessibilityValue={{ min: minimum, max: maximum, now: rangeValue }}
        className={cx(
          "rounded-lg border-2",
          focused ? "border-mapachito-orange" : "border-transparent",
        )}
        ref={slider}
        onAccessibilityAction={(event) => {
          const name = event.nativeEvent.actionName
          if (!disabled && (name === "increment" || name === "decrement"))
            onEdit({
              type: "stepped",
              direction: name === "increment" ? 1 : -1,
            })
        }}
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
              className="bg-mapachito-charcoal/30 relative h-2 justify-center rounded-full"
            >
              <View
                className="bg-mapachito-violet absolute inset-y-0 left-0 rounded-full"
                style={{ width: progress }}
              />
              <View
                className="bg-mapachito-violet border-mapachito-charcoal absolute size-5 -translate-x-1/2 rounded-full border-2"
                style={{ left: progress }}
              />
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  )
}
export default NativeEloInput
