import type { MatchPresentationBeat } from "./matchPresentationMachine.js"
import type {
  ResolvedSpritePresentation,
  SpriteClearance,
  SpriteFrameGeometry,
} from "./presentationAssetManifest.js"

const MOBILE_VISIBLE_HEIGHT_PIXELS = 60
const DESKTOP_VISIBLE_HEIGHT_PIXELS = 80

export type BattleSpriteScale = Readonly<{
  integerScale: number
  visibleWidthPixels: number
  clearance: SpriteClearance
}>

export type BattleSpriteGeometry =
  | Readonly<{ kind: "authored-fallback" }>
  | Readonly<{
      kind: "sprite"
      sourceVisibleWidthPixels: number
      mobile: BattleSpriteScale
      desktop: BattleSpriteScale
    }>

export type SpritePresentationGeometry = Readonly<{
  frameHeight: number
  frameOffsetX: number
  frameOffsetY: number
  frameWidth: number
  integerScale: number
}>

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

export function battleSpriteGeometry(
  presentation: ResolvedSpritePresentation<string, string>,
): BattleSpriteGeometry {
  if (presentation.kind === "authored-fallback") return presentation
  const { referenceGeometry, standaloneScale, clearance } = presentation.layout
  const scaleForHeight = (heightPixels: number): BattleSpriteScale => {
    const integerScale =
      standaloneScale ??
      createSpritePresentationGeometry(
        referenceGeometry,
        referenceGeometry,
        heightPixels,
      ).integerScale
    return {
      integerScale,
      visibleWidthPixels: referenceGeometry.visibleWidth * integerScale,
      clearance: {
        above: clearance.above * integerScale,
        below: clearance.below * integerScale,
        horizontalRadius: clearance.horizontalRadius * integerScale,
      },
    }
  }
  return {
    kind: "sprite",
    sourceVisibleWidthPixels: referenceGeometry.visibleWidth,
    mobile: scaleForHeight(MOBILE_VISIBLE_HEIGHT_PIXELS),
    desktop: scaleForHeight(DESKTOP_VISIBLE_HEIGHT_PIXELS),
  }
}

export function battleSpriteContactAdvance(
  presentation: ResolvedSpritePresentation<string, string>,
  opposing: ResolvedSpritePresentation<string, string>,
  beat: MatchPresentationBeat,
): number | undefined {
  if (
    (beat !== "reaction" && beat !== "recovery") ||
    presentation.kind !== "sprite" ||
    opposing.kind !== "sprite" ||
    !opposing.sourceAnimalId
  )
    return undefined
  return presentation.contactAdvanceByTarget?.[opposing.sourceAnimalId]
}
