export const CARD_IDLE_FRAME_MILLISECONDS = 150
export const PROFILE_CARD_WIDTH = 960
export const PROFILE_CARD_HEIGHT = 540
export const PROFILE_ARTWORK_WIDTH = 360
export const PROFILE_ARTWORK_HEIGHT = 450
export const PROFILE_CARD_TYPOGRAPHY = {
  label: { weight: 700, size: 33 },
  value: { weight: 900, size: 65 },
  category: { weight: 700, size: 24 },
  invitation: { weight: 700, size: 34 },
} as const

export const PROFILE_CARD_LAYOUT = {
  factsWidth: 384,
  invitationHeight: 70,
  factsInset: 38,
  levelLabelGap: 10,
  ratingValueOffset: -20,
  ratingLabelOffset: 28,
  categoryOffset: 57,
  medalSize: 32,
  medalGap: 6,
} as const

type ArtworkBounds = Readonly<{ width: number; height: number }>
type ArtworkPlacement = Readonly<{
  x: number
  y: number
  width: number
  height: number
}>

export function profileCardCharacterLayout({
  width,
  height,
  heroBounds,
  animalBounds,
}: Readonly<{
  width: number
  height: number
  heroBounds: ArtworkBounds
  animalBounds: ArtworkBounds | null
}>): Readonly<{
  hero: ArtworkPlacement
  animal: ArtworkPlacement | null
  ground: Readonly<{ x: number; y: number; radiusX: number; radiusY: number }>
}> {
  const heroScale = Math.max(
    1,
    Math.floor(
      Math.min(
        (height * 0.76) / heroBounds.height,
        (width * (animalBounds === null ? 0.9 : 0.7)) / heroBounds.width,
      ),
    ),
  )
  const heroWidth = heroBounds.width * heroScale
  const heroHeight = heroBounds.height * heroScale
  const floor = Math.round(height * 0.88)
  const animalScale =
    animalBounds === null
      ? 1
      : Math.max(
          1,
          Math.floor(
            Math.min(
              (height * 0.28) / animalBounds.height,
              (width * 0.32) / animalBounds.width,
            ),
          ),
        )
  return {
    hero: {
      x: Math.round(
        width * (animalBounds === null ? 0.5 : 0.4) - heroWidth / 2,
      ),
      y: floor - heroHeight,
      width: heroWidth,
      height: heroHeight,
    },
    animal:
      animalBounds === null
        ? null
        : {
            x: Math.round(
              width * 0.73 - (animalBounds.width * animalScale) / 2,
            ),
            y: floor - animalBounds.height * animalScale,
            width: animalBounds.width * animalScale,
            height: animalBounds.height * animalScale,
          },
    ground: {
      x: width * 0.5,
      y: floor,
      radiusX: width * 0.32,
      radiusY: height * 0.021,
    },
  }
}

export type GifEncodingRequest = Readonly<{
  width: number
  height: number
  delay: number
  frames: readonly Uint8Array<ArrayBuffer>[]
}>

export function profileCardAnimationFrameCount(
  heroFrames: number,
  animalFrames: number,
): number {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  return (heroFrames * animalFrames) / gcd(heroFrames, animalFrames)
}
