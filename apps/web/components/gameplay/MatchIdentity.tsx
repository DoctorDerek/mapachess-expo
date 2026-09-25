import type { ReactNode, Ref } from "react"
import type { MatchColor } from "@mapachess/match/match-position"

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
        <strong>Mapachito</strong> · {playerElo}
        <span className="sr-only">
          {" "}
          ({playerColor === "white" ? "White" : "Black"})
        </span>
        {" vs. "}
        <strong>{opponentName}</strong> · {opponentElo}
        <span className="sr-only">
          {" "}
          ({playerColor === "white" ? "Black" : "White"})
        </span>
      </h1>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30">
        {reactions}
      </div>
    </section>
  )
}
