import { getImageProps, type StaticImageData } from "next/image"
import bronze from "@mapachess/match-presentation/medals/bronze.png"
import gold from "@mapachess/match-presentation/medals/gold.png"
import silver from "@mapachess/match-presentation/medals/silver.png"
import type { MatchMedal } from "@mapachess/profile/match-medal"

const MEDAL_ARTWORK = { bronze, silver, gold } as const satisfies Readonly<
  Record<MatchMedal, StaticImageData>
>
export const MEDAL_ICON_SIZE = 24

export default function medalArtworkSource(medal: MatchMedal): string {
  return getImageProps({
    src: MEDAL_ARTWORK[medal],
    alt: "",
    width: MEDAL_ICON_SIZE,
    height: MEDAL_ICON_SIZE,
    unoptimized: true,
  }).props.src
}
