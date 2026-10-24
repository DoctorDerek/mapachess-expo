import type { ReactNode, Ref } from "react"
import type { MatchColor } from "@mapachess/match/match-position"
import {
  timeControlLabel,
  type TimeControl,
} from "@mapachess/match/time-control"
import type { MatchMedal } from "@mapachess/profile/match-medal"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"

export default function MatchIdentity({
  headingRef,
  playerColor,
  playerElo,
  assistance,
  opponentName,
  opponentElo,
  playerClock,
  opponentClock,
  timeControl,
}: Readonly<{
  headingRef: Ref<HTMLHeadingElement>
  playerColor: MatchColor
  playerElo: number
  assistance: MatchMedal
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
      className="text-mapachito-white contents"
    >
      {playerClock || opponentClock ? (
        <div className="mb-2 grid w-full max-w-(--playing-width) min-w-0 grid-cols-2 gap-2 justify-self-center text-center [grid-area:clocks]">
          <div>{playerClock}</div>
          <div>{opponentClock}</div>
        </div>
      ) : null}
      <h1
        id="opponent-band-title"
        ref={headingRef}
        tabIndex={-1}
        className="mb-2 w-full max-w-(--playing-width) min-w-0 justify-self-center px-3 text-center text-base leading-tight [grid-area:identity] xl:px-0"
      >
        <span className="inline-block">
          <strong>{copy.presentation.playerName}</strong> ·{" "}
          {copy.gameplay.elo(playerElo)}
          {" · "}
          {copy.shared.story.medals[assistance]}
          <span className="sr-only"> ({copy.board.colors[playerColor]})</span>
        </span>
        {copy.board.versus}
        <span className="inline-block">
          <strong>{opponentName}</strong> · {copy.gameplay.elo(opponentElo)}
          <span className="sr-only">
            {" "}
            ({copy.board.colors[playerColor === "white" ? "black" : "white"]})
          </span>
        </span>
        <span className="inline-block">
          {" "}
          · {timeControlLabel(timeControl, copy.gameplay.clock)}
        </span>
      </h1>
    </section>
  )
}
