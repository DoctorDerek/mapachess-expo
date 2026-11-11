import cx from "classix"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Pressable, View } from "react-native"
import {
  boardDestinationMoves,
  createBoardSquareRows,
  cycleOwnPieceFocus,
  hintDescriptionsForSquare,
  nextFocusedBoardSquare,
} from "@mapachess/match-presentation/board-presentation"
import { CHESS_BOARDS } from "@mapachess/match-presentation/chess-appearance-catalog"
import CHESS_BOARD_PALETTES from "@mapachess/match-presentation/chess-board-palettes"
import lastMoveHighlight from "@mapachess/match-presentation/last-move-highlight"
import type { BetterHintsResult } from "@mapachess/match/better-hints"
import {
  MATCH_PROMOTION_ROLES,
  type AppliedMatchMove,
  type LegalMatchMove,
  type MatchMoveId,
} from "@mapachess/match/match-move"
import type {
  MatchColor,
  MatchPosition,
  MatchSquare,
} from "@mapachess/match/match-position"
import { isInputDirection } from "@mapachess/match/player-input"
import type { ChessAppearanceSettings } from "@mapachess/profile/chess-appearance-settings"
import assets from "@/lib/presentation/nativeAssetManifest"
import { useNativeInputControl } from "../input/NativeInputProvider"
import NativeButton from "../presentation/NativeButton"
import NativeImage from "../presentation/NativeImage"
import NativePanel from "../presentation/NativePanel"
import NativeText from "../presentation/NativeText"
import { useNativeLocale } from "../profile/NativeLocaleProvider"
import NativeBetterHints from "./NativeBetterHints"
import NativeChessPiece from "./NativeChessPiece"

