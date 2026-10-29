"use client"

import cx from "classix"
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import type { MapachessCatalog } from "@mapachess/localization/catalog"
import CHESS_BOARD_PALETTES from "@mapachess/match-presentation/chess-board-palettes"
import lastMoveHighlight from "@mapachess/match-presentation/last-move-highlight"
import type { BetterHintsResult } from "@mapachess/match/better-hints"
import type {
  AppliedMatchMove,
  LegalMatchMove,
  MatchMoveId,
} from "@mapachess/match/match-move"
import type {
  MatchBoardPiece,
  MatchPosition,
  MatchSquare,
} from "@mapachess/match/match-position"
import {
  actionForKeyboardCode,
  isInputDirection,
} from "@mapachess/match/player-input"
import {
  createBoardSquareRows,
  cycleOwnPieceFocus,
  nextFocusedBoardSquare,
  type BoardNavigationKey,
  type BoardOrientation,
} from "../../lib/board/boardPresentation"
import {
  usePlayerInput,
  usePlayerInputScope,
} from "../input/PlayerInputProvider"
import MapachessButton from "../presentation/MapachessButton"
import MapachessDialog from "../presentation/MapachessDialog"
import ScrollActions from "../presentation/ScrollActions"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"
import BetterHintsOverlay from "./BetterHintsOverlay"
import {
  ChessBoardArtwork,
  ChessPiece,
  useDisplayedChessAppearance,
} from "./ChessArtwork"
import ChessSquareAnnotations from "./ChessSquareAnnotations"

type BoardCopy = MapachessCatalog["board"]

const PROMOTION_ROLES = ["queen", "rook", "bishop", "knight"] as const

type PendingMoveChoice = Readonly<{
  moves: readonly LegalMatchMove[]
  to: MatchSquare
}>

export const boardDestinationMoves = (
  moves: readonly LegalMatchMove[],
  square: MatchSquare,
): readonly LegalMatchMove[] =>
  moves.filter(
    (move) =>
      move.to === square ||
      (move.kind === "castle" && move.rookFrom === square),
  )

const moveChoiceLabel = (move: LegalMatchMove, copy: BoardCopy): string => {
  if (move.kind === "castle") return copy.castle(move.san, move.to, move.rookTo)
  return move.promotion === null
    ? copy.moveKing(move.to)
    : copy.promote(move.promotion)
}

export type CanonicalChessboardProps = Readonly<{
  disabled: boolean
  hints: BetterHintsResult | null
  legalMoves: readonly LegalMatchMove[]
  lastMove: AppliedMatchMove | null
  onMove: (moveId: MatchMoveId) => void
  orientation: BoardOrientation
  position: MatchPosition
  showMoveHints: boolean
}>

const pieceAtSquare = (
  position: MatchPosition,
  square: MatchSquare,
): MatchBoardPiece | undefined =>
  position.pieces.find((piece) => piece.square === square)

const hintDescriptionsForSquare = (
  hints: BetterHintsResult | null,
  showMoveHints: boolean,
  square: MatchSquare,
  copy: BoardCopy,
): readonly string[] => {
  if (hints === null) return []

  const descriptions: string[] = []
  for (const [owner, ownedHints] of [
    ["player", hints.player],
    ["opponent", hints.opponent],
  ] as const) {
    if (ownedHints.some((hint) => hint.from === square)) {
      descriptions.push(copy.pieceHint(owner))
    }
    if (showMoveHints) {
      descriptions.push(
        ...ownedHints
          .filter((hint) => hint.to === square)
          .map((hint) =>
            hint.castling === undefined
              ? copy.moveHint(owner, hint.from)
              : copy.castleHint(
                  owner,
                  hint.castling.side,
                  hint.to,
                  hint.castling.rookFrom,
                  hint.castling.rookTo,
                ),
          ),
      )
    }
  }
  return descriptions
}

const isNavigationKey = (key: string): key is BoardNavigationKey =>
  key === "ArrowDown" ||
  key === "ArrowLeft" ||
  key === "ArrowRight" ||
  key === "ArrowUp" ||
  key === "End" ||
  key === "Home"

const baseSquareClasses =
  "group text-mapachito-charcoal relative grid aspect-square min-h-0 min-w-0 cursor-pointer place-items-center overflow-hidden border-0 bg-transparent p-0 text-[clamp(1rem,8cqw,4.75rem)] leading-none outline-none! aria-disabled:cursor-default"

