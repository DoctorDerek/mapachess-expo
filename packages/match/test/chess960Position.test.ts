import { describe, expect, it } from "vitest"
import {
  CHESS960_POSITION_COUNT,
  createChess960BackRank,
  createChess960InitialFen,
  parseChess960PositionId,
} from "../src/chess960Position"
import { createInitialMatchPosition } from "../src/matchPosition"
import { requireChess960PositionId } from "./matchTestUtils"

describe("Chess960 starting positions", () => {
  it("accepts only integer position identifiers from zero through 959", () => {
    expect(parseChess960PositionId(0)).toMatchObject({ ok: true })
    expect(parseChess960PositionId(959)).toMatchObject({ ok: true })

    for (const received of [-1, 960, 1.5, "518", null]) {
      expect(parseChess960PositionId(received)).toEqual({
        error: {
          received,
          type: "MATCH.CHESS960_POSITION_ID_INVALID",
        },
        ok: false,
      })
    }
  })

  it("maps Scharnagl position 518 to the orthodox back rank", () => {
    const positionId = requireChess960PositionId(518)

    expect(createChess960BackRank(positionId)).toBe("RNBQKBNR")
    expect(createChess960InitialFen(positionId)).toContain(
      "RNBQKBNR w HAha - 0 1",
    )
  })

  it("generates every unique legal Chess960 back rank", () => {
    const backRanks = new Set<string>()

    for (let value = 0; value < CHESS960_POSITION_COUNT; value += 1) {
      const positionId = requireChess960PositionId(value)
      const backRank = createChess960BackRank(positionId)
      const bishops = [...backRank].flatMap((piece, file) =>
        piece === "B" ? [file] : [],
      )
      const kingFile = backRank.indexOf("K")
      const rookFiles = [...backRank].flatMap((piece, file) =>
        piece === "R" ? [file] : [],
      )
      const [firstBishopFile, secondBishopFile] = bishops
      const [queenSideRookFile, kingSideRookFile] = rookFiles
      if (
        firstBishopFile === undefined ||
        secondBishopFile === undefined ||
        queenSideRookFile === undefined ||
        kingSideRookFile === undefined
      ) {
        throw new Error(`Incomplete Chess960 back rank ${backRank}`)
      }

      expect(backRank).toHaveLength(8)
      expect([...backRank].sort().join("")).toBe("BBKNNQRR")
      expect(firstBishopFile % 2).not.toBe(secondBishopFile % 2)
      expect(queenSideRookFile).toBeLessThan(kingFile)
      expect(kingFile).toBeLessThan(kingSideRookFile)
      expect(
        createInitialMatchPosition({
          chess960PositionId: positionId,
          variant: "chess960",
        }),
      ).toMatchObject({
        chess960PositionId: positionId,
        status: { type: "playing" },
        turn: "white",
        variant: "chess960",
      })
      backRanks.add(backRank)
    }

    expect(backRanks.size).toBe(CHESS960_POSITION_COUNT)
  })
})
