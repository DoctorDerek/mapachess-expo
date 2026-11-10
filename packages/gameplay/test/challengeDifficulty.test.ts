import { describe, expect, it } from "vitest"
import { MATCH_VARIANTS } from "@mapachess/match/match-variant"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import challengeDifficultyGrid, {
  challengeDifficultyHistory,
  challengeDifficultyText,
  challengeEloAtFraction,
  createChallengeDifficultyDraft,
  editChallengeDifficulty,
  resolveChallengeDifficulty,
} from "../src/challengeDifficulty.js"
import { challengeDifficultyTargets } from "../src/opponentPolicy.js"

describe.each(MATCH_VARIANTS)("%s Challenge Elo", (variant) => {
  const grid = challengeDifficultyGrid(variant)
  const draft = createChallengeDifficultyDraft(grid, 1000)

  it("derives an unbroken slider grid from the actual supported targets", () => {
    expect(grid.targets).toEqual(challengeDifficultyTargets(variant))
    expect(grid.targets).toHaveLength(91)
    expect(grid).toMatchObject({ minimum: 100, maximum: 2350, step: 25 })
    expect(
      grid.targets.every(
        (elo, index) => elo === grid.minimum + index * grid.step,
      ),
    ).toBe(true)
  })

  it.each(["", "1012", "100.5", "1e3", "2,350", "-100", "75", "2400"])(
    "preserves invalid exact text %j without selecting or launching",
    (text) => {
      const pending = editChallengeDifficulty(grid, draft, {
        type: "typed",
        text,
      })
      expect(challengeDifficultyText(pending)).toBe(text)
      expect(resolveChallengeDifficulty(grid, pending)).toBeNull()
      expect(
        editChallengeDifficulty(grid, pending, { type: "committed" }),
      ).toEqual({
        selectedElo: 1000,
        exactText: text,
        showError: true,
      })
    },
  )

  it.each([100, 1475, 2350])(
    "accepts the exact value %i only when committed or resolved at Start",
    (targetElo) => {
      const pending = editChallengeDifficulty(grid, draft, {
        type: "typed",
        text: ` ${targetElo} `,
      })
      expect(pending.selectedElo).toBe(1000)
      expect(resolveChallengeDifficulty(grid, pending)).toBe(targetElo)
      const committed = editChallengeDifficulty(grid, pending, {
        type: "committed",
      })
      expect(committed.selectedElo).toBe(targetElo)
      expect(challengeDifficultyText(committed)).toBe(String(targetElo))
    },
  )

  it("cannot silently substitute a supported target for a restored invalid value", () => {
    const restored = createChallengeDifficultyDraft(grid, 2400)
    expect(challengeDifficultyText(restored)).toBe("2400")
    expect(restored.selectedElo).toBeNull()
    expect(resolveChallengeDifficulty(grid, restored)).toBeNull()
    expect(
      editChallengeDifficulty(grid, restored, {
        type: "selected",
        targetElo: 100,
      }),
    ).toEqual(createChallengeDifficultyDraft(grid, 100))
  })

  it("selects only grid targets by slider fraction and clamps steps at each end", () => {
    expect(challengeEloAtFraction(grid, -0.1)).toBe(100)
    expect(challengeEloAtFraction(grid, 0.5)).toBe(1225)
    expect(challengeEloAtFraction(grid, 1.1)).toBe(2350)
    const minimum = createChallengeDifficultyDraft(grid, 100)
    const maximum = createChallengeDifficultyDraft(grid, 2350)
    expect(
      editChallengeDifficulty(grid, minimum, {
        type: "stepped",
        direction: -1,
      }),
    ).toEqual(minimum)
    expect(
      editChallengeDifficulty(grid, maximum, { type: "stepped", direction: 1 }),
    ).toEqual(maximum)
    const invalid = editChallengeDifficulty(grid, draft, {
      type: "typed",
      text: "1012",
    })
    expect(
      editChallengeDifficulty(grid, invalid, { type: "stepped", direction: 1 }),
    ).toEqual(createChallengeDifficultyDraft(grid, 1025))
  })
})

it("reads only the accepted target record from the current variant", () => {
  const history = {
    standard: {
      animals: [],
      difficulties: [
        {
          targetElo: 1000,
          lastPlayedAnimal: "bunny-stockfish",
          highestMedal: null,
        },
      ],
    },
    chess960: {
      animals: [],
      difficulties: [
        {
          targetElo: 1000,
          lastPlayedAnimal: "chicken-stockfish",
          highestMedal: "gold",
        },
      ],
    },
  } as const satisfies MapachessPlayerData["challengeHistory"]
  expect(challengeDifficultyHistory(history, "standard", 1000)).toBe(
    history.standard.difficulties[0],
  )
  expect(challengeDifficultyHistory(history, "chess960", 1000)).toBe(
    history.chess960.difficulties[0],
  )
  expect(challengeDifficultyHistory(history, "standard", 1025)).toBeNull()
  expect(challengeDifficultyHistory(history, "chess960", null)).toBeNull()
})
