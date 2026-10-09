"use client"

import cx from "classix"
import { useId, useState } from "react"
import {
  CHESS_BOARDS,
  CHESS_PIECE_SETS,
  type ChessPieceSetId,
} from "@mapachess/match-presentation/chess-appearance-catalog"
import type { MatchPieceRole } from "@mapachess/match/match-position"
import type {
  ChessAppearanceChange,
  ChessAppearanceSettings,
} from "@mapachess/profile/chess-appearance-settings"
import {
  chessBoard,
  ChessBoardArtwork,
  ChessPiece,
  chessPieceSet,
} from "../gameplay/ChessArtwork"

const BACK_RANK = [
  "rook",
  "knight",
  "bishop",
  "queen",
  "king",
  "bishop",
  "knight",
  "rook",
] as const satisfies readonly MatchPieceRole[]

function PieceSample({
  id,
  compact = false,
}: Readonly<{ id: ChessPieceSetId; compact?: boolean }>) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "grid grid-cols-4 overflow-hidden rounded-md bg-[linear-gradient(90deg,var(--color-mapachito-charcoal)_50%,var(--color-mapachito-white)_50%)]",
        compact ? "h-12 text-lg" : "h-16 text-2xl",
      )}
    >
      {(["white", "black"] as const).flatMap((color) =>
        (["king", "knight"] as const).map((role) => (
          <ChessPiece
            key={`${color}-${role}`}
            color={color}
            role={role}
            pieceSetId={id}
          />
        )),
      )}
    </span>
  )
}

