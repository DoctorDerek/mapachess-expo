import type { CSSProperties } from "react"
import type { MatchPresentationBeat } from "@mapachess/match-presentation/match-presentation-machine"
import type {
  ResolvedSpritePresentation,
  ResolvedSpriteStep,
  SpriteFrameRange,
} from "@mapachess/match-presentation/presentation-asset-manifest"
import createSpritePresentationGeometry from "@mapachess/match-presentation/sprite-presentation-geometry"

export type BattleSpriteStep = ResolvedSpriteStep<string, string>

const MOBILE_VISIBLE_HEIGHT_PIXELS = 60
const DESKTOP_VISIBLE_HEIGHT_PIXELS = 80

const responsiveSpriteGeometry = (
  presentation: ResolvedSpritePresentation<string, string>,
) => {
  if (presentation.kind !== "sprite")
    return {
      desktopScale: 1,
      mobileScale: 1,
      visibleWidth: "var(--battle-fallback-size)",
    }
  const { referenceGeometry, standaloneScale } = presentation.layout
  return {
    mobileScale:
      standaloneScale ??
      createSpritePresentationGeometry(
        referenceGeometry,
        referenceGeometry,
        MOBILE_VISIBLE_HEIGHT_PIXELS,
      ).integerScale,
    desktopScale:
      standaloneScale ??
      createSpritePresentationGeometry(
        referenceGeometry,
        referenceGeometry,
        DESKTOP_VISIBLE_HEIGHT_PIXELS,
      ).integerScale,
    visibleWidth: `${referenceGeometry.visibleWidth}px`,
  }
}

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
  const bounds = [player, opponent].map((presentation) => {
    const geometry = responsiveSpriteGeometry(presentation)
    return {
      geometry,
      clearance: presentation.layout.clearance,
      fallback: presentation.kind === "authored-fallback",
    }
  })
  const extent = (
    axis: "above" | "below",
    scale: "mobileScale" | "desktopScale",
  ) =>
    `max(${bounds
      .map(({ geometry, clearance, fallback }) =>
        fallback
          ? axis === "above"
            ? "var(--battle-fallback-size)"
            : "0px"
          : `${clearance[axis] * geometry[scale]}px`,
      )
      .join(", ")})`
  const radius = (
    presentation: typeof player,
    scale: "mobileScale" | "desktopScale",
  ) =>
    presentation.kind === "authored-fallback"
      ? "calc(var(--battle-fallback-size) / 2)"
      : `${presentation.layout.clearance.horizontalRadius * responsiveSpriteGeometry(presentation)[scale]}px`
  return {
    "--battle-mobile-above": extent("above", "mobileScale"),
    "--battle-desktop-above": extent("above", "desktopScale"),
    "--battle-mobile-below": extent("below", "mobileScale"),
    "--battle-desktop-below": extent("below", "desktopScale"),
    "--battle-mobile-player-radius": radius(player, "mobileScale"),
    "--battle-desktop-player-radius": radius(player, "desktopScale"),
    "--battle-mobile-opponent-radius": radius(opponent, "mobileScale"),
    "--battle-desktop-opponent-radius": radius(opponent, "desktopScale"),
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
  const sprite = responsiveSpriteGeometry(presentation)
  const opponent = responsiveSpriteGeometry(opposingPresentation)
  const extension =
    (beat === "reaction" || beat === "recovery") &&
    presentation.kind === "sprite" &&
    opposingPresentation.kind === "sprite" &&
    opposingPresentation.sourceAnimalId
      ? presentation.contactAdvanceByTarget?.[
          opposingPresentation.sourceAnimalId
        ]
      : undefined
  return {
    "--sprite-mobile-scale": sprite.mobileScale,
    "--sprite-desktop-scale": sprite.desktopScale,
    "--sprite-visible-width": sprite.visibleWidth,
    ...(extension === undefined
      ? {}
      : { "--battle-contact-extension": `${extension}px` }),
    "--opponent-mobile-width": `calc(${opponent.visibleWidth} * ${opponent.mobileScale})`,
    "--opponent-desktop-width": `calc(${opponent.visibleWidth} * ${opponent.desktopScale})`,
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
  const [first, end] = step.frames ?? [0, animation.frameCount]
  const pixelSize = "var(--sprite-pixel-size, calc(1px * var(--sprite-scale)))"
  const frameIndex = reducedMotion
    ? step.playback === "once-hold-final-frame"
      ? end - 1
      : Math.max(first, Math.min(end - 1, animation.reducedMotionFrameIndex))
    : first
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
