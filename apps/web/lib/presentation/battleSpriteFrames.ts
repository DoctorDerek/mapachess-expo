import type { CSSProperties } from "react"
import type {
  ResolvedSpritePresentation,
  ResolvedSpriteStep,
} from "@mapachess/match-presentation/presentation-asset-manifest"
import createSpritePresentationGeometry from "@mapachess/match-presentation/sprite-presentation-geometry"

export type BattleSpritePresentation = Extract<
  ResolvedSpritePresentation<string, string>,
  { kind: "sprite" }
>
export type BattleSpriteStep = ResolvedSpriteStep<string, string>

const MOBILE_VISIBLE_HEIGHT_PIXELS = 60
const DESKTOP_VISIBLE_HEIGHT_PIXELS = 80

export const battleSpriteAnchorStyle = (
  presentation: BattleSpritePresentation,
): CSSProperties &
  Readonly<{
    "--sprite-mobile-scale": number
    "--sprite-desktop-scale": number
  }> => {
  const { referenceGeometry } = presentation
  return {
    "--sprite-mobile-scale": createSpritePresentationGeometry(
      referenceGeometry,
      referenceGeometry,
      MOBILE_VISIBLE_HEIGHT_PIXELS,
    ).integerScale,
    "--sprite-desktop-scale": createSpritePresentationGeometry(
      referenceGeometry,
      referenceGeometry,
      DESKTOP_VISIBLE_HEIGHT_PIXELS,
    ).integerScale,
    width: `calc(${referenceGeometry.visibleWidth}px * var(--sprite-scale))`,
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
