import type { MatchVariant } from "@mapachess/match/match-variant"

// The first three published ladders used different settings at the same displayed Elo.
const remainingRungs = [
  [3200],
  [2800],
  [2550],
  [2325],
  [2000],
  [1725],
  [1350],
  [1125],
  [825],
  [550],
  [400],
  [250],
  [80],
] as const

const provisionalPresets = {
  standard: [
    [9000, 9150],
    [8000, 8200],
    [7350],
    [6550],
    [6150],
    [5500, 6000, 5800],
    [5000, 5400],
    [4450, 5000, 5050],
    [3850, 4450],
    [3650, 3850],
    ...remainingRungs,
  ],
  chess960: [
    [8350, 8500, 9300],
    [8000, 8100, 8700],
    [7350, 7700, 8100],
    [6550, 6650, 7400],
    [6150, 6000, 6650],
    [5500, 5700, 6000],
    [5400, 5000, 5350],
    [5000, 4300, 4800],
    [4450, 3800, 4300],
    [3650, 3600, 3800],
    ...remainingRungs,
  ],
} as const

export default function provisionalWebProbabilities(
  variant: MatchVariant,
  targetElo: number,
): readonly number[] {
  return provisionalPresets[variant][targetElo / 100 - 1] ?? []
}
