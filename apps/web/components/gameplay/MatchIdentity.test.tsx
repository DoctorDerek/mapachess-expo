import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import MatchIdentity from "./MatchIdentity"

describe("compact match identity", () => {
  it.each(["white", "black"] as const)(
    "keeps the %s hero first and full names with accessible colors",
    (playerColor) => {
      const markup = renderToStaticMarkup(
        <MatchIdentity
          headingRef={null}
          playerColor={playerColor}
          playerElo={100}
          opponentName="Dragonfly Stockfish"
          opponentElo={1200}
          reactions={null}
        />,
      )
      expect(markup).toContain("<strong>Mapachito</strong> · 100")
      expect(markup).toContain("<strong>Dragonfly Stockfish</strong> · 1200")
      expect(markup.indexOf("Mapachito")).toBeLessThan(markup.indexOf("vs."))
      expect(markup.indexOf("vs.")).toBeLessThan(markup.indexOf("Dragonfly"))
      expect(markup).toContain(
        'class="sr-only"> (' +
          (playerColor === "white" ? "White" : "Black") +
          ")</span>",
      )
      expect(markup).not.toContain("Estimated")
      expect(markup).not.toContain("truncate")
    },
  )
})
