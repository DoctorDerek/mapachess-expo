import type { ReactNode } from "react"
import {
  matchConclusionText,
  type MatchConclusion,
} from "@mapachess/match/match-conclusion"
import type { MatchColor } from "@mapachess/match/match-position"

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
  return (
    <section
      aria-label="Match result"
      className="bg-mapachito-white text-mapachito-charcoal grid gap-3 rounded-lg p-4"
    >
      <h2 aria-live="polite" className="font-display text-xl font-black">
        {matchConclusionText(conclusion, playerColor, opponentName)}
      </h2>
      {children}
    </section>
  )
}
