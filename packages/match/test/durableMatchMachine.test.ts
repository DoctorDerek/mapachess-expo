import { describe, expect, it, vi } from "vitest"
import { createActor, waitFor } from "xstate"
import type { BetterHintsRequest } from "../src/betterHints.js"
import matchMachine, {
  selectCanRedo,
  selectCanUndo,
  selectHintStage,
  selectIsPersistingMutation,
  selectIsPlayerTurn,
  selectMatchHints,
  selectMatchPosition,
  selectMatchTimeline,
  selectMoveHintsUsed,
  selectPersistenceFailure,
  selectPieceHintsUsed,
  type MatchOpponentRequest,
} from "../src/matchMachine.js"
import type {
  MatchPersistence,
  MatchPersistenceReceipt,
  MatchPersistenceRequest,
} from "../src/matchPersistence.js"
import { createInitialMatchPosition } from "../src/matchPosition.js"
import {
  applyMatchTimelineMove,
  createMatchTimeline,
  currentMatchPosition,
} from "../src/matchTimeline.js"
import { createHintResult, requireLegalMove } from "./matchTestUtils.js"

type PendingPersistence = Readonly<{
  reject: (reason: Error) => void
  request: MatchPersistenceRequest
  resolve: (receipt: MatchPersistenceReceipt) => void
}>

class ControlledPersistence implements MatchPersistence {
  readonly pending: PendingPersistence[] = []
  readonly requests: MatchPersistenceRequest[] = []

  persist(request: MatchPersistenceRequest): Promise<MatchPersistenceReceipt> {
    this.requests.push(request)
    return new Promise((resolve, reject) => {
      this.pending.push({ reject, request, resolve })
    })
  }

  failNext(): void {
    const pending = this.pending.shift()
    if (pending === undefined) throw new Error("No persistence request to fail")
    pending.reject(new Error("storage unavailable"))
  }

  succeedNext(requestId?: string): void {
    const pending = this.pending.shift()
    if (pending === undefined) {
      throw new Error("No persistence request to succeed")
    }
    pending.resolve({
      requestId: requestId ?? pending.request.requestId,
      type: "MATCH.MUTATION_PERSISTED",
    })
  }
}

const standardInitialPosition = () =>
  createInitialMatchPosition({
    chess960PositionId: null,
    variant: "standard",
  })

const createDurableActor = (
  persistence: MatchPersistence,
  opponentMove = "e7e5",
) => {
  const selectMove = vi.fn(async (request: MatchOpponentRequest) => {
    const move = request.legalMoves.find(({ uci }) => uci === opponentMove)
    if (move === undefined) throw new Error("Scripted move is not legal")
    return move.id
  })
  const actor = createActor(matchMachine, {
    input: {
      autoHintsEnabled: false,
      durability: { persistence, type: "durable" },
      initialPosition: standardInitialPosition(),
      matchId: "durable-standard-chicken",
      opponent: { selectMove },
      playerColor: "white",
    },
  }).start()
  return { actor, selectMove }
}

const requestE4 = (actor: ReturnType<typeof createDurableActor>["actor"]) => {
  const move = requireLegalMove(
    selectMatchPosition(actor.getSnapshot()),
    "e2e4",
  )
  actor.send({ moveId: move.id, type: "MATCH.MOVE_REQUESTED" })
}

