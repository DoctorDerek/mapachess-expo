import type {
  MatchColor,
  MatchPieceRole,
} from "@mapachess/match/match-position"
import type { ArtCreditId } from "./artCredits.js"

export type ChessArtwork = Readonly<{
  path: string
  width: number
  height: number
}>

type PieceArtwork = Readonly<Record<MatchPieceRole, ChessArtwork>>
type ChessAssetDelivery = "public" | "protected-chess"

const piecePalette = (
  prefix: string,
  width: number,
  height: number,
  extension: "svg" | "png",
): PieceArtwork => {
  const piece = (role: MatchPieceRole): ChessArtwork =>
    Object.freeze({ path: `${prefix}-${role}.${extension}`, width, height })
  return Object.freeze({
    king: piece("king"),
    queen: piece("queen"),
    rook: piece("rook"),
    bishop: piece("bishop"),
    knight: piece("knight"),
    pawn: piece("pawn"),
  })
}

const pieceSet = <Id extends string>(
  id: Id,
  label: string,
  credit: ArtCreditId,
  delivery: ChessAssetDelivery,
  palettes: readonly [string, string],
  width: number,
  height: number,
  rendering: "pixelated" | "smooth" = "pixelated",
  extension: "svg" | "png" = "png",
) =>
  Object.freeze({
    id,
    label,
    credit,
    delivery,
    rendering,
    kind: "artwork" as const,
    pieces: Object.freeze({
      white: piecePalette(
        `${credit}/pieces/${palettes[0]}`,
        width,
        height,
        extension,
      ),
      black: piecePalette(
        `${credit}/pieces/${palettes[1]}`,
        width,
        height,
        extension,
      ),
    }) satisfies Readonly<Record<MatchColor, PieceArtwork>>,
  })

