import {
  Alignment,
  Fit,
  RiveView,
  useRive,
  useRiveFile,
} from "@rive-app/react-native"
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated"
import Svg, { G, Image } from "react-native-svg"
import { scheduleOnRN } from "react-native-worklets"
import { withUniwind } from "uniwind"
import { MAPACHITO_SPRITE_MANIFEST } from "@mapachess/match-presentation/presentation-assets"
import animations from "@/lib/presentation/nativeAnimationManifest"
import assets from "@/lib/presentation/nativeAssetManifest"

const StyledRive = withUniwind(RiveView)
const AnimatedGroup = Animated.createAnimatedComponent(G)
const AnimatedImage = Animated.createAnimatedComponent(Image)
const run = MAPACHITO_SPRITE_MANIFEST.animations.run
const CROSSING_DURATION_MS = 3200
const CROSSING_DELAY_MS = 900

function ArrivalRaccoon({ onComplete }: Readonly<{ onComplete: () => void }>) {
  const progress = useSharedValue(0)
  const frame = useSharedValue(0)
  const source = assets.images[run.sourceId]
  useEffect(() => {
    let disposed = false
    const complete = (): void => {
      if (!disposed) onComplete()
    }
    if (source === undefined) {
      queueMicrotask(complete)
      return () => {
        disposed = true
      }
    }
    frame.value = withRepeat(
      withTiming(run.frameCount, {
        duration: run.frameCount * run.frameDurationMilliseconds,
        easing: Easing.linear,
      }),
      -1,
      false,
    )
    progress.value = withDelay(
      CROSSING_DELAY_MS,
      withTiming(
        1,
        { duration: CROSSING_DURATION_MS, easing: Easing.linear },
        (finished) => {
          if (finished) scheduleOnRN(complete)
        },
      ),
    )
    return () => {
      disposed = true
      cancelAnimation(frame)
      cancelAnimation(progress)
    }
  }, [source, onComplete])
  const group = useAnimatedProps(() => ({
    transform: `translate(${String(-run.geometry.frameWidth + (600 + run.geometry.frameWidth) * progress.value)},0)`,
  }))
  const image = useAnimatedProps(() => ({
    x:
      -Math.floor(Math.min(frame.value, run.frameCount - 1)) *
      run.geometry.frameWidth,
  }))
  return source === undefined ? null : (
    <View className="absolute inset-x-0 bottom-0 h-20" pointerEvents="none">
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 600 ${String(run.geometry.frameHeight)}`}
      >
        <AnimatedGroup animatedProps={group}>
          <Svg
            width={run.geometry.frameWidth}
            height={run.geometry.frameHeight}
            viewBox={`0 0 ${String(run.geometry.frameWidth)} ${String(run.geometry.frameHeight)}`}
          >
            <AnimatedImage
              href={source}
              animatedProps={image}
              width={run.geometry.frameWidth * run.frameCount}
              height={run.geometry.frameHeight}
            />
          </Svg>
        </AnimatedGroup>
      </Svg>
    </View>
  )
}

export default function NativeArrivalAnimation({
  onUnavailable,
}: Readonly<{ onUnavailable: () => void }>) {
  const { riveFile, error } = useRiveFile(
    animations["/first-arrival/ice-cream.riv"],
  )
  const { riveViewRef, setHybridRef } = useRive()
  const [started, setStarted] = useState(false)
  const unavailable = useCallback(onUnavailable, [onUnavailable])
  useEffect(() => {
    if (error !== null) unavailable()
  }, [error, unavailable])
  useEffect(() => {
    if (riveViewRef === undefined || riveViewRef === null) return
    let disposed = false
    void riveViewRef
      .awaitViewReady()
      .then(async (ready) => {
        if (!ready || disposed) return
        await riveViewRef.play()
        if (!disposed) setStarted(true)
      })
      .catch(() => {
        if (!disposed) unavailable()
      })
    return () => {
      disposed = true
    }
  }, [riveViewRef, unavailable])
  return (
    <View
      className="absolute inset-0"
      pointerEvents="none"
      accessible={false}
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
          onError={unavailable}
        />
      )}
      {started ? <ArrivalRaccoon onComplete={unavailable} /> : null}
    </View>
  )
}
