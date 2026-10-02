import {
  MATCH_MEDAL_HINT_USE,
  type MatchMedal,
} from "@mapachess/profile/match-medal"
import { STORY_PROGRESS_COPY } from "@mapachess/profile/story-progress"
import MedalSymbol from "../presentation/MedalSymbol"

export default function MedalWithHintUse({
  medal,
}: Readonly<{ medal: MatchMedal }>) {
  return (
    <span className="text-base font-normal">
      <MedalSymbol medal={medal} />
      <strong>{STORY_PROGRESS_COPY.medals[medal]}</strong>
      {" · "}
      {MATCH_MEDAL_HINT_USE[medal]}
    </span>
  )
}
