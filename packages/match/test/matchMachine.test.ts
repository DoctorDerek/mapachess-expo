import { describe, expect, it, vi } from "vitest"
import { createActor, waitFor } from "xstate"
import matchMachine, {
  selectCanRedo,
  selectCanUndo,
  selectIsOpponentThinking,
  selectIsOpponentTurn,
  selectIsPlayerTurn,
  selectMatchPosition,
  selectMatchTimeline,
  selectOpponentFailure,
  type MatchOpponent,
  type MatchOpponentRequest,
} from "../src/matchMachine"
import type { MatchMoveId } from "../src/matchMove"
import {
  createInitialMatchPosition,
  reconstructMatchPosition,
} from "../src/matchPosition"
import { requireLegalMove } from "./matchTestUtils"

type ScriptedMove = string | Error

const createScriptedOpponent = (
  scriptedMoves: readonly ScriptedMove[],
): Readonly<{
  opponent: MatchOpponent
  requests: MatchOpponentRequest[]
}> => {
  const remainingMoves = [...scriptedMoves]
  const requests: MatchOpponentRequest[] = []
  const opponent: MatchOpponent = {
    selectMove: async (request) => {
      requests.push(request)
      const scriptedMove = remainingMoves.shift()
      if (scriptedMove === undefined) {
        throw new Error("The scripted opponent has no remaining move.")
      }
      if (scriptedMove instanceof Error) throw scriptedMove

      const move = request.legalMoves.find(
        (legalMove) => legalMove.uci === scriptedMove,
      )
      if (move === undefined) return scriptedMove as MatchMoveId

      return move.id
    },
  }

  return { opponent, requests }
}

const standardInitialPosition = () =>
  createInitialMatchPosition({
    chess960PositionId: null,
    variant: "standard",
  })

