"use client"

import cx from "classix"
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  CHESS_BOARDS,
  CHESS_PIECE_SETS,
  type ChessBoardId,
  type ChessPieceSetId,
} from "@mapachess/match-presentation/chess-appearance-catalog"
import type {
  MatchColor,
  MatchPieceRole,
} from "@mapachess/match/match-position"
import {
  DEFAULT_CHESS_APPEARANCE,
  type ChessAppearanceSettings,
} from "@mapachess/profile/chess-appearance-settings"
import { loadPresentationImage } from "../../lib/presentation/presentationImages"
import MapachessButton from "../presentation/MapachessButton"

export const chessArtworkSource = (
  delivery: "public" | "protected-chess",
  path: string,
): string =>
  `${delivery === "public" ? "/chess-assets" : "/generated/chess-assets"}/${path}`

export const chessPieceSet = (
  id: ChessPieceSetId,
): (typeof CHESS_PIECE_SETS)[number] => {
  const set = CHESS_PIECE_SETS.find((entry) => entry.id === id)
  if (set === undefined) throw new Error("Unknown chess piece set.")
  return set
}

export const chessBoard = (id: ChessBoardId): (typeof CHESS_BOARDS)[number] => {
  const board = CHESS_BOARDS.find((entry) => entry.id === id)
  if (board === undefined) throw new Error("Unknown chess board.")
  return board
}

const ArtworkContext = createContext<
  Readonly<{ appearance: ChessAppearanceSettings; attempt: number }>
>({ appearance: DEFAULT_CHESS_APPEARANCE, attempt: 0 })

function useArtworkVisibility(
  source: string | null,
  prepared: boolean,
  attempt: number,
) {
  const [result, setResult] = useState<Readonly<{
    source: string | null
    attempt: number
    ready: boolean
  }> | null>(null)
  return {
    visible:
      source !== null &&
      (result?.source === source && result.attempt === attempt
        ? result.ready
        : prepared),
    onLoad: () => setResult({ source, attempt, ready: true }),
    onError: () => setResult({ source, attempt, ready: false }),
  }
}

function usePreparedChoice<Id extends string>(
  id: Id,
  sources: readonly string[],
  fallback: Id,
  attempt: number,
) {
  const [displayed, setDisplayed] = useState<Id>(fallback)
  const [failed, setFailed] = useState<Id | null>(null)
  useEffect(() => {
    let active = true
    const images = sources.map(loadPresentationImage)
    void Promise.all(images.map((image) => image.ready)).then((results) => {
      if (!active) return
      const ready = results.every(Boolean)
      setDisplayed(ready ? id : fallback)
      setFailed(ready ? null : id)
    })
    return () => {
      active = false
      images.forEach((image) => image.release())
    }
  }, [id, sources, fallback, attempt])
  return { displayed, failed: failed === id }
}

export default function ChessAppearanceProvider({
  appearance,
  children,
}: Readonly<{ appearance: ChessAppearanceSettings; children: ReactNode }>) {
  const [attempt, setAttempt] = useState(0)
  const selectedPieces = chessPieceSet(appearance.pieceSetId)
  const selectedBoard = chessBoard(appearance.boardId)
  const pieceSources = useMemo(
    () =>
      selectedPieces.kind === "unicode"
        ? []
        : Object.values(selectedPieces.pieces).flatMap((side) =>
            Object.values(side).map((art) =>
              chessArtworkSource(selectedPieces.delivery, art.path),
            ),
          ),
    [selectedPieces],
  )
  const boardSources = useMemo(
    () =>
      selectedBoard.kind === "colors"
        ? []
        : [
            chessArtworkSource(
              selectedBoard.delivery,
              selectedBoard.image.path,
            ),
          ],
    [selectedBoard],
  )
  const pieces = usePreparedChoice(
    appearance.pieceSetId,
    pieceSources,
    "current",
    attempt,
  )
  const board = usePreparedChoice(
    appearance.boardId,
    boardSources,
    "current",
    attempt,
  )
  return (
    <ArtworkContext
      value={{
        appearance: {
          pieceSetId: pieces.displayed,
          boardId: board.displayed,
        },
        attempt,
      }}
    >
      {pieces.failed || board.failed ? (
        <div
          role="alert"
          className="bg-mapachito-white text-mapachito-charcoal mx-auto my-3 flex max-w-3xl flex-wrap items-center gap-3 rounded-lg p-4"
        >
          <p>
            Selected chess artwork could not load. Defaults are shown; your
            choices and match are preserved.
          </p>
          <MapachessButton onClick={() => setAttempt((value) => value + 1)}>
            Retry chess artwork
          </MapachessButton>
        </div>
      ) : null}
      {children}
    </ArtworkContext>
  )
}

