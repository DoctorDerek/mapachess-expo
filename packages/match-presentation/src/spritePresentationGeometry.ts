import type { SpriteFrameGeometry } from "./presentationAssetManifest.js"

export type SpritePresentationGeometry = Readonly<{
  frameHeight: number
  frameOffsetX: number
  frameOffsetY: number
  frameWidth: number
  integerScale: number
}>

export const battleContactDistancePixels = (
  leftCombatantRightEdge: number,
  rightCombatantLeftEdge: number,
): number =>
  Math.max(0, Math.round(rightCombatantLeftEdge - leftCombatantRightEdge))

export default function createSpritePresentationGeometry(
  geometry: SpriteFrameGeometry,
  referenceGeometry: SpriteFrameGeometry,
  maximumVisibleHeightPixels: number,
): SpritePresentationGeometry {
  const integerScale = Math.floor(
    maximumVisibleHeightPixels / referenceGeometry.visibleHeight,
  )
  if (!Number.isFinite(integerScale) || integerScale < 1) {
    throw new RangeError("Sprite reference height must fit the presentation.")
  }

  return Object.freeze({
    frameHeight: geometry.frameHeight,
    frameOffsetX: -geometry.bottomCenterX,
    frameOffsetY: -geometry.bottomY,
    frameWidth: geometry.frameWidth,
    integerScale,
  })
}
