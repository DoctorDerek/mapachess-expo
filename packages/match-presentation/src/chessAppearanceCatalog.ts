import loadCatalog from "@mapachess/localization/catalog"
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
    label: loadCatalog("en").artwork.pieces.current,
    kind: "unicode",
  } as const),
  pieceSet(
    "chessnut",
    loadCatalog("en").artwork.pieces["chessnut"],
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
    loadCatalog("en").artwork.pieces["skoll"],
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
    loadCatalog("en").artwork.pieces["classical"],
    "toffee-classical",
    "protected-chess",
    ["white", "black"],
    32,
    32,
  ),
  pieceSet(
    "classical-brown",
    loadCatalog("en").artwork.pieces["classical-brown"],
    "toffee-classical",
    "protected-chess",
    ["white", "darkbrown"],
    32,
    32,
  ),
  pieceSet(
    "classical-earth",
    loadCatalog("en").artwork.pieces["classical-earth"],
    "toffee-classical",
    "protected-chess",
    ["darkbrown", "black"],
    32,
    32,
  ),
  pieceSet(
    "toffee-wood",
    loadCatalog("en").artwork.pieces["toffee-wood"],
    "toffee-wood",
    "protected-chess",
    ["toffee-wood/white", "toffee-wood/black"],
    32,
    32,
  ),
  pieceSet(
    "toffee-ice",
    loadCatalog("en").artwork.pieces["toffee-ice"],
    "toffee-ice",
    "protected-chess",
    ["toffee-ice/white", "toffee-ice/black"],
    32,
    32,
  ),
  pieceSet(
    "back-1-bit",
    loadCatalog("en").artwork.pieces["back-1-bit"],
    "backterria",
    "protected-chess",
    ["back-1-bit/white", "back-1-bit/black"],
    16,
    16,
  ),
  pieceSet(
    "back-plain",
    loadCatalog("en").artwork.pieces["back-plain"],
    "backterria",
    "protected-chess",
    ["back-plain/white", "back-plain/black"],
    16,
    32,
  ),
  pieceSet(
    "back-wood",
    loadCatalog("en").artwork.pieces["back-wood"],
    "backterria",
    "protected-chess",
    ["back-wood/white", "back-wood/black"],
    16,
    32,
  ),
  pieceSet(
    "back-gold-bronze",
    loadCatalog("en").artwork.pieces["back-gold-bronze"],
    "backterria",
    "protected-chess",
    ["back-gold-bronze/white", "back-gold-bronze/black"],
    16,
    32,
  ),
  pieceSet(
    "back-glass",
    loadCatalog("en").artwork.pieces["back-glass"],
    "backterria",
    "protected-chess",
    ["back-glass/white", "back-glass/black"],
    16,
    32,
  ),
  pieceSet(
    "back-stone",
    loadCatalog("en").artwork.pieces["back-stone"],
    "backterria",
    "protected-chess",
    ["back-stone/white", "back-stone/black"],
    16,
    32,
  ),
  pieceSet(
    "back-elegant",
    loadCatalog("en").artwork.pieces["back-elegant"],
    "backterria",
    "protected-chess",
    ["back-elegant/white", "back-elegant/black"],
    16,
    32,
  ),
  pieceSet(
    "back-fantasy-i-mono",
    loadCatalog("en").artwork.pieces["back-fantasy-i-mono"],
    "backterria",
    "protected-chess",
    ["back-fantasy-i-mono/white", "back-fantasy-i-mono/black"],
    16,
    16,
  ),
  pieceSet(
    "back-fantasy-i-color",
    loadCatalog("en").artwork.pieces["back-fantasy-i-color"],
    "backterria",
    "protected-chess",
    ["back-fantasy-i-color/white", "back-fantasy-i-color/black"],
    16,
    16,
  ),
  pieceSet(
    "back-fantasy-i-earth",
    loadCatalog("en").artwork.pieces["back-fantasy-i-earth"],
    "backterria",
    "protected-chess",
    ["back-fantasy-i-earth/white", "back-fantasy-i-earth/black"],
    16,
    16,
  ),
  pieceSet(
    "back-fantasy-ii-plain",
    loadCatalog("en").artwork.pieces["back-fantasy-ii-plain"],
    "backterria",
    "protected-chess",
    ["back-fantasy-ii-plain/white", "back-fantasy-ii-plain/black"],
    16,
    48,
  ),
  pieceSet(
    "back-fantasy-ii-gold",
    loadCatalog("en").artwork.pieces["back-fantasy-ii-gold"],
    "backterria",
    "protected-chess",
    ["back-fantasy-ii-gold/white", "back-fantasy-ii-gold/black"],
    16,
    48,
  ),
  pieceSet(
    "cosunosuke",
    loadCatalog("en").artwork.pieces["cosunosuke"],
    "cosunosuke",
    "protected-chess",
    ["white", "black"],
    32,
    32,
  ),
  pieceSet(
    "cat-chess",
    loadCatalog("en").artwork.pieces["cat-chess"],
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
    label: loadCatalog("en").artwork.boards.current,
    kind: "colors",
  } as const),
  board(
    "toffee-brown",
    loadCatalog("en").artwork.boards["toffee-brown"],
    "toffee-classical",
    256,
  ),
  board(
    "toffee-mono",
    loadCatalog("en").artwork.boards["toffee-mono"],
    "toffee-classical",
    256,
  ),
  board(
    "toffee-green",
    loadCatalog("en").artwork.boards["toffee-green"],
    "toffee-classical",
    256,
  ),
  board(
    "toffee-wood",
    loadCatalog("en").artwork.boards["toffee-wood"],
    "toffee-wood",
    256,
  ),
  board(
    "toffee-ice",
    loadCatalog("en").artwork.boards["toffee-ice"],
    "toffee-ice",
    256,
  ),
  ...(["a", "b", "c", "d", "e", "f", "g", "h", "i"] as const).map((letter) =>
    board(
      `back-${letter}`,
      loadCatalog("en").artwork.boards[`back-${letter}`],
      "backterria",
      128,
    ),
  ),
  board(
    "cosunosuke",
    loadCatalog("en").artwork.boards["cosunosuke"],
    "cosunosuke",
    256,
  ),
  board(
    "cat-chess",
    loadCatalog("en").artwork.boards["cat-chess"],
    "cat-chess",
    744,
    "public",
  ),
] as const)

export type ChessPieceSetId = (typeof CHESS_PIECE_SETS)[number]["id"]
export type ChessBoardId = (typeof CHESS_BOARDS)[number]["id"]
