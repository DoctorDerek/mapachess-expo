import type { Ref } from "react"
import type { MatchColor } from "@mapachess/match/match-position"
import {
  timeControlLabel,
  type TimeControl,
} from "@mapachess/match/time-control"
import { MATCH_MEDALS, type MatchMedal } from "@mapachess/profile/match-medal"
import MedalSymbol from "../presentation/MedalSymbol"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"

const nameEloSeparator = "\u00a0·\u00a0"

export default function MatchIdentity({
  headingRef,
  playerColor,
  playerElo,
  assistance,
  opponentName,
  opponentElo,
  timeControl,
}: Readonly<{
  headingRef: Ref<HTMLHeadingElement>
  playerColor: MatchColor
  playerElo: number
  assistance: MatchMedal
  opponentName: string
  opponentElo: number
  timeControl: TimeControl
}>) {
  const copy = useMapachessCopy()
  return (
    <section
      aria-labelledby="opponent-band-title"
      className="col-start-1 row-start-1 min-w-0 xl:col-start-2"
    >
      <h1
        id="opponent-band-title"
        ref={headingRef}
        tabIndex={-1}
        className="text-mapachito-white m-0 min-h-11 min-w-0 content-center px-1 text-center text-sm leading-none xl:text-base xl:leading-tight"
      >
        <strong>{copy.presentation.playerName}</strong>
        {nameEloSeparator}
        {copy.gameplay.elo(playerElo)}{" "}
        <span className="inline-block">
          <MedalSymbol medal={assistance} className="max-xl:size-4" />
          <span className="inline-grid align-baseline">
            {MATCH_MEDALS.map((medal) => (
              <span
                key={medal}
                aria-hidden={medal !== assistance || undefined}
                className={
                  medal === assistance
                    ? "col-start-1 row-start-1"
                    : "invisible col-start-1 row-start-1"
                }
              >
                {copy.shared.story.medals[medal]}
              </span>
            ))}
          </span>
        </span>
        <span className="sr-only"> ({copy.board.colors[playerColor]})</span>
        {copy.board.versus}
        <strong>{opponentName}</strong>
        {nameEloSeparator}
        {copy.gameplay.elo(opponentElo)}
        <span className="sr-only">
          {" "}
          ({copy.board.colors[playerColor === "white" ? "black" : "white"]})
        </span>{" "}
        <span className="inline-block">
          · {timeControlLabel(timeControl, copy.gameplay.clock)}
        </span>
      </h1>
    </section>
  )
}
