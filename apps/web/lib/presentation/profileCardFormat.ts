export const CARD_IDLE_FRAME_MILLISECONDS = 150
export const PROFILE_CARD_WIDTH = 960
export const PROFILE_CARD_HEIGHT = 540
export const PROFILE_ARTWORK_WIDTH = 360
export const PROFILE_ARTWORK_HEIGHT = 450

export type GifEncodingRequest = Readonly<{
  width: number
  height: number
  delay: number
  frames: readonly Uint8Array<ArrayBuffer>[]
}>
