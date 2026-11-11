import cx from "classix"
import { useEffect, useRef } from "react"
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  Text,
  type View,
} from "react-native"
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import { withUniwind } from "uniwind"
import {
  MOVE_REACTION_DURATION_MS,
  type MoveReactionCard,
} from "@mapachess/evaluation/move-reaction-machine"
import { useNativeInputControl } from "@/components/input/NativeInputProvider"
import NativeText from "@/components/presentation/NativeText"
import { useNativeLocale } from "@/components/profile/NativeLocaleProvider"

const Countdown = withUniwind(Animated.View)

export default function NativeMoveReactionCard({
  card,
  active,
  reducedMotion,
  onDismiss,
}: Readonly<{
  card: MoveReactionCard
  active: boolean
  reducedMotion: boolean
  onDismiss: (presentationId: string) => void
}>) {
  const { copy } = useNativeLocale()
  const ref = useRef<View>(null)
  const presented = useRef(false)
  const countdownEnabled = useRef(!reducedMotion)
  const remaining = useSharedValue(1)
  const countdownStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: remaining.value }],
  }))
  const dismiss = (): void => onDismiss(card.presentationId)
  const focused = useNativeInputControl(ref, dismiss, active)
  useEffect(() => () => cancelAnimation(remaining), [remaining])
  useEffect(() => {
    if (!reducedMotion) return
    countdownEnabled.current = false
    cancelAnimation(remaining)
  }, [remaining, reducedMotion])
  const { mover, notation, classification } = card.reaction
  const white = mover === "white"
  const label = copy.board.dismissReaction(
    mover,
    notation,
    copy.shared.moveGrades[classification.grade],
  )
  return (
    <Pressable
      ref={ref}
      focusable
      disabled={!active}
      accessibilityRole="button"
      accessibilityState={{ disabled: !active }}
      accessibilityLabel={label}
      onLayout={() => {
        if (!active || presented.current) return
        presented.current = true
        if (countdownEnabled.current && !reducedMotion)
          remaining.value = withTiming(0, {
            duration: MOVE_REACTION_DURATION_MS,
            easing: Easing.linear,
            reduceMotion: ReduceMotion.Never,
          })
        card.actor.send({ type: "MOVE_REACTION.PRESENTED" })
        if (Platform.OS === "ios")
          AccessibilityInfo.announceForAccessibilityWithOptions(label, {
            queue: true,
          })
      }}
      onPress={(event) => {
        event.stopPropagation()
        dismiss()
      }}
      className={cx(
        "relative min-h-12 w-full shrink-0 justify-center rounded border px-2 py-2 shadow-sm",
        white
          ? "border-mapachito-charcoal/40 bg-mapachito-white"
          : "border-mapachito-white/40 bg-mapachito-charcoal",
        focused && "outline-2 -outline-offset-2",
        focused &&
          (white ? "outline-mapachito-charcoal" : "outline-mapachito-white"),
      )}
    >
      <NativeText
        className={cx(
          "text-center leading-tight",
          white ? "text-mapachito-charcoal" : "text-mapachito-white",
        )}
      >
        {notation}{" "}
        <Text className="font-native">
          {copy.shared.moveGrades[classification.grade]}
        </Text>
      </NativeText>
      <Countdown
        accessible={false}
        pointerEvents="none"
        className={cx(
          "bg-move-reaction-countdown absolute inset-x-0 bottom-0 h-0.5 origin-left rounded-full",
          (reducedMotion || !countdownEnabled.current) && "opacity-0",
        )}
        style={countdownStyle}
      />
    </Pressable>
  )
}