describe("scoped XState match flow", () => {
  it("owns a complete player and automatic opponent turn", async () => {
    const scripted = createScriptedOpponent(["e7e5"])
    const actor = createActor(matchMachine, {
      input: {
        initialPosition: standardInitialPosition(),
        matchId: "standard-story-chicken-1",
        opponent: scripted.opponent,
        playerColor: "white",
      },
    }).start()

    expect(selectIsPlayerTurn(actor.getSnapshot())).toBe(true)
    const e4 = requireLegalMove(
      selectMatchPosition(actor.getSnapshot()),
      "e2e4",
    )
    actor.send({ moveId: e4.id, type: "MATCH.MOVE_REQUESTED" })

    await waitFor(actor, selectIsPlayerTurn)

    expect(selectMatchTimeline(actor.getSnapshot()).cursor).toBe(2)
    expect(selectMatchPosition(actor.getSnapshot()).turn).toBe("white")
    expect(scripted.requests).toHaveLength(1)
    expect(scripted.requests[0]?.acceptedMoves.map((move) => move.uci)).toEqual(
      ["e2e4"],
    )
    expect(scripted.requests[0]?.requestId).toContain(
      "standard-story-chicken-1/opponent/ply/2/fen/",
    )
    actor.stop()
  })

  it("lets the opponent open when Story assigns the player Black", async () => {
    const scripted = createScriptedOpponent(["e2e4"])
    const actor = createActor(matchMachine, {
      input: {
        initialPosition: standardInitialPosition(),
        matchId: "standard-story-chicken-black",
        opponent: scripted.opponent,
        playerColor: "black",
      },
    }).start()

    expect(selectIsOpponentTurn(actor.getSnapshot())).toBe(true)
    await waitFor(actor, selectIsPlayerTurn)

    expect(selectMatchTimeline(actor.getSnapshot()).cursor).toBe(1)
    expect(selectMatchPosition(actor.getSnapshot()).turn).toBe("black")
    expect(selectCanUndo(actor.getSnapshot())).toBe(false)
    actor.stop()
  })

  it("undoes and redoes complete player-decision boundaries", async () => {
    const scripted = createScriptedOpponent(["e7e5"])
    const actor = createActor(matchMachine, {
      input: {
        initialPosition: standardInitialPosition(),
        matchId: "standard-story-chicken-history",
        opponent: scripted.opponent,
        playerColor: "white",
      },
    }).start()
    const e4 = requireLegalMove(
      selectMatchPosition(actor.getSnapshot()),
      "e2e4",
    )
    actor.send({ moveId: e4.id, type: "MATCH.MOVE_REQUESTED" })
    await waitFor(actor, selectIsPlayerTurn)

    actor.send({ type: "MATCH.UNDO_REQUESTED" })
    expect(selectMatchTimeline(actor.getSnapshot()).cursor).toBe(0)
    expect(selectCanRedo(actor.getSnapshot())).toBe(true)

    actor.send({ type: "MATCH.REDO_REQUESTED" })
    expect(selectMatchTimeline(actor.getSnapshot()).cursor).toBe(2)
    expect(selectIsPlayerTurn(actor.getSnapshot())).toBe(true)
    expect(scripted.requests).toHaveLength(1)
    actor.stop()
  })

  it("aborts a pending opponent request when the player undoes", async () => {
    let requestSignal: AbortSignal | undefined
    const selectMove = vi.fn(
      async (_request: MatchOpponentRequest, signal: AbortSignal) => {
        requestSignal = signal
        return await new Promise<MatchMoveId>((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => reject(new Error("request aborted")),
            { once: true },
          )
        })
      },
    )
    const actor = createActor(matchMachine, {
      input: {
        initialPosition: standardInitialPosition(),
        matchId: "standard-story-chicken-cancel",
        opponent: { selectMove },
        playerColor: "white",
      },
    }).start()
    const e4 = requireLegalMove(
      selectMatchPosition(actor.getSnapshot()),
      "e2e4",
    )
    actor.send({ moveId: e4.id, type: "MATCH.MOVE_REQUESTED" })
    await waitFor(actor, selectIsOpponentThinking)

    actor.send({ type: "MATCH.UNDO_REQUESTED" })
    await waitFor(actor, selectIsPlayerTurn)

    expect(requestSignal?.aborted).toBe(true)
    expect(selectMatchTimeline(actor.getSnapshot()).cursor).toBe(0)
    expect(selectMove).toHaveBeenCalledTimes(1)
    actor.stop()
  })

  it("surfaces an illegal opponent move and retries explicitly", async () => {
    const scripted = createScriptedOpponent(["a1a1", "e7e5"])
    const actor = createActor(matchMachine, {
      input: {
        initialPosition: standardInitialPosition(),
        matchId: "standard-story-chicken-retry",
        opponent: scripted.opponent,
        playerColor: "white",
      },
    }).start()
    const e4 = requireLegalMove(
      selectMatchPosition(actor.getSnapshot()),
      "e2e4",
    )
    actor.send({ moveId: e4.id, type: "MATCH.MOVE_REQUESTED" })
    await waitFor(actor, (snapshot) => selectOpponentFailure(snapshot) !== null)

    expect(selectOpponentFailure(actor.getSnapshot())).toEqual({
      type: "MATCH.OPPONENT_MOVE_ILLEGAL",
    })
    expect(selectMatchTimeline(actor.getSnapshot()).cursor).toBe(1)

    actor.send({ type: "MATCH.OPPONENT_RETRY_REQUESTED" })
    await waitFor(actor, selectIsPlayerTurn)

    expect(selectMatchTimeline(actor.getSnapshot()).cursor).toBe(2)
    expect(scripted.requests).toHaveLength(2)
    actor.stop()
  })

  it("surfaces request failure without inventing a fallback move", async () => {
    const scripted = createScriptedOpponent([new Error("engine unavailable")])
    const actor = createActor(matchMachine, {
      input: {
        initialPosition: standardInitialPosition(),
        matchId: "standard-story-chicken-failure",
        opponent: scripted.opponent,
        playerColor: "white",
      },
    }).start()
    const e4 = requireLegalMove(
      selectMatchPosition(actor.getSnapshot()),
      "e2e4",
    )
    actor.send({ moveId: e4.id, type: "MATCH.MOVE_REQUESTED" })
    await waitFor(actor, (snapshot) => selectOpponentFailure(snapshot) !== null)

    expect(selectOpponentFailure(actor.getSnapshot())).toEqual({
      type: "MATCH.OPPONENT_REQUEST_FAILED",
    })
    expect(selectMatchTimeline(actor.getSnapshot()).cursor).toBe(1)
    expect(selectIsOpponentTurn(actor.getSnapshot())).toBe(true)
    actor.stop()
  })

  it("moves between active play and complete without duplicated state", async () => {
    const scripted = createScriptedOpponent(["e7e5", "d8h4"])
    const actor = createActor(matchMachine, {
      input: {
        initialPosition: standardInitialPosition(),
        matchId: "standard-story-chicken-checkmate",
        opponent: scripted.opponent,
        playerColor: "white",
      },
    }).start()
    const play = async (uci: string) => {
      const move = requireLegalMove(
        selectMatchPosition(actor.getSnapshot()),
        uci,
      )
      actor.send({ moveId: move.id, type: "MATCH.MOVE_REQUESTED" })
      await waitFor(
        actor,
        (snapshot) =>
          selectIsPlayerTurn(snapshot) || snapshot.matches("complete"),
      )
    }

    await play("f2f3")
    await play("g2g4")

    expect(actor.getSnapshot().matches("complete")).toBe(true)
    expect(selectMatchPosition(actor.getSnapshot()).status).toEqual({
      type: "checkmate",
      winner: "black",
    })
    expect(selectCanUndo(actor.getSnapshot())).toBe(true)

    actor.send({ type: "MATCH.UNDO_REQUESTED" })
    expect(selectIsPlayerTurn(actor.getSnapshot())).toBe(true)
    expect(selectMatchTimeline(actor.getSnapshot()).cursor).toBe(2)
    expect(selectCanRedo(actor.getSnapshot())).toBe(true)
    actor.stop()
  })

  it("starts a reconstructed terminal position in complete", () => {
    const result = reconstructMatchPosition(
      { chess960PositionId: null, variant: "standard" },
      "7k/5K2/6Q1/8/8/8/8/8 b - - 0 1",
    )
    if (!result.ok) throw new Error("Invalid terminal test position")
    const scripted = createScriptedOpponent([])
    const actor = createActor(matchMachine, {
      input: {
        initialPosition: result.position,
        matchId: "terminal-position",
        opponent: scripted.opponent,
        playerColor: "black",
      },
    }).start()

    expect(actor.getSnapshot().matches("complete")).toBe(true)
    expect(selectCanUndo(actor.getSnapshot())).toBe(false)
    expect(selectCanRedo(actor.getSnapshot())).toBe(false)
    expect(scripted.requests).toHaveLength(0)
    actor.stop()
  })
})
