"use client"

import cx from "classix"
import { useId } from "react"
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
  ChessArtworkRecovery,
  ChessBoardArtwork,
  ChessPiece,
} from "../gameplay/ChessArtwork"
import CustomizationChoice from "./CustomizationChoice"
import { useMapachessCopy } from "./MapachessLocaleProvider"

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
        "grid overflow-hidden rounded-md",
        compact
          ? "size-16 grid-cols-2 bg-[linear-gradient(180deg,var(--color-mapachito-charcoal)_50%,var(--color-mapachito-white)_50%)] text-2xl"
          : "h-16 grid-cols-4 bg-[linear-gradient(90deg,var(--color-mapachito-charcoal)_50%,var(--color-mapachito-white)_50%)] text-2xl",
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

function ChessAppearancePreview({
  appearance,
}: Readonly<{
  appearance: ChessAppearanceSettings
}>) {
  const copy = useMapachessCopy()

  return (
    <>
      <ChessArtworkRecovery />
      <div
        className="border-mapachito-charcoal relative mx-auto my-4 grid aspect-square w-full max-w-40 grid-cols-8 grid-rows-8 overflow-hidden rounded-sm border-2 text-xl"
        role="img"
        aria-label={copy.profile.artworkPreview(
          copy.artwork.pieces[appearance.pieceSetId],
          copy.artwork.boards[appearance.boardId],
        )}
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
    </>
  )
}

export default function ChessAppearanceChoices({
  appearance,
  disabled,
  onChange,
  open,
  onOpen,
  onClose,
}: Readonly<{
  appearance: ChessAppearanceSettings
  disabled: boolean
  onChange: (change: ChessAppearanceChange) => void
  open: "pieces" | "board" | null
  onOpen: (choice: "pieces" | "board") => void
  onClose: () => void
}>) {
  const copy = useMapachessCopy()
  const messages = copy.interface.chessAppearanceChoices

  const id = useId()
  return (
    <section aria-labelledby={`${id}-title`} className="min-w-0">
      <h2 id={`${id}-title`} className="sr-only">
        {messages.boardPieces}
      </h2>
      {open === null ? <ChessArtworkRecovery /> : null}
      <div className="grid gap-3">
        <CustomizationChoice
          kind="pieces"
          value={copy.artwork.pieces[appearance.pieceSetId]}
          preview={<PieceSample id={appearance.pieceSetId} compact />}
          open={open === "pieces"}
          onToggle={() => (open === "pieces" ? onClose() : onOpen("pieces"))}
        >
          <ChessAppearancePreview appearance={appearance} />
          <fieldset
            disabled={disabled}
            className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))] gap-3"
          >
            <legend className="sr-only">{messages.pieces}</legend>
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
                  {copy.artwork.pieces[pieces.id]}
                </span>
              </label>
            ))}
          </fieldset>
        </CustomizationChoice>
        <CustomizationChoice
          kind="board"
          value={copy.artwork.boards[appearance.boardId]}
          preview={
            <span className="relative size-16 overflow-hidden rounded">
              <ChessBoardArtwork boardId={appearance.boardId} />
            </span>
          }
          open={open === "board"}
          onToggle={() => (open === "board" ? onClose() : onOpen("board"))}
        >
          <ChessAppearancePreview appearance={appearance} />
          <fieldset
            disabled={disabled}
            className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))] gap-3"
          >
            <legend className="sr-only">{messages.board}</legend>
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
                  {copy.artwork.boards[board.id]}
                </span>
              </label>
            ))}
          </fieldset>
        </CustomizationChoice>
      </div>
    </section>
  )
}
