import {
  Alignment,
  Fit,
  RiveView,
  useRive,
  useRiveFile,
} from "@rive-app/react-native"
import { useEffect, useEffectEvent } from "react"
import { View } from "react-native"
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated"
import Svg from "react-native-svg"
import { scheduleOnRN } from "react-native-worklets"
import {
  ScopedVariables,
  useCSSVariable,
  useResolveClassNames,
  withUniwind,
} from "uniwind"
import { MAPACHITO_SPRITE_MANIFEST } from "@mapachess/match-presentation/presentation-assets"
import NativeSpriteImage from "@/components/presentation/NativeSpriteImage"
import animations from "@/lib/presentation/nativeAnimationManifest"
import useNativeArtworkReadiness from "@/lib/presentation/useNativeArtworkReadiness"

const StyledRive = withUniwind(RiveView)
const StyledTraveler = withUniwind(Animated.View)
const run = MAPACHITO_SPRITE_MANIFEST.animations.run
const scale = MAPACHITO_SPRITE_MANIFEST.standaloneScale

function milliseconds(value: unknown): number {
  return typeof value === "string" && value.endsWith("ms")
    ? Number(value.slice(0, -2))
    : Number.NaN
}

export function NativeArrivalRaccoon({
  onComplete,
}: Readonly<{ onComplete: () => void }>) {
  const progress = useSharedValue(0)
  const frame = useSharedValue(0)
  const readiness = useNativeArtworkReadiness([run.sourceId])
  const ready = readiness.status(run.sourceId) === "ready"
  const timing = useResolveClassNames(
    "duration-(--arrival-crossing-duration) xl:duration-(--arrival-crossing-wide-duration)",
  )
  const duration = milliseconds(timing.transitionDuration)
  const delay = milliseconds(useCSSVariable("--arrival-crossing-delay"))
  const unavailable =
    readiness.status(run.sourceId) === "missing" ||
    readiness.status(run.sourceId) === "failed" ||
    !Number.isFinite(duration) ||
    !Number.isFinite(delay)
  const complete = useEffectEvent(onComplete)
  useEffect(() => {
    if (unavailable) complete()
  }, [unavailable])
  useEffect(() => {
    if (!ready || unavailable) return
    let disposed = false
    const finish = (): void => {
      if (!disposed) onComplete()
    }
    frame.value = 0
    progress.value = 0
    frame.value = withRepeat(
      withTiming(run.frameCount, {
        duration: run.frameCount * run.frameDurationMilliseconds,
        easing: Easing.linear,
        reduceMotion: ReduceMotion.Never,
      }),
      -1,
      false,
      undefined,
      ReduceMotion.Never,
    )
    progress.value = withDelay(
      delay,
      withTiming(
        1,
        { duration, easing: Easing.linear, reduceMotion: ReduceMotion.Never },
        (finished) => {
          if (finished) scheduleOnRN(finish)
        },
      ),
      ReduceMotion.Never,
    )
    return () => {
      disposed = true
      cancelAnimation(frame)
      cancelAnimation(progress)
    }
  }, [ready, unavailable, duration, delay, frame, progress, onComplete])
  const travel = useAnimatedStyle(() => ({
    left: `${progress.value * 100}%`,
    transform: [
      { translateX: -run.geometry.frameWidth * scale * (1 - progress.value) },
    ],
  }))
  const settle = (sourceId: string, status: "ready" | "failed") => {
    const layer = readiness.layers.find(
      ({ request }) => request.sourceId === sourceId,
    )
    if (layer !== undefined) readiness.settle(layer.request, status)
  }
  return (
    <ScopedVariables
      variables={{
        "--arrival-sprite-width": run.geometry.frameWidth * scale,
        "--arrival-sprite-height": run.geometry.frameHeight * scale,
      }}
    >
      <View
        className="pointer-events-none absolute inset-x-0 bottom-0 h-(--arrival-sprite-height) overflow-hidden"
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <StyledTraveler
          className="absolute top-0 h-full w-(--arrival-sprite-width)"
          style={travel}
        >
          <Svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${run.geometry.frameWidth} ${run.geometry.frameHeight}`}
          >
            <NativeSpriteImage
              sourceId={run.sourceId}
              frameWidth={run.geometry.frameWidth}
              frameHeight={run.geometry.frameHeight}
              frameCount={run.frameCount}
              frame={frame}
              onAssetLoaded={(sourceId) => settle(sourceId, "ready")}
              onAssetFailed={(sourceId) => settle(sourceId, "failed")}
            />
          </Svg>
        </StyledTraveler>
      </View>
    </ScopedVariables>
  )
}

export default function NativeArrivalAnimation({
  onStarted,
  onUnavailable,
}: Readonly<{ onStarted: () => void; onUnavailable: () => void }>) {
  const { riveFile, error } = useRiveFile(
    animations["/first-arrival/ice-cream.riv"],
  )
  const { riveViewRef, setHybridRef } = useRive()
  const unavailable = useEffectEvent(onUnavailable)
  const started = useEffectEvent(onStarted)
  useEffect(() => {
    if (error !== null) unavailable()
  }, [error])
  useEffect(() => {
    if (
      riveFile === undefined ||
      riveFile === null ||
      error !== null ||
      riveViewRef === undefined ||
      riveViewRef === null
    )
      return
    let disposed = false
    void riveViewRef
      .awaitViewReady()
      .then(async (ready) => {
        if (disposed) return
        if (!ready) {
          unavailable()
          return
        }
        await riveViewRef.play()
        if (!disposed) started()
      })
      .catch(() => {
        if (!disposed) unavailable()
      })
    return () => {
      disposed = true
    }
  }, [riveViewRef, riveFile, error])
  return (
    <View
      className="absolute inset-0"
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {riveFile === undefined || riveFile === null ? null : (
        <StyledRive
          file={riveFile}
          hybridRef={setHybridRef}
          stateMachineName="Intro Animation"
          autoPlay={false}
          alignment={Alignment.Center}
          fit={Fit.Cover}
          className="h-full w-full"
          onError={onUnavailable}
        />
      )}
    </View>
  )
}
