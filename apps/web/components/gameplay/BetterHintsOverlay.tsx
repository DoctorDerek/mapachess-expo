"use client"

import createBetterHintGeometry, {
  BETTER_HINT_FRAME,
  BETTER_HINT_RIBBON,
  BETTER_HINT_VIEW_BOX,
  type BetterHintGeometry,
} from "@mapachess/match-presentation/better-hint-geometry"
import type { BetterHintsResult } from "@mapachess/match/better-hints"
import type { BoardOrientation } from "../../lib/board/boardPresentation"

type HintOwner = "opponent" | "player"

export type BetterHintsOverlayProps = Readonly<{
  hints: BetterHintsResult
  orientation: BoardOrientation
  showMoves: boolean
}>

const HINT_OUTLINE_COLOR = "var(--mapachess-board-hint-outline)"
const PLAYER_HINT_COLOR = "var(--mapachess-board-player-hint)"
const OPPONENT_HINT_COLOR = "var(--mapachess-board-opponent-hint)"

function HintRibbon({
  geometry,
  owner,
}: Readonly<{ geometry: BetterHintGeometry; owner: HintOwner }>) {
  const color = owner === "player" ? PLAYER_HINT_COLOR : OPPONENT_HINT_COLOR

  return (
    <g
      opacity={BETTER_HINT_RIBBON.opacity}
      transform={`translate(${geometry.source.x} ${geometry.source.y}) rotate(${geometry.rotationDegrees})`}
    >
      {owner === "opponent" ? (
        <>
          <line
            data-hint-stroke="outline"
            stroke={HINT_OUTLINE_COLOR}
            strokeDasharray={geometry.opponentDash}
            strokeLinecap="butt"
            strokeWidth={
              BETTER_HINT_RIBBON.width + BETTER_HINT_RIBBON.outlineWidth
            }
            x1={BETTER_HINT_RIBBON.sourceOffset}
            x2={geometry.shaftEnd}
            y1="0"
            y2="0"
          />
          <line
            data-hint-stroke="owner"
            stroke={color}
            strokeDasharray={geometry.opponentDash}
            strokeLinecap="butt"
            strokeWidth={BETTER_HINT_RIBBON.width}
            x1={BETTER_HINT_RIBBON.sourceOffset}
            x2={geometry.shaftEnd}
            y1="0"
            y2="0"
          />
        </>
      ) : null}
      <path
        d={owner === "player" ? geometry.ribbonPath : geometry.headPath}
        fill={color}
        stroke={HINT_OUTLINE_COLOR}
        strokeLinejoin="round"
        strokeWidth={BETTER_HINT_RIBBON.outlineWidth}
      />
    </g>
  )
}

export default function BetterHintsOverlay({
  hints,
  orientation,
  showMoves,
}: BetterHintsOverlayProps) {
  const visibleHints = [...hints.player, ...hints.opponent]
  const ownedHints = (["player", "opponent"] as const).flatMap((owner) =>
    hints[owner].map((hint) => ({
      owner,
      uci: hint.uci,
      geometry: createBetterHintGeometry(hint, orientation, visibleHints),
    })),
  )

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[5] size-full"
      preserveAspectRatio="none"
      viewBox={BETTER_HINT_VIEW_BOX}
    >
      {ownedHints.map(({ geometry, owner, uci }) => {
        const source = geometry.piece
        const frame = {
          fill: "none",
          height: BETTER_HINT_FRAME.size,
          rx: BETTER_HINT_FRAME.radius,
          strokeDasharray:
            owner === "opponent" ? BETTER_HINT_FRAME.opponentDash : undefined,
          width: BETTER_HINT_FRAME.size,
          x: Math.floor(source.x) + BETTER_HINT_FRAME.inset,
          y: Math.floor(source.y) + BETTER_HINT_FRAME.inset,
        }

        return (
          <g
            data-hint-kind="source"
            data-hint-owner={owner}
            data-hint-pattern={owner === "player" ? "solid" : "dashed"}
            data-source-x={source.x}
            data-source-y={source.y}
            key={`highlight-${owner}-${uci}`}
          >
            <rect
              {...frame}
              data-hint-stroke="outline"
              stroke={HINT_OUTLINE_COLOR}
              strokeWidth={BETTER_HINT_FRAME.outlineWidth}
            />
            <rect
              {...frame}
              data-hint-stroke="owner"
              stroke={
                owner === "player" ? PLAYER_HINT_COLOR : OPPONENT_HINT_COLOR
              }
              strokeWidth={BETTER_HINT_FRAME.width}
            />
          </g>
        )
      })}

      {showMoves
        ? ownedHints.map(({ geometry, owner, uci }) => (
            <g
              data-destination-x={geometry.destination.x}
              data-destination-y={geometry.destination.y}
              data-hint-kind="move"
              data-hint-owner={owner}
              data-hint-pattern={owner === "player" ? "solid" : "dashed"}
              data-source-x={geometry.source.x}
              data-source-y={geometry.source.y}
              key={`move-${owner}-${uci}`}
            >
              <HintRibbon geometry={geometry} owner={owner} />
            </g>
          ))
        : null}
    </svg>
  )
}
