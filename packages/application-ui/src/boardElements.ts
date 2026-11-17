import type { ComponentType, ReactNode } from "react"
import type { BoardInteractionActor } from "@mapachess/match-presentation/board-interaction-machine"
import type { BoardNavigationKey } from "@mapachess/match-presentation/board-presentation"
import type { ChessBoardPalette } from "@mapachess/match-presentation/chess-board-palettes"
import type {
  MatchColor,
  MatchPieceRole,
  MatchSquare,
} from "@mapachess/match/match-position"
import type { PlayerInputAction } from "@mapachess/match/player-input"

export type BoardPaint =
  | "none"
  | `--color-board-${
      | "hint-player"
      | "hint-player-on-light"
      | "hint-player-on-dark"
      | "hint-player-on-texture"
      | "hint-opponent"
      | "hint-edge"
      | "history-origin"
      | "history-destination"
      | "history-origin-on-dark"
      | "history-destination-on-dark"
      | "neutral"
      | "neutral-edge"
      | "check"}`
export const playerHintPaint = (palette: ChessBoardPalette): BoardPaint =>
  palette === "light"
    ? "--color-board-hint-player-on-light"
    : palette === "dark"
      ? "--color-board-hint-player-on-dark"
      : palette === "textured"
        ? "--color-board-hint-player-on-texture"
        : "--color-board-hint-player"

export type BoardInput = Readonly<{
  actor: BoardInteractionActor
  enabled: boolean
  focusedSquare: MatchSquare
  onAction: (action: PlayerInputAction) => boolean
  onNavigate: (key: BoardNavigationKey) => void
  onFocus: (square: MatchSquare) => void
  onChoose: (square: MatchSquare) => void
}>
export type BoardGroupProps = Readonly<{
  children: ReactNode
  className: string
  kind?: "frame" | "row" | "rowgroup" | "layer" | "piece" | "choice-row"
  decorative?: boolean
}>
export type BoardSurfaceProps = Readonly<{
  children: (controller: boolean) => ReactNode
  className: string
  label: string
  input: BoardInput | null
}>
export type BoardSquareProps = Readonly<{
  children: ReactNode
  className: string
  label: string
  square: MatchSquare
  selected: boolean
  disabled: boolean
  input: BoardInput
}>
export type BoardVectorMetadata = Readonly<{
  hintKind?: "source" | "move"
  owner?: "player" | "opponent"
  pattern?: "solid" | "dashed"
  strokePart?: "outline" | "owner"
  sourceX?: number
  sourceY?: number
  destinationX?: number
  destinationY?: number
  annotation?:
    | "history-origin"
    | "history-destination"
    | "check"
    | "selection"
    | "focus"
    | "legal"
}>
export type BoardSvgProps = BoardVectorMetadata &
  Readonly<{
    children: ReactNode
    className: string
    viewBox: string
    opacity?: number
  }>
export type BoardVectorGroupProps = BoardVectorMetadata &
  Readonly<{
    children: ReactNode
    opacity?: number
    transform?: string
  }>
export type BoardShapeProps = BoardVectorMetadata &
  Readonly<{
    fill?: BoardPaint | undefined
    stroke?: BoardPaint | undefined
    opacity?: number | undefined
    strokeWidth?: number | undefined
    strokeDasharray?: string | undefined
    strokeLinecap?: "butt" | "round" | "square" | undefined
    strokeLinejoin?: "round" | "miter" | "bevel" | undefined
    d?: string | undefined
    x?: number | undefined
    y?: number | undefined
    width?: number | undefined
    height?: number | undefined
    rx?: number | undefined
    x1?: number | undefined
    x2?: number | undefined
    y1?: number | undefined
    y2?: number | undefined
  }>
export type BoardChoiceActionProps = Readonly<{
  children: ReactNode
  className: string
  label: string
  disabled: boolean
  first: boolean
  onActivate: () => void
}>
export type BoardElements = Readonly<{
  Group: ComponentType<BoardGroupProps>
  Surface: ComponentType<BoardSurfaceProps>
  Square: ComponentType<BoardSquareProps>
  Text: ComponentType<Readonly<{ children: ReactNode; className: string }>>
  Artwork: ComponentType<
    Readonly<{ orientation: MatchColor; children: ReactNode }>
  >
  Piece: ComponentType<
    Readonly<{ color: MatchColor; role: MatchPieceRole; fitToSquare?: boolean }>
  >
  Focus: ComponentType<
    Readonly<{
      children: ReactNode
      className: string
      focused: boolean
      controller: boolean
    }>
  >
  Svg: ComponentType<BoardSvgProps>
  VectorGroup: ComponentType<BoardVectorGroupProps>
  Rect: ComponentType<BoardShapeProps>
  Line: ComponentType<BoardShapeProps>
  Path: ComponentType<BoardShapeProps>
  Choice: ComponentType<
    Readonly<{
      children: ReactNode
      actions: ReactNode
      title: string
      onCancel: () => void
    }>
  >
  ChoiceAction: ComponentType<BoardChoiceActionProps>
}>

export const boardShapeGeometry = (
  shape: BoardShapeProps,
): Omit<BoardShapeProps, keyof BoardVectorMetadata | "fill" | "stroke"> => ({
  opacity: shape.opacity,
  strokeWidth: shape.strokeWidth,
  strokeDasharray: shape.strokeDasharray,
  strokeLinecap: shape.strokeLinecap,
  strokeLinejoin: shape.strokeLinejoin,
  d: shape.d,
  x: shape.x,
  y: shape.y,
  width: shape.width,
  height: shape.height,
  rx: shape.rx,
  x1: shape.x1,
  x2: shape.x2,
  y1: shape.y1,
  y2: shape.y2,
})
