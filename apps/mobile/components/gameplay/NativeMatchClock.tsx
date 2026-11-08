import cx from "classix"
import { useEffect, useState } from "react"
import { View } from "react-native"
import {
  CLOCK_DISPLAY_INTERVAL_MS,
  LOW_TIME_MS,
} from "@mapachess/match-presentation/clock-display"
import {
  remainingClockTime,
  type MatchClock,
  type MonotonicClock,
} from "@mapachess/match/match-clock"
import { MATCH_COLORS } from "@mapachess/match/match-position"
import NativeButton from "../presentation/NativeButton"
import NativeText from "../presentation/NativeText"
import { useNativeLocale } from "../profile/NativeLocaleProvider"

export default function NativeMatchClock({
  clock,
  monotonicClock,
  canResume,
  onResume,
}: Readonly<{
  clock: MatchClock
  monotonicClock: MonotonicClock
  canResume: boolean
  onResume: () => void
}>) {
  const { copy } = useNativeLocale()
  const [, repaint] = useState(0)
  const running = clock.startedAt !== null && !clock.paused
  useEffect(() => {
    if (!running) return
    const interval = setInterval(
      () => repaint((current) => current + 1),
      CLOCK_DISPLAY_INTERVAL_MS,
    )
    return () => clearInterval(interval)
  }, [running])
  const remaining = remainingClockTime(clock, monotonicClock.now())
  return (
    <View className="flex-row flex-wrap items-center justify-between gap-2">
      {MATCH_COLORS.map((color) => {
        const seconds = Math.ceil(remaining[color] / 1000)
        return (
          <View
            key={color}
            className={cx(
              "min-w-24 rounded-lg border-2 p-2",
              color === clock.activeColor && running
                ? "border-mapachito-blue bg-mapachito-white"
                : "bg-mapachito-surface border-transparent",
              remaining[color] <= LOW_TIME_MS && "border-mapachito-orange",
            )}
          >
            <NativeText
              accessibilityRole="timer"
              accessibilityLabel={copy.gameplay.clock.label(
                copy.board.colors[color],
              )}
              className={cx(
                "font-native text-center text-xl tabular-nums",
                color === clock.activeColor &&
                  running &&
                  "text-mapachito-charcoal",
              )}
            >
              {copy.gameplay.clock.display(
                Math.floor(seconds / 60),
                seconds % 60,
              )}
            </NativeText>
          </View>
        )
      })}
      {clock.paused && canResume ? (
        <NativeButton variant="secondary" onPress={onResume}>
          {copy.gameplay.clock.resume}
        </NativeButton>
      ) : null}
    </View>
  )
}
