import type { ReactNode, Ref } from "react"
import type { MatchColor } from "@mapachess/match/match-position"
import {
  timeControlLabel,
  type TimeControl,
} from "@mapachess/match/time-control"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"

export default function MatchIdentity({
  headingRef,
  playerColor,
  playerElo,
  opponentName,
  opponentElo,
  playerClock,
  opponentClock,
  timeControl,
}: Readonly<{
  headingRef: Ref<HTMLHeadingElement>
  playerColor: MatchColor
  playerElo: number
  opponentName: string
  opponentElo: number
  playerClock?: ReactNode
  opponentClock?: ReactNode
  timeControl: TimeControl
}>) {
  const copy = useMapachessCopy()
  return (
    <section
      aria-labelledby="opponent-band-title"
      className="text-mapachito-white px-3 xl:px-0"
    >
      <h1
        id="opponent-band-title"
        ref={headingRef}
        tabIndex={-1}
        className="text-center text-base leading-tight"
      >
        <span className="inline-block">
          <strong>{copy.presentation.playerName}</strong> ·{" "}
          {copy.gameplay.elo(playerElo)}
          <span className="sr-only"> ({copy.board.colors[playerColor]})</span>
          {playerClock}
        </span>
        {copy.board.versus}
        <span className="inline-block">
          <strong>{opponentName}</strong> · {copy.gameplay.elo(opponentElo)}
          <span className="sr-only">
            {" "}
            ({copy.board.colors[playerColor === "white" ? "black" : "white"]})
          </span>
          {opponentClock}
        </span>
        <span className="inline-block">
          {" "}
          · {timeControlLabel(timeControl, copy.gameplay.clock)}
        </span>
      </h1>
    </section>
  )
}