export const CHESS_PIECE_SETS = Object.freeze([
  Object.freeze({
    id: "current",
    label: "Mapachess default",
    kind: "unicode",
  } as const),
  pieceSet(
    "chessnut",
    "Chessnut",
    "chessnut",
    "public",
    ["white", "black"],
    800,
    800,
    "smooth",
    "svg",
  ),
  pieceSet(
    "skoll",
    "Game-icons (Skoll)",
    "skoll",
    "public",
    ["white", "black"],
    512,
    512,
    "smooth",
    "svg",
  ),
  pieceSet(
    "classical",
    "Classical · white / black",
    "toffee-classical",
    "protected-chess",
    ["white", "black"],
    32,
    32,
  ),
  pieceSet(
    "classical-brown",
    "Classical · white / brown",
    "toffee-classical",
    "protected-chess",
    ["white", "darkbrown"],
    32,
    32,
  ),
  pieceSet(
    "classical-earth",
    "Classical · brown / black",
    "toffee-classical",
    "protected-chess",
    ["darkbrown", "black"],
    32,
    32,
  ),
  pieceSet(
    "toffee-wood",
    "Toffee Wood",
    "toffee-wood",
    "protected-chess",
    ["toffee-wood/white", "toffee-wood/black"],
    32,
    32,
  ),
  pieceSet(
    "toffee-ice",
    "Toffee Ice",
    "toffee-ice",
    "protected-chess",
    ["toffee-ice/white", "toffee-ice/black"],
    32,
    32,
  ),
  pieceSet(
    "back-1-bit",
    "Backterria · 1-bit",
    "backterria",
    "protected-chess",
    ["back-1-bit/white", "back-1-bit/black"],
    16,
    16,
  ),
  pieceSet(
    "back-plain",
    "Backterria · plain",
    "backterria",
    "protected-chess",
    ["back-plain/white", "back-plain/black"],
    16,
    32,
  ),
  pieceSet(
    "back-wood",
    "Backterria · wood",
    "backterria",
    "protected-chess",
    ["back-wood/white", "back-wood/black"],
    16,
    32,
  ),
  pieceSet(
    "back-gold-bronze",
    "Backterria · gold / bronze",
    "backterria",
    "protected-chess",
    ["back-gold-bronze/white", "back-gold-bronze/black"],
    16,
    32,
  ),
  pieceSet(
    "back-glass",
    "Backterria · glass",
    "backterria",
    "protected-chess",
    ["back-glass/white", "back-glass/black"],
    16,
    32,
  ),
  pieceSet(
    "back-stone",
    "Backterria · stone",
    "backterria",
    "protected-chess",
    ["back-stone/white", "back-stone/black"],
    16,
    32,
  ),
  pieceSet(
    "back-elegant",
    "Backterria · elegant",
    "backterria",
    "protected-chess",
    ["back-elegant/white", "back-elegant/black"],
    16,
    32,
  ),
  pieceSet(
    "back-fantasy-i-mono",
    "Fantasy I · white / black",
    "backterria",
    "protected-chess",
    ["back-fantasy-i-mono/white", "back-fantasy-i-mono/black"],
    16,
    16,
  ),
  pieceSet(
    "back-fantasy-i-color",
    "Fantasy I · blue / red",
    "backterria",
    "protected-chess",
    ["back-fantasy-i-color/white", "back-fantasy-i-color/black"],
    16,
    16,
  ),
  pieceSet(
    "back-fantasy-i-earth",
    "Fantasy I · yellow / green",
    "backterria",
    "protected-chess",
    ["back-fantasy-i-earth/white", "back-fantasy-i-earth/black"],
    16,
    16,
  ),
  pieceSet(
    "back-fantasy-ii-plain",
    "Fantasy II · plain",
    "backterria",
    "protected-chess",
    ["back-fantasy-ii-plain/white", "back-fantasy-ii-plain/black"],
    16,
    48,
  ),
  pieceSet(
    "back-fantasy-ii-gold",
    "Fantasy II · gold",
    "backterria",
    "protected-chess",
    ["back-fantasy-ii-gold/white", "back-fantasy-ii-gold/black"],
    16,
    48,
  ),
  pieceSet(
    "cosunosuke",
    "Cosunosuke · gold / blue",
    "cosunosuke",
    "protected-chess",
    ["white", "black"],
    32,
    32,
  ),
  pieceSet(
    "cat-chess",
    "Cat chess",
    "cat-chess",
    "public",
    ["white", "black"],
    653,
    653,
    "smooth",
  ),
] as const)

const board = <Id extends string>(
  id: Id,
  label: string,
  credit: ArtCreditId,
  size: number,
  delivery: ChessAssetDelivery = "protected-chess",
) =>
  Object.freeze({
    id,
    label,
    credit,
    delivery,
    kind: "artwork" as const,
    rendering:
      credit === "cat-chess" ? ("smooth" as const) : ("pixelated" as const),
    image: Object.freeze({
      path: `${credit}/boards/${id}.png`,
      width: size,
      height: size,
    }),
  })

export const CHESS_BOARDS = Object.freeze([
  Object.freeze({
    id: "current",
    label: "Mapachess blue / white",
    kind: "colors",
  } as const),
  board("toffee-brown", "Toffee · brown", "toffee-classical", 256),
  board("toffee-mono", "Toffee · black / white", "toffee-classical", 256),
  board("toffee-green", "Toffee · green / yellow", "toffee-classical", 256),
  board("toffee-wood", "Toffee · wood", "toffee-wood", 256),
  board("toffee-ice", "Toffee · ice", "toffee-ice", 256),
  ...(["a", "b", "c", "d", "e", "f", "g", "h", "i"] as const).map((letter) =>
    board(
      `back-${letter}`,
      `Backterria · board ${letter.toUpperCase()}`,
      "backterria",
      128,
    ),
  ),
  board("cosunosuke", "Cosunosuke · slate", "cosunosuke", 256),
  board("cat-chess", "Cat chess · green / white", "cat-chess", 744, "public"),
] as const)

export type ChessPieceSetId = (typeof CHESS_PIECE_SETS)[number]["id"]
export type ChessBoardId = (typeof CHESS_BOARDS)[number]["id"]
