import { createActor, waitFor } from "xstate"
import positionEvaluationMachine from "@mapachess/evaluation/position-evaluation-machine"
import {
  evaluatePositionWithStockfish,
  type PositionEvaluationRefinement,
  type PositionEvaluationResult,
} from "@mapachess/evaluation/position-evaluator"
import { parseChess960PositionId } from "@mapachess/match/chess960-position"
import {
  applyMatchMove,
  listLegalMatchMoves,
} from "@mapachess/match/match-move"
import {
  createInitialMatchPosition,
  type MatchColor,
} from "@mapachess/match/match-position"
import type { MatchVariant } from "@mapachess/match/match-variant"
import type {
  StockfishEngineSearchResult,
  StockfishEngineSession,
  StockfishSearchRequest,
} from "@mapachess/stockfish/engine-session"
import { WEB_OPPONENT_ENGINE_CONFIGURATION } from "@mapachess/stockfish/web-opponent-policy"
import createWebStockfishSession from "../lib/stockfish/createWebStockfishSession"

export type EvaluationBrowserSample = Readonly<{
  variant: MatchVariant
  turn: MatchColor
  queries: readonly StockfishSearchRequest[]
  refinements: readonly Readonly<{
    value: PositionEvaluationRefinement
    elapsedMilliseconds: number
    finalResult: PositionEvaluationResult | null
  }>[]
  result: PositionEvaluationResult
  engineResult: StockfishEngineSearchResult
  elapsedMilliseconds: number
}>

export default async function runEvaluationBrowserProof(): Promise<
  readonly EvaluationBrowserSample[]
> {
  const parsed = parseChess960PositionId(0)
  if (!parsed.ok) throw new Error("Expected a valid Chess960 proof position.")
  const samples: EvaluationBrowserSample[] = []
  for (const variant of ["standard", "chess960"] as const) {
    const session = createWebStockfishSession({
      ...WEB_OPPONENT_ENGINE_CONFIGURATION,
      variant,
    })
    try {
      await session.boot()
      const initial = createInitialMatchPosition(
        variant === "standard"
          ? { variant, chess960PositionId: null }
          : { variant, chess960PositionId: parsed.positionId },
      )
      const move = listLegalMatchMoves(initial)[0]
      if (move === undefined) throw new Error("Expected an initial legal move.")
      const moved = applyMatchMove(initial, move.id)
      if (!moved.ok) throw new Error("Expected the initial move to apply.")
      for (const position of [initial, moved.transition.after]) {
        const queries: StockfishSearchRequest[] = []
        const refinements: Array<
          EvaluationBrowserSample["refinements"][number]
        > = []
        let engineResult: StockfishEngineSearchResult | undefined
        const observed: StockfishEngineSession = {
          ...session,
          search: async (request, signal, onRefinement) => {
            queries.push(request)
            engineResult = await session.search(request, signal, onRefinement)
            return engineResult
          },
        }
        const actor = createActor(positionEvaluationMachine, {
          input: {
            evaluator: (request, signal, publish) =>
              evaluatePositionWithStockfish(observed, request, signal, publish),
          },
        })
        const started = performance.now()
        let previousRefinement: PositionEvaluationRefinement | null = null
        const subscription = actor.subscribe((snapshot) => {
          const refinement = snapshot.context.refinement
          if (refinement !== null && refinement !== previousRefinement) {
            refinements.push({
              value: refinement,
              elapsedMilliseconds: performance.now() - started,
              finalResult: snapshot.context.result,
            })
          }
          previousRefinement = refinement
        })
        try {
          actor.start()
          actor.send({
            type: "EVALUATION.POSITION_REQUESTED",
            request: {
              position,
              requestId: `live-proof/${variant}/${position.turn}`,
            },
          })
          const completed = await waitFor(
            actor,
            (snapshot) =>
              snapshot.matches("ready") || snapshot.matches("failure"),
          )
          const result = completed.context.result
          if (result === null || engineResult === undefined)
            throw new Error("Real Worker evaluation did not complete.")
          samples.push({
            variant,
            turn: position.turn,
            queries,
            refinements,
            result,
            engineResult,
            elapsedMilliseconds: performance.now() - started,
          })
        } finally {
          subscription.unsubscribe()
          actor.stop()
        }
      }
    } finally {
      await session.close()
    }
  }
  return samples
}
