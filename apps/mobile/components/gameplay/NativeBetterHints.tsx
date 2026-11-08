import Svg, { G, Line, Path, Rect } from "react-native-svg"
import { useCSSVariable } from "uniwind"
import createBetterHintGeometry, {
  BETTER_HINT_FRAME,
  BETTER_HINT_RIBBON,
  BETTER_HINT_VIEW_BOX,
} from "@mapachess/match-presentation/better-hint-geometry"
import type { ChessBoardPalette } from "@mapachess/match-presentation/chess-board-palettes"
import type { BetterHintsResult } from "@mapachess/match/better-hints"
import type { MatchColor } from "@mapachess/match/match-position"

export default function NativeBetterHints({
  hints,
  orientation,
  showMoves,
  palette,
}: Readonly<{
  hints: BetterHintsResult
  orientation: MatchColor
  showMoves: boolean
  palette: ChessBoardPalette
}>) {
  const playerToken =
    palette === "light"
      ? "--color-board-hint-player-on-light"
      : palette === "dark"
        ? "--color-board-hint-player-on-dark"
        : palette === "textured"
          ? "--color-board-hint-player-on-texture"
          : "--color-board-hint-player"
  const [player, opponent, edge] = useCSSVariable([
    playerToken,
    "--color-board-hint-opponent",
    "--color-board-hint-edge",
  ])
  const visible = [...hints.player, ...hints.opponent]
  const owned = (["player", "opponent"] as const).flatMap((owner) =>
    hints[owner].map((hint) => ({
      owner,
      hint,
      geometry: createBetterHintGeometry(hint, orientation, visible),
    })),
  )
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={BETTER_HINT_VIEW_BOX}
      pointerEvents="none"
    >
      {owned.map(({ owner, hint, geometry }) => {
        const frame = {
          x: Math.floor(geometry.piece.x) + BETTER_HINT_FRAME.inset,
          y: Math.floor(geometry.piece.y) + BETTER_HINT_FRAME.inset,
          width: BETTER_HINT_FRAME.size,
          height: BETTER_HINT_FRAME.size,
          rx: BETTER_HINT_FRAME.radius,
          fill: "none",
          strokeDasharray:
            owner === "opponent" ? BETTER_HINT_FRAME.opponentDash : undefined,
        }
        const color = owner === "player" ? player : opponent
        return (
          <G key={`piece-${owner}-${hint.uci}`}>
            <Rect
              {...frame}
              stroke={typeof edge === "string" ? edge : undefined}
              strokeWidth={BETTER_HINT_FRAME.outlineWidth}
            />
            <Rect
              {...frame}
              stroke={typeof color === "string" ? color : undefined}
              strokeWidth={BETTER_HINT_FRAME.width}
            />
          </G>
        )
      })}
      {showMoves
        ? owned.map(({ owner, hint, geometry }) => {
            const color = owner === "player" ? player : opponent
            return (
              <G
                key={`move-${owner}-${hint.uci}`}
                opacity={BETTER_HINT_RIBBON.opacity}
                transform={`translate(${String(geometry.source.x)},${String(geometry.source.y)}) rotate(${String(geometry.rotationDegrees)})`}
              >
                {owner === "opponent" ? (
                  <>
                    <Line
                      x1={BETTER_HINT_RIBBON.sourceOffset}
                      x2={geometry.shaftEnd}
                      y1={0}
                      y2={0}
                      stroke={typeof edge === "string" ? edge : undefined}
                      strokeWidth={
                        BETTER_HINT_RIBBON.width +
                        BETTER_HINT_RIBBON.outlineWidth
                      }
                      strokeDasharray={geometry.opponentDash}
                    />
                    <Line
                      x1={BETTER_HINT_RIBBON.sourceOffset}
                      x2={geometry.shaftEnd}
                      y1={0}
                      y2={0}
                      stroke={typeof color === "string" ? color : undefined}
                      strokeWidth={BETTER_HINT_RIBBON.width}
                      strokeDasharray={geometry.opponentDash}
                    />
                  </>
                ) : null}
                <Path
                  d={
                    owner === "player" ? geometry.ribbonPath : geometry.headPath
                  }
                  fill={typeof color === "string" ? color : undefined}
                  stroke={typeof edge === "string" ? edge : undefined}
                  strokeLinejoin="round"
                  strokeWidth={BETTER_HINT_RIBBON.outlineWidth}
                />
              </G>
            )
          })
        : null}
    </Svg>
  )
}
