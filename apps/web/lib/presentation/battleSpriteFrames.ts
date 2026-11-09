import type { CSSProperties } from "react"
import {
  spriteStepPlayback,
  type BattleSpriteStep,
} from "@mapachess/match-presentation/battle-sprite-playback"
import type { MatchPresentationBeat } from "@mapachess/match-presentation/match-presentation-machine"
import type {
  ResolvedSpritePresentation,
  SpriteFrameRange,
} from "@mapachess/match-presentation/presentation-asset-manifest"
import {
  battleSpriteContactAdvance,
  battleSpriteGeometry,
} from "@mapachess/match-presentation/sprite-presentation-geometry"

export type { BattleSpriteStep }

export const battleStageStyle = (
  player: ResolvedSpritePresentation<string, string>,
  opponent: ResolvedSpritePresentation<string, string>,
): CSSProperties &
  Readonly<
    Record<
      | "--battle-mobile-above"
      | "--battle-desktop-above"
      | "--battle-mobile-below"
      | "--battle-desktop-below"
      | "--battle-mobile-player-radius"
      | "--battle-desktop-player-radius"
      | "--battle-mobile-opponent-radius"
      | "--battle-desktop-opponent-radius",
      string
    >
  > => {
  const playerGeometry = battleSpriteGeometry(player)
  const opponentGeometry = battleSpriteGeometry(opponent)
  const bounds = [playerGeometry, opponentGeometry]
  const extent = (axis: "above" | "below", layout: "mobile" | "desktop") =>
    `max(${bounds
      .map((geometry) =>
        geometry.kind === "authored-fallback"
          ? axis === "above"
            ? "var(--battle-fallback-size)"
            : "0px"
          : `${geometry[layout].clearance[axis]}px`,
      )
      .join(", ")})`
  const radius = (
    geometry: typeof playerGeometry,
    layout: "mobile" | "desktop",
  ) =>
    geometry.kind === "authored-fallback"
      ? "calc(var(--battle-fallback-size) / 2)"
      : `${geometry[layout].clearance.horizontalRadius}px`
  return {
    "--battle-mobile-above": extent("above", "mobile"),
    "--battle-desktop-above": extent("above", "desktop"),
    "--battle-mobile-below": extent("below", "mobile"),
    "--battle-desktop-below": extent("below", "desktop"),
    "--battle-mobile-player-radius": radius(playerGeometry, "mobile"),
    "--battle-desktop-player-radius": radius(playerGeometry, "desktop"),
    "--battle-mobile-opponent-radius": radius(opponentGeometry, "mobile"),
    "--battle-desktop-opponent-radius": radius(opponentGeometry, "desktop"),
  }
}

export const battleSpriteAnchorStyle = (
  presentation: ResolvedSpritePresentation<string, string>,
  opposingPresentation: ResolvedSpritePresentation<string, string>,
  beat: MatchPresentationBeat = "idle",
): CSSProperties &
  Readonly<{
    "--sprite-mobile-scale": number
    "--sprite-desktop-scale": number
    "--sprite-visible-width": string
    "--opponent-mobile-width": string
    "--opponent-desktop-width": string
    "--battle-contact-extension"?: string
  }> => {
  const sprite = battleSpriteGeometry(presentation)
  const opponent = battleSpriteGeometry(opposingPresentation)
  const extension = battleSpriteContactAdvance(
    presentation,
    opposingPresentation,
    beat,
  )
  const visibleWidth = (geometry: typeof sprite) =>
    geometry.kind === "sprite"
      ? `${geometry.sourceVisibleWidthPixels}px`
      : "var(--battle-fallback-size)"
  const scale = (geometry: typeof sprite, layout: "mobile" | "desktop") =>
    geometry.kind === "sprite" ? geometry[layout].integerScale : 1
  return {
    "--sprite-mobile-scale": scale(sprite, "mobile"),
    "--sprite-desktop-scale": scale(sprite, "desktop"),
    "--sprite-visible-width": visibleWidth(sprite),
    ...(extension === undefined
      ? {}
      : { "--battle-contact-extension": `${extension}px` }),
    "--opponent-mobile-width": `calc(${visibleWidth(opponent)} * ${scale(opponent, "mobile")})`,
    "--opponent-desktop-width": `calc(${visibleWidth(opponent)} * ${scale(opponent, "desktop")})`,
  }
}

export const battleSpriteFramePosition = (frame: number, frameCount: number) =>
  `${frameCount === 1 ? 0 : (frame / (frameCount - 1)) * 100}% 0`

export const battleSpriteFrameKeyframes = (
  frameCount: number,
  [first, end]: SpriteFrameRange = [0, frameCount],
): Keyframe[] =>
  Array.from({ length: end - first + 1 }, (_, index) => ({
    backgroundPosition: battleSpriteFramePosition(
      Math.min(first + index, end - 1),
      frameCount,
    ),
    easing: "step-end",
    offset: index / (end - first),
  }))

export const battleSpriteFrameStyle = (
  step: BattleSpriteStep,
  reducedMotion: boolean,
): CSSProperties => {
  const { animation } = step
  const { geometry } = animation
  const {
    frames: [first],
    stillFrame,
  } = spriteStepPlayback(step)
  const pixelSize = "var(--sprite-pixel-size, calc(1px * var(--sprite-scale)))"
  const frameIndex = reducedMotion ? stillFrame : first
  return {
    backgroundImage: `url("${animation.sourceId}")`,
    backgroundPosition: battleSpriteFramePosition(
      frameIndex,
      animation.frameCount,
    ),
    backgroundSize: `${animation.frameCount * 100}% 100%`,
    height: `calc(${geometry.frameHeight} * ${pixelSize})`,
    left: `calc(${-geometry.bottomCenterX} * ${pixelSize})`,
    top: `calc(${-geometry.bottomY} * ${pixelSize})`,
    width: `calc(${geometry.frameWidth} * ${pixelSize})`,
  }
}

export const showBattleSpriteFrame = (
  element: HTMLSpanElement,
  step: BattleSpriteStep,
  reducedMotion: boolean,
): void => {
  Object.assign(element.style, battleSpriteFrameStyle(step, reducedMotion))
}
