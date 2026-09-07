import type { CSSProperties } from "react"
import type {
  ResolvedSpritePresentation,
  ResolvedSpriteStep,
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
  const { referenceGeometry } = presentation
  return {
    mobileScale: createSpritePresentationGeometry(
      referenceGeometry,
      referenceGeometry,
      MOBILE_VISIBLE_HEIGHT_PIXELS,
    ).integerScale,
    desktopScale: createSpritePresentationGeometry(
      referenceGeometry,
      referenceGeometry,
      DESKTOP_VISIBLE_HEIGHT_PIXELS,
    ).integerScale,
    visibleWidth: `${referenceGeometry.visibleWidth}px`,
  }
}

export const battleSpriteAnchorStyle = (
  presentation: ResolvedSpritePresentation<string, string>,
  opposingPresentation: ResolvedSpritePresentation<string, string>,
): CSSProperties &
  Readonly<{
    "--sprite-mobile-scale": number
    "--sprite-desktop-scale": number
    "--sprite-visible-width": string
    "--opponent-mobile-width": string
    "--opponent-desktop-width": string
  }> => {
  const sprite = responsiveSpriteGeometry(presentation)
  const opponent = responsiveSpriteGeometry(opposingPresentation)
  return {
    "--sprite-mobile-scale": sprite.mobileScale,
    "--sprite-desktop-scale": sprite.desktopScale,
    "--sprite-visible-width": sprite.visibleWidth,
    "--opponent-mobile-width": `calc(${opponent.visibleWidth} * ${opponent.mobileScale})`,
    "--opponent-desktop-width": `calc(${opponent.visibleWidth} * ${opponent.desktopScale})`,
  }
}

export const battleSpriteFrameKeyframes = (frameCount: number): Keyframe[] =>
  Array.from({ length: frameCount + 1 }, (_, index) => ({
    backgroundPosition: `${frameCount === 1 ? 0 : (Math.min(index, frameCount - 1) / (frameCount - 1)) * 100}% 0`,
    easing: "step-end",
    offset: index / frameCount,
  }))

export const showBattleSpriteFrame = (
  element: HTMLSpanElement,
  step: BattleSpriteStep,
  reducedMotion: boolean,
): void => {
  const { animation } = step
  const { geometry } = animation
  const frameIndex = reducedMotion
    ? step.playback === "once-hold-final-frame"
      ? animation.frameCount - 1
      : animation.reducedMotionFrameIndex
    : 0
  Object.assign(element.style, {
    backgroundImage: `url("${animation.sourceId}")`,
    backgroundPosition: `${animation.frameCount === 1 ? 0 : (frameIndex / (animation.frameCount - 1)) * 100}% 0`,
    backgroundSize: `${animation.frameCount * 100}% 100%`,
    height: `calc(${geometry.frameHeight}px * var(--sprite-scale))`,
    left: `calc(${-geometry.bottomCenterX}px * var(--sprite-scale))`,
    top: `calc(${-geometry.bottomY}px * var(--sprite-scale))`,
    width: `calc(${geometry.frameWidth}px * var(--sprite-scale))`,
  })
}
