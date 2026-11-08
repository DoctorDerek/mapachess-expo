import { useState } from "react"
import Svg, { Text } from "react-native-svg"
import { useCSSVariable } from "uniwind"
import {
  CHESS_PIECE_SETS,
  type ChessPieceSetId,
} from "@mapachess/match-presentation/chess-appearance-catalog"
import type {
  MatchColor,
  MatchPieceRole,
} from "@mapachess/match/match-position"
import assets from "@/lib/presentation/nativeAssetManifest"
import NativeImage from "../presentation/NativeImage"

const glyphs = {
  white: {
    king: "♔",
    queen: "♕",
    rook: "♖",
    bishop: "♗",
    knight: "♘",
    pawn: "♙",
  },
  black: {
    king: "♚",
    queen: "♛",
    rook: "♜",
    bishop: "♝",
    knight: "♞",
    pawn: "♟",
  },
} as const satisfies Readonly<
  Record<MatchColor, Readonly<Record<MatchPieceRole, string>>>
>

export default function NativeChessPiece({
  color,
  role,
  pieceSetId,
}: Readonly<{
  color: MatchColor
  role: MatchPieceRole
  pieceSetId: ChessPieceSetId
}>) {
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const white = useCSSVariable("--color-mapachito-white")
  const black = useCSSVariable("--color-mapachito-charcoal")
  const set = CHESS_PIECE_SETS.find((choice) => choice.id === pieceSetId)
  const sourceId =
    set === undefined || set.kind === "unicode"
      ? null
      : `${set.delivery === "public" ? "/chess-assets" : "/generated/chess-assets"}/${set.pieces[color][role].path}`
  if (
    sourceId !== null &&
    failedSource !== sourceId &&
    (assets.images[sourceId] !== undefined ||
      assets.svg[sourceId] !== undefined)
  )
    return (
      <NativeImage
        sourceId={sourceId}
        className="h-full w-full"
        onError={() => setFailedSource(sourceId)}
      />
    )
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Text
        x={50}
        y={79}
        textAnchor="middle"
        fontSize={84}
        fontFamily="serif"
        fill={
          typeof (color === "white" ? white : black) === "string"
            ? String(color === "white" ? white : black)
            : undefined
        }
        stroke={
          typeof (color === "white" ? black : white) === "string"
            ? String(color === "white" ? black : white)
            : undefined
        }
        strokeWidth={1}
      >
        {glyphs[color][role]}
      </Text>
    </Svg>
  )
}
