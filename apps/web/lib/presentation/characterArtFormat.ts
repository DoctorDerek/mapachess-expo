import { presentationAssetSource } from "@mapachess/match-presentation/presentation-assets"
import readIndexedArtPack from "@/lib/presentation/readIndexedArtPack"

export function isCharacterArtSource(source: string): boolean {
  return (
    source.startsWith(presentationAssetSource("battle/")) ||
    source.startsWith(presentationAssetSource("profile/hero/"))
  )
}

export function readCharacterArtPack(
  buffer: ArrayBuffer,
  expectedSources: number,
) {
  return readIndexedArtPack(
    buffer,
    expectedSources,
    presentationAssetSource,
    (source) => (isCharacterArtSource(source) ? "image/webp" : undefined),
  )
}
