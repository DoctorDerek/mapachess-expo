import type { ReactNode, Ref } from "react"
import type { MatchColor } from "@mapachess/match/match-position"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"

export default function MatchIdentity({
  headingRef,
  playerColor,
  playerElo,
  opponentName,
  opponentElo,
  reactions,
}: Readonly<{
  headingRef: Ref<HTMLHeadingElement>
  playerColor: MatchColor
  playerElo: number
  opponentName: string
  opponentElo: number
  reactions: ReactNode
}>) {
  const copy = useMapachessCopy()
  return (
    <section
      aria-labelledby="opponent-band-title"
      className="text-mapachito-white relative px-3 xl:px-0"
    >
      <h1
        id="opponent-band-title"
        ref={headingRef}
        tabIndex={-1}
        className="text-center text-base leading-tight"
      >
        <strong>{copy.presentation.playerName}</strong> ·{" "}
        {copy.gameplay.elo(playerElo)}
        <span className="sr-only"> ({copy.board.colors[playerColor]})</span>
        {copy.board.versus}
        <strong>{opponentName}</strong> · {copy.gameplay.elo(opponentElo)}
        <span className="sr-only">
          {" "}
          ({copy.board.colors[playerColor === "white" ? "black" : "white"]})
        </span>
      </h1>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30">
        {reactions}
      </div>
    </section>
  )
}
