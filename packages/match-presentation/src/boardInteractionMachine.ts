import {
  fromTransition,
  type ActorRefFrom,
  type ActorSystem,
  type ActorSystemInfo,
} from "xstate"
import type { LegalMatchMove, MatchMoveId } from "@mapachess/match/match-move"
import type {
  MatchColor,
  MatchPosition,
  MatchSquare,
} from "@mapachess/match/match-position"
import {
  boardDestinationMoves,
  createBoardSquareRows,
  cycleOwnPieceFocus,
  nextFocusedBoardSquare,
  type BoardNavigationKey,
} from "./boardPresentation.js"

export type BoardObservation = Readonly<{
  position: MatchPosition
  legalMoves: readonly LegalMatchMove[]
  disabled: boolean
  orientation: MatchColor
}>
export type BoardMoveChoice = Readonly<{
  positionFen: string
  to: MatchSquare
  moves: readonly LegalMatchMove[]
}>
export type BoardInteractionContext = Readonly<{
  positionFen: string
  focusedSquare: MatchSquare
  selectedSquare: MatchSquare | null
  pendingChoice: BoardMoveChoice | null
}>
type BoardInput = Readonly<{ positionFen: string; orientation: MatchColor }>
export type BoardInteractionEvent =
  | Readonly<{ type: "BOARD.POSITION_CHANGED"; positionFen: string }>
  | Readonly<{ type: "BOARD.FOCUSED"; square: MatchSquare }>
  | (Readonly<{ board: BoardObservation }> &
      (
        | Readonly<{ type: "BOARD.SQUARE_CHOSEN"; square: MatchSquare }>
        | Readonly<{ type: "BOARD.MOVE_CHOSEN"; moveId: MatchMoveId }>
        | Readonly<{ type: "BOARD.NAVIGATED"; key: BoardNavigationKey }>
        | Readonly<{
            type: "BOARD.PIECE_CYCLED"
            direction: "previousPiece" | "nextPiece"
          }>
        | Readonly<{ type: "BOARD.CANCELED" }>
      ))
type BoardEmission =
  | Readonly<{ type: "BOARD.MOVE_REQUESTED"; moveId: MatchMoveId }>
  | Readonly<{
      type: "BOARD.FOCUS_REQUESTED"
      square: MatchSquare
      reason: "navigation" | "return"
    }>

const atPosition = (
  context: BoardInteractionContext,
  positionFen: string,
): BoardInteractionContext =>
  context.positionFen === positionFen
    ? context
    : { ...context, positionFen, selectedSquare: null, pendingChoice: null }

const boardInteractionMachine = fromTransition<
  BoardInteractionContext,
  BoardInteractionEvent,
  ActorSystem<ActorSystemInfo>,
  BoardInput,
  BoardEmission
>(
  (previous, event, { emit }) => {
    if (event.type === "BOARD.POSITION_CHANGED")
      return atPosition(previous, event.positionFen)
    if (event.type === "BOARD.FOCUSED")
      return { ...previous, focusedSquare: event.square }
    // ONE-TIME EXCEPTION: XState also delivers internal stop events to transition actors.
    if (!("board" in event)) return previous
    const { board } = event
    const context = atPosition(previous, board.position.fen)
    const returnFocus = (): BoardInteractionContext => {
      const square = context.selectedSquare ?? context.focusedSquare
      emit({ type: "BOARD.FOCUS_REQUESTED", square, reason: "return" })
      return {
        ...context,
        focusedSquare: square,
        selectedSquare: null,
        pendingChoice: null,
      }
    }
    if (event.type === "BOARD.CANCELED") return returnFocus()
    if (
      event.type === "BOARD.NAVIGATED" ||
      event.type === "BOARD.PIECE_CYCLED"
    ) {
      const rows = createBoardSquareRows(board.orientation)
      const square =
        event.type === "BOARD.NAVIGATED"
          ? nextFocusedBoardSquare(rows, context.focusedSquare, event.key)
          : cycleOwnPieceFocus(
              rows,
              board.position.pieces,
              board.orientation,
              context.focusedSquare,
              event.direction,
            )
      emit({ type: "BOARD.FOCUS_REQUESTED", square, reason: "navigation" })
      return { ...context, focusedSquare: square }
    }
    if (board.disabled) return context
    if (event.type === "BOARD.MOVE_CHOSEN") {
      const pending = context.pendingChoice
      if (
        pending === null ||
        pending.positionFen !== board.position.fen ||
        !pending.moves.some((move) => move.id === event.moveId) ||
        !board.legalMoves.some((move) => move.id === event.moveId)
      )
        return context
      const next = returnFocus()
      emit({ type: "BOARD.MOVE_REQUESTED", moveId: event.moveId })
      return next
    }
    if (context.pendingChoice !== null) return context
    if (context.selectedSquare === event.square)
      return { ...context, selectedSquare: null }
    const moves = boardDestinationMoves(
      board.legalMoves.filter((move) => move.from === context.selectedSquare),
      event.square,
    )
    const move = moves[0]
    if (moves.length === 1 && move !== undefined) {
      const next = returnFocus()
      emit({ type: "BOARD.MOVE_REQUESTED", moveId: move.id })
      return next
    }
    if (moves.length > 1)
      return {
        ...context,
        pendingChoice: {
          positionFen: board.position.fen,
          to: event.square,
          moves,
        },
      }
    const piece = board.position.pieces.find(
      (entry) => entry.square === event.square,
    )
    const selectable =
      piece?.color === board.position.turn &&
      board.legalMoves.some((candidate) => candidate.from === event.square)
    return { ...context, selectedSquare: selectable ? event.square : null }
  },
  ({ input }) => ({
    positionFen: input.positionFen,
    focusedSquare: input.orientation === "white" ? "e1" : "e8",
    selectedSquare: null,
    pendingChoice: null,
  }),
)

export type BoardInteractionActor = ActorRefFrom<typeof boardInteractionMachine>
export default boardInteractionMachine