export default function CanonicalChessboard({
  disabled,
  hints,
  legalMoves,
  lastMove,
  onMove,
  orientation,
  position,
  showMoveHints,
}: CanonicalChessboardProps) {
  const copy = useMapachessCopy().board
  const appearance = useDisplayedChessAppearance()
  const palette = CHESS_BOARD_PALETTES[appearance.boardId]
  const input = usePlayerInput()
  const rows = useMemo(() => createBoardSquareRows(orientation), [orientation])
  const initialFocusSquare = orientation === "white" ? "e1" : "e8"
  const [focusedSquare, setFocusedSquare] =
    useState<MatchSquare>(initialFocusSquare)
  const [selectedSquare, setSelectedSquare] = useState<MatchSquare | null>(null)
  const [pendingChoice, setPendingChoice] = useState<PendingMoveChoice | null>(
    null,
  )
  const squareElements = useRef(new Map<MatchSquare, HTMLButtonElement>())
  const firstChoiceButton = useRef<HTMLButtonElement>(null)
  const boardElement = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setPendingChoice(null)
    setSelectedSquare(null)
  }, [position.fen])

  useEffect(() => {
    if (pendingChoice !== null) firstChoiceButton.current?.focus()
  }, [pendingChoice])

  const selectedMoves =
    selectedSquare === null
      ? []
      : legalMoves.filter((move) => move.from === selectedSquare)

  const clearSelection = (): void => {
    setPendingChoice(null)
    squareElements.current.get(selectedSquare ?? focusedSquare)?.focus()
    setSelectedSquare(null)
  }

  const commitMove = (moveId: MatchMoveId): void => {
    if (disabled) return
    clearSelection()
    onMove(moveId)
  }

  const chooseSquare = (square: MatchSquare): void => {
    if (disabled || pendingChoice !== null) return
    if (selectedSquare === square) {
      setSelectedSquare(null)
      return
    }

    const destinationMoves = boardDestinationMoves(selectedMoves, square)
    if (destinationMoves.length === 1) {
      const move = destinationMoves[0]
      if (move !== undefined) commitMove(move.id)
      return
    }
    if (destinationMoves.length > 1) {
      setPendingChoice({ moves: destinationMoves, to: square })
      return
    }

    const piece = pieceAtSquare(position, square)
    const selectable =
      piece?.color === position.turn &&
      legalMoves.some((move) => move.from === square)
    setSelectedSquare(selectable ? square : null)
  }

  const moveFocus = (
    event: KeyboardEvent<HTMLButtonElement>,
    square: MatchSquare,
  ): void => {
    if (
      !isNavigationKey(event.key) ||
      (input !== null &&
        ((event.key !== "Home" && event.key !== "End") ||
          actionForKeyboardCode(input.bindings, event.code) !== undefined))
    )
      return

    event.preventDefault()
    const nextSquare = nextFocusedBoardSquare(rows, square, event.key)
    setFocusedSquare(nextSquare)
    squareElements.current.get(nextSquare)?.focus()
  }

  usePlayerInputScope({
    root: boardElement,
    focused: true,
    handle: (action) => {
      if (isInputDirection(action)) {
        const keys = {
          up: "ArrowUp",
          down: "ArrowDown",
          left: "ArrowLeft",
          right: "ArrowRight",
        } as const
        const next = nextFocusedBoardSquare(rows, focusedSquare, keys[action])
        squareElements.current.get(next)?.focus()
        return true
      }
      if (action === "previousPiece" || action === "nextPiece") {
        squareElements.current
          .get(
            cycleOwnPieceFocus(
              rows,
              position.pieces,
              orientation,
              focusedSquare,
              action,
            ),
          )
          ?.focus()
        return true
      }
      if (action === "confirm") {
        chooseSquare(focusedSquare)
        return true
      }
      if (action === "cancel" && selectedSquare !== null) {
        clearSelection()
        return true
      }
      return false
    },
  })

  const choosingPromotion =
    pendingChoice?.moves.every(
      (move) => move.kind === "normal" && move.promotion !== null,
    ) ?? false
  const choiceMoves =
    pendingChoice === null
      ? []
      : [...pendingChoice.moves].sort((left, right) =>
          left.kind === "normal" &&
          right.kind === "normal" &&
          left.promotion !== null &&
          right.promotion !== null
            ? PROMOTION_ROLES.indexOf(left.promotion) -
              PROMOTION_ROLES.indexOf(right.promotion)
            : 0,
        )

  return (
    <div className="[container-type:inline-size] relative w-full min-w-0">
      <div className="relative">
        <div
          aria-label={copy.orientation(orientation)}
          className="border-mapachito-charcoal relative grid aspect-square w-full grid-rows-8 overflow-hidden border"
          role="grid"
          ref={boardElement}
        >
          <ChessBoardArtwork orientation={orientation} />
          {rows.map((row, rowIndex) => (
            <div className="grid grid-cols-8" key={row[0]} role="row">
              {row.map((square, columnIndex) => {
                const piece = pieceAtSquare(position, square)
                const selected = selectedSquare === square
                const legalDestination =
                  boardDestinationMoves(selectedMoves, square).length > 0
                const checkedKing =
                  position.inCheck &&
                  piece?.color === position.turn &&
                  piece.role === "king"
                const file = square.slice(0, 1)
                const rank = square.slice(1)

                return (
                  <button
                    aria-disabled={disabled}
                    aria-label={copy.square(
                      square,
                      piece,
                      selected,
                      legalDestination,
                      disabled,
                      hintDescriptionsForSquare(
                        hints,
                        showMoveHints,
                        square,
                        copy,
                      ),
                    )}
                    aria-selected={selected}
                    className={baseSquareClasses}
                    data-square={square}
                    key={square}
                    onClick={() => chooseSquare(square)}
                    onFocus={() => setFocusedSquare(square)}
                    onKeyDown={(event) => moveFocus(event, square)}
                    ref={(element) => {
                      if (element === null)
                        squareElements.current.delete(square)
                      else squareElements.current.set(square, element)
                    }}
                    role="gridcell"
                    tabIndex={focusedSquare === square ? 0 : -1}
                    type="button"
                  >
                    <ChessSquareAnnotations
                      checked={checkedKing}
                      controller={input?.device.method === "controller"}
                      history={lastMoveHighlight(lastMove, square)}
                      legal={legalDestination}
                      palette={palette}
                      selected={selected}
                    />
                    {piece === undefined ? null : (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none relative z-10 size-full select-none"
                      >
                        <ChessPiece color={piece.color} role={piece.role} />
                      </span>
                    )}
                    {columnIndex === 0 ? (
                      <span
                        aria-hidden="true"
                        className="text-mapachito-charcoal bg-mapachito-white/90 pointer-events-none absolute top-0.5 left-0.5 z-10 rounded-sm px-0.5 font-mono text-[clamp(0.55rem,1.4vw,0.75rem)] font-black"
                      >
                        {rank}
                      </span>
                    ) : null}
                    {rowIndex === 7 ? (
                      <span
                        aria-hidden="true"
                        className="text-mapachito-charcoal bg-mapachito-white/90 pointer-events-none absolute right-0.5 bottom-0.5 z-10 rounded-sm px-0.5 font-mono text-[clamp(0.55rem,1.4vw,0.75rem)] font-black"
                      >
                        {file}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {hints === null ? null : (
          <BetterHintsOverlay
            hints={hints}
            orientation={orientation}
            palette={palette.hints}
            showMoves={showMoveHints}
          />
        )}
      </div>

      {pendingChoice === null ? null : (
        <MapachessDialog
          label={
            choosingPromotion
              ? copy.promoteOn(pendingChoice.to)
              : copy.chooseMove(pendingChoice.to)
          }
          onClose={clearSelection}
          fixedContent
          placement="bottom"
        >
          <ScrollActions
            actions={
              <MapachessButton
                variant="secondary"
                className="w-full"
                onClick={clearSelection}
              >
                {choosingPromotion ? copy.cancelPromotion : copy.cancelMove}
              </MapachessButton>
            }
          >
            <h2 className="font-display text-xl leading-tight font-black">
              {choosingPromotion
                ? copy.promoteOn(pendingChoice.to)
                : copy.chooseMove(pendingChoice.to)}
            </h2>
            <div
              className={cx(
                "mt-4 grid gap-2",
                choosingPromotion &&
                  "grid-cols-[repeat(auto-fit,minmax(min(6.5rem,100%),1fr))]",
              )}
            >
              {(choosingPromotion
                ? [choiceMoves.slice(0, 2), choiceMoves.slice(2)]
                : [choiceMoves]
              ).map((group, groupIndex) => (
                <div
                  className={cx(
                    "grid gap-2",
                    choosingPromotion && "grid-cols-2",
                  )}
                  key={group[0]?.id}
                >
                  {group.map((move, index) => (
                    <MapachessButton
                      variant="secondary"
                      aria-label={moveChoiceLabel(move, copy)}
                      className={
                        choosingPromotion
                          ? "grid aspect-square min-w-0 place-items-center p-1!"
                          : "w-full min-w-0 wrap-anywhere"
                      }
                      disabled={disabled}
                      key={move.id}
                      onClick={() => commitMove(move.id)}
                      ref={
                        groupIndex === 0 && index === 0
                          ? firstChoiceButton
                          : undefined
                      }
                      type="button"
                    >
                      {move.kind === "normal" && move.promotion !== null ? (
                        <ChessPiece
                          color={position.turn}
                          role={move.promotion}
                          fitToSquare
                        />
                      ) : (
                        moveChoiceLabel(move, copy)
                      )}
                    </MapachessButton>
                  ))}
                </div>
              ))}
            </div>
          </ScrollActions>
        </MapachessDialog>
      )}
    </div>
  )
}
