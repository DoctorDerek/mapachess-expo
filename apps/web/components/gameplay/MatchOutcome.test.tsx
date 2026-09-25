import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import MatchOutcome from "./MatchOutcome"

describe("canonical result presentation", () => {
  it("announces one result without claiming an unverified save or Story reward", () => {
    const markup = renderToStaticMarkup(
      <MatchOutcome
        conclusion={{ type: "checkmate", winner: "black" }}
        playerColor="black"
        opponentName="Chicken Stockfish"
      />,
    )
    expect(markup).toContain("You won!")
    expect(markup).toContain('aria-live="polite"')
    expect(markup).not.toContain("Checkmate —")
    expect(markup).not.toContain("Saved")
    expect(markup).not.toContain("medal")
  })
  it("keeps saved Story content below the canonical outcome", () => {
    const markup = renderToStaticMarkup(
      <MatchOutcome
        conclusion={{ type: "stalemate" }}
        playerColor="white"
        opponentName="Chicken Stockfish"
      >
        <p>Verified Story result</p>
      </MatchOutcome>,
    )
    expect(markup.indexOf("Draw by stalemate.")).toBeLessThan(
      markup.indexOf("Verified Story result"),
    )
  })
})
