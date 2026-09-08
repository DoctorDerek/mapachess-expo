import { describe, expect, it } from "vitest"
import {
  chess960PlanFixture,
  MATE_IN_ONE_FEN,
  STALEMATE_FEN,
} from "../test/calibrationFixtures"
import createCalibrationChessPosition from "./calibrationChessPosition"

function positionFromFen(fen: string) {
  const game = chess960PlanFixture(fen).games[0]
  if (game === undefined) throw new Error("Fixture game is missing.")
  return createCalibrationChessPosition(game)
}

describe("canonical Chess960 calibration positions", () => {
  it.each([
    ["king and rook swap", "R4KR1", "GA", "f1g1"],
    ["king remains on g1", "R5KR", "HA", "g1h1"],
    ["rook remains on f1", "R3KR2", "FA", "e1f1"],
  ])("replays castling when the %s", (_label, rank, rights, uci) => {
    const position = positionFromFen(
      `4k3/8/8/8/8/8/8/${rank} w ${rights} - 0 1`,
    )
    expect(position.legalMoves()).toContain(uci)
    expect(position.play(uci)).toBe("O-O")
    expect(position.fen()).toBe("4k3/8/8/8/8/8/8/R4RK1 b - - 1 1")
    expect(position.turn()).toBe("black")
  })

  it("rejects castling across an attacked square without changing the position", () => {
    const position = positionFromFen("4kr2/8/8/8/8/8/8/R3K2R w HA - 0 1")
    const before = position.fen()
    expect(position.legalMoves()).not.toContain("e1h1")
    expect(() => position.play("e1h1")).toThrow("illegal")
    expect(position.fen()).toBe(before)
  })

  it("keeps promotion choices in sorted UCI order and applies underpromotion", () => {
    const position = positionFromFen("4k3/P7/8/8/8/8/8/4K3 w - - 0 1")
    const moves = position.legalMoves()
    expect(moves).toEqual([...moves].sort())
    expect(moves.filter((move) => move.startsWith("a7a8"))).toEqual([
      "a7a8b",
      "a7a8n",
      "a7a8q",
      "a7a8r",
    ])
    expect(position.play("a7a8n")).toBe("a8=N")
    expect(position.fen()).toBe("N3k3/8/8/8/8/8/8/4K3 b - - 0 1")
  })

  it("counts repetitions without an uncapturable en-passant square", () => {
    const position = positionFromFen("4k1n1/8/8/3p4/8/8/8/R3K1N1 w - d6 0 2")
    expect(position.fen().split(" ")[3]).toBe("-")
    const cycle = ["g1f3", "g8f6", "f3g1", "f6g8"]
    cycle.forEach((move) => position.play(move))
    expect(position.termination()).toBeUndefined()
    cycle.forEach((move) => position.play(move))
    expect(position.termination()).toEqual({ kind: "threefold-repetition" })
  })

  it("distinguishes the initial legal en-passant opportunity from later repetitions", () => {
    const position = positionFromFen("4k1n1/8/8/3pP3/8/8/8/R3K1N1 w - d6 0 2")
    expect(position.legalMoves()).toContain("e5d6")
    const cycle = ["g1f3", "g8f6", "f3g1", "f6g8"]
    for (let repetition = 0; repetition < 2; repetition++) {
      cycle.forEach((move) => position.play(move))
      expect(position.termination()).toBeUndefined()
    }
    cycle.forEach((move) => position.play(move))
    expect(position.termination()).toEqual({ kind: "threefold-repetition" })
  })

  it("retains the tournament fifty-move policy and gives checkmate precedence", () => {
    const draw = positionFromFen("4k3/8/8/8/8/8/8/R3K3 w - - 99 1")
    draw.play("a1a2")
    expect(draw.termination()).toEqual({ kind: "fifty-move-rule" })
    const mate = positionFromFen(MATE_IN_ONE_FEN.replace("0 1", "99 1"))
    mate.play("g6g7")
    expect(mate.termination()).toEqual({ kind: "checkmate", winner: "white" })
  })

  it("recognizes terminal positions without playing another move", () => {
    expect(positionFromFen(STALEMATE_FEN).termination()).toEqual({
      kind: "stalemate",
    })
    expect(
      positionFromFen("4k3/8/8/8/8/8/8/4K3 w - - 0 1").termination(),
    ).toEqual({ kind: "insufficient-material" })
  })
})