export default function NativeChessboard({
  position,
  orientation,
  legalMoves,
  disabled,
  appearance,
  hints,
  showMoveHints,
  lastMove,
  onMove,
  renderBoardHost,
}: Readonly<{
  position: MatchPosition
  orientation: MatchColor
  legalMoves: readonly LegalMatchMove[]
  disabled: boolean
  appearance: ChessAppearanceSettings
  hints: BetterHintsResult | null
  showMoveHints: boolean
  lastMove: AppliedMatchMove | null
  onMove: (move: MatchMoveId) => void
  renderBoardHost?: (board: ReactNode, promotion: ReactNode) => ReactNode
}>) {
  const { copy } = useNativeLocale()
  const rows = useMemo(() => createBoardSquareRows(orientation), [orientation])
  const [selected, setSelected] = useState<MatchSquare | null>(null)
  const [pending, setPending] = useState<readonly LegalMatchMove[]>([])
  const [failedBoard, setFailedBoard] = useState<string | null>(null)
  const boardRef = useRef<View>(null)
  const [focusedSquare, setFocusedSquare] = useState<MatchSquare>(
    orientation === "white" ? "e2" : "e7",
  )
  useEffect(() => {
    setSelected(null)
    setPending([])
  }, [position.fen, disabled])
  const selectedMoves =
    selected === null ? [] : legalMoves.filter((move) => move.from === selected)
  const board = CHESS_BOARDS.find(({ id }) => id === appearance.boardId)
  const requestedSource =
    board === undefined || board.kind === "colors"
      ? null
      : `${board.delivery === "public" ? "/chess-assets" : "/generated/chess-assets"}/${board.image.path}`
  const source =
    requestedSource !== null && assets.images[requestedSource] !== undefined
      ? requestedSource
      : null
  const palette =
    CHESS_BOARD_PALETTES[
      source === null || failedBoard === source ? "current" : appearance.boardId
    ]
  const choose = (square: MatchSquare): void => {
    if (disabled) return
    const moves = boardDestinationMoves(selectedMoves, square)
    if (moves.length === 1 && moves[0] !== undefined) {
      setSelected(null)
      onMove(moves[0].id)
      return
    }
    if (moves.length > 1) {
      setPending(moves)
      return
    }
    const piece = position.pieces.find((entry) => entry.square === square)
    setSelected(
      selected === square || piece?.color !== orientation ? null : square,
    )
  }
  const focused = useNativeInputControl(
    boardRef,
    () => choose(focusedSquare),
    !disabled,
    (action) => {
      if (isInputDirection(action)) {
        const keys = {
          up: "ArrowUp",
          down: "ArrowDown",
          left: "ArrowLeft",
          right: "ArrowRight",
        } as const
        setFocusedSquare(
          nextFocusedBoardSquare(rows, focusedSquare, keys[action]),
        )
        return true
      }
      if (action === "previousPiece" || action === "nextPiece") {
        setFocusedSquare(
          cycleOwnPieceFocus(
            rows,
            position.pieces,
            orientation,
            focusedSquare,
            action,
          ),
        )
        return true
      }
      if (action === "cancel" && selected !== null) {
        setSelected(null)
        return true
      }
      return false
    },
  )
  const boardSurface = (
    <View
      ref={boardRef}
      focusable
      accessibilityLabel={copy.board.orientation(orientation)}
      className="bg-mapachito-white relative aspect-square w-full overflow-hidden rounded-lg"
    >
      {source !== null && failedBoard !== source ? (
        <View
          className={cx(
            "absolute inset-0",
            orientation === "black" && "rotate-180",
          )}
          pointerEvents="none"
        >
          <NativeImage
            sourceId={source}
            className="h-full w-full"
            onError={() => setFailedBoard(source)}
          />
        </View>
      ) : null}
      <View className="h-full w-full">
        {rows.map((row, rowIndex) => (
          <View className="flex-1 flex-row" key={row[0]}>
            {row.map((square, columnIndex) => {
              const piece = position.pieces.find(
                (entry) => entry.square === square,
              )
              const history = lastMoveHighlight(lastMove, square)
              const isSelected = selected === square
              const legal =
                boardDestinationMoves(selectedMoves, square).length > 0
              const checked =
                position.inCheck &&
                piece?.color === position.turn &&
                piece.role === "king"
              return (
                <Pressable
                  key={square}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel={copy.board.square(
                    square,
                    piece,
                    isSelected,
                    legal,
                    disabled,
                    hintDescriptionsForSquare(
                      hints,
                      showMoveHints,
                      square,
                      copy.board,
                    ),
                  )}
                  accessibilityState={{ disabled, selected: isSelected }}
                  onPress={() => choose(square)}
                  className={cx(
                    "relative aspect-square flex-1 items-center justify-center",
                    (source === null || failedBoard === source) &&
                      ((rowIndex + columnIndex) % 2 === 0
                        ? "bg-mapachito-white"
                        : "bg-mapachito-blue"),
                  )}
                >
                  {history !== null ? (
                    <View
                      pointerEvents="none"
                      className={cx(
                        "absolute inset-0 opacity-65",
                        history === "origin"
                          ? palette === "dark"
                            ? "bg-board-history-origin-on-dark"
                            : "bg-board-history-origin"
                          : palette === "dark"
                            ? "bg-board-history-destination-on-dark"
                            : "bg-board-history-destination",
                      )}
                    />
                  ) : null}
                  {checked ? (
                    <View
                      pointerEvents="none"
                      className="border-board-check absolute inset-0 border-4"
                    />
                  ) : null}
                  {isSelected ? (
                    <View
                      pointerEvents="none"
                      className="border-board-neutral-edge bg-board-neutral/30 absolute inset-1 rounded-md border-3"
                    />
                  ) : null}
                  {focused && focusedSquare === square ? (
                    <View
                      pointerEvents="none"
                      className="border-mapachito-orange absolute inset-0 z-10 border-4"
                    />
                  ) : null}
                  {piece === undefined ? null : (
                    <View pointerEvents="none" className="absolute inset-0.5">
                      <NativeChessPiece
                        color={piece.color}
                        role={piece.role}
                        pieceSetId={appearance.pieceSetId}
                      />
                    </View>
                  )}
                  {legal ? (
                    <View
                      pointerEvents="none"
                      className="border-board-neutral-edge bg-board-neutral absolute size-3 rounded-full border-2"
                    />
                  ) : null}
                  {columnIndex === 0 ? (
                    <NativeText
                      accessible={false}
                      className="text-mapachito-charcoal absolute top-0 left-0.5 text-xs"
                    >
                      {square.slice(1)}
                    </NativeText>
                  ) : null}
                  {rowIndex === rows.length - 1 ? (
                    <NativeText
                      accessible={false}
                      className="text-mapachito-charcoal absolute right-0.5 bottom-0 text-xs"
                    >
                      {square[0]}
                    </NativeText>
                  ) : null}
                </Pressable>
              )
            })}
          </View>
        ))}
      </View>
      {hints === null ? null : (
        <View pointerEvents="none" className="absolute inset-0">
          <NativeBetterHints
            hints={hints}
            orientation={orientation}
            showMoves={showMoveHints}
            palette={palette}
          />
        </View>
      )}
    </View>
  )
  const promotion =
    pending.length === 0 ? null : (
      <NativePanel
        title={copy.board.chooseMove(pending[0]?.to ?? "a1")}
        onBack={() => setPending([])}
        actions={
          <NativeButton variant="secondary" onPress={() => setPending([])}>
            {copy.board.cancelMove}
          </NativeButton>
        }
      >
        <View className="flex-row flex-wrap gap-3">
          {[...pending]
            .sort((left, right) =>
              left.kind === "normal" &&
              right.kind === "normal" &&
              left.promotion !== null &&
              right.promotion !== null
                ? MATCH_PROMOTION_ROLES.indexOf(left.promotion) -
                  MATCH_PROMOTION_ROLES.indexOf(right.promotion)
                : 0,
            )
            .map((move) => (
              <NativeButton
                key={move.id}
                className="min-h-24 min-w-28 flex-1 basis-28"
                accessibilityLabel={
                  move.kind === "castle"
                    ? copy.board.castle(move.san, move.to, move.rookTo)
                    : move.promotion === null
                      ? copy.board.moveKing(move.to)
                      : copy.board.promote(move.promotion)
                }
                onPress={() => {
                  setPending([])
                  setSelected(null)
                  onMove(move.id)
                }}
              >
                {move.kind === "normal" && move.promotion !== null ? (
                  <View className="size-20">
                    <NativeChessPiece
                      color={orientation}
                      role={move.promotion}
                      pieceSetId={appearance.pieceSetId}
                    />
                  </View>
                ) : (
                  <NativeText>{move.san}</NativeText>
                )}
              </NativeButton>
            ))}
        </View>
      </NativePanel>
    )
  return renderBoardHost === undefined ? (
    <View className="w-full">
      {boardSurface}
      {promotion}
    </View>
  ) : (
    renderBoardHost(boardSurface, promotion)
  )
}
