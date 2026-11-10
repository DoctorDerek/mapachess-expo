import type { MatchVariant } from "@mapachess/match/match-variant"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import { challengeDifficultyTargets } from "./opponentPolicy.js"

export type ChallengeDifficultyGrid = Readonly<{
  targets: readonly number[]
  minimum: number
  maximum: number
  step: number
}>

function createGrid(variant: MatchVariant): ChallengeDifficultyGrid {
  const targets = challengeDifficultyTargets(variant)
  const [minimum, second] = targets
  const maximum = targets.at(-1)
  if (minimum === undefined || second === undefined || maximum === undefined)
    throw new Error(`Missing calibrated Challenge targets for ${variant}.`)
  return Object.freeze({
    targets: Object.freeze(targets),
    minimum,
    maximum,
    step: second - minimum,
  })
}

const grids = {
  standard: createGrid("standard"),
  chess960: createGrid("chess960"),
} satisfies Readonly<Record<MatchVariant, ChallengeDifficultyGrid>>

export default function challengeDifficultyGrid(
  variant: MatchVariant,
): ChallengeDifficultyGrid {
  return grids[variant]
}

export type ChallengeDifficultyDraft = Readonly<{
  selectedElo: number | null
  exactText: string | null
  showError: boolean
}>

export type ChallengeDifficultyEdit =
  | Readonly<{ type: "typed"; text: string }>
  | Readonly<{ type: "committed" }>
  | Readonly<{ type: "selected"; targetElo: number }>
  | Readonly<{ type: "stepped"; direction: -1 | 1 }>

export function createChallengeDifficultyDraft(
  grid: ChallengeDifficultyGrid,
  targetElo: number,
): ChallengeDifficultyDraft {
  const supported = grid.targets.includes(targetElo)
  return {
    selectedElo: supported ? targetElo : null,
    exactText: supported ? null : String(targetElo),
    showError: false,
  }
}

function resolveChallengeDifficulty(
  grid: ChallengeDifficultyGrid,
  draft: ChallengeDifficultyDraft,
): number | null {
  if (draft.exactText === null) return draft.selectedElo
  const text = draft.exactText.trim()
  if (!/^[0-9]+$/.test(text)) return null
  const targetElo = Number(text)
  return grid.targets.includes(targetElo) ? targetElo : null
}

export function challengeEloAtFraction(
  grid: ChallengeDifficultyGrid,
  fraction: number,
): number {
  const last = grid.targets.length - 1
  const index = Math.max(0, Math.min(last, Math.round(fraction * last)))
  return grid.targets[index] ?? grid.minimum
}

export function editChallengeDifficulty(
  grid: ChallengeDifficultyGrid,
  draft: ChallengeDifficultyDraft,
  edit: ChallengeDifficultyEdit,
): ChallengeDifficultyDraft {
  switch (edit.type) {
    case "typed":
      return { ...draft, exactText: edit.text, showError: false }
    case "committed": {
      const targetElo = resolveChallengeDifficulty(grid, draft)
      return targetElo === null
        ? { ...draft, showError: true }
        : createChallengeDifficultyDraft(grid, targetElo)
    }
    case "selected":
      return grid.targets.includes(edit.targetElo)
        ? createChallengeDifficultyDraft(grid, edit.targetElo)
        : draft
    case "stepped": {
      const current =
        draft.selectedElo === null
          ? -1
          : grid.targets.indexOf(draft.selectedElo)
      const next = Math.max(
        0,
        Math.min(grid.targets.length - 1, current + edit.direction),
      )
      return createChallengeDifficultyDraft(
        grid,
        grid.targets[next] ?? grid.minimum,
      )
    }
  }
}

type ChallengeHistory = MapachessPlayerData["challengeHistory"]
type DifficultyRecord = ChallengeHistory[MatchVariant]["difficulties"][number]

type ChallengeDifficultyHistoryState =
  | Readonly<{ type: "unselected" | "unplayed" }>
  | Readonly<{ type: "played"; record: DifficultyRecord }>

type ChallengeDifficultyStart =
  | Readonly<{ type: "unavailable" | "correct-exact-entry" }>
  | Readonly<{ type: "ready"; targetElo: number }>

export type ChallengeDifficultyControlState = Readonly<{
  grid: ChallengeDifficultyGrid
  rangeValue: number
  exactText: string
  hasPendingText: boolean
  showError: boolean
  history: ChallengeDifficultyHistoryState
  start: ChallengeDifficultyStart
}>

function difficultyHistory(
  history: ChallengeHistory[MatchVariant],
  selectedElo: number | null,
): ChallengeDifficultyHistoryState {
  if (selectedElo === null) return { type: "unselected" }
  const record = history.difficulties.find(
    (entry) => entry.targetElo === selectedElo,
  )
  return record === undefined
    ? { type: "unplayed" }
    : { type: "played", record }
}

function difficultyStart(
  targetElo: number | null,
  selectedElo: number | null,
): ChallengeDifficultyStart {
  if (targetElo !== null) return { type: "ready", targetElo }
  return { type: selectedElo === null ? "unavailable" : "correct-exact-entry" }
}

export function projectChallengeDifficulty(
  variant: MatchVariant,
  draft: ChallengeDifficultyDraft,
  history: ChallengeHistory,
): ChallengeDifficultyControlState {
  const grid = challengeDifficultyGrid(variant)
  const { exactText, selectedElo, showError } = draft
  return {
    grid,
    rangeValue: selectedElo ?? grid.minimum,
    exactText: exactText ?? String(selectedElo ?? ""),
    hasPendingText: exactText !== null,
    showError,
    history: difficultyHistory(history[variant], selectedElo),
    start: difficultyStart(
      resolveChallengeDifficulty(grid, draft),
      selectedElo,
    ),
  }
}
