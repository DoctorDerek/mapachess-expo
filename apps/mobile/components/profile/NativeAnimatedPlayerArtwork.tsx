import cx from "classix"
import { useEffect, useEffectEvent, useRef, useState } from "react"
import { View } from "react-native"
import {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated"
import resolveOpponentPresentation from "@mapachess/match-presentation/opponent-presentation"
import {
  CARD_IDLE_FRAME_MILLISECONDS,
  profileCardAnimationFrameCount,
} from "@mapachess/match-presentation/profile-card-format"
import { HERO_IDLE_GEOMETRY } from "@mapachess/profile/hero-catalog"
import {
  heroLayerPaths,
  type PlayerAppearance,
} from "@mapachess/profile/player-appearance"
import NativeButton from "@/components/presentation/NativeButton"
import NativeText from "@/components/presentation/NativeText"
import useNativeArtworkReadiness from "@/lib/presentation/useNativeArtworkReadiness"
import useNativePresentationActivity from "@/lib/presentation/useNativePresentationActivity"
import { useNativeLocale } from "./NativeLocaleProvider"
import NativePlayerArtwork from "./NativePlayerArtwork"

type PreparedAppearance = Readonly<{
  key: string
  appearance: PlayerAppearance
  sources: readonly string[]
}>

function PreparedArtwork({
  request,
  visible,
  frame,
  onStatus,
}: Readonly<{
  request: PreparedAppearance
  visible: boolean
  frame: SharedValue<number>
  onStatus: (request: PreparedAppearance, status: "ready" | "failed") => void
}>) {
  const readiness = useNativeArtworkReadiness(request.sources)
  const ready = request.sources.every(
    (source) => readiness.status(source) === "ready",
  )
  const failed = request.sources.some((source) =>
    ["failed", "missing"].includes(readiness.status(source)),
  )
  const report = useEffectEvent(onStatus)
  useEffect(() => {
    if (failed) report(request, "failed")
    else if (ready) report(request, "ready")
  }, [failed, ready, request.key])
  const settle = (sourceId: string, status: "ready" | "failed") => {
    const layer = readiness.layers.find(
      ({ request: source }) => source.sourceId === sourceId,
    )
    if (layer !== undefined) readiness.settle(layer.request, status)
  }
  return (
    <View
      pointerEvents="none"
      accessible={false}
      className={cx("absolute inset-0", !visible && "opacity-0")}
    >
      <NativePlayerArtwork
        appearance={request.appearance}
        frame={frame}
        onAssetLoaded={(sourceId) => settle(sourceId, "ready")}
        onAssetFailed={(sourceId) => settle(sourceId, "failed")}
      />
    </View>
  )
}

export default function NativeAnimatedPlayerArtwork({
  appearance,
}: Readonly<{ appearance: PlayerAppearance }>) {
  const { copy } = useNativeLocale()
  const { active, reducedMotion } = useNativePresentationActivity()
  const frame = useSharedValue(0)
  const playback = useRef<string | null>(null)
  const [retained, setRetained] = useState<PreparedAppearance | null>(null)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const animal = resolveOpponentPresentation(appearance.animal)
  const sources = [
    ...heroLayerPaths(appearance).map(
      (path) => `/generated/presentation-assets/${path}`,
    ),
    ...(animal.kind === "sprite" ? [animal.steps[0].animation.sourceId] : []),
  ]
  const request: PreparedAppearance = {
    key: `${sources.join("|")}:${attempt}`,
    appearance,
    sources,
  }
  const frameCount = profileCardAnimationFrameCount(
    HERO_IDLE_GEOMETRY.frameCount,
    animal.kind === "sprite" ? animal.steps[0].animation.frameCount : 1,
  )
  const failed = failedKey === request.key
  useEffect(() => {
    if (!active || retained?.key !== request.key || failed) return
    if (playback.current !== request.key) {
      playback.current = request.key
      frame.value = 0
    }
    if (reducedMotion) {
      frame.value = 0
      return
    }
    frame.value %= frameCount
    const timing = { easing: Easing.linear, reduceMotion: ReduceMotion.Never }
    frame.value = withSequence(
      withTiming(frameCount, {
        ...timing,
        duration: (frameCount - frame.value) * CARD_IDLE_FRAME_MILLISECONDS,
      }),
      withTiming(0, { duration: 0, reduceMotion: ReduceMotion.Never }),
      withRepeat(
        withSequence(
          withTiming(frameCount, {
            ...timing,
            duration: frameCount * CARD_IDLE_FRAME_MILLISECONDS,
          }),
          withTiming(0, { duration: 0, reduceMotion: ReduceMotion.Never }),
        ),
        -1,
        false,
        undefined,
        ReduceMotion.Never,
      ),
    )
    return () => cancelAnimation(frame)
  }, [
    active,
    reducedMotion,
    frameCount,
    frame,
    retained?.key,
    request.key,
    failed,
  ])
  const displayed =
    retained !== null && retained.key !== request.key
      ? [retained, request]
      : [request]
  return (
    <View className="relative min-h-58 flex-1">
      {displayed.map((candidate) => (
        <PreparedArtwork
          key={candidate.key}
          request={candidate}
          visible={retained?.key === candidate.key}
          frame={frame}
          onStatus={(settled, status) => {
            if (settled.key !== request.key) return
            if (status === "failed") setFailedKey(settled.key)
            else {
              setFailedKey(null)
              setRetained((previous) =>
                previous?.key === settled.key ? previous : settled,
              )
            }
          }}
        />
      ))}
      {failed ? (
        <View className="bg-profile-card-yellow absolute inset-x-0 bottom-0 gap-2 p-3">
          <NativeText
            accessibilityRole="alert"
            className="text-profile-card-ink"
          >
            {copy.interface.profileCard.profileArtworkCouldNotLoad}
          </NativeText>
          <NativeButton
            variant="secondary"
            onPress={() => setAttempt((current) => current + 1)}
          >
            {copy.interface.profileCard.retryArtwork}
          </NativeButton>
        </View>
      ) : null}
    </View>
  )
}
