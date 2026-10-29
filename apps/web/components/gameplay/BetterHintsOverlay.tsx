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

function HintRibbon({
  geometry,
  owner,
}: Readonly<{
  geometry: BetterHintGeometry
  owner: HintOwner
}>) {
  return (
    <g
      opacity={BETTER_HINT_RIBBON.opacity}
      transform={`translate(${geometry.source.x} ${geometry.source.y}) rotate(${geometry.rotationDegrees})`}
    >
      {owner === "opponent" ? (
        <>
          <line
            data-hint-stroke="outline"
            className="stroke-board-hint-edge"
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
            className="stroke-current"
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
        className="stroke-board-hint-edge fill-current"
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
            className="text-board-hint-player data-[hint-owner=opponent]:text-board-hint-opponent"
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
              className="stroke-board-hint-edge"
              strokeWidth={BETTER_HINT_FRAME.outlineWidth}
            />
            <rect
              {...frame}
              data-hint-stroke="owner"
              className="stroke-current"
              strokeWidth={BETTER_HINT_FRAME.width}
            />
          </g>
        )
      })}

      {showMoves
        ? ownedHints.map(({ geometry, owner, uci }) => (
            <g
              className="text-board-hint-player data-[hint-owner=opponent]:text-board-hint-opponent"
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
