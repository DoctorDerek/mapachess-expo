"use client"

import { useId, type ReactNode } from "react"
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

const PLAYER_HINT_COLOR = "#16a34a"
const OPPONENT_HINT_COLOR = "#dc2626"

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

const sourceShape = (ownedHint: OwnedHint, point: BoardPoint): ReactNode =>
  ownedHint.owner === "player" ? (
    <circle
      cx={point.x}
      cy={point.y}
      fill="none"
      r="0.29"
      stroke="white"
      strokeWidth="0.1"
    />
  ) : (
    <>
      <path
        d={`M ${String(point.x)} ${String(point.y - 0.34)} L ${String(point.x + 0.36)} ${String(point.y + 0.3)} L ${String(point.x - 0.36)} ${String(point.y + 0.3)} Z`}
        fill="none"
        stroke="white"
        strokeLinejoin="round"
        strokeWidth="0.09"
      />
      <path
        d={`M ${String(point.x)} ${String(point.y - 0.11)} L ${String(point.x)} ${String(point.y + 0.1)} M ${String(point.x)} ${String(point.y + 0.19)} L ${String(point.x)} ${String(point.y + 0.2)}`}
        stroke="white"
        strokeLinecap="round"
        strokeWidth="0.08"
      />
    </>
  )

const destinationPath = (owner: HintOwner, point: BoardPoint): string =>
  owner === "player"
    ? `M ${String(point.x - 0.25)} ${String(point.y)} L ${String(point.x + 0.25)} ${String(point.y)} M ${String(point.x)} ${String(point.y - 0.25)} L ${String(point.x)} ${String(point.y + 0.25)}`
    : `M ${String(point.x - 0.23)} ${String(point.y - 0.23)} L ${String(point.x + 0.23)} ${String(point.y + 0.23)} M ${String(point.x + 0.23)} ${String(point.y - 0.23)} L ${String(point.x - 0.23)} ${String(point.y + 0.23)}`

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
      className="pointer-events-none absolute inset-0 z-[15] size-full"
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
            markerHeight="0.42"
            markerUnits="userSpaceOnUse"
            markerWidth="0.42"
            orient="auto"
            refX="8.5"
            refY="5"
            viewBox="0 0 10 10"
          >
            <path d="M 0 0 L 10 5 L 0 10 Z" fill={color} />
          </marker>
        ))}
      </defs>

      {ownedHints.map((ownedHint) => {
        const source = pointForSquare(ownedHint.hint.from, orientation)
        return (
          <rect
            data-hint-kind="source-highlight"
            data-hint-owner={ownedHint.owner}
            fill={hintColor(ownedHint.owner)}
            fillOpacity="0.32"
            height="1"
            key={`highlight-${ownedHint.owner}-${ownedHint.hint.uci}`}
            stroke={hintColor(ownedHint.owner)}
            strokeOpacity="0.85"
            strokeWidth="0.08"
            width="1"
            x={Math.floor(source.x)}
            y={Math.floor(source.y)}
          />
        )
      })}

      {showMoves
        ? ownedHints.map((ownedHint) => {
            const source = pointForSquare(ownedHint.hint.from, orientation)
            const destination = pointForSquare(ownedHint.hint.to, orientation)
            const color = hintColor(ownedHint.owner)
            const targetPath = destinationPath(ownedHint.owner, destination)
            return (
              <g
                data-destination-x={destination.x}
                data-destination-y={destination.y}
                data-hint-kind="move"
                data-hint-owner={ownedHint.owner}
                data-hint-shape={
                  ownedHint.owner === "player" ? "target-cross" : "x"
                }
                data-source-x={source.x}
                data-source-y={source.y}
                key={`move-${ownedHint.owner}-${ownedHint.hint.uci}`}
              >
                <line
                  markerEnd={`url(#${ownedHint.owner === "player" ? playerMarkerId : opponentMarkerId})`}
                  opacity="0.9"
                  stroke={color}
                  strokeDasharray="0.22 0.13"
                  strokeLinecap="round"
                  strokeWidth="0.14"
                  x1={source.x}
                  x2={destination.x}
                  y1={source.y}
                  y2={destination.y}
                />
                {ownedHint.owner === "player" ? (
                  <circle
                    cx={destination.x}
                    cy={destination.y}
                    fill="none"
                    r="0.34"
                    stroke="white"
                    strokeWidth="0.08"
                  />
                ) : null}
                <path
                  d={targetPath}
                  fill="none"
                  stroke="white"
                  strokeLinecap="round"
                  strokeWidth="0.17"
                />
                <path
                  d={targetPath}
                  fill="none"
                  stroke={color}
                  strokeLinecap="round"
                  strokeWidth="0.09"
                />
              </g>
            )
          })
        : null}

      {ownedHints.map((ownedHint) => {
        const source = pointForSquare(ownedHint.hint.from, orientation)
        return (
          <g
            data-hint-kind="source"
            data-hint-owner={ownedHint.owner}
            data-hint-shape={
              ownedHint.owner === "player" ? "circle" : "warning-triangle"
            }
            data-source-x={source.x}
            data-source-y={source.y}
            key={`source-${ownedHint.owner}-${ownedHint.hint.uci}`}
          >
            {sourceShape(ownedHint, source)}
          </g>
        )
      })}
    </svg>
  )
}
