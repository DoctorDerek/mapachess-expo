import { useEffect, useMemo, useRef, useState } from "react"
import { View } from "react-native"
import levelProgressionSpans, {
  easeOutQuad,
  levelProgressFrame,
  levelProgressSpanFrame,
} from "@mapachess/profile/level-progression"
import useNativePresentationActivity from "@/lib/presentation/useNativePresentationActivity"
import NativeText from "../presentation/NativeText"
import { useNativeLocale } from "../profile/NativeLocaleProvider"

export default function NativeLevelProgress({
  beforeXp,
  afterXp,
}: Readonly<{ beforeXp: number; afterXp: number }>) {
  const { copy } = useNativeLocale()
  const { active, reducedMotion } = useNativePresentationActivity()
  const [display, setDisplay] = useState(() => levelProgressFrame(beforeXp))
  const final = levelProgressFrame(afterXp)
  const spans = useMemo(
    () => [...levelProgressionSpans(beforeXp, afterXp)],
    [beforeXp, afterXp],
  )
  const elapsed = useRef(0)
  const finished = useRef(false)
  useEffect(() => {
    elapsed.current = 0
    finished.current = false
    setDisplay(levelProgressFrame(beforeXp))
  }, [beforeXp, afterXp])
  useEffect(() => {
    if (!active || finished.current) return
    if (reducedMotion) {
      finished.current = true
      setDisplay(levelProgressFrame(afterXp))
      return
    }
    let frame: number
    const started = performance.now()
    const startingElapsed = elapsed.current
    let lastElapsed = startingElapsed
    const tick = (): void => {
      lastElapsed = startingElapsed + performance.now() - started
      let preceding = 0
      const span = spans.find((entry) => {
        const contains = lastElapsed < preceding + entry.durationMs
        if (!contains) preceding += entry.durationMs
        return contains
      })
      if (span === undefined) {
        finished.current = true
        setDisplay(levelProgressFrame(afterXp))
        return
      }
      const fraction = easeOutQuad(
        Math.min(1, (lastElapsed - preceding) / span.durationMs),
      )
      setDisplay(levelProgressSpanFrame(span, fraction))
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      elapsed.current = lastElapsed
    }
  }, [spans, active, reducedMotion, afterXp])
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={copy.gameplay.levelProgress(
        final.level,
        final.current,
        final.required,
      )}
      className="bg-mapachito-white gap-2 rounded-lg p-3"
    >
      <View className="flex-row flex-wrap items-baseline justify-between gap-1">
        <NativeText className="font-native text-mapachito-charcoal text-xl">
          {copy.gameplay.level(display.level)}
        </NativeText>
        <NativeText className="text-mapachito-charcoal text-sm">
          {copy.gameplay.xpProgress(display.current, display.required)}
        </NativeText>
      </View>
      <View className="bg-mapachito-charcoal/20 h-3 overflow-hidden rounded-full">
        <View
          className="bg-mapachito-green h-full"
          style={{ width: `${display.fraction * 100}%` }}
        />
      </View>
    </View>
  )
}