describe("verified durable match mutation gate", () => {
  it("resumes the exact branch, cursor, and monotonic hint-use state", () => {
    const persistence = new ControlledPersistence()
    const initialTimeline = createMatchTimeline(standardInitialPosition())
    const afterE4 = applyMatchTimelineMove(
      initialTimeline,
      requireLegalMove(currentMatchPosition(initialTimeline), "e2e4").id,
    )
    if (!afterE4.ok) throw new Error("Test e2e4 must be legal")
    const afterE5 = applyMatchTimelineMove(
      afterE4.timeline,
      requireLegalMove(currentMatchPosition(afterE4.timeline), "e7e5").id,
    )
    if (!afterE5.ok) throw new Error("Test e7e5 must be legal")
    const resumedTimeline = Object.freeze({
      ...afterE5.timeline,
      cursor: 0,
    })

    const actor = createActor(matchMachine, {
      input: {
        autoHintsEnabled: false,
        durability: { persistence, type: "durable" },
        matchId: "resumed-durable-standard-chicken",
        opponent: {
          selectMove: async () => {
            throw new Error("Opponent must not move at the restored cursor")
          },
        },
        playerColor: "white",
        resumedState: {
          conclusion: null,
          moveHintsUsed: true,
          pieceHintsUsed: true,
          timeline: resumedTimeline,
        },
      },
    }).start()

    expect(selectMatchTimeline(actor.getSnapshot())).toBe(resumedTimeline)
    expect(selectMatchTimeline(actor.getSnapshot()).transitions).toHaveLength(2)
    expect(selectMatchTimeline(actor.getSnapshot()).cursor).toBe(0)
    expect(selectPieceHintsUsed(actor.getSnapshot())).toBe(true)
    expect(selectMoveHintsUsed(actor.getSnapshot())).toBe(true)
    expect(selectCanRedo(actor.getSnapshot())).toBe(true)
    actor.stop()
  })

  it("accepts player and opponent moves only after each verified write", async () => {
    const persistence = new ControlledPersistence()
    const { actor, selectMove } = createDurableActor(persistence)
    const initialFen = selectMatchPosition(actor.getSnapshot()).fen

    requestE4(actor)
    expect(selectIsPersistingMutation(actor.getSnapshot())).toBe(true)
    expect(selectMatchPosition(actor.getSnapshot()).fen).toBe(initialFen)
    expect(persistence.requests[0]).toMatchObject({
      cursor: 1,
      moveIds: ["e2e4"],
    })
    expect(selectMove).not.toHaveBeenCalled()

    persistence.succeedNext()
    await waitFor(actor, () => persistence.requests.length === 2)
    expect(selectMatchTimeline(actor.getSnapshot()).cursor).toBe(1)
    expect(selectMove).toHaveBeenCalledTimes(1)
    expect(persistence.requests[1]).toMatchObject({
      cursor: 2,
      moveIds: ["e2e4", "e7e5"],
    })

    persistence.succeedNext()
    await waitFor(actor, selectIsPlayerTurn)
    expect(selectMatchTimeline(actor.getSnapshot()).cursor).toBe(2)
    actor.stop()
  })

  it("freezes a failed candidate and retries without duplicate engine work", async () => {
    const persistence = new ControlledPersistence()
    const { actor, selectMove } = createDurableActor(persistence)
    const initialFen = selectMatchPosition(actor.getSnapshot()).fen

    requestE4(actor)
    const originalRequestId = persistence.requests[0]?.requestId
    persistence.failNext()
    await waitFor(actor, (snapshot) => snapshot.matches("persistenceFailure"))

    expect(selectPersistenceFailure(actor.getSnapshot())).toEqual({
      type: "MATCH.PERSISTENCE_REQUEST_FAILED",
    })
    expect(selectMatchPosition(actor.getSnapshot()).fen).toBe(initialFen)
    expect(selectMove).not.toHaveBeenCalled()

    requestE4(actor)
    actor.send({ type: "MATCH.UNDO_REQUESTED" })
    expect(persistence.requests).toHaveLength(1)
    expect(actor.getSnapshot().context.pendingMutation?.request.requestId).toBe(
      originalRequestId,
    )

    actor.send({ type: "MATCH.PERSISTENCE_RETRY_REQUESTED" })
    await waitFor(actor, selectIsPersistingMutation)
    expect(persistence.requests[1]?.requestId).toBe(originalRequestId)
    persistence.succeedNext()
    await waitFor(actor, () => persistence.requests.length === 3)
    expect(selectMove).toHaveBeenCalledTimes(1)
    actor.stop()
  })

  it("retries a failed opponent write without requesting another engine move", async () => {
    const persistence = new ControlledPersistence()
    const { actor, selectMove } = createDurableActor(persistence)

    requestE4(actor)
    persistence.succeedNext()
    await waitFor(actor, () => persistence.requests.length === 2)
    const opponentRequestId = persistence.requests[1]?.requestId
    expect(selectMove).toHaveBeenCalledTimes(1)

    persistence.failNext()
    await waitFor(actor, (snapshot) => snapshot.matches("persistenceFailure"))
    expect(selectMatchTimeline(actor.getSnapshot()).cursor).toBe(1)

    actor.send({ type: "MATCH.PERSISTENCE_RETRY_REQUESTED" })
    await waitFor(actor, selectIsPersistingMutation)
    expect(persistence.requests[2]?.requestId).toBe(opponentRequestId)
    expect(selectMove).toHaveBeenCalledTimes(1)

    persistence.succeedNext()
    await waitFor(actor, selectIsPlayerTurn)
    expect(selectMatchTimeline(actor.getSnapshot()).cursor).toBe(2)
    actor.stop()
  })

  it("rejects stale receipts while preserving the exact retry candidate", async () => {
    const persistence = new ControlledPersistence()
    const { actor } = createDurableActor(persistence)
    const initialFen = selectMatchPosition(actor.getSnapshot()).fen

    requestE4(actor)
    const originalRequestId = persistence.requests[0]?.requestId
    persistence.succeedNext(`${originalRequestId}/stale`)
    await waitFor(actor, (snapshot) => snapshot.matches("persistenceFailure"))
    expect(selectPersistenceFailure(actor.getSnapshot())).toEqual({
      type: "MATCH.PERSISTENCE_RECEIPT_STALE",
    })
    expect(selectMatchPosition(actor.getSnapshot()).fen).toBe(initialFen)

    actor.send({ type: "MATCH.PERSISTENCE_RETRY_REQUESTED" })
    await waitFor(actor, selectIsPersistingMutation)
    expect(persistence.requests[1]?.requestId).toBe(originalRequestId)
    persistence.succeedNext()
    await waitFor(actor, () => persistence.requests.length === 3)
    expect(selectMatchTimeline(actor.getSnapshot()).cursor).toBe(1)
    actor.stop()
  })

  it("persists monotonic Piece and Move Hint use before revealing either", async () => {
    const persistence = new ControlledPersistence()
    const analyze = vi.fn((request: BetterHintsRequest) =>
      Promise.resolve(createHintResult(request)),
    )
    const actor = createActor(matchMachine, {
      input: {
        autoHintsEnabled: false,
        durability: { persistence, type: "durable" },
        hintAnalyst: { analyze },
        initialPosition: standardInitialPosition(),
        matchId: "durable-standard-chicken-hints",
        opponent: {
          selectMove: async (request) => {
            const move = request.legalMoves.find(({ uci }) => uci === "e7e5")
            if (move === undefined) throw new Error("Missing scripted e7e5")
            return move.id
          },
        },
        playerColor: "white",
      },
    }).start()

    actor.send({ type: "MATCH.PIECE_HINTS_REQUESTED" })
    await waitFor(actor, selectIsPersistingMutation)
    expect(persistence.requests[0]).toMatchObject({
      moveHintsUsed: false,
      pieceHintsUsed: true,
    })
    expect(selectPieceHintsUsed(actor.getSnapshot())).toBe(false)
    expect(selectHintStage(actor.getSnapshot())).toBe("hidden")

    persistence.succeedNext()
    await waitFor(
      actor,
      (snapshot) => selectHintStage(snapshot) === "piece-hints",
    )
    expect(selectPieceHintsUsed(actor.getSnapshot())).toBe(true)
    expect(selectMatchHints(actor.getSnapshot())).not.toBeNull()
    expect(analyze).toHaveBeenCalledTimes(1)

    actor.send({ type: "MATCH.MOVE_HINTS_REQUESTED" })
    expect(selectIsPersistingMutation(actor.getSnapshot())).toBe(true)
    expect(persistence.requests[1]).toMatchObject({
      moveHintsUsed: true,
      pieceHintsUsed: true,
    })
    expect(selectMoveHintsUsed(actor.getSnapshot())).toBe(false)
    expect(selectMatchHints(actor.getSnapshot())).not.toBeNull()

    persistence.succeedNext()
    await waitFor(
      actor,
      (snapshot) => selectHintStage(snapshot) === "move-hints",
    )
    expect(selectMoveHintsUsed(actor.getSnapshot())).toBe(true)
    expect(selectMatchHints(actor.getSnapshot())).not.toBeNull()
    expect(analyze).toHaveBeenCalledTimes(1)

    requestE4(actor)
    persistence.succeedNext()
    await waitFor(actor, () => persistence.requests.length === 4)
    persistence.succeedNext()
    await waitFor(actor, selectIsPlayerTurn)
    const persistedRequestCount = persistence.requests.length

    actor.send({ type: "MATCH.PIECE_HINTS_REQUESTED" })
    await waitFor(
      actor,
      (snapshot) => selectHintStage(snapshot) === "piece-hints",
    )
    actor.send({ type: "MATCH.MOVE_HINTS_REQUESTED" })
    expect(selectHintStage(actor.getSnapshot())).toBe("move-hints")
    expect(persistence.requests).toHaveLength(persistedRequestCount)
    expect(analyze).toHaveBeenCalledTimes(2)
    actor.stop()
  })

  it("persists Undo and Redo cursors without discarding the saved branch", async () => {
    const persistence = new ControlledPersistence()
    const { actor } = createDurableActor(persistence)
    requestE4(actor)
    persistence.succeedNext()
    await waitFor(actor, () => persistence.requests.length === 2)
    persistence.succeedNext()
    await waitFor(actor, selectIsPlayerTurn)

    actor.send({ type: "MATCH.UNDO_REQUESTED" })
    expect(selectCanUndo(actor.getSnapshot())).toBe(false)
    expect(persistence.requests[2]).toMatchObject({
      cursor: 0,
      moveIds: ["e2e4", "e7e5"],
    })
    expect(selectMatchTimeline(actor.getSnapshot()).cursor).toBe(2)
    persistence.succeedNext()
    await waitFor(
      actor,
      (snapshot) =>
        selectMatchTimeline(snapshot).cursor === 0 && selectCanRedo(snapshot),
    )

    actor.send({ type: "MATCH.REDO_REQUESTED" })
    expect(persistence.requests[3]).toMatchObject({
      cursor: 2,
      moveIds: ["e2e4", "e7e5"],
    })
    expect(selectMatchTimeline(actor.getSnapshot()).cursor).toBe(0)
    persistence.succeedNext()
    await waitFor(
      actor,
      (snapshot) => selectMatchTimeline(snapshot).cursor === 2,
    )
    actor.stop()
  })
})
