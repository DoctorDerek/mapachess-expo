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
