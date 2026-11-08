import type { MatchMedal } from "@mapachess/profile/match-medal"
import NativeImage from "./NativeImage"

export default function NativeMedal({
  medal,
}: Readonly<{ medal: MatchMedal }>) {
  return (
    <NativeImage
      sourceId={`/medals/${medal}.png`}
      className="size-7 shrink-0"
      accessible={false}
    />
  )
}
