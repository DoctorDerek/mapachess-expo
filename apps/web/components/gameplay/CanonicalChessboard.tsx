"use client"

import Chessboard, {
  type ChessboardProps,
} from "@mapachess/application-ui/chessboard"
import CHESS_BOARD_PALETTES from "@mapachess/match-presentation/chess-board-palettes"
import { useDisplayedChessAppearance } from "@/components/gameplay/ChessArtwork"
import webBoardElements from "@/components/gameplay/WebBoardElements"
import { useMapachessCopy } from "@/components/profile/MapachessLocaleProvider"

export type CanonicalChessboardProps = Omit<
  ChessboardProps,
  "copy" | "elements" | "palette" | "renderBoardHost"
>

export default function CanonicalChessboard(props: CanonicalChessboardProps) {
  const appearance = useDisplayedChessAppearance()
  return (
    <Chessboard
      {...props}
      palette={CHESS_BOARD_PALETTES[appearance.boardId]}
      copy={useMapachessCopy().board}
      elements={webBoardElements}
    />
  )
}