export default function ChessAppearanceChoices({
  appearance,
  disabled,
  onChange,
}: Readonly<{
  appearance: ChessAppearanceSettings
  disabled: boolean
  onChange: (change: ChessAppearanceChange) => void
}>) {
  const id = useId()
  const [open, setOpen] = useState<"pieces" | "board" | null>(null)
  return (
    <section aria-labelledby={`${id}-title`} className="mt-8 min-w-0">
      <h2
        id={`${id}-title`}
        className="font-display text-mapachito-charcoal text-[1.35rem] leading-none font-black uppercase"
      >
        Board &amp; Pieces
      </h2>
      <div
        className="border-mapachito-charcoal relative mx-auto my-4 grid aspect-square w-full max-w-80 grid-cols-8 grid-rows-8 overflow-hidden rounded-sm border-2 text-[clamp(1rem,5vw,2.25rem)]"
        role="img"
        aria-label={`${chessPieceSet(appearance.pieceSetId).label} pieces on ${chessBoard(appearance.boardId).label} board preview`}
      >
        <ChessBoardArtwork />
        {Array.from({ length: 64 }, (_, index) => {
          const row = Math.floor(index / 8)
          const column = index % 8
          const role =
            row === 0 || row === 7
              ? BACK_RANK[column]
              : row === 1 || row === 6
                ? "pawn"
                : undefined
          return (
            <span key={index} className="relative min-h-0 min-w-0">
              {role === undefined ? null : (
                <ChessPiece color={row < 2 ? "black" : "white"} role={role} />
              )}
              {column === 0 ? (
                <span
                  aria-hidden="true"
                  className="bg-mapachito-white/90 text-mapachito-charcoal absolute top-0 left-0 rounded-sm px-0.5 text-[0.5rem] font-black"
                >
                  {8 - row}
                </span>
              ) : null}
              {row === 7 ? (
                <span
                  aria-hidden="true"
                  className="bg-mapachito-white/90 text-mapachito-charcoal absolute right-0 bottom-0 rounded-sm px-0.5 text-[0.5rem] font-black"
                >
                  {String.fromCharCode(97 + column)}
                </span>
              ) : null}
            </span>
          )
        })}
      </div>
      <div className="grid gap-3">
        <details
          className="group"
          name={`${id}-appearance`}
          onToggle={(event) => {
            if (event.currentTarget.open) setOpen("pieces")
            else setOpen((current) => (current === "pieces" ? null : current))
          }}
        >
          <summary className="bg-mapachito-violet text-mapachito-white focus-visible:outline-mapachito-orange grid cursor-pointer list-none grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg p-3 font-bold focus-visible:outline-3 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
            <span aria-hidden="true" className="group-open:rotate-90">
              ▸
            </span>
            <span>
              Pieces
              <span className="block text-sm font-normal">
                {chessPieceSet(appearance.pieceSetId).label}
              </span>
            </span>
            <span className="w-20">
              <PieceSample id={appearance.pieceSetId} compact />
            </span>
          </summary>
          {open === "pieces" ? (
            <fieldset
              disabled={disabled}
              className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))] gap-3"
            >
              <legend className="sr-only">Pieces</legend>
              {CHESS_PIECE_SETS.map((pieces) => (
                <label
                  key={pieces.id}
                  className={cx(
                    "bg-mapachito-violet text-mapachito-white has-[:focus-visible]:outline-mapachito-orange grid cursor-pointer content-start gap-2 rounded-lg p-2 text-sm font-bold has-[:disabled]:cursor-not-allowed has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2",
                    appearance.pieceSetId === pieces.id &&
                      "ring-mapachito-orange ring-3 ring-offset-2",
                  )}
                >
                  <PieceSample id={pieces.id} />
                  <span className="flex items-start gap-2">
                    <input
                      type="radio"
                      name={`${id}-pieces`}
                      value={pieces.id}
                      checked={appearance.pieceSetId === pieces.id}
                      onChange={() => onChange({ pieceSetId: pieces.id })}
                      className="accent-mapachito-orange mt-0.5 size-4 shrink-0"
                    />
                    {pieces.label}
                  </span>
                </label>
              ))}
            </fieldset>
          ) : null}
        </details>
        <details
          className="group"
          name={`${id}-appearance`}
          onToggle={(event) => {
            if (event.currentTarget.open) setOpen("board")
            else setOpen((current) => (current === "board" ? null : current))
          }}
        >
          <summary className="bg-mapachito-blue-ink text-mapachito-white focus-visible:outline-mapachito-charcoal grid cursor-pointer list-none grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg p-3 font-bold focus-visible:outline-3 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
            <span aria-hidden="true" className="group-open:rotate-90">
              ▸
            </span>
            <span>
              Board
              <span className="block text-sm font-normal">
                {chessBoard(appearance.boardId).label}
              </span>
            </span>
            <span className="relative size-12 overflow-hidden rounded">
              <ChessBoardArtwork boardId={appearance.boardId} />
            </span>
          </summary>
          {open === "board" ? (
            <fieldset
              disabled={disabled}
              className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))] gap-3"
            >
              <legend className="sr-only">Board</legend>
              {CHESS_BOARDS.map((board) => (
                <label
                  key={board.id}
                  className={cx(
                    "bg-mapachito-blue-ink text-mapachito-white has-[:focus-visible]:outline-mapachito-charcoal grid cursor-pointer content-start gap-2 rounded-lg p-2 text-sm font-bold has-[:disabled]:cursor-not-allowed has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2",
                    appearance.boardId === board.id &&
                      "ring-mapachito-orange ring-3 ring-offset-2",
                  )}
                >
                  <span className="relative mx-auto block aspect-square w-full max-w-32 overflow-hidden rounded">
                    <ChessBoardArtwork boardId={board.id} />
                  </span>
                  <span className="flex items-start gap-2">
                    <input
                      type="radio"
                      name={`${id}-board`}
                      value={board.id}
                      checked={appearance.boardId === board.id}
                      onChange={() => onChange({ boardId: board.id })}
                      className="accent-mapachito-orange mt-0.5 size-4 shrink-0"
                    />
                    {board.label}
                  </span>
                </label>
              ))}
            </fieldset>
          ) : null}
        </details>
      </div>
    </section>
  )
}
