import cx from "classix"
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { Image, View, type ViewStyle } from "react-native"
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated"
import { scheduleOnRN } from "react-native-worklets"
import { ScopedVariables, withUniwind } from "uniwind"
import {
  BATTLE_FALLBACK_TRAVEL_MILLISECONDS,
  type BattleSpritePlayback,
  type SpriteStepPlayback,
} from "@mapachess/match-presentation/battle-sprite-playback"
import useNativeArtworkReadiness, {
  type NativeArtworkLayer,
} from "@/lib/presentation/useNativeArtworkReadiness"

const AnimatedStrip = withUniwind(Animated.View)

type SpritePlacement =
  | Readonly<{ kind: "battle"; mobileScale: number; desktopScale: number }>
  | Readonly<{ kind: "preview"; size: number }>

type SpritePose = Readonly<{
  step: SpriteStepPlayback
  mirrored: boolean
  reducedMotion: boolean
}>

function spriteLayerGeometry(
  pose: SpritePose | null,
  placement: SpritePlacement,
  layout: "mobile" | "desktop",
) {
  if (pose === null)
    return { width: 1, height: 1, left: 0, top: 0, stripWidth: 1 }
  const { geometry, frameCount } = pose.step.step.animation
  const scale =
    placement.kind === "preview"
      ? placement.size / Math.max(geometry.frameWidth, geometry.frameHeight)
      : layout === "mobile"
        ? placement.mobileScale
        : placement.desktopScale
  const width = geometry.frameWidth * scale
  const height = geometry.frameHeight * scale
  return {
    width,
    height,
    left:
      placement.kind === "preview"
        ? -width / 2
        : -geometry.bottomCenterX * scale,
    top: placement.kind === "preview" ? -height / 2 : -geometry.bottomY * scale,
    stripWidth: width * frameCount,
  }
}

function SpriteLayer({
  layer,
  pose,
  placement,
  frame,
  onSettled,
}: Readonly<{
  layer: NativeArtworkLayer
  pose: SpritePose | null
  placement: SpritePlacement
  frame: SharedValue<number>
  onSettled: (status: "ready" | "failed") => void
}>) {
  const mobile = spriteLayerGeometry(pose, placement, "mobile")
  const desktop = spriteLayerGeometry(pose, placement, "desktop")
  const [first, end] = pose?.step.frames ?? [0, 1]
  const frameCount = pose?.step.step.animation.frameCount ?? 1
  const stillFrame = pose?.reducedMotion ? pose.step.stillFrame : null
  const stripStyle = useAnimatedStyle<ViewStyle>(() => {
    const index =
      stillFrame ?? Math.max(first, Math.min(end - 1, Math.floor(frame.get())))
    return { transform: [{ translateX: `${(-100 * index) / frameCount}%` }] }
  })
  return (
    <ScopedVariables
      variables={{
        "--native-sprite-width": mobile.width,
        "--native-sprite-height": mobile.height,
        "--native-sprite-left": mobile.left,
        "--native-sprite-top": mobile.top,
        "--native-strip-width": mobile.stripWidth,
        "--native-sprite-wide-width": desktop.width,
        "--native-sprite-wide-height": desktop.height,
        "--native-sprite-wide-left": desktop.left,
        "--native-sprite-wide-top": desktop.top,
        "--native-strip-wide-width": desktop.stripWidth,
      }}
    >
      <View
        className={cx(
          "absolute [margin-top:var(--native-sprite-top)] [margin-left:var(--native-sprite-left)] [height:var(--native-sprite-height)] [width:var(--native-sprite-width)] overflow-hidden xl:[margin-top:var(--native-sprite-wide-top)] xl:[margin-left:var(--native-sprite-wide-left)] xl:[height:var(--native-sprite-wide-height)] xl:[width:var(--native-sprite-wide-width)]",
          placement.kind === "preview" ? "top-1/2 left-1/2" : "top-0 left-0",
          pose === null && "opacity-0",
        )}
      >
        <AnimatedStrip
          className="absolute top-0 left-0 h-full [width:var(--native-strip-width)] xl:[width:var(--native-strip-wide-width)]"
          style={stripStyle}
        >
          <Image
            accessible={false}
            className="size-full"
            fadeDuration={0}
            onError={() => onSettled("failed")}
            onLoad={() => onSettled("ready")}
            resizeMethod="scale"
            resizeMode="stretch"
            source={layer.request.source}
          />
        </AnimatedStrip>
      </View>
    </ScopedVariables>
  )
}

type PlaybackPosition = Readonly<{
  identity: string
  stepIndex: number
  cycle: number
}>

