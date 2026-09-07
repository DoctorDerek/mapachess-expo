import { Chess } from "chess.js"
import {
  applyMatchMove,
  listLegalMatchMoves,
} from "@mapachess/match/match-move"
import { reconstructMatchPosition } from "@mapachess/match/match-position"
import type {
  CalibrationColor,
  CalibrationCompletedTermination,
} from "./calibrationGameTypes.js"
import type { CalibrationGame } from "./calibrationPlan.js"

export type CalibrationChessPosition = Readonly<{
  fen: () => string
  legalMoves: () => readonly string[]
  play: (uci: string) => string
  termination: () => CalibrationCompletedTermination | undefined
  turn: () => CalibrationColor
}>

function standardPosition(fen: string): CalibrationChessPosition {
  const chess = new Chess(fen)
  return {
    fen: () => chess.fen(),
    turn: () => (chess.turn() === "w" ? "white" : "black"),
    legalMoves: () =>
      chess
        .moves({ verbose: true })
        .map((move) => move.from + move.to + (move.promotion ?? ""))
        .sort(),
    play: (uci) =>
      chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        ...(uci.length === 5 ? { promotion: uci.slice(4) } : {}),
      }).san,
    termination: () => {
      if (chess.isCheckmate()) {
        return {
          kind: "checkmate",
          winner: chess.turn() === "w" ? "black" : "white",
        }
      }
      if (chess.isStalemate()) return { kind: "stalemate" }
      if (chess.isThreefoldRepetition()) {
        return { kind: "threefold-repetition" }
      }
      if (chess.isDrawByFiftyMoves()) return { kind: "fifty-move-rule" }
      if (chess.isInsufficientMaterial()) {
        return { kind: "insufficient-material" }
      }
      if (chess.isGameOver()) {
        throw new Error("chess.js reported an unclassified terminal position.")
      }
      return undefined
    },
  }
}

function repetitionKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ")
}

function chess960Position(
  game: Extract<CalibrationGame, { variant: "chess960" }>,
): CalibrationChessPosition {
  const initial = reconstructMatchPosition(
    {
      variant: "chess960",
      chess960PositionId: game.chess960PositionId,
    },
    game.fen,
  )
  if (!initial.ok) {
    throw new TypeError("Calibration Chess960 position is invalid.")
  }
  let position = initial.position
  const repetitions = new Map([[repetitionKey(position.fen), 1]])

  return {
    fen: () => position.fen,
    turn: () => position.turn,
    legalMoves: () =>
      listLegalMatchMoves(position)
        .map((move) => move.uci)
        .sort(),
    play: (uci) => {
      const move = listLegalMatchMoves(position).find(
        (candidate) => candidate.uci === uci,
      )
      if (move === undefined) {
        throw new TypeError("Calibration Chess960 move is illegal: " + uci)
      }
      const applied = applyMatchMove(position, move.id)
      if (!applied.ok) {
        throw new Error("Canonical calibration move could not be applied.")
      }
      position = applied.transition.after
      const key = repetitionKey(position.fen)
      repetitions.set(key, (repetitions.get(key) ?? 0) + 1)
      return applied.transition.move.san
    },
    termination: () => {
      if (position.status.type === "checkmate") {
        return { kind: "checkmate", winner: position.status.winner }
      }
      if (position.status.type === "stalemate") return { kind: "stalemate" }
      if ((repetitions.get(repetitionKey(position.fen)) ?? 0) >= 3) {
        return { kind: "threefold-repetition" }
      }
      if (Number(position.fen.split(" ")[4]) >= 100) {
        return { kind: "fifty-move-rule" }
      }
      if (position.status.type === "insufficient-material") {
        return { kind: "insufficient-material" }
      }
      return undefined
    },
  }
}

export default function createCalibrationChessPosition(
  game: CalibrationGame,
): CalibrationChessPosition {
  return game.variant === "standard"
    ? standardPosition(game.fen)
    : chess960Position(game)
}
