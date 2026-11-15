import createBetterHintGeometry, {
  BETTER_HINT_FRAME,
  BETTER_HINT_RIBBON,
  BETTER_HINT_VIEW_BOX,
} from "@mapachess/match-presentation/better-hint-geometry"
import type { ChessBoardPalette } from "@mapachess/match-presentation/chess-board-palettes"
import type { BetterHintsResult } from "@mapachess/match/better-hints"
import type { MatchColor } from "@mapachess/match/match-position"
import { playerHintPaint, type BoardElements } from "./boardElements.js"

export default function BetterHints({
  hints,
  orientation,
  showMoves,
  palette,
  elements,
}: Readonly<{
  hints: BetterHintsResult
  orientation: MatchColor
  showMoves: boolean
  palette: ChessBoardPalette
  elements: BoardElements
}>) {
  const { Svg, VectorGroup, Rect, Line, Path } = elements
  const visible = [...hints.player, ...hints.opponent]
  const owned = (["player", "opponent"] as const).flatMap((owner) =>
    hints[owner].map((hint) => ({
      owner,
      hint,
      geometry: createBetterHintGeometry(hint, orientation, visible),
    })),
  )
  const paint = (owner: "player" | "opponent") =>
    owner === "player"
      ? playerHintPaint(palette)
      : "--color-board-hint-opponent"
  return (
    <Svg
      className="pointer-events-none absolute inset-0 z-5 size-full"
      viewBox={BETTER_HINT_VIEW_BOX}
    >
      {owned.map(({ owner, hint, geometry }) => {
        const frame = {
          fill: "none",
          height: BETTER_HINT_FRAME.size,
          rx: BETTER_HINT_FRAME.radius,
          strokeDasharray:
            owner === "opponent" ? BETTER_HINT_FRAME.opponentDash : undefined,
          width: BETTER_HINT_FRAME.size,
          x: Math.floor(geometry.piece.x) + BETTER_HINT_FRAME.inset,
          y: Math.floor(geometry.piece.y) + BETTER_HINT_FRAME.inset,
        } as const
        return (
          <VectorGroup
            hintKind="source"
            owner={owner}
            pattern={owner === "player" ? "solid" : "dashed"}
            sourceX={geometry.piece.x}
            sourceY={geometry.piece.y}
            key={`source-${owner}-${hint.uci}`}
          >
            <Rect
              {...frame}
              strokePart="outline"
              stroke="--color-board-hint-edge"
              strokeWidth={BETTER_HINT_FRAME.outlineWidth}
            />
            <Rect
              {...frame}
              strokePart="owner"
              stroke={paint(owner)}
              strokeWidth={BETTER_HINT_FRAME.width}
            />
          </VectorGroup>
        )
      })}
      {showMoves
        ? owned.map(({ owner, hint, geometry }) => (
            <VectorGroup
              destinationX={geometry.destination.x}
              destinationY={geometry.destination.y}
              hintKind="move"
              owner={owner}
              pattern={owner === "player" ? "solid" : "dashed"}
              sourceX={geometry.source.x}
              sourceY={geometry.source.y}
              key={`move-${owner}-${hint.uci}`}
            >
              <VectorGroup
                opacity={BETTER_HINT_RIBBON.opacity}
                transform={`translate(${geometry.source.x} ${geometry.source.y}) rotate(${geometry.rotationDegrees})`}
              >
                {owner === "opponent" ? (
                  <>
                    <Line
                      strokePart="outline"
                      stroke="--color-board-hint-edge"
                      strokeDasharray={geometry.opponentDash}
                      strokeLinecap="butt"
                      strokeWidth={
                        BETTER_HINT_RIBBON.width +
                        BETTER_HINT_RIBBON.outlineWidth
                      }
                      x1={BETTER_HINT_RIBBON.sourceOffset}
                      x2={geometry.shaftEnd}
                      y1={0}
                      y2={0}
                    />
                    <Line
                      strokePart="owner"
                      stroke={paint(owner)}
                      strokeDasharray={geometry.opponentDash}
                      strokeLinecap="butt"
                      strokeWidth={BETTER_HINT_RIBBON.width}
                      x1={BETTER_HINT_RIBBON.sourceOffset}
                      x2={geometry.shaftEnd}
                      y1={0}
                      y2={0}
                    />
                  </>
                ) : null}
                <Path
                  d={
                    owner === "player" ? geometry.ribbonPath : geometry.headPath
                  }
                  stroke="--color-board-hint-edge"
                  fill={paint(owner)}
                  strokeLinejoin="round"
                  strokeWidth={BETTER_HINT_RIBBON.outlineWidth}
                />
              </VectorGroup>
            </VectorGroup>
          ))
        : null}
    </Svg>
  )
}
