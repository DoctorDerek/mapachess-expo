import type { MatchMedal } from "@mapachess/profile/match-medal"
import MedalSymbol from "../presentation/MedalSymbol"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"

export default function MedalWithHintUse({
  medal,
}: Readonly<{ medal: MatchMedal }>) {
  const copy = useMapachessCopy()
  return (
    <span className="text-base font-normal">
      <MedalSymbol medal={medal} />
      <strong>{copy.shared.story.medals[medal]}</strong>
      {" · "}
      {copy.shared.medalHintUse[medal]}
    </span>
  )
}
