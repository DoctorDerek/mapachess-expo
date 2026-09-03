"use client"

import { useId } from "react"
import type {
  BetterHint,
  BetterHintsResult,
} from "@mapachess/match/better-hints"
import type { MatchSquare } from "@mapachess/match/match-position"
import type { BoardOrientation } from "../../lib/board/boardPresentation"

type HintOwner = "opponent" | "player"

type OwnedHint = Readonly<{
  hint: BetterHint
  owner: HintOwner
}>

type BoardPoint = Readonly<{
  x: number
  y: number
}>

export type BetterHintsOverlayProps = Readonly<{
  hints: BetterHintsResult
  orientation: BoardOrientation
  showMoves: boolean
}>

const HINT_OUTLINE_COLOR = "var(--mapachess-board-hint-outline)"
const PLAYER_HINT_COLOR = "var(--mapachess-board-player-hint)"
const OPPONENT_HINT_COLOR = "var(--mapachess-board-opponent-hint)"

const ownHints = (hints: BetterHintsResult): readonly OwnedHint[] => [
  ...hints.player.map((hint) => ({ hint, owner: "player" as const })),
  ...hints.opponent.map((hint) => ({
    hint,
    owner: "opponent" as const,
  })),
]

const pointForSquare = (
  square: MatchSquare,
  orientation: BoardOrientation,
): BoardPoint => {
  const fileIndex = square.charCodeAt(0) - "a".charCodeAt(0)
  const rankIndex = Number(square.slice(1)) - 1

  return orientation === "white"
    ? { x: fileIndex + 0.5, y: 7.5 - rankIndex }
    : { x: 7.5 - fileIndex, y: rankIndex + 0.5 }
}

const hintColor = (owner: HintOwner): string =>
  owner === "player" ? PLAYER_HINT_COLOR : OPPONENT_HINT_COLOR

export default function BetterHintsOverlay({
  hints,
  orientation,
  showMoves,
}: BetterHintsOverlayProps) {
  const markerPrefix = useId().replaceAll(":", "")
  const playerMarkerId = `${markerPrefix}-player-hint-arrow`
  const opponentMarkerId = `${markerPrefix}-opponent-hint-arrow`
  const ownedHints = ownHints(hints)

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[5] size-full"
      preserveAspectRatio="none"
      viewBox="0 0 8 8"
    >
      <defs>
        {(
          [
            [playerMarkerId, PLAYER_HINT_COLOR],
            [opponentMarkerId, OPPONENT_HINT_COLOR],
          ] as const
        ).map(([id, color]) => (
          <marker
            id={id}
            key={id}
            markerHeight="0.96"
            markerUnits="userSpaceOnUse"
            markerWidth="0.96"
            orient="auto"
            refX="8.25"
            refY="5"
            viewBox="0 0 10 10"
          >
            <path
              d="M 0 0 L 10 5 L 0 10 Z"
              fill={color}
              stroke={HINT_OUTLINE_COLOR}
              strokeLinejoin="round"
              strokeWidth="1.5"
            />
          </marker>
        ))}
      </defs>

      {ownedHints.map((ownedHint) => {
        const source = pointForSquare(ownedHint.hint.from, orientation)
        return (
          <g
            data-hint-kind="source"
            data-hint-owner={ownedHint.owner}
            data-hint-pattern={
              ownedHint.owner === "player" ? "solid" : "dashed"
            }
            data-source-x={source.x}
            data-source-y={source.y}
            key={`highlight-${ownedHint.owner}-${ownedHint.hint.uci}`}
          >
            <rect
              data-hint-stroke="outline"
              fill="none"
              height="0.82"
              rx="0.06"
              stroke={HINT_OUTLINE_COLOR}
              strokeDasharray={
                ownedHint.owner === "opponent" ? "0.16 0.1" : undefined
              }
              strokeWidth="0.22"
              width="0.82"
              x={Math.floor(source.x) + 0.09}
              y={Math.floor(source.y) + 0.09}
            />
            <rect
              data-hint-stroke="owner"
              fill="none"
              height="0.82"
              rx="0.06"
              stroke={hintColor(ownedHint.owner)}
              strokeDasharray={
                ownedHint.owner === "opponent" ? "0.16 0.1" : undefined
              }
              strokeWidth="0.12"
              width="0.82"
              x={Math.floor(source.x) + 0.09}
              y={Math.floor(source.y) + 0.09}
            />
          </g>
        )
      })}

      {showMoves
        ? ownedHints.map((ownedHint) => {
            const source = pointForSquare(ownedHint.hint.from, orientation)
            const destination = pointForSquare(ownedHint.hint.to, orientation)
            const color = hintColor(ownedHint.owner)
            return (
              <g
                data-destination-x={destination.x}
                data-destination-y={destination.y}
                data-hint-kind="move"
                data-hint-owner={ownedHint.owner}
                data-hint-pattern={
                  ownedHint.owner === "player" ? "solid" : "dashed"
                }
                data-source-x={source.x}
                data-source-y={source.y}
                key={`move-${ownedHint.owner}-${ownedHint.hint.uci}`}
              >
                <line
                  data-hint-stroke="outline"
                  stroke={HINT_OUTLINE_COLOR}
                  strokeDasharray={
                    ownedHint.owner === "opponent" ? "0.22 0.13" : undefined
                  }
                  strokeLinecap="round"
                  strokeWidth="0.34"
                  x1={source.x}
                  x2={destination.x}
                  y1={source.y}
                  y2={destination.y}
                />
                <line
                  data-hint-stroke="owner"
                  markerEnd={`url(#${ownedHint.owner === "player" ? playerMarkerId : opponentMarkerId})`}
                  stroke={color}
                  strokeDasharray={
                    ownedHint.owner === "opponent" ? "0.22 0.13" : undefined
                  }
                  strokeLinecap="round"
                  strokeWidth="0.2"
                  x1={source.x}
                  x2={destination.x}
                  y1={source.y}
                  y2={destination.y}
                />
              </g>
            )
          })
        : null}
    </svg>
  )
}
