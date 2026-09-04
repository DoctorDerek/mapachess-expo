"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import type { BetterHintsResult } from "@mapachess/match/better-hints"
import type {
  AppliedMatchMove,
  LegalMatchMove,
  MatchMoveId,
  MatchPromotionRole,
} from "@mapachess/match/match-move"
import type {
  MatchBoardPiece,
  MatchColor,
  MatchPieceRole,
  MatchPosition,
  MatchSquare,
} from "@mapachess/match/match-position"
import {
  createBoardSquareRows,
  nextFocusedBoardSquare,
  type BoardNavigationKey,
  type BoardOrientation,
} from "../../lib/board/boardPresentation"
import MapachessButton from "../presentation/MapachessButton"
import BetterHintsOverlay from "./BetterHintsOverlay"

const PIECE_GLYPHS = Object.freeze({
  black: Object.freeze({
    bishop: "♝",
    king: "♚",
    knight: "♞",
    pawn: "♟",
    queen: "♛",
    rook: "♜",
  }),
  white: Object.freeze({
    bishop: "♗",
    king: "♔",
    knight: "♘",
    pawn: "♙",
    queen: "♕",
    rook: "♖",
  }),
}) satisfies Readonly<
  Record<MatchColor, Readonly<Record<MatchPieceRole, string>>>
>

const PIECE_NAMES = Object.freeze({
  bishop: "bishop",
  king: "king",
  knight: "knight",
  pawn: "pawn",
  queen: "queen",
  rook: "rook",
}) satisfies Readonly<Record<MatchPieceRole, string>>

const PROMOTION_ROLES = ["queen", "rook", "bishop", "knight"] as const

type PendingPromotion = Readonly<{
  moves: readonly LegalMatchMove[]
  to: MatchSquare
}>

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

const capitalize = (value: string): string =>
  `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`

const squareLabel = (
  square: MatchSquare,
  piece: MatchBoardPiece | undefined,
  selected: boolean,
  legalDestination: boolean,
  disabled: boolean,
  hintDescriptions: readonly string[],
): string => {
  const parts = [
    square,
    piece === undefined
      ? "empty"
      : `${capitalize(piece.color)} ${PIECE_NAMES[piece.role]}`,
  ]
  if (selected) parts.push("selected")
  if (legalDestination) parts.push("legal destination")
  if (disabled) parts.push("board not accepting moves")
  parts.push(...hintDescriptions)
  return parts.join(", ")
}

