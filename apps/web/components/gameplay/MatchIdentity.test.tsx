import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import MatchIdentity from "./MatchIdentity"

describe("compact match identity", () => {
  it.each([
    { playerColor: "white", playerElo: 445.21238123123, expectedElo: 445 },
    { playerColor: "black", playerElo: 445.21238123123, expectedElo: 445 },
    { playerColor: "white", playerElo: 445.5, expectedElo: 446 },
    { playerColor: "black", playerElo: 445.999999, expectedElo: 446 },
  ] as const)(
    "rounds $playerColor Elo $playerElo to $expectedElo only for display",
    ({ playerColor, playerElo, expectedElo }) => {
      const markup = renderToStaticMarkup(
        <MatchIdentity
          headingRef={null}
          playerColor={playerColor}
          playerElo={playerElo}
          opponentName="Dragonfly Stockfish"
          opponentElo={1200.61238123123}
          reactions={null}
        />,
      )
      expect(markup).toContain(`<strong>Mapachito</strong> · ${expectedElo}`)
      expect(markup).toContain("<strong>Dragonfly Stockfish</strong> · 1201")
      expect(markup).not.toContain(String(playerElo))
      expect(markup).not.toContain("1200.61238123123")
    },
  )

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
