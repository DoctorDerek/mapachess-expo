export const CHESS960_POSITION_COUNT = 960 as const

declare const chess960PositionIdBrand: unique symbol

export type Chess960PositionId = number & {
  readonly [chess960PositionIdBrand]: true
}

export type Chess960PositionIdParseResult =
  | Readonly<{
      ok: true
      positionId: Chess960PositionId
    }>
  | Readonly<{
      error: Readonly<{
        received: unknown
        type: "MATCH.CHESS960_POSITION_ID_INVALID"
      }>
      ok: false
    }>

export const parseChess960PositionId = (
  received: unknown,
): Chess960PositionIdParseResult =>
  typeof received === "number" &&
  Number.isInteger(received) &&
  received >= 0 &&
  received < CHESS960_POSITION_COUNT
    ? { ok: true, positionId: received as Chess960PositionId }
    : {
        error: {
          received,
          type: "MATCH.CHESS960_POSITION_ID_INVALID",
        },
        ok: false,
      }

const KNIGHT_SLOT_COMBINATIONS = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [1, 2],
  [1, 3],
  [1, 4],
  [2, 3],
  [2, 4],
  [3, 4],
] as const

type Chess960BackRankPiece = "B" | "K" | "N" | "Q" | "R"

const assignBackRankPiece = (
  backRank: Array<Chess960BackRankPiece | undefined>,
  file: number,
  piece: Chess960BackRankPiece,
): void => {
  if (backRank[file]) {
    throw new Error("Chess960 generation attempted to reuse a back-rank file")
  }

  backRank[file] = piece
}

const listEmptyFiles = (
  backRank: readonly (Chess960BackRankPiece | undefined)[],
): readonly number[] => backRank.flatMap((piece, file) => (piece ? [] : [file]))

export const createChess960BackRank = (
  positionId: Chess960PositionId,
): string => {
  let remainingIndex: number = positionId
  const backRank = Array<Chess960BackRankPiece | undefined>(8).fill(undefined)

  const oppositeColorBishopFile = (remainingIndex % 4) * 2 + 1
  remainingIndex = Math.floor(remainingIndex / 4)
  const sameColorBishopFile = (remainingIndex % 4) * 2
  remainingIndex = Math.floor(remainingIndex / 4)

  assignBackRankPiece(backRank, oppositeColorBishopFile, "B")
  assignBackRankPiece(backRank, sameColorBishopFile, "B")

  const queenSlot = remainingIndex % 6
  remainingIndex = Math.floor(remainingIndex / 6)
  const queenFile = listEmptyFiles(backRank)[queenSlot]
  if (queenFile === undefined) {
    throw new Error("Chess960 generation could not resolve the queen file")
  }
  assignBackRankPiece(backRank, queenFile, "Q")

  const knightSlots = KNIGHT_SLOT_COMBINATIONS[remainingIndex]
  if (!knightSlots) {
    throw new Error("Chess960 generation could not resolve the knight files")
  }
  const knightCandidateFiles = listEmptyFiles(backRank)
  for (const knightSlot of knightSlots) {
    const knightFile = knightCandidateFiles[knightSlot]
    if (knightFile === undefined) {
      throw new Error("Chess960 generation produced an invalid knight slot")
    }
    assignBackRankPiece(backRank, knightFile, "N")
  }

  const rookKingRookFiles = listEmptyFiles(backRank)
  const [queenSideRookFile, kingFile, kingSideRookFile] = rookKingRookFiles
  if (
    queenSideRookFile === undefined ||
    kingFile === undefined ||
    kingSideRookFile === undefined
  ) {
    throw new Error(
      "Chess960 generation could not resolve rook-king-rook files",
    )
  }

  assignBackRankPiece(backRank, queenSideRookFile, "R")
  assignBackRankPiece(backRank, kingFile, "K")
  assignBackRankPiece(backRank, kingSideRookFile, "R")

  return backRank.join("")
}

const fileName = (file: number): string =>
  String.fromCharCode("a".charCodeAt(0) + file)

export const createChess960InitialFen = (
  positionId: Chess960PositionId,
): string => {
  const whiteBackRank = createChess960BackRank(positionId)
  const rookFiles = [...whiteBackRank]
    .flatMap((piece, file) => (piece === "R" ? [file] : []))
    .sort((left, right) => right - left)
  const [kingSideRookFile, queenSideRookFile] = rookFiles
  if (kingSideRookFile === undefined || queenSideRookFile === undefined) {
    throw new Error("Chess960 generation did not produce two rooks")
  }

  const whiteCastlingRights =
    fileName(kingSideRookFile).toUpperCase() +
    fileName(queenSideRookFile).toUpperCase()
  const castlingRights = whiteCastlingRights + whiteCastlingRights.toLowerCase()

  return `${whiteBackRank.toLowerCase()}/pppppppp/8/8/8/8/PPPPPPPP/${whiteBackRank} w ${castlingRights} - 0 1`
}
