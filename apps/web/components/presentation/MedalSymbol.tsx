import type { MatchMedal } from "@mapachess/profile/match-medal"
import medalArtworkSource, {
  MEDAL_ICON_SIZE,
} from "../../lib/presentation/medalArtwork"

export default function MedalSymbol({
  medal,
}: Readonly<{ medal: MatchMedal }>) {
  return (
    <img
      src={medalArtworkSource(medal)}
      alt=""
      aria-hidden="true"
      width={MEDAL_ICON_SIZE}
      height={MEDAL_ICON_SIZE}
      className="mr-1 inline-block size-6 shrink-0 object-contain align-middle"
    />
  )
}
