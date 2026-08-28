import { describe, expect, it } from "vitest"
import { createActor } from "xstate"
import matchMachine, {
  selectCanRedo,
  selectCanUndo,
  selectIsOpponentTurn,
  selectIsPlayerTurn,
  selectMatchPosition,
  selectMatchTimeline,
} from "../src/matchMachine"
import {
  createInitialMatchPosition,
  reconstructMatchPosition,
} from "../src/matchPosition"
import { requireLegalMove } from "./matchTestUtils"

describe("scoped XState match flow", () => {
  it("enforces player and opponent turn ownership", () => {
    const actor = createActor(matchMachine, {
      input: {
        initialPosition: createInitialMatchPosition({
          chess960PositionId: null,
          variant: "standard",
        }),
        playerColor: "white",
      },
    }).start()

    expect(selectIsPlayerTurn(actor.getSnapshot())).toBe(true)
    const e4 = requireLegalMove(
      selectMatchPosition(actor.getSnapshot()),
      "e2e4",
    )
    actor.send({
      moveId: e4.id,
      requestedBy: "player",
      type: "MATCH.MOVE_REQUESTED",
    })

    expect(selectIsOpponentTurn(actor.getSnapshot())).toBe(true)
    const e5 = requireLegalMove(
      selectMatchPosition(actor.getSnapshot()),
      "e7e5",
    )
    actor.send({
      moveId: e5.id,
      requestedBy: "player",
      type: "MATCH.MOVE_REQUESTED",
    })
    expect(selectMatchTimeline(actor.getSnapshot()).cursor).toBe(1)

    actor.send({
      moveId: e5.id,
      requestedBy: "opponent",
      type: "MATCH.MOVE_REQUESTED",
    })
    expect(selectMatchTimeline(actor.getSnapshot()).cursor).toBe(2)
    expect(selectIsPlayerTurn(actor.getSnapshot())).toBe(true)
    actor.stop()
  })

  it("moves between playing and complete without duplicating terminal state", () => {
    const actor = createActor(matchMachine, {
      input: {
        initialPosition: createInitialMatchPosition({
          chess960PositionId: null,
          variant: "standard",
        }),
        playerColor: "white",
      },
    }).start()
    const play = (uci: string, requestedBy: "player" | "opponent") => {
      const move = requireLegalMove(
        selectMatchPosition(actor.getSnapshot()),
        uci,
      )
      actor.send({
        moveId: move.id,
        requestedBy,
        type: "MATCH.MOVE_REQUESTED",
      })
    }

    play("f2f3", "player")
    play("e7e5", "opponent")
    play("g2g4", "player")
    play("d8h4", "opponent")

    expect(actor.getSnapshot().matches("complete")).toBe(true)
    expect(selectMatchPosition(actor.getSnapshot()).status).toEqual({
      type: "checkmate",
      winner: "black",
    })
    const terminalPosition = selectMatchPosition(actor.getSnapshot())
    expect(selectCanUndo(actor.getSnapshot())).toBe(true)

    actor.send({ type: "MATCH.UNDO_REQUESTED" })
    expect(actor.getSnapshot().matches("playing")).toBe(true)
    expect(selectCanRedo(actor.getSnapshot())).toBe(true)

    actor.send({ type: "MATCH.REDO_REQUESTED" })
    expect(actor.getSnapshot().matches("complete")).toBe(true)
    expect(selectMatchPosition(actor.getSnapshot())).toBe(terminalPosition)
    actor.stop()
  })

  it("starts a reconstructed terminal position in complete", () => {
    const result = reconstructMatchPosition(
      { chess960PositionId: null, variant: "standard" },
      "7k/5K2/6Q1/8/8/8/8/8 b - - 0 1",
    )
    if (!result.ok) throw new Error("Invalid terminal test position")
    const actor = createActor(matchMachine, {
      input: {
        initialPosition: result.position,
        playerColor: "black",
      },
    }).start()

    expect(actor.getSnapshot().matches("complete")).toBe(true)
    expect(selectCanUndo(actor.getSnapshot())).toBe(false)
    expect(selectCanRedo(actor.getSnapshot())).toBe(false)
    actor.stop()
  })
})