const PIECE_GLYPHS = {
  black: {
    bishop: "♝",
    king: "♚",
    knight: "♞",
    pawn: "♟",
    queen: "♛",
    rook: "♜",
  },
  white: {
    bishop: "♗",
    king: "♔",
    knight: "♘",
    pawn: "♙",
    queen: "♕",
    rook: "♖",
  },
} as const satisfies Readonly<
  Record<MatchColor, Readonly<Record<MatchPieceRole, string>>>
>

export function ChessPiece({
  color,
  role,
  pieceSetId,
}: Readonly<{
  color: MatchColor
  role: MatchPieceRole
  pieceSetId?: ChessPieceSetId
}>) {
  const { appearance, attempt } = useContext(ArtworkContext)
  const pieces = chessPieceSet(pieceSetId ?? appearance.pieceSetId)
  const source =
    pieces.kind === "unicode"
      ? null
      : chessArtworkSource(pieces.delivery, pieces.pieces[color][role].path)
  const image = useArtworkVisibility(
    source,
    pieces.id === appearance.pieceSetId,
    attempt,
  )
  return (
    <span
      aria-hidden="true"
      className="relative grid size-full place-items-center select-none"
    >
      <span
        className={cx(
          image.visible && "invisible",
          color === "white"
            ? "text-mapachito-white [filter:drop-shadow(0_2px_1px_rgb(30_30_30/0.95))]"
            : "text-mapachito-charcoal [filter:drop-shadow(0_1px_0_rgb(255_255_255/0.9))]",
        )}
      >
        {PIECE_GLYPHS[color][role]}
      </span>
      {source !== null && pieces.kind === "artwork" ? (
        <img
          key={`${source}:${attempt}`}
          alt=""
          draggable={false}
          src={source}
          width={pieces.pieces[color][role].width}
          height={pieces.pieces[color][role].height}
          onLoad={image.onLoad}
          onError={image.onError}
          className={cx(
            "pointer-events-none absolute size-[86%] object-contain",
            !image.visible && "opacity-0",
            pieces.rendering === "pixelated" && "[image-rendering:pixelated]",
          )}
        />
      ) : null}
    </span>
  )
}

export function ChessBoardArtwork({
  boardId,
  orientation = "white",
}: Readonly<{ boardId?: ChessBoardId; orientation?: MatchColor }>) {
  const { appearance, attempt } = useContext(ArtworkContext)
  const board = chessBoard(boardId ?? appearance.boardId)
  const source =
    board.kind === "colors"
      ? null
      : chessArtworkSource(board.delivery, board.image.path)
  const image = useArtworkVisibility(
    source,
    board.id === appearance.boardId,
    attempt,
  )
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <span className="grid size-full grid-cols-8 grid-rows-8">
        {Array.from({ length: 64 }, (_, index) => (
          <span
            key={index}
            className={
              (Math.floor(index / 8) + (index % 8)) % 2 === 0
                ? "bg-[var(--mapachess-board-light-square)]"
                : "bg-[var(--mapachess-board-dark-square)]"
            }
          />
        ))}
      </span>
      {source !== null && board.kind === "artwork" ? (
        <img
          key={`${source}:${attempt}`}
          alt=""
          src={source}
          width={board.image.width}
          height={board.image.height}
          onLoad={image.onLoad}
          onError={image.onError}
          className={cx(
            "absolute inset-0 size-full object-contain",
            !image.visible && "opacity-0",
            orientation === "black" && "rotate-180",
            board.rendering === "pixelated" && "[image-rendering:pixelated]",
          )}
        />
      ) : null}
    </span>
  )
}
