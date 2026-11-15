import { useActorRef, useSelector } from "@xstate/react"
import { useLayoutEffect, type ReactNode } from "react"
import type { MapachessCatalog } from "@mapachess/localization/catalog"
import boardInteractionMachine, {
  type BoardObservation,
} from "@mapachess/match-presentation/board-interaction-machine"
import type { ChessBoardPalette } from "@mapachess/match-presentation/chess-board-palettes"
import type { BetterHintsResult } from "@mapachess/match/better-hints"
import type { AppliedMatchMove, MatchMoveId } from "@mapachess/match/match-move"
import { isInputDirection } from "@mapachess/match/player-input"
import type { BoardElements, BoardInput } from "./boardElements.js"
import BoardGrid from "./BoardGrid.js"
import BoardMoveChoice from "./BoardMoveChoice.js"

export type ChessboardProps = BoardObservation &
  Readonly<{
    hints: BetterHintsResult | null
    showMoveHints: boolean
    lastMove: AppliedMatchMove | null
    palette: ChessBoardPalette
    copy: MapachessCatalog["board"]
    elements: BoardElements
    onMove: (moveId: MatchMoveId) => void
    renderBoardHost?: (board: ReactNode, promotion: ReactNode) => ReactNode
  }>

export default function Chessboard(props: ChessboardProps) {
  const {
    position,
    orientation,
    legalMoves,
    disabled,
    hints,
    showMoveHints,
    lastMove,
    palette,
    copy,
    elements,
    onMove,
    renderBoardHost,
  } = props
  const actor = useActorRef(boardInteractionMachine, {
    input: { positionFen: position.fen, orientation },
  })
  const state = useSelector(actor, (snapshot) => snapshot.context)
  useLayoutEffect(() => {
    const subscription = actor.on("BOARD.MOVE_REQUESTED", ({ moveId }) =>
      onMove(moveId),
    )
    return () => subscription.unsubscribe()
  }, [actor, onMove])
  useLayoutEffect(
    () =>
      actor.send({ type: "BOARD.POSITION_CHANGED", positionFen: position.fen }),
    [actor, position.fen],
  )
  const current = state.positionFen === position.fen
  const pending = current ? state.pendingChoice : null
  const board: BoardObservation = {
    position,
    orientation,
    legalMoves,
    disabled,
  }
  const cancel = () => actor.send({ type: "BOARD.CANCELED", board })
  const input: BoardInput = {
    actor,
    enabled: pending === null,
    focusedSquare: state.focusedSquare,
    onChoose: (square) =>
      actor.send({ type: "BOARD.SQUARE_CHOSEN", square, board }),
    onFocus: (square) => actor.send({ type: "BOARD.FOCUSED", square }),
    onNavigate: (key) => actor.send({ type: "BOARD.NAVIGATED", key, board }),
    onAction: (action) => {
      if (isInputDirection(action)) {
        const keys = {
          up: "ArrowUp",
          down: "ArrowDown",
          left: "ArrowLeft",
          right: "ArrowRight",
        } as const
        actor.send({ type: "BOARD.NAVIGATED", key: keys[action], board })
        return true
      }
      if (action === "previousPiece" || action === "nextPiece") {
        actor.send({ type: "BOARD.PIECE_CYCLED", direction: action, board })
        return true
      }
      if (action === "confirm") {
        actor.send({
          type: "BOARD.SQUARE_CHOSEN",
          square: actor.getSnapshot().context.focusedSquare,
          board,
        })
        return true
      }
      if (
        action === "cancel" &&
        actor.getSnapshot().context.selectedSquare !== null
      ) {
        cancel()
        return true
      }
      return false
    },
  }
  const surface = (
    <BoardGrid
      position={position}
      orientation={orientation}
      legalMoves={legalMoves}
      selectedSquare={current ? state.selectedSquare : null}
      disabled={disabled}
      hints={hints}
      showMoveHints={showMoveHints}
      lastMove={lastMove}
      palette={palette}
      copy={copy}
      elements={elements}
      input={input}
    />
  )
  const promotion =
    pending === null ? null : (
      <BoardMoveChoice
        choice={pending}
        color={position.turn}
        disabled={disabled}
        copy={copy}
        elements={elements}
        onCancel={cancel}
        onChoose={(moveId) =>
          actor.send({ type: "BOARD.MOVE_CHOSEN", moveId, board })
        }
      />
    )
  const { Group } = elements
  return renderBoardHost === undefined ? (
    <Group kind="frame" className="relative w-full min-w-0">
      {surface}
      {promotion}
    </Group>
  ) : (
    renderBoardHost(surface, promotion)
  )
}
