import { useEffect, useMemo, useRef, useState } from "react"
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated"
import Svg, { G, Image } from "react-native-svg"
import { scheduleOnRN } from "react-native-worklets"
import type { MatchPresentationBeat } from "@mapachess/match-presentation/match-presentation-machine"
import type { MatchPresentationParticipant } from "@mapachess/match-presentation/match-reaction"
import type {
  ResolvedSpritePresentation,
  ResolvedSpriteStep,
} from "@mapachess/match-presentation/presentation-asset-manifest"
import assets from "@/lib/presentation/nativeAssetManifest"

const AnimatedGroup = Animated.createAnimatedComponent(G)
const AnimatedImage = Animated.createAnimatedComponent(Image)
const FALLBACK_TRAVEL_MS = 360

export default function NativeBattleFighter({
  participant,
  presentation,
  idle,
  opposing,
  beat,
  phaseIndex,
  sequence,
  report,
  active,
  reducedMotion,
  onComplete,
}: Readonly<{
  participant: MatchPresentationParticipant
  presentation: ResolvedSpritePresentation<string, string>
  idle: ResolvedSpritePresentation<string, string>
  opposing: ResolvedSpritePresentation<string, string>
  beat: MatchPresentationBeat
  phaseIndex: number
  sequence: number
  report: boolean
  active: boolean
  reducedMotion: boolean
  onComplete: (
    participant: MatchPresentationParticipant,
    phase: number,
    sequence: number,
  ) => void
}>) {
  const steps = useMemo(
    () =>
      presentation.kind === "sprite"
        ? presentation.steps.filter(
            (step) =>
              step.beat ===
              (beat === "conclusion" && presentation.reactionSlot === "idle"
                ? "idle"
                : beat),
          )
        : [],
    [presentation, beat],
  )
  const identity = `${String(sequence)}:${String(phaseIndex)}:${beat}:${reducedMotion ? "still" : "motion"}`
  const [progress, setProgress] = useState({ identity, stepIndex: 0, cycle: 0 })
  const stepIndex = progress.identity === identity ? progress.stepIndex : 0
  const cycle = progress.identity === identity ? progress.cycle : 0
  const step: ResolvedSpriteStep<string, string> | undefined =
    steps[stepIndex] ?? (idle.kind === "sprite" ? idle.steps[0] : undefined)
  const frame = useSharedValue(0)
  const travel = useSharedValue(0)
  const frameIdentity = useRef("")
  const completedIdentity = useRef<string | null>(null)
  const attacker =
    presentation.reactionSlot.endsWith("attacker") &&
    !(
      presentation.kind === "sprite" &&
      presentation.steps.every((entry) => entry.beat === "strike")
    )
  const victim = presentation.reactionSlot.endsWith("victim")
  const geometry = step?.animation.geometry
  const scale =
    presentation.kind === "sprite"
      ? Math.max(
          1,
          Math.floor(60 / presentation.referenceGeometry.visibleHeight),
        )
      : 1
  const opponentScale =
    opposing.kind === "sprite"
      ? Math.max(1, Math.floor(60 / opposing.referenceGeometry.visibleHeight))
      : 1
  const contact =
    180 -
    (presentation.layout.clearance.horizontalRadius * scale +
      opposing.layout.clearance.horizontalRadius * opponentScale)
  const target = reducedMotion
    ? 0
    : attacker && ["approach", "strike", "reaction"].includes(beat)
      ? Math.max(0, contact)
      : victim && beat === "reaction"
        ? -10
        : 0
  const facing = participant === "player" ? 1 : -1
  const mirror =
    presentation.kind === "sprite" &&
    (presentation.sourceFacing === "right" ? 1 : -1) !==
      (beat === "recovery" && attacker ? -facing : facing)
  const source =
    step === undefined ? undefined : assets.images[step.animation.sourceId]
  useEffect(() => {
    if (!active) return
    let disposed = false
    const selected = steps[stepIndex]
    const animation = selected?.animation ?? step?.animation
    const first = selected?.frames?.[0] ?? 0
    const end = selected?.frames?.[1] ?? animation?.frameCount ?? 1
    const duration =
      selected === undefined
        ? FALLBACK_TRAVEL_MS
        : (end - first) * selected.animation.frameDurationMilliseconds
    const selectedIdentity = `${identity}:${String(stepIndex)}:${String(cycle)}:${step?.animationId ?? "fallback"}`
    if (frameIdentity.current !== selectedIdentity) {
      frameIdentity.current = selectedIdentity
      frame.value = first
    }
    const done = (): void => {
      if (disposed || completedIdentity.current === identity) return
      if (stepIndex + 1 < steps.length) {
        setProgress({ identity, stepIndex: stepIndex + 1, cycle })
        return
      }
      if (
        beat === "conclusion" &&
        presentation.kind === "sprite" &&
        presentation.repeatSequence &&
        !reducedMotion
      ) {
        setProgress({ identity, stepIndex: 0, cycle: cycle + 1 })
        return
      }
      completedIdentity.current = identity
      if (report) onComplete(participant, phaseIndex, sequence)
    }
    const dispose = (): void => {
      disposed = true
      cancelAnimation(frame)
      cancelAnimation(travel)
    }
    if (reducedMotion || source === undefined) {
      frame.value = animation?.reducedMotionFrameIndex ?? 0
      travel.value = 0
      if (report || (selected !== undefined && selected.playback !== "loop"))
        queueMicrotask(done)
      return dispose
    }
    if (selected === undefined && report) {
      travel.value = withTiming(target, { duration, easing: Easing.linear })
      frame.value = withTiming(
        end,
        { duration, easing: Easing.linear },
        (finished) => {
          if (finished) scheduleOnRN(done)
        },
      )
    } else {
      frame.value = Math.max(first, Math.min(frame.value, end - 1))
      const remaining = Math.max(
        1,
        (end - frame.value) * (animation?.frameDurationMilliseconds ?? 1),
      )
      travel.value = withTiming(target, {
        duration: remaining,
        easing: Easing.linear,
      })
      const animationValue = withTiming(
        end,
        { duration: remaining, easing: Easing.linear },
        (finished) => {
          if (finished && selected?.playback !== "loop") scheduleOnRN(done)
        },
      )
      frame.value =
        selected?.playback === "loop" || (selected === undefined && !report)
          ? withSequence(
              withTiming(end, { duration: remaining, easing: Easing.linear }),
              withTiming(first, { duration: 0 }),
              withRepeat(
                withSequence(
                  withTiming(end, {
                    duration:
                      (end - first) *
                      (animation?.frameDurationMilliseconds ?? 1),
                    easing: Easing.linear,
                  }),
                  withTiming(first, { duration: 0 }),
                ),
                -1,
                false,
              ),
            )
          : animationValue
    }
    return dispose
  }, [
    identity,
    steps,
    stepIndex,
    cycle,
    active,
    reducedMotion,
    report,
    source,
    target,
  ])
  const groupProps = useAnimatedProps(() => ({
    transform: `translate(${String((participant === "player" ? 90 : 270) + facing * travel.value)},104) scale(${String(scale * (mirror ? -1 : 1))},${String(scale)})`,
  }))
  const imageProps = useAnimatedProps(() => ({
    x:
      -Math.floor(
        Math.min(
          frame.value,
          (step?.frames?.[1] ?? step?.animation.frameCount ?? 1) - 1,
        ),
      ) *
        (geometry?.frameWidth ?? 1) -
      (geometry?.bottomCenterX ?? 0),
  }))
  return source === undefined || geometry === undefined ? null : (
    <AnimatedGroup animatedProps={groupProps}>
      <Svg
        x={-geometry.bottomCenterX}
        y={-geometry.bottomY}
        width={geometry.frameWidth}
        height={geometry.frameHeight}
        viewBox={`${String(-geometry.bottomCenterX)} ${String(-geometry.bottomY)} ${String(geometry.frameWidth)} ${String(geometry.frameHeight)}`}
      >
        <AnimatedImage
          animatedProps={imageProps}
          href={source}
          y={-geometry.bottomY}
          width={geometry.frameWidth * (step?.animation.frameCount ?? 1)}
          height={geometry.frameHeight}
        />
      </Svg>
    </AnimatedGroup>
  )
}
