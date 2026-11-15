import { afterEach, describe, expect, it } from "vitest"
import { createActor } from "xstate"
import { parseChess960PositionId } from "@mapachess/match/chess960-position"
import {
  listLegalMatchMoves,
  type MatchMoveId,
} from "@mapachess/match/match-move"
import {
  createInitialMatchPosition,
  reconstructMatchPosition,
  type MatchColor,
  type MatchPosition,
  type MatchSquare,
} from "@mapachess/match/match-position"
import boardInteractionMachine, {
  type BoardInteractionActor,
  type BoardObservation,
} from "../src/boardInteractionMachine.js"

const actors: BoardInteractionActor[] = []
afterEach(() => {
  for (const actor of actors.splice(0)) actor.stop()
})
const initial = () =>
  createInitialMatchPosition({ variant: "standard", chess960PositionId: null })
function restored(fen: string, chess960 = false): MatchPosition {
  const layout = parseChess960PositionId(0)
  if (!layout.ok) throw new Error("Expected initial Chess960 ID")
  const result = reconstructMatchPosition(
    chess960
      ? { variant: "chess960", chess960PositionId: layout.positionId }
      : { variant: "standard", chess960PositionId: null },
    fen,
  )
  if (!result.ok) throw new Error("Expected a legal board interaction fixture")
  return result.position
}
function open(position = initial(), orientation: MatchColor = "white") {
  const board: BoardObservation = {
    position,
    orientation,
    legalMoves: listLegalMatchMoves(position),
    disabled: false,
  }
  const actor = createActor(boardInteractionMachine, {
    input: { orientation, positionFen: position.fen },
  })
  const moves: MatchMoveId[] = []
  const focuses: MatchSquare[] = []
  actor.on("BOARD.MOVE_REQUESTED", ({ moveId }) => moves.push(moveId))
  actor.on("BOARD.FOCUS_REQUESTED", ({ square }) => focuses.push(square))
  actors.push(actor)
  actor.start()
  const choose = (square: MatchSquare, current = board) =>
    actor.send({ type: "BOARD.SQUARE_CHOSEN", square, board: current })
  return {
    actor,
    board,
    moves,
    focuses,
    choose,
    state: () => actor.getSnapshot().context,
  }
}
function promotion() {
  const view = open(restored("7k/P7/8/8/8/8/8/4K3 w - - 0 1"))
  view.choose("a7")
  view.choose("a8")
  return view
}

