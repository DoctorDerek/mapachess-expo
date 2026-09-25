import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { createActor, waitFor } from "xstate"
import positionEvaluationMachine from "@mapachess/evaluation/position-evaluation-machine"
import matchMachine from "@mapachess/match/match-machine"
import { listLegalMatchMoves } from "@mapachess/match/match-move"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import MatchRecovery from "./MatchRecovery"

describe("actionable match recovery", () => {
  it.each(["save", "opponent-request", "opponent-illegal"] as const)(
    "retains the %s failure meaning beside its retry",
    async (failure) => {
      const position = createInitialMatchPosition({
        variant: "standard",
        chess960PositionId: null,
      })
      const move = listLegalMatchMoves(position).find(
        (candidate) => candidate.uci === "e2e4",
      )
      if (move === undefined) throw new Error("Missing legal fixture move")
      const actor = createActor(matchMachine, {
        input: {
          autoHintMode: "no-auto-hints",
          initialPosition: position,
          matchId: "recovery",
          playerColor: "white",
          durability:
            failure === "save"
              ? {
                  type: "durable",
                  persistence: {
                    persist: async () => {
                      throw new Error("private storage error")
                    },
                  },
                }
              : { type: "ephemeral" },
          opponent: {
            selectMove: async () => {
              if (failure === "opponent-illegal") return move.id
              throw new Error("private engine error")
            },
          },
        },
      }).start()
      const evaluationActor = createActor(positionEvaluationMachine, {
        input: {
          evaluator: async () => {
            throw new Error("unused fixture")
          },
        },
      }).start()
      try {
        actor.send({ type: "MATCH.MOVE_REQUESTED", moveId: move.id })
        await waitFor(actor, (snapshot) =>
          snapshot.matches(
            failure === "save" ? "persistenceFailure" : "opponentFailure",
          ),
        )
        const markup = renderToStaticMarkup(
          <MatchRecovery
            actor={actor}
            snapshot={actor.getSnapshot()}
            evaluationActor={evaluationActor}
            evaluationSnapshot={evaluationActor.getSnapshot()}
            opponentName="Chicken Stockfish"
          />,
        )
        expect(markup).toContain('role="status"')
        expect(markup).not.toContain("private")
        if (failure === "save") {
          expect(markup).toContain("local save was not verified")
          expect(markup).toContain("Retry local save")
          expect(markup).not.toContain("Saved")
        } else {
          expect(markup).toContain(
            failure === "opponent-illegal"
              ? "returned an invalid move"
              : "could not finish its turn",
          )
          expect(markup).toContain("Retry Chicken Stockfish turn")
        }
      } finally {
        actor.stop()
        evaluationActor.stop()
      }
    },
  )
})
