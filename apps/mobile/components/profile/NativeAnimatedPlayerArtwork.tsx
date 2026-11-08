import { useEffect } from "react"
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated"
import resolveOpponentPresentation from "@mapachess/match-presentation/opponent-presentation"
import {
  CARD_IDLE_FRAME_MILLISECONDS,
  profileCardAnimationFrameCount,
} from "@mapachess/match-presentation/profile-card-format"
import { HERO_IDLE_GEOMETRY } from "@mapachess/profile/hero-catalog"
import type { PlayerAppearance } from "@mapachess/profile/player-appearance"
import useNativePresentationActivity from "@/lib/presentation/useNativePresentationActivity"
import NativePlayerArtwork from "./NativePlayerArtwork"

export default function NativeAnimatedPlayerArtwork({
  appearance,
}: Readonly<{ appearance: PlayerAppearance }>) {
  const { active, reducedMotion } = useNativePresentationActivity()
  const frame = useSharedValue(0)
  const animal = resolveOpponentPresentation(appearance.animal)
  const frameCount = profileCardAnimationFrameCount(
    HERO_IDLE_GEOMETRY.frameCount,
    animal.kind === "sprite" ? animal.steps[0].animation.frameCount : 1,
  )
  useEffect(() => {
    if (!active) return
    if (reducedMotion) {
      frame.value = 0
      return
    }
    frame.value %= frameCount
    frame.value = withSequence(
      withTiming(frameCount, {
        duration: (frameCount - frame.value) * CARD_IDLE_FRAME_MILLISECONDS,
        easing: Easing.linear,
      }),
      withTiming(0, { duration: 0 }),
      withRepeat(
        withSequence(
          withTiming(frameCount, {
            duration: frameCount * CARD_IDLE_FRAME_MILLISECONDS,
            easing: Easing.linear,
          }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
        false,
      ),
    )
    return () => cancelAnimation(frame)
  }, [active, reducedMotion, frameCount, frame])
  return <NativePlayerArtwork appearance={appearance} frame={frame} />
}
