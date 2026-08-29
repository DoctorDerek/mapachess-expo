"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
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
  legalMoves: readonly LegalMatchMove[]
  lastMove: AppliedMatchMove | null
  onMove: (moveId: MatchMoveId) => void
  orientation: BoardOrientation
  position: MatchPosition
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
  return parts.join(", ")
}

const isNavigationKey = (key: string): key is BoardNavigationKey =>
  key === "ArrowDown" ||
  key === "ArrowLeft" ||
  key === "ArrowRight" ||
  key === "ArrowUp" ||
  key === "End" ||
  key === "Home"

const baseSquareClasses =
  "group relative grid aspect-square min-h-0 min-w-0 cursor-pointer place-items-center overflow-hidden border-0 p-0 text-[clamp(1.65rem,8vw,4.75rem)] leading-none transition-[filter,box-shadow] outline-none focus-visible:z-20 focus-visible:ring-4 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 aria-disabled:cursor-default"

const squareColorClasses = (rowIndex: number, columnIndex: number): string =>
  (rowIndex + columnIndex) % 2 === 0
    ? "bg-[#e7d7bd] text-slate-950"
    : "bg-[#776b8c] text-slate-950"

const pieceColorClasses = (color: MatchColor): string =>
  color === "white"
    ? "text-slate-50 [filter:drop-shadow(0_2px_1px_rgba(15,23,42,0.95))]"
    : "text-slate-950 [filter:drop-shadow(0_1px_0_rgba(248,250,252,0.75))]"

export default function CanonicalChessboard({
  disabled,
  legalMoves,
  lastMove,
  onMove,
  orientation,
  position,
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
        className="grid aspect-square w-full grid-rows-8 overflow-hidden rounded-[clamp(0.75rem,2vw,1.25rem)] border border-white/20 shadow-[0_1.5rem_5rem_rgba(2,6,23,0.55)]"
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
                  )}
                  aria-selected={selected}
                  className={`${baseSquareClasses} ${squareColorClasses(rowIndex, columnIndex)} ${selected ? "z-10 ring-4 ring-cyan-500 ring-inset" : ""} ${partOfLastMove ? "after:absolute after:inset-[8%] after:rounded-sm after:border-[clamp(2px,0.35vw,4px)] after:border-amber-400" : ""} ${checkedKing ? "bg-red-300 ring-4 ring-red-700 ring-inset" : ""}`}
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
                      className={`pointer-events-none absolute z-[5] rounded-full border-4 border-cyan-900/75 ${piece === undefined ? "size-[22%] bg-cyan-200/85" : "inset-[9%]"}`}
                    />
                  ) : null}
                  {columnIndex === 0 ? (
                    <span
                      aria-hidden="true"
                      className="absolute top-1 left-1 z-10 font-mono text-[clamp(0.55rem,1.4vw,0.75rem)] font-black text-slate-950/70"
                    >
                      {rank}
                    </span>
                  ) : null}
                  {rowIndex === 7 ? (
                    <span
                      aria-hidden="true"
                      className="absolute right-1 bottom-1 z-10 font-mono text-[clamp(0.55rem,1.4vw,0.75rem)] font-black text-slate-950/70"
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

      {pendingPromotion === null ? null : (
        <div
          aria-labelledby="promotion-title"
          aria-modal="true"
          className="absolute inset-0 z-30 grid place-items-center rounded-[clamp(0.75rem,2vw,1.25rem)] bg-slate-950/80 p-6 backdrop-blur-sm"
          onKeyDown={(event) => {
            if (event.key === "Escape") clearSelection()
          }}
          role="dialog"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-slate-900 p-5 shadow-2xl">
            <h2 className="text-xl font-black text-white" id="promotion-title">
              Promote on {pendingPromotion.to}
            </h2>
            <div className="mt-4 grid grid-cols-4 gap-3">
              {PROMOTION_ROLES.map((role, index) => (
                <button
                  aria-label={`Promote to ${PIECE_NAMES[role]}`}
                  className="grid aspect-square place-items-center rounded-xl border border-white/15 bg-slate-800 text-5xl text-white transition-colors hover:bg-slate-700 focus-visible:ring-4 focus-visible:ring-cyan-300 focus-visible:outline-none"
                  key={role}
                  onClick={() => choosePromotion(role)}
                  ref={index === 0 ? firstPromotionButton : undefined}
                  type="button"
                >
                  <span aria-hidden="true">
                    {PIECE_GLYPHS[position.turn][role]}
                  </span>
                </button>
              ))}
            </div>
            <button
              className="mt-4 w-full rounded-xl border border-white/15 px-4 py-3 font-bold text-slate-200 hover:bg-white/10 focus-visible:ring-4 focus-visible:ring-cyan-300 focus-visible:outline-none"
              onClick={clearSelection}
              type="button"
            >
              Cancel promotion
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