const hintDescriptionsForSquare = (
  hints: BetterHintsResult | null,
  showMoveHints: boolean,
  square: MatchSquare,
): readonly string[] => {
  if (hints === null) return []

  const descriptions: string[] = []
  for (const [owner, ownedHints] of [
    ["Player", hints.player],
    ["Opponent", hints.opponent],
  ] as const) {
    if (ownedHints.some((hint) => hint.from === square)) {
      descriptions.push(`${owner} Piece Hint`)
    }
    if (showMoveHints) {
      descriptions.push(
        ...ownedHints
          .filter((hint) => hint.to === square)
          .map((hint) => `${owner} Move Hint destination from ${hint.from}`),
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
  "group relative grid aspect-square min-h-0 min-w-0 cursor-pointer place-items-center overflow-hidden border-0 p-0 text-[clamp(1.65rem,8vw,4.75rem)] leading-none transition-[filter,box-shadow] outline-none focus-visible:ring-4 focus-visible:ring-[var(--mapachito-orange)] focus-visible:ring-inset aria-disabled:cursor-default"

const squareColorClasses = (rowIndex: number, columnIndex: number): string =>
  (rowIndex + columnIndex) % 2 === 0
    ? "bg-[var(--mapachess-board-light-square)] text-[var(--mapachito-charcoal)]"
    : "bg-[var(--mapachess-board-dark-square)] text-[var(--mapachito-charcoal)]"

const pieceColorClasses = (color: MatchColor): string =>
  color === "white"
    ? "text-[var(--mapachito-white)] [filter:drop-shadow(0_2px_1px_rgb(30_30_30/0.95))]"
    : "text-[var(--mapachito-charcoal)] [filter:drop-shadow(0_1px_0_rgb(255_255_255/0.75))]"

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
  const rows = useMemo(() => createBoardSquareRows(orientation), [orientation])
  const initialFocusSquare = orientation === "white" ? "e1" : "e8"
  const [focusedSquare, setFocusedSquare] =
    useState<MatchSquare>(initialFocusSquare)
  const [selectedSquare, setSelectedSquare] = useState<MatchSquare | null>(null)
  const [pendingPromotion, setPendingPromotion] =
    useState<PendingPromotion | null>(null)
  const squareElements = useRef(new Map<MatchSquare, HTMLButtonElement>())
  const firstPromotionButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setPendingPromotion(null)
    setSelectedSquare(null)
  }, [position.fen])

  useEffect(() => {
    if (pendingPromotion !== null) firstPromotionButton.current?.focus()
  }, [pendingPromotion])

  const selectedMoves =
    selectedSquare === null
      ? []
      : legalMoves.filter((move) => move.from === selectedSquare)

  const clearSelection = (): void => {
    setPendingPromotion(null)
    setSelectedSquare(null)
  }

  const commitMove = (moveId: MatchMoveId): void => {
    clearSelection()
    onMove(moveId)
  }

  const chooseSquare = (square: MatchSquare): void => {
    if (disabled || pendingPromotion !== null) return
    if (selectedSquare === square) {
      setSelectedSquare(null)
      return
    }

    const destinationMoves = selectedMoves.filter((move) => move.to === square)
    if (destinationMoves.length === 1) {
      const move = destinationMoves[0]
      if (move !== undefined) commitMove(move.id)
      return
    }
    if (destinationMoves.length > 1) {
      setPendingPromotion({ moves: destinationMoves, to: square })
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
    if (!isNavigationKey(event.key)) return

    event.preventDefault()
    const nextSquare = nextFocusedBoardSquare(rows, square, event.key)
    setFocusedSquare(nextSquare)
    squareElements.current.get(nextSquare)?.focus()
  }

  const choosePromotion = (role: MatchPromotionRole): void => {
    const move = pendingPromotion?.moves.find(
      (candidate) =>
        candidate.kind === "normal" && candidate.promotion === role,
    )
    if (move === undefined) {
      throw new Error("Promotion selection has no canonical legal move.")
    }

    commitMove(move.id)
  }

  return (
    <div className="relative w-full max-w-[min(100%,52rem)] xl:max-w-[min(100%,calc(100dvh-6rem))]">
      <div
        aria-label={`Chessboard, ${capitalize(orientation)} at bottom`}
        className="mapachess-board-frame grid aspect-square w-full grid-rows-8"
        role="grid"
      >
        {rows.map((row, rowIndex) => (
          <div className="grid grid-cols-8" key={row[0]} role="row">
            {row.map((square, columnIndex) => {
              const piece = pieceAtSquare(position, square)
              const selected = selectedSquare === square
              const legalDestination = selectedMoves.some(
                (move) => move.to === square,
              )
              const partOfLastMove =
                lastMove?.from === square || lastMove?.to === square
              const checkedKing =
                position.inCheck &&
                piece?.color === position.turn &&
                piece.role === "king"
              const file = square.slice(0, 1)
              const rank = square.slice(1)

              return (
                <button
                  aria-disabled={disabled}
                  aria-label={squareLabel(
                    square,
                    piece,
                    selected,
                    legalDestination,
                    disabled,
                    hintDescriptionsForSquare(hints, showMoveHints, square),
                  )}
                  aria-selected={selected}
                  className={`${baseSquareClasses} ${squareColorClasses(rowIndex, columnIndex)} ${selected ? "ring-4 ring-[var(--mapachito-raspberry)] ring-inset" : ""} ${partOfLastMove ? "after:absolute after:inset-[8%] after:rounded-sm after:border-[clamp(2px,0.35vw,4px)] after:border-[var(--mapachito-orange)]" : ""} ${checkedKing ? "bg-[var(--mapachito-red)] ring-4 ring-[var(--mapachito-charcoal)] ring-inset" : ""}`}
                  data-square={square}
                  key={square}
                  onClick={() => chooseSquare(square)}
                  onFocus={() => setFocusedSquare(square)}
                  onKeyDown={(event) => moveFocus(event, square)}
                  ref={(element) => {
                    if (element === null) squareElements.current.delete(square)
                    else squareElements.current.set(square, element)
                  }}
                  role="gridcell"
                  tabIndex={focusedSquare === square ? 0 : -1}
                  type="button"
                >
                  {piece === undefined ? null : (
                    <span
                      aria-hidden="true"
                      className={`relative z-10 select-none ${pieceColorClasses(piece.color)}`}
                    >
                      {PIECE_GLYPHS[piece.color][piece.role]}
                    </span>
                  )}
                  {legalDestination ? (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-[11%] z-[5] rounded-sm border-[clamp(3px,0.5vw,6px)] border-[var(--mapachess-board-legal-move)] [box-shadow:0_0_0_2px_var(--mapachess-board-hint-outline)]"
                      data-legal-destination-shape="square-outline"
                    />
                  ) : null}
                  {columnIndex === 0 ? (
                    <span
                      aria-hidden="true"
                      className="absolute top-1 left-1 z-10 font-mono text-[clamp(0.55rem,1.4vw,0.75rem)] font-black text-[var(--mapachito-charcoal)] opacity-75"
                    >
                      {rank}
                    </span>
                  ) : null}
                  {rowIndex === 7 ? (
                    <span
                      aria-hidden="true"
                      className="absolute right-1 bottom-1 z-10 font-mono text-[clamp(0.55rem,1.4vw,0.75rem)] font-black text-[var(--mapachito-charcoal)] opacity-75"
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
          showMoves={showMoveHints}
        />
      )}

      {pendingPromotion === null ? null : (
        <div
          aria-labelledby="promotion-title"
          aria-modal="true"
          className="absolute inset-0 z-30 grid place-items-center rounded-[clamp(0.75rem,2vw,1.25rem)] bg-[rgb(30_30_30/0.84)] p-6 backdrop-blur-sm"
          onKeyDown={(event) => {
            if (event.key === "Escape") clearSelection()
          }}
          role="dialog"
        >
          <div className="mapachess-surface w-full max-w-md p-5">
            <h2 className="mapachess-subheading" id="promotion-title">
              Promote on {pendingPromotion.to}
            </h2>
            <div className="mt-4 grid grid-cols-4 gap-3">
              {PROMOTION_ROLES.map((role, index) => (
                <MapachessButton
                  variant="secondary"
                  aria-label={`Promote to ${PIECE_NAMES[role]}`}
                  className="grid aspect-square place-items-center text-5xl"
                  key={role}
                  onClick={() => choosePromotion(role)}
                  ref={index === 0 ? firstPromotionButton : undefined}
                  type="button"
                >
                  <span aria-hidden="true">
                    {PIECE_GLYPHS[position.turn][role]}
                  </span>
                </MapachessButton>
              ))}
            </div>
            <MapachessButton
              variant="secondary"
              className="mt-4 w-full"
              onClick={clearSelection}
              type="button"
            >
              Cancel promotion
            </MapachessButton>
          </div>
        </div>
      )}
    </div>
  )
}