export default function NativeSpritePlayback({
  active,
  identity,
  playback,
  placement,
  reducedMotion,
  mirrored = false,
  fallback,
  travel,
  onComplete,
}: Readonly<{
  active: boolean
  identity: string
  playback: Pick<BattleSpritePlayback, "sources" | "steps" | "repeatSequence">
  placement: SpritePlacement
  reducedMotion: boolean
  mirrored?: boolean
  fallback?: ReactNode
  travel?: Readonly<{ position: SharedValue<number>; target: number }>
  onComplete?: () => void
}>) {
  const programIdentity = `${identity}:${reducedMotion ? "still" : "motion"}`
  const frame = useSharedValue(0)
  const [position, setPosition] = useState<PlaybackPosition>({
    identity: programIdentity,
    stepIndex: 0,
    cycle: 0,
  })
  const [retained, setRetained] = useState<SpritePose | null>(null)
  const frameIdentity = useRef<string | null>(null)
  const completed = useRef<string | null>(null)
  const stepIndex =
    position.identity === programIdentity ? position.stepIndex : 0
  const cycle = position.identity === programIdentity ? position.cycle : 0
  const step = playback.steps[stepIndex]
  const artwork = useNativeArtworkReadiness([
    ...(active ? playback.sources : []),
    ...(retained === null ? [] : [retained.step.step.animation.sourceId]),
  ])
  const failed =
    active &&
    playback.sources.some((source) => {
      const status = artwork.status(source)
      return status === "missing" || status === "failed"
    })
  const ready =
    active &&
    playback.sources.every((source) => artwork.status(source) === "ready")
  const visible =
    failed || (active && playback.sources.length === 0)
      ? null
      : ready && step !== undefined
        ? { step, mirrored, reducedMotion }
        : retained !== null &&
            artwork.status(retained.step.step.animation.sourceId) === "ready"
          ? retained
          : null
  if (
    visible !== null &&
    (visible.step !== retained?.step ||
      visible.mirrored !== retained.mirrored ||
      visible.reducedMotion !== retained.reducedMotion)
  )
    setRetained(visible)

  const finishCurrent = useEffectEvent((finishedIdentity: string) => {
    if (identity === finishedIdentity) onComplete?.()
  })
  const travelPosition = travel?.position
  const travelTarget = travel?.target ?? 0
  useEffect(() => {
    if (!active || (!ready && !failed) || completed.current === identity) return
    let disposed = false
    const selected = failed ? undefined : step
    const [first, end] = selected?.frames ?? [0, 1]
    const key = `${programIdentity}:${String(stepIndex)}:${String(cycle)}:${selected?.step.animation.sourceId ?? "fallback"}`
    if (selected !== undefined && frameIdentity.current !== key) {
      frameIdentity.current = key
      frame.set(first)
    }
    const finish = () => {
      if (disposed || completed.current === identity) return
      if (!failed && stepIndex + 1 < playback.steps.length) {
        setPosition({
          identity: programIdentity,
          stepIndex: stepIndex + 1,
          cycle,
        })
      } else if (!failed && playback.repeatSequence) {
        setPosition({
          identity: programIdentity,
          stepIndex: 0,
          cycle: cycle + 1,
        })
      } else {
        completed.current = identity
        finishCurrent(identity)
      }
    }
    const dispose = () => {
      disposed = true
      cancelAnimation(frame)
      if (travelPosition !== undefined) cancelAnimation(travelPosition)
    }
    if (failed || reducedMotion) {
      if (selected !== undefined) frame.set(selected.stillFrame)
      travelPosition?.set(0)
      queueMicrotask(finish)
      return dispose
    }
    const duration =
      selected === undefined
        ? BATTLE_FALLBACK_TRAVEL_MILLISECONDS
        : (selected.durationMilliseconds * (end - frame.get())) / (end - first)
    let frameFinished = selected === undefined
    let travelFinished =
      travelPosition === undefined || travelPosition.get() === travelTarget
    const finishFrame = () => {
      frameFinished = true
      if (travelFinished) finish()
    }
    const finishTravel = () => {
      travelFinished = true
      if (frameFinished) finish()
    }
    if (travelPosition !== undefined && !travelFinished)
      travelPosition.set(
        withTiming(
          travelTarget,
          {
            duration,
            easing: Easing.linear,
            reduceMotion: ReduceMotion.Never,
          },
          (finished) => {
            if (finished) scheduleOnRN(finishTravel)
          },
        ),
      )
    if (selected === undefined) {
      if (travelFinished) queueMicrotask(finish)
      return dispose
    }
    const timing = {
      duration,
      easing: Easing.linear,
      reduceMotion: ReduceMotion.Never,
    }
    const reset = () =>
      withTiming(first, {
        duration: 0,
        reduceMotion: ReduceMotion.Never,
      })
    frame.set(
      selected.step.playback === "loop"
        ? withSequence(
            ReduceMotion.Never,
            withTiming(end, timing),
            reset(),
            withRepeat(
              withSequence(
                ReduceMotion.Never,
                withTiming(end, {
                  ...timing,
                  duration: selected.durationMilliseconds,
                }),
                reset(),
              ),
              -1,
              false,
              undefined,
              ReduceMotion.Never,
            ),
          )
        : withTiming(end, timing, (finished) => {
            if (finished) scheduleOnRN(finishFrame)
          }),
    )
    return dispose
  }, [
    active,
    cycle,
    failed,
    frame,
    identity,
    playback.repeatSequence,
    playback.steps.length,
    programIdentity,
    ready,
    reducedMotion,
    step,
    stepIndex,
    travelPosition,
    travelTarget,
  ])

  return (
    <View
      accessible={false}
      className={cx(
        "relative",
        placement.kind === "preview" ? "size-full" : "size-0",
        visible?.mirrored && "-scale-x-100",
      )}
      pointerEvents="none"
    >
      {artwork.layers.map((layer) => (
        <SpriteLayer
          key={layer.request.sourceId}
          layer={layer}
          pose={
            visible?.step.step.animation.sourceId === layer.request.sourceId
              ? visible
              : null
          }
          placement={placement}
          frame={frame}
          onSettled={(status) => artwork.settle(layer.request, status)}
        />
      ))}
      {visible === null ? fallback : null}
    </View>
  )
}
