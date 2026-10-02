import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { createActor, waitFor } from "xstate"
import positionEvaluationMachine from "@mapachess/evaluation/position-evaluation-machine"
import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
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
  ratedOpponentElo: 600,
  playerColor: "white",
  positionEvaluator: async () => {
    throw new Error("Unavailable fixture evaluation")
  },
  startingPosition,
}

describe("match composition", () => {
  it.each(["accepted", "missing", "stale"] as const)(
    "offers truthful current-ending replay with a %s receipt",
    (receipt) => {
      const conclusion = { type: "resignation", winner: "black" } as const
      const completed: DurableMatchRecord = {
        autoHintMode: "no-auto-hints",
        conclusion,
        currentFen: position.fen,
        cursor: 0,
        matchId: runtime.matchId,
        matchSeed: "0123456789abcdef0123456789abcdef",
        mode: "challenge",
        moveHintsUsed: false,
        moveIds: [],
        opponentId: runtime.opponentId,
        opponentPolicyFingerprint: "composition-fixture",
        pieceHintsUsed: false,
        playerColor: "white",
        playerEloAtStart: 100,
        recordVersion: 3,
        startingPosition,
        timeControl: { type: "untimed" },
      }
      const actor = createActor(matchMachine, {
        input: {
          autoHintMode: "no-auto-hints",
          matchId: runtime.matchId,
          opponent: runtime.opponent,
          playerColor: "white",
          durability: {
            type: "durable",
            persistence: {
              persist: async ({ requestId }) => ({
                requestId,
                type: "MATCH.MUTATION_PERSISTED",
              }),
            },
          },
          resumedState: {
            conclusion,
            moveHintsUsed: false,
            pieceHintsUsed: false,
            timeline: { cursor: 0, initialPosition: position, transitions: [] },
          },
        },
      }).start()
      const evaluationActor = createActor(positionEvaluationMachine, {
        input: { evaluator: runtime.positionEvaluator },
      }).start()
      try {
        const markup = renderToStaticMarkup(
          <WebMatch
            actor={actor}
            evaluationActor={evaluationActor}
            initiallyConcluded
            savedMatch={completed}
            acceptedReward={
              receipt === "missing"
                ? null
                : {
                    matchId: receipt === "accepted" ? runtime.matchId : "stale",
                    awardedXp: 4,
                    totalXpBefore: 0,
                    unlockedAchievementIds: [],
                    ratedElo: null,
                  }
            }
            storyProgress={{ standard: [], chess960: [] }}
            onSetupRequested={vi.fn()}
            onReplayRequested={vi.fn()}
            mode="challenge"
            playerElo={100}
            runtime={runtime}
            navigation={{ open: vi.fn(), back: vi.fn() }}
            overlays={[]}
            celebrationDismissed
            rewardsReplaySequence={0}
            onRewardsReplayRequested={vi.fn()}
            visible
          />,
        )
        expect(markup).toContain("View rewards")
        expect(markup).not.toContain("Saved locally")
        expect(markup).not.toContain("Achievement unlocked")
        expect(markup).not.toContain("<dialog")
      } finally {
        actor.stop()
        evaluationActor.stop()
      }
    },
  )
  it("keeps one board, meter and client battle allocation with all core actions", () => {
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
          navigation: { open: vi.fn(), back: vi.fn() },
          overlays: [],
          celebrationDismissed: false,
          rewardsReplaySequence: 0,
          onRewardsReplayRequested: vi.fn(),
          visible: true,
          actor,
          evaluationActor,
          initiallyConcluded: false,
          savedMatch: null,
          acceptedReward: null,
          storyProgress: { standard: [], chess960: [] },
          onSetupRequested: vi.fn(),
          onReplayRequested: vi.fn(),
          mode: "challenge",
          playerElo: 500,
          runtime,
        }),
      )
      for (const token of [
        'role="grid"',
        'role="meter"',
        "[grid-area:battle]",
        'id="opponent-band-title"',
      ]) {
        expect(markup.split(token)).toHaveLength(2)
      }
      expect(markup.indexOf('role="meter"')).toBeLessThan(
        markup.indexOf('role="grid"'),
      )
      expect(markup.indexOf('role="meter"')).toBeLessThan(
        markup.indexOf("[grid-area:battle]"),
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
          navigation: { open: vi.fn(), back: vi.fn() },
          overlays: [],
          celebrationDismissed: false,
          rewardsReplaySequence: 0,
          onRewardsReplayRequested: vi.fn(),
          visible: true,
          actor,
          evaluationActor,
          initiallyConcluded: false,
          savedMatch: null,
          acceptedReward: null,
          storyProgress: { standard: [], chess960: [] },
          onSetupRequested: vi.fn(),
          onReplayRequested: vi.fn(),
          mode: "challenge",
          playerElo: 500,
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
          navigation={{ open: vi.fn(), back: vi.fn() }}
          overlays={[]}
          celebrationDismissed={false}
          rewardsReplaySequence={0}
          onRewardsReplayRequested={vi.fn()}
          visible
          actor={actor}
          evaluationActor={evaluationActor}
          initiallyConcluded={false}
          savedMatch={null}
          acceptedReward={null}
          storyProgress={{ standard: [], chess960: [] }}
          onSetupRequested={vi.fn()}
          onReplayRequested={vi.fn()}
          mode="challenge"
          playerElo={100}
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