describe("shared board interaction", () => {
  it("stops the real transition actor cleanly without processing teardown as board input", () => {
    const view = open()
    const errors: unknown[] = []
    let completed = 0
    const context = view.state()
    view.actor.subscribe({
      error: (error) => errors.push(error),
      complete: () => {
        completed += 1
      },
    })
    view.actor.stop()
    expect(completed).toBe(1)
    expect(view.state()).toBe(context)
    expect(errors).toEqual([])
  })
  it.each(["white", "black"] as const)(
    "starts %s focus at the shared home square",
    (orientation) => {
      const view = open(initial(), orientation)
      expect(view.state().focusedSquare).toBe(
        orientation === "white" ? "e1" : "e8",
      )
      expect(view.state().selectedSquare).toBeNull()
    },
  )
  it("selects only movable pieces for the current turn, toggles and changes selection", () => {
    const view = open()
    for (const square of ["e7", "e1", "a5"] as const) {
      view.choose(square)
      expect(view.state().selectedSquare).toBeNull()
    }
    view.choose("e2")
    expect(view.state().selectedSquare).toBe("e2")
    view.choose("d2")
    expect(view.state().selectedSquare).toBe("d2")
    view.choose("d2")
    expect(view.state().selectedSquare).toBeNull()
    view.choose("e2")
    view.choose("a5")
    expect(view.state().selectedSquare).toBeNull()
    expect(view.moves).toEqual([])
  })
  it("requests a legal move once and returns focus to the selected source", () => {
    const view = open()
    view.choose("e2")
    view.choose("e4")
    view.choose("e4")
    expect(view.moves).toEqual(["e2e4"])
    expect(view.focuses).toEqual(["e2"])
    expect(view.state().selectedSquare).toBeNull()
  })
  it("rejects a disabled initial press without creating a selection", () => {
    const view = open()
    view.choose("e2", { ...view.board, disabled: true })
    expect(view.state().selectedSquare).toBeNull()
    expect(view.moves).toEqual([])
  })
  it("ignores disabled presses without losing an existing promotion choice", () => {
    const view = promotion()
    const choice = view.state().pendingChoice
    expect(choice?.moves).toHaveLength(4)
    const queen = choice?.moves.find(
      (move) => move.kind === "normal" && move.promotion === "queen",
    )
    if (queen === undefined) throw new Error("Expected queen promotion")
    const board = { ...view.board, disabled: true }
    view.choose("e1", board)
    view.actor.send({ type: "BOARD.MOVE_CHOSEN", moveId: queen.id, board })
    view.actor.send({
      type: "BOARD.POSITION_CHANGED",
      positionFen: board.position.fen,
    })
    expect(view.state().pendingChoice).toBe(choice)
    expect(view.moves).toEqual([])
  })
  it.each(["queen", "rook", "bishop", "knight"] as const)(
    "requires the explicit %s choice and rejects duplicate confirmation",
    (role) => {
      const view = promotion()
      const move = view.board.legalMoves.find(
        (candidate) =>
          candidate.kind === "normal" && candidate.promotion === role,
      )
      if (move === undefined) throw new Error("Expected promotion role")
      view.choose("e1")
      expect(view.state().selectedSquare).toBe("a7")
      expect(view.moves).toEqual([])
      view.actor.send({
        type: "BOARD.MOVE_CHOSEN",
        moveId: move.id,
        board: view.board,
      })
      view.actor.send({
        type: "BOARD.MOVE_CHOSEN",
        moveId: move.id,
        board: view.board,
      })
      expect(view.moves).toEqual([move.id])
      expect(view.state().pendingChoice).toBeNull()
    },
  )
  it("cancels both choice and selection without executing a move, even while disabled", () => {
    const view = promotion()
    view.actor.send({
      type: "BOARD.CANCELED",
      board: { ...view.board, disabled: true },
    })
    expect(view.state()).toMatchObject({
      selectedSquare: null,
      pendingChoice: null,
      focusedSquare: "a7",
    })
    expect(view.focuses).toEqual(["a7"])
    expect(view.moves).toEqual([])
  })
  it("rejects a stale promotion against a new position before an observation effect", () => {
    const view = promotion()
    const move = view.state().pendingChoice?.moves[0]
    if (move === undefined) throw new Error("Expected pending choice")
    const position = initial()
    view.actor.send({
      type: "BOARD.MOVE_CHOSEN",
      moveId: move.id,
      board: {
        ...view.board,
        position,
        legalMoves: listLegalMatchMoves(position),
      },
    })
    expect(view.state()).toMatchObject({
      positionFen: position.fen,
      selectedSquare: null,
      pendingChoice: null,
    })
    expect(view.moves).toEqual([])
  })
  it("rechecks the latest legal list and requires membership in the pending choice", () => {
    const view = promotion()
    const move = view.state().pendingChoice?.moves[0]
    const unrelated = listLegalMatchMoves(initial())[0]
    if (move === undefined || unrelated === undefined)
      throw new Error("Expected legal move fixtures")
    view.actor.send({
      type: "BOARD.MOVE_CHOSEN",
      moveId: unrelated.id,
      board: view.board,
    })
    view.actor.send({
      type: "BOARD.MOVE_CHOSEN",
      moveId: move.id,
      board: { ...view.board, legalMoves: [] },
    })
    expect(view.moves).toEqual([])
    view.actor.send({
      type: "BOARD.MOVE_CHOSEN",
      moveId: move.id,
      board: view.board,
    })
    expect(view.moves).toEqual([move.id])
  })
  it("clears transient choice on a canonical position change and ignores unchanged observations", () => {
    const view = promotion()
    const context = view.state()
    view.actor.send({
      type: "BOARD.POSITION_CHANGED",
      positionFen: view.board.position.fen,
    })
    expect(view.state()).toBe(context)
    view.actor.send({
      type: "BOARD.POSITION_CHANGED",
      positionFen: initial().fen,
    })
    expect(view.state().pendingChoice).toBeNull()
    expect(view.state().selectedSquare).toBeNull()
  })
  it.each(["white", "black"] as const)(
    "navigates visually and cycles owned pieces without selecting for %s",
    (orientation) => {
      const view = open(initial(), orientation)
      view.actor.send({ type: "BOARD.FOCUSED", square: "e4" })
      view.actor.send({
        type: "BOARD.NAVIGATED",
        key: "ArrowRight",
        board: view.board,
      })
      expect(view.state().focusedSquare).toBe(
        orientation === "white" ? "f4" : "d4",
      )
      view.actor.send({
        type: "BOARD.PIECE_CYCLED",
        direction: "nextPiece",
        board: view.board,
      })
      expect(view.state().focusedSquare).toBe(
        orientation === "white" ? "a2" : "h7",
      )
      view.actor.send({
        type: "BOARD.PIECE_CYCLED",
        direction: "previousPiece",
        board: view.board,
      })
      expect(view.state().focusedSquare).toBe(
        orientation === "white" ? "h1" : "a8",
      )
      expect(view.state().selectedSquare).toBeNull()
      expect(view.moves).toEqual([])
    },
  )
  it.each(["normal", "castle"] as const)(
    "keeps Chess960 %s explicit at an ambiguous king destination",
    (kind) => {
      const view = open(restored("r4k1r/8/8/8/8/8/8/R4K1R w HAha - 0 1", true))
      view.choose("f1")
      view.choose("g1")
      expect(view.state().pendingChoice?.moves).toHaveLength(2)
      expect(view.moves).toEqual([])
      const move = view
        .state()
        .pendingChoice?.moves.find((entry) => entry.kind === kind)
      if (move === undefined) throw new Error("Expected ambiguous move")
      view.actor.send({
        type: "BOARD.MOVE_CHOSEN",
        moveId: move.id,
        board: view.board,
      })
      expect(view.moves).toEqual([move.id])
    },
  )
  it("accepts a castling rook-square target through canonical legal moves", () => {
    const view = open(restored("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"))
    const castle = view.board.legalMoves.find(
      (move) => move.kind === "castle" && move.side === "king",
    )
    if (castle?.kind !== "castle") throw new Error("Expected kingside castle")
    view.choose("e1")
    view.choose(castle.rookFrom)
    expect(view.moves).toEqual([castle.id])
  })
})
