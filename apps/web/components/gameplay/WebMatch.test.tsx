import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { createActor, waitFor } from "xstate"
import positionEvaluationMachine from "@mapachess/evaluation/position-evaluation-machine"
import matchMachine from "@mapachess/match/match-machine"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import { parseDeterministicRandomSeed } from "@mapachess/stockfish/opponent-move-selection"
import type { WebMatchRuntime } from "../../lib/gameplay/webMatchRuntime"
import WebMatch from "./WebMatch"

const startingPosition = {
  variant: "standard",
  chess960PositionId: null,
} as const
const position = createInitialMatchPosition(startingPosition)
const runtime: WebMatchRuntime = {
  close: async () => undefined,
  engineIdentity: {
    author: "Fixture",
    name: "Fixture engine",
    optionNames: [],
  },
  hintAnalyst: {
    analyze: async () => {
      throw new Error("Unavailable fixture analysis")
    },
  },
  matchId: "match/composition",
  matchSeed: parseDeterministicRandomSeed(
    "0123456789abcdef0123456789abcdef",
    "composition fixture",
  ),
  opponent: {
    selectMove: async () => {
      throw new Error("Unavailable fixture opponent")
    },
  },
  opponentId: "dog-stockfish",
  opponentPolicyFingerprint: "composition-fixture",
  opponentTargetElo: 600,
  playerColor: "white",
  positionEvaluator: async () => {
    throw new Error("Unavailable fixture evaluation")
  },
  startingPosition,
}

describe("match composition", () => {
  it("keeps one board, meter and battle in reading order with all core actions", () => {
    const actor = createActor(matchMachine, {
      input: {
        autoHintMode: "no-auto-hints",
        durability: { type: "ephemeral" },
        initialPosition: position,
        matchId: runtime.matchId,
        opponent: runtime.opponent,
        playerColor: "white",
        hintAnalyst: runtime.hintAnalyst,
      },
    }).start()
    const evaluationActor = createActor(positionEvaluationMachine, {
      input: { evaluator: runtime.positionEvaluator },
    }).start()
    try {
      const markup = renderToStaticMarkup(
        createElement(WebMatch, {
          actor,
          evaluationActor,
          mode: "challenge",
          playerEloAtStart: 500,
          runtime,
        }),
      )
      for (const token of [
        'role="grid"',
        'role="meter"',
        'id="reactive-battle-stage-title"',
        'id="opponent-band-title"',
      ]) {
        expect(markup.split(token)).toHaveLength(2)
      }
      expect(markup.indexOf('role="meter"')).toBeLessThan(
        markup.indexOf('role="grid"'),
      )
      expect(markup.indexOf('role="meter"')).toBeLessThan(
        markup.indexOf('id="reactive-battle-stage-title"'),
      )
      expect(markup).not.toContain('aria-label="Match result"')
      for (const label of [
        "Dog Stockfish",
        "Mapachito coach",
        "Show Piece Hints",
        "vs.",
        "Offer Draw",
        "Resign",
        "Undo",
        "Redo",
        "Move History",
        "Untimed",
      ]) {
        expect(markup).toContain(label)
      }
    } finally {
      actor.stop()
      evaluationActor.stop()
    }
  })

  it("keeps evaluation recovery exposed in the compact controls", async () => {
    const actor = createActor(matchMachine, {
      input: {
        autoHintMode: "no-auto-hints",
        durability: { type: "ephemeral" },
        initialPosition: position,
        matchId: runtime.matchId,
        opponent: runtime.opponent,
        playerColor: "white",
      },
    }).start()
    const evaluationActor = createActor(positionEvaluationMachine, {
      input: { evaluator: runtime.positionEvaluator },
    }).start()
    try {
      evaluationActor.send({
        type: "EVALUATION.POSITION_REQUESTED",
        request: { position, requestId: "composition/evaluation" },
      })
      await waitFor(evaluationActor, (snapshot) => snapshot.matches("failure"))
      const markup = renderToStaticMarkup(
        createElement(WebMatch, {
          actor,
          evaluationActor,
          mode: "challenge",
          playerEloAtStart: 500,
          runtime,
        }),
      )
      expect(markup).toContain("Retry Evaluation")
      expect(markup.indexOf('aria-label="Match menu"')).toBeLessThan(
        markup.indexOf("Retry Evaluation"),
      )
      expect(markup).not.toContain("Your move.")
      expect(markup).not.toContain("is choosing a move")
    } finally {
      actor.stop()
      evaluationActor.stop()
    }
  })

  it("keeps declined draw feedback inside Menu beside Offer Draw", () => {
    const actor = createActor(matchMachine, {
      input: {
        autoHintMode: "no-auto-hints",
        durability: { type: "ephemeral" },
        initialPosition: position,
        matchId: runtime.matchId,
        opponent: runtime.opponent,
        playerColor: "white",
      },
    }).start()
    const evaluationActor = createActor(positionEvaluationMachine, {
      input: { evaluator: runtime.positionEvaluator },
    }).start()
    try {
      actor.send({
        type: "MATCH.DRAW_OFFER_REQUESTED",
        decision: { outcome: "rejected", positionFen: position.fen },
      })
      const markup = renderToStaticMarkup(
        <WebMatch
          actor={actor}
          evaluationActor={evaluationActor}
          mode="challenge"
          playerEloAtStart={100}
          runtime={runtime}
        />,
      )
      const drawAction = markup.indexOf("Offer Draw")
      const declined = markup.indexOf("declines the draw.")
      expect(declined).toBeGreaterThan(drawAction)
      expect(declined).toBeLessThan(markup.indexOf("Resign"))
      expect(markup).not.toContain('aria-label="Match result"')
    } finally {
      actor.stop()
      evaluationActor.stop()
    }
  })
})
