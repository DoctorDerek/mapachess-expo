import cx from "classix"
import { useMemo } from "react"
import { View, type ViewStyle } from "react-native"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated"
import { ScopedVariables, withUniwind } from "uniwind"
import battleSpritePlayback from "@mapachess/match-presentation/battle-sprite-playback"
import type { MatchPresentationBeat } from "@mapachess/match-presentation/match-presentation-machine"
import type { MatchPresentationParticipant } from "@mapachess/match-presentation/match-reaction"
import type { ResolvedSpritePresentation } from "@mapachess/match-presentation/presentation-asset-manifest"
import {
  battleSpriteContactAdvance,
  type BattleSpriteScale,
} from "@mapachess/match-presentation/sprite-presentation-geometry"
import NativeSpritePlayback from "../presentation/NativeSpritePlayback"
import NativeText from "../presentation/NativeText"

const AnimatedTrack = withUniwind(Animated.View)

export type NativeFighterGeometry = Readonly<{
  mobile: BattleSpriteScale
  desktop: BattleSpriteScale
}>

function trackInsets(
  sprite: BattleSpriteScale,
  opponent: BattleSpriteScale,
  contactAdvancePixels: number,
  recoilLimit: number,
) {
  return {
    home: sprite.clearance.horizontalRadius + recoilLimit,
    contact:
      opponent.clearance.horizontalRadius +
      recoilLimit +
      (sprite.visibleWidthPixels + opponent.visibleWidthPixels) / 2 -
      contactAdvancePixels * sprite.integerScale,
  }
}

export default function NativeBattleFighter({
  participant,
  displayName,
  presentation,
  opposing,
  geometry,
  opposingGeometry,
  recoilLimit,
  beat,
  phaseIndex,
  sequence,
  report,
  active,
  reducedMotion,
  onComplete,
}: Readonly<{
  participant: MatchPresentationParticipant
  displayName: string
  presentation: ResolvedSpritePresentation<string, string>
  opposing: ResolvedSpritePresentation<string, string>
  geometry: NativeFighterGeometry
  opposingGeometry: NativeFighterGeometry
  recoilLimit: number
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
  const isPlayer = participant === "player"
  const direction = isPlayer ? 1 : -1
  const facing = isPlayer ? "right" : "left"
  const playback = useMemo(
    () => battleSpritePlayback(presentation, beat, facing, reducedMotion),
    [presentation, beat, facing, reducedMotion],
  )
  const contact = battleSpriteContactAdvance(presentation, opposing, beat) ?? 0
  const mobile = trackInsets(
    geometry.mobile,
    opposingGeometry.mobile,
    contact,
    recoilLimit,
  )
  const desktop = trackInsets(
    geometry.desktop,
    opposingGeometry.desktop,
    contact,
    recoilLimit,
  )
  const travel = useSharedValue(0)
  const contactStyle = useAnimatedStyle<ViewStyle>(() => ({
    transform: [
      { translateX: `${100 * direction * Math.max(0, travel.get())}%` },
    ],
  }))
  const recoilStyle = useAnimatedStyle<ViewStyle>(() => ({
    transform: [
      { translateX: `${100 * direction * Math.min(0, travel.get())}%` },
    ],
  }))
  const home = isPlayer ? "left-0" : "right-0"
  const travelTarget =
    playback.travelTarget === "contact"
      ? 1
      : playback.travelTarget === "recoil"
        ? -1
        : 0
  return (
    <ScopedVariables
      variables={{
        "--native-track-home": mobile.home,
        "--native-track-contact": mobile.contact,
        "--native-track-wide-home": desktop.home,
        "--native-track-wide-contact": desktop.contact,
      }}
    >
      <View
        className={cx(
          "absolute [bottom:var(--native-stage-below)] h-0 min-w-0 xl:[bottom:var(--native-stage-wide-below)]",
          isPlayer
            ? "[right:var(--native-track-contact)] [left:var(--native-track-home)] xl:[right:var(--native-track-wide-contact)] xl:[left:var(--native-track-wide-home)]"
            : "[right:var(--native-track-home)] [left:var(--native-track-contact)] xl:[right:var(--native-track-wide-home)] xl:[left:var(--native-track-wide-contact)]",
        )}
        pointerEvents="none"
      >
        <AnimatedTrack className="absolute inset-x-0 h-0" style={contactStyle}>
          <View
            className={cx("max-w-battle-recoil-limit absolute h-0 w-1/4", home)}
          >
            <AnimatedTrack
              className="absolute inset-x-0 h-0"
              style={recoilStyle}
            >
              <View className={cx("absolute size-0", home)}>
                <NativeSpritePlayback
                  active={active}
                  identity={`${String(sequence)}:${String(phaseIndex)}:${beat}`}
                  playback={playback}
                  placement={{
                    kind: "battle",
                    mobileScale: geometry.mobile.integerScale,
                    desktopScale: geometry.desktop.integerScale,
                  }}
                  mirrored={
                    presentation.kind === "sprite" &&
                    playback.facing !== presentation.sourceFacing
                  }
                  reducedMotion={reducedMotion}
                  travel={{ position: travel, target: travelTarget }}
                  onComplete={
                    report
                      ? () => onComplete(participant, phaseIndex, sequence)
                      : undefined
                  }
                  fallback={
                    <View
                      accessibilityLabel={displayName}
                      className={cx(
                        "border-mapachito-charcoal size-battle-fallback absolute bottom-0 left-0 -translate-x-1/2 items-center justify-center border-4",
                        isPlayer ? "bg-mapachito-orange" : "bg-mapachito-white",
                      )}
                    >
                      <NativeText className="text-mapachito-charcoal font-native text-3xl">
                        {displayName.slice(0, 1)}
                      </NativeText>
                    </View>
                  }
                />
              </View>
            </AnimatedTrack>
          </View>
        </AnimatedTrack>
      </View>
    </ScopedVariables>
  )
}
