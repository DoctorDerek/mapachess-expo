declare module "gifenc" {
  export type GifPalette = number[][]
  export function quantize(rgba: Uint8Array, maximumColors: number): GifPalette
  export function applyPalette(
    rgba: Uint8Array,
    palette: GifPalette,
  ): Uint8Array
  export function GIFEncoder(): {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options: { palette: GifPalette; delay: number; repeat: number },
    ): void
    finish(): void
    bytes(): Uint8Array
  }
}
