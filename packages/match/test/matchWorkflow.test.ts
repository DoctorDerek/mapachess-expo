import { describe, expect, it } from "vitest"
import type { MatchMachineInput } from "../src/matchMachineTypes"
import { parseMatchMoveId } from "../src/matchMove"
import { createInitialMatchPosition } from "../src/matchPosition"
import { createMatchTimeline } from "../src/matchTimeline"
import {
  createInitialContext,
  moveIsLegal,
  pendingAcceptedHintsMutation,
  pendingAutoHintModeMutation,
  pendingConclusionMutation,
  pendingMoveHintsMutation,
  pendingPositionMutation,
  requireAppliedTimelineMove,
  requireHintAnalyst,
  requireMatchPersistence,
  requirePendingMutation,
} from "../src/matchWorkflow"
import { createHintResult, requireLegalMove } from "./matchTestUtils"

const position = createInitialMatchPosition({
  variant: "standard",
  chess960PositionId: null,
})
const input: MatchMachineInput = {
  autoHintMode: "no-auto-hints",
  matchId: "workflow-boundary",
  initialPosition: position,
  durability: { type: "ephemeral" },
  playerColor: "white",
  opponent: {
    selectMove: async () => {
      throw new Error("Boundary validation must not search.")
    },
  },
}

describe("canonical match construction and mutation boundaries", () => {
  it.each(["", " padded", "padded "])(
    "rejects invalid match identity %j before enabling a game",
    (matchId) => {
      expect(() => createInitialContext({ ...input, matchId })).toThrow(
        "nonempty and trimmed",
      )
    },
  )

  it("refuses incomplete or contradictory resumed state instead of inventing clocks, hint use, or conclusions", () => {
    const context = createInitialContext(input)
    const resumed = {
      timeline: context.timeline,
      conclusion: null,
      pieceHintsUsed: false,
      moveHintsUsed: false,
    }
    const durable: MatchMachineInput = {
      autoHintMode: input.autoHintMode,
      matchId: input.matchId,
      playerColor: input.playerColor,
      opponent: input.opponent,
      durability: {
        type: "durable",
        persistence: {
          persist: async () => {
            throw new Error("Invalid resumed state cannot persist.")
          },
        },
      },
      resumedState: resumed,
    }
    expect(() =>
      createInitialContext({
        ...durable,
        timeControl: { type: "fischer", baseSeconds: 60, incrementSeconds: 0 },
      }),
    ).toThrow("recorded clocks")
    expect(() =>
      createInitialContext({
        ...durable,
        resumedState: { ...resumed, moveHintsUsed: true },
      }),
    ).toThrow("requires Piece Hint")
    expect(() =>
      createInitialContext({
        ...durable,
        resumedState: {
          ...resumed,
          conclusion: { type: "checkmate", winner: "white" },
        },
      }),
    ).toThrow("retained branch")
  })

  it("checks unavailable capabilities and illegal canonical moves before dispatching work", () => {
    const context = createInitialContext(input)
    expect(() => requireHintAnalyst(context)).toThrow(
      "without an injected analyst",
    )
    expect(() => requireMatchPersistence(context)).toThrow(
      "requires persistence",
    )
    expect(() => requirePendingMutation(context)).toThrow("requires a pending")
    const illegal = parseMatchMoveId("e2e5")
    if (!illegal.ok)
      throw new Error(
        "The illegal move must still be a syntactically valid UCI ID.",
      )
    expect(moveIsLegal(context.timeline, illegal.moveId)).toBe(false)
    expect(() =>
      requireAppliedTimelineMove(context.timeline, illegal.moveId),
    ).toThrow("became illegal")
    expect(() =>
      pendingConclusionMutation(context, {
        type: "checkmate",
        winner: "white",
      }),
    ).toThrow("does not match")
    expect(context.timeline).toEqual(createMatchTimeline(position))
  })

  it("lets the deadline override late moves, hint results, and hint-mode changes before any of them can be accepted", () => {
    const initial = createInitialContext({
      ...input,
      timeControl: { type: "fischer", baseSeconds: 60, incrementSeconds: 0 },
      monotonicClock: { now: () => 60000 },
    })
    if (initial.clock === null)
      throw new Error("The timed fixture must have a clock.")
    const expired = {
      ...initial,
      clock: { ...initial.clock, startedAt: 0, paused: false },
    }
    const hints = createHintResult({
      position,
      playerColor: "white",
      requestId: "late-hints",
    })
    const moved = requireAppliedTimelineMove(
      initial.timeline,
      requireLegalMove(position, "e2e4").id,
    )
    for (const mutation of [
      pendingAcceptedHintsMutation(expired, hints),
      pendingMoveHintsMutation(expired),
      pendingAutoHintModeMutation(expired, "auto-move-hints", null),
      pendingPositionMutation(expired, moved),
      pendingConclusionMutation(expired, { type: "draw-agreement" }),
    ]) {
      expect(mutation.conclusion).toEqual({ type: "timeout", winner: "black" })
      expect(mutation.timeline.cursor).toBe(0)
      expect(mutation.moveHintsUsed).toBe(false)
      expect(mutation.pieceHintsUsed).toBe(false)
    }
  })
})
