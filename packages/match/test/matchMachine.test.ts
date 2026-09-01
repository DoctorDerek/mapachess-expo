import { describe, expect, it, vi } from "vitest"
import { createActor, SimulatedClock, waitFor } from "xstate"
import type {
  BetterHintsAnalyst,
  BetterHintsRequest,
  BetterHintsResult,
} from "../src/betterHints"
import matchMachine, {
  AUTO_HINTS_PIECE_DWELL_MS,
  selectCanRedo,
  selectCanUndo,
  selectHintFailure,
  selectHintStage,
  selectIsOpponentThinking,
  selectIsOpponentTurn,
  selectIsPlayerTurn,
  selectMatchConclusion,
  selectMatchHints,
  selectMatchPosition,
  selectMatchTimeline,
  selectMoveHintsUsed,
  selectOpponentFailure,
  selectPieceHintsUsed,
  type MatchOpponent,
  type MatchOpponentRequest,
} from "../src/matchMachine"
import type { MatchMoveId } from "../src/matchMove"
import {
  createInitialMatchPosition,
  reconstructMatchPosition,
} from "../src/matchPosition"
import { createHintResult, requireLegalMove } from "./matchTestUtils"

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
  it("reveals staged hints once and preserves monotonic use evidence", async () => {
    const scripted = createScriptedOpponent(["e7e5"])
    const hintRequests: BetterHintsRequest[] = []
    const hintAnalyst: BetterHintsAnalyst = {
      analyze: (request) => {
        hintRequests.push(request)
        return Promise.resolve(createHintResult(request))
      },
    }
    const actor = createActor(matchMachine, {
      input: {
        autoHintsEnabled: false,
        durability: { type: "ephemeral" },
        hintAnalyst,
        initialPosition: standardInitialPosition(),
        matchId: "standard-story-chicken-hints",
        opponent: scripted.opponent,
        playerColor: "white",
      },
    }).start()

    expect(selectHintStage(actor.getSnapshot())).toBe("ready")
    expect(selectMoveHintsUsed(actor.getSnapshot())).toBe(false)
    expect(selectPieceHintsUsed(actor.getSnapshot())).toBe(false)
    actor.send({ type: "MATCH.PIECE_HINTS_REQUESTED" })
    await waitFor(
      actor,
      (snapshot) => selectHintStage(snapshot) === "piece-hints",
    )

    const analyzedHints = selectMatchHints(actor.getSnapshot())
    expect(analyzedHints?.player.map((hint) => hint.from)).toEqual([
      "e2",
      "g1",
      "d2",
    ])
    expect(selectMoveHintsUsed(actor.getSnapshot())).toBe(false)
    expect(selectPieceHintsUsed(actor.getSnapshot())).toBe(true)

    actor.send({ type: "MATCH.MOVE_HINTS_REQUESTED" })
    expect(selectHintStage(actor.getSnapshot())).toBe("move-hints")
    expect(selectMatchHints(actor.getSnapshot())).toBe(analyzedHints)
    expect(selectMoveHintsUsed(actor.getSnapshot())).toBe(true)
    expect(selectPieceHintsUsed(actor.getSnapshot())).toBe(true)
    expect(hintRequests).toHaveLength(1)

    const e4 = requireLegalMove(
      selectMatchPosition(actor.getSnapshot()),
      "e2e4",
    )
    actor.send({ moveId: e4.id, type: "MATCH.MOVE_REQUESTED" })
    await waitFor(actor, selectIsPlayerTurn)

    expect(selectHintStage(actor.getSnapshot())).toBe("ready")
    expect(selectMatchHints(actor.getSnapshot())).toBeNull()
    expect(selectMoveHintsUsed(actor.getSnapshot())).toBe(true)
    expect(selectPieceHintsUsed(actor.getSnapshot())).toBe(true)
    actor.send({ type: "MATCH.UNDO_REQUESTED" })
    actor.send({ type: "MATCH.REDO_REQUESTED" })
    expect(selectMoveHintsUsed(actor.getSnapshot())).toBe(true)
    expect(selectPieceHintsUsed(actor.getSnapshot())).toBe(true)
    actor.stop()
  })

  it("automatically reveals staged hints on every enabled player turn", async () => {
    const clock = new SimulatedClock()
    const scripted = createScriptedOpponent(["e7e5"])
    const hintRequests: BetterHintsRequest[] = []
    const hintAnalyst: BetterHintsAnalyst = {
      analyze: (request) => {
        hintRequests.push(request)
        return Promise.resolve(createHintResult(request))
      },
    }
    const actor = createActor(matchMachine, {
      clock,
      input: {
        autoHintsEnabled: true,
        durability: { type: "ephemeral" },
        hintAnalyst,
        initialPosition: standardInitialPosition(),
        matchId: "standard-story-chicken-auto-hints",
        opponent: scripted.opponent,
        playerColor: "white",
      },
    }).start()

    await waitFor(
      actor,
      (snapshot) => selectHintStage(snapshot) === "piece-hints",
    )
    expect(hintRequests).toHaveLength(1)
    expect(selectPieceHintsUsed(actor.getSnapshot())).toBe(true)
    expect(selectMoveHintsUsed(actor.getSnapshot())).toBe(false)

    clock.increment(AUTO_HINTS_PIECE_DWELL_MS - 1)
    expect(selectHintStage(actor.getSnapshot())).toBe("piece-hints")
    expect(selectMoveHintsUsed(actor.getSnapshot())).toBe(false)

    clock.increment(1)
    expect(selectHintStage(actor.getSnapshot())).toBe("move-hints")
    expect(selectMoveHintsUsed(actor.getSnapshot())).toBe(true)

    const e4 = requireLegalMove(
      selectMatchPosition(actor.getSnapshot()),
      "e2e4",
    )
    actor.send({ moveId: e4.id, type: "MATCH.MOVE_REQUESTED" })
    await waitFor(
      actor,
      (snapshot) => selectHintStage(snapshot) === "piece-hints",
    )

    expect(hintRequests).toHaveLength(2)
    actor.send({ type: "MATCH.MOVE_HINTS_REQUESTED" })
    expect(selectHintStage(actor.getSnapshot())).toBe("move-hints")
    clock.increment(AUTO_HINTS_PIECE_DWELL_MS)
    expect(selectHintStage(actor.getSnapshot())).toBe("move-hints")
    expect(hintRequests).toHaveLength(2)
    actor.stop()
  })

  it("cancels the automatic Piece Hint dwell when the board changes", async () => {
    const clock = new SimulatedClock()
    const selectMove = vi.fn(
      async (_request: MatchOpponentRequest, signal: AbortSignal) =>
        await new Promise<MatchMoveId>((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => reject(new Error("request aborted")),
            { once: true },
          )
        }),
    )
    const actor = createActor(matchMachine, {
      clock,
      input: {
        autoHintsEnabled: true,
        durability: { type: "ephemeral" },
        hintAnalyst: {
          analyze: (request) => Promise.resolve(createHintResult(request)),
        },
        initialPosition: standardInitialPosition(),
        matchId: "standard-story-chicken-auto-hints-dwell-cancel",
        opponent: { selectMove },
        playerColor: "white",
      },
    }).start()

    await waitFor(
      actor,
      (snapshot) => selectHintStage(snapshot) === "piece-hints",
    )
    const e4 = requireLegalMove(
      selectMatchPosition(actor.getSnapshot()),
      "e2e4",
    )
    actor.send({ moveId: e4.id, type: "MATCH.MOVE_REQUESTED" })
    await waitFor(actor, selectIsOpponentThinking)

    clock.increment(AUTO_HINTS_PIECE_DWELL_MS)
    expect(selectHintStage(actor.getSnapshot())).toBe("hidden")
    expect(selectMoveHintsUsed(actor.getSnapshot())).toBe(false)
    expect(selectMove).toHaveBeenCalledTimes(1)
    actor.stop()
  })

  it("cancels pending hint analysis when the board changes", async () => {
    let hintSignal: AbortSignal | undefined
    const analyze = vi.fn(
      async (_request: BetterHintsRequest, signal?: AbortSignal) => {
        hintSignal = signal
        return await new Promise<BetterHintsResult>((_resolve, reject) => {
          signal?.addEventListener(
            "abort",
            () => reject(new Error("hint request aborted")),
            { once: true },
          )
        })
      },
    )
    const selectMove = vi.fn(
      async (_request: MatchOpponentRequest, signal: AbortSignal) =>
        await new Promise<MatchMoveId>((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => reject(new Error("request aborted")),
            { once: true },
          )
        }),
    )
    const actor = createActor(matchMachine, {
      input: {
        autoHintsEnabled: true,
        durability: { type: "ephemeral" },
        hintAnalyst: { analyze },
        initialPosition: standardInitialPosition(),
        matchId: "standard-story-chicken-hint-cancel",
        opponent: { selectMove },
        playerColor: "white",
      },
    }).start()

    await waitFor(actor, (snapshot) => selectHintStage(snapshot) === "loading")
    const e4 = requireLegalMove(
      selectMatchPosition(actor.getSnapshot()),
      "e2e4",
    )
    actor.send({ moveId: e4.id, type: "MATCH.MOVE_REQUESTED" })
    await waitFor(actor, selectIsOpponentThinking)

    expect(hintSignal?.aborted).toBe(true)
    expect(analyze).toHaveBeenCalledTimes(1)
    expect(selectMove).toHaveBeenCalledTimes(1)
    expect(selectMatchHints(actor.getSnapshot())).toBeNull()
    expect(selectMoveHintsUsed(actor.getSnapshot())).toBe(false)
    expect(selectPieceHintsUsed(actor.getSnapshot())).toBe(false)
    actor.stop()
  })

  it("retries failed and stale hint output without counting failed use", async () => {
    let attempt = 0
    const hintAnalyst: BetterHintsAnalyst = {
      analyze: (request) => {
        attempt += 1
        if (attempt === 1) {
          return Promise.reject(new Error("hint engine unavailable"))
        }
        const result = createHintResult(request)
        return Promise.resolve(
          attempt === 2
            ? { ...result, requestId: `${result.requestId}/stale` }
            : result,
        )
      },
    }
    const actor = createActor(matchMachine, {
      input: {
        autoHintsEnabled: true,
        durability: { type: "ephemeral" },
        hintAnalyst,
        initialPosition: standardInitialPosition(),
        matchId: "standard-story-chicken-hint-retry",
        opponent: createScriptedOpponent([]).opponent,
        playerColor: "white",
      },
    }).start()

    await waitFor(actor, (snapshot) => selectHintStage(snapshot) === "failure")
    expect(selectHintFailure(actor.getSnapshot())).toEqual({
      type: "MATCH.HINT_REQUEST_FAILED",
    })
    expect(selectPieceHintsUsed(actor.getSnapshot())).toBe(false)

    actor.send({ type: "MATCH.PIECE_HINTS_REQUESTED" })
    await waitFor(actor, (snapshot) => selectHintStage(snapshot) === "failure")
    expect(selectPieceHintsUsed(actor.getSnapshot())).toBe(false)

    actor.send({ type: "MATCH.PIECE_HINTS_REQUESTED" })
    await waitFor(
      actor,
      (snapshot) => selectHintStage(snapshot) === "piece-hints",
    )
    expect(selectHintFailure(actor.getSnapshot())).toBeNull()
    expect(selectPieceHintsUsed(actor.getSnapshot())).toBe(true)
    expect(attempt).toBe(3)
    actor.stop()
  })

  it("owns a complete player and automatic opponent turn", async () => {
    const scripted = createScriptedOpponent(["e7e5"])
    const actor = createActor(matchMachine, {
      input: {
        autoHintsEnabled: true,
        durability: { type: "ephemeral" },
        initialPosition: standardInitialPosition(),
        matchId: "standard-story-chicken-1",
        opponent: scripted.opponent,
        playerColor: "white",
      },
    }).start()

    expect(selectIsPlayerTurn(actor.getSnapshot())).toBe(true)
    expect(selectHintStage(actor.getSnapshot())).toBe("unavailable")
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
    const clock = new SimulatedClock()
    const scripted = createScriptedOpponent(["e2e4"])
    const hintRequests: BetterHintsRequest[] = []
    const actor = createActor(matchMachine, {
      clock,
      input: {
        autoHintsEnabled: true,
        durability: { type: "ephemeral" },
        hintAnalyst: {
          analyze: (request) => {
            hintRequests.push(request)
            const result = createHintResult(request)
            return Promise.resolve(
              Object.freeze({
                ...result,
                opponent: result.player,
                player: result.opponent,
              }),
            )
          },
        },
        initialPosition: standardInitialPosition(),
        matchId: "standard-story-chicken-black",
        opponent: scripted.opponent,
        playerColor: "black",
      },
    }).start()

    expect(selectIsOpponentTurn(actor.getSnapshot())).toBe(true)
    await waitFor(
      actor,
      (snapshot) => selectHintStage(snapshot) === "piece-hints",
    )

    expect(selectMatchTimeline(actor.getSnapshot()).cursor).toBe(1)
    expect(selectMatchPosition(actor.getSnapshot()).turn).toBe("black")
    expect(selectCanUndo(actor.getSnapshot())).toBe(false)
    expect(hintRequests).toHaveLength(1)
    expect(hintRequests[0]?.playerColor).toBe("black")
    clock.increment(AUTO_HINTS_PIECE_DWELL_MS)
    expect(selectHintStage(actor.getSnapshot())).toBe("move-hints")
    actor.stop()
  })

  it("undoes and redoes complete player-decision boundaries", async () => {
    const scripted = createScriptedOpponent(["e7e5"])
    const actor = createActor(matchMachine, {
      input: {
        autoHintsEnabled: false,
        durability: { type: "ephemeral" },
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
        autoHintsEnabled: false,
        durability: { type: "ephemeral" },
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
        autoHintsEnabled: false,
        durability: { type: "ephemeral" },
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
        autoHintsEnabled: false,
        durability: { type: "ephemeral" },
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

  it("keeps a completed result immutable during timeline review", async () => {
    const scripted = createScriptedOpponent(["e7e5", "d8h4"])
    const actor = createActor(matchMachine, {
      input: {
        autoHintsEnabled: false,
        durability: { type: "ephemeral" },
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
    expect(selectMatchConclusion(actor.getSnapshot())).toEqual({
      type: "checkmate",
      winner: "black",
    })
    expect(selectCanUndo(actor.getSnapshot())).toBe(true)

    actor.send({ type: "MATCH.UNDO_REQUESTED" })
    expect(actor.getSnapshot().matches("complete")).toBe(true)
    expect(selectMatchTimeline(actor.getSnapshot()).cursor).toBe(2)
    expect(selectCanRedo(actor.getSnapshot())).toBe(true)
    expect(selectMatchConclusion(actor.getSnapshot())).toEqual({
      type: "checkmate",
      winner: "black",
    })

    actor.send({ type: "MATCH.REDO_REQUESTED" })
    expect(actor.getSnapshot().matches("complete")).toBe(true)
    expect(selectMatchTimeline(actor.getSnapshot()).cursor).toBe(4)
    expect(selectMatchConclusion(actor.getSnapshot())).toEqual({
      type: "checkmate",
      winner: "black",
    })
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
        autoHintsEnabled: false,
        durability: { type: "ephemeral" },
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
