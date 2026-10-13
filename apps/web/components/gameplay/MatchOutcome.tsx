import type { ReactNode } from "react"
import {
  matchConclusionText,
  type MatchConclusion,
} from "@mapachess/match/match-conclusion"
import type { MatchColor } from "@mapachess/match/match-position"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"

export default function MatchOutcome({
  conclusion,
  playerColor,
  opponentName,
  children,
}: Readonly<{
  conclusion: MatchConclusion
  playerColor: MatchColor
  opponentName: string
  children?: ReactNode
}>) {
  const copy = useMapachessCopy()
  const messages = copy.interface.matchOutcome

  return (
    <section
      aria-label={messages.matchResult}
      className="bg-mapachito-white text-mapachito-charcoal grid gap-3 rounded-lg p-4"
    >
      <h2 aria-live="polite" className="font-display text-xl font-black">
        {matchConclusionText(
          conclusion,
          playerColor,
          opponentName,
          copy.gameplay.conclusion,
        )}
      </h2>
      {children}
    </section>
  )
}
