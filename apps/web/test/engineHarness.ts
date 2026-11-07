import {
  applyMatchMove,
  listLegalMatchMoves,
} from "@mapachess/match/match-move"
import { reconstructMatchPosition } from "@mapachess/match/match-position"
import type { StockfishUciSession } from "@mapachess/stockfish/uci-session"

export type EngineScenario = {
  failedWorker: string | null
  replies: string[]
  bootFailure: boolean
  closes: number
}

export default function engineHarness(
  scenario: EngineScenario,
  workerName: string,
): StockfishUciSession {
  let closed = false
  return {
    async boot() {
      if (scenario.bootFailure) {
        scenario.bootFailure = false
        throw new Error("Engine boot interrupted")
      }
      return {
        name: "Controlled legal-move engine",
        author: "Owned integration fixture",
        optionNames: [],
      }
    },
    async close() {
      if (!closed) {
        scenario.closes++
        closed = true
      }
    },
    state: () => (closed ? "closed" : "ready"),
    async search(request, signal, refine) {
      signal?.throwIfAborted()
      if (
        scenario.failedWorker !== null &&
        workerName.includes(scenario.failedWorker)
      ) {
        scenario.failedWorker = null
        throw new Error("Engine search interrupted")
      }
      const position = reconstructMatchPosition(
        { variant: "standard", chess960PositionId: null },
        request.position.fen,
      )
      if (!position.ok)
        throw new Error("The fixture requires legal chess rules.")
      let current = position.position
      for (const uci of request.position.moves) {
        const move = listLegalMatchMoves(current).find(
          (candidate) => candidate.uci === uci,
        )
        if (move === undefined)
          throw new Error("The fixture must receive legal retained moves.")
        const applied = applyMatchMove(current, move.id)
        if (!applied.ok)
          throw new Error("The fixture failed to apply a legal retained move.")
        current = applied.transition.after
      }
      const moves = listLegalMatchMoves(current).map((move) => move.uci)
      const requestedReply = workerName.includes("opponent")
        ? scenario.replies.shift()
        : undefined
      if (requestedReply !== undefined && !moves.includes(requestedReply))
        throw new Error(`The scripted reply ${requestedReply} must be legal.`)
      const score = { kind: "centipawns", bound: "exact", value: 0 } as const
      refine?.({
        requestId: request.requestId,
        position: request.position,
        principalVariationRank: 1,
        depth: 1,
        score,
      })
      return {
        requestId: request.requestId,
        bestMove: requestedReply ?? moves[0] ?? null,
        informationLineCount: 1,
        latestInformation: { line: "info depth 1 score cp 0", score },
        principalVariations: moves.map((move, index) => ({
          rank: index + 1,
          moves: [move],
          score,
        })),
      }
    },
  }
}
