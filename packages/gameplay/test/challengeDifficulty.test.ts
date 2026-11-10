import { describe, expect, it } from "vitest"
import { MATCH_VARIANTS } from "@mapachess/match/match-variant"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import challengeDifficultyGrid, {
  challengeEloAtFraction,
  createChallengeDifficultyDraft,
  editChallengeDifficulty,
  projectChallengeDifficulty,
  type ChallengeDifficultyDraft,
} from "../src/challengeDifficulty.js"
import { challengeDifficultyTargets } from "../src/opponentPolicy.js"

const emptyHistory = {
  standard: { animals: [], difficulties: [] },
  chess960: { animals: [], difficulties: [] },
} as const satisfies MapachessPlayerData["challengeHistory"]

describe.each(MATCH_VARIANTS)("%s Challenge Elo", (variant) => {
  const grid = challengeDifficultyGrid(variant)
  const draft = createChallengeDifficultyDraft(grid, 1000)
  const controlFor = (current: ChallengeDifficultyDraft) =>
    projectChallengeDifficulty(variant, current, emptyHistory)

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
      expect(controlFor(pending)).toMatchObject({
        rangeValue: 1000,
        exactText: text,
        hasPendingText: true,
        showError: false,
        history: { type: "unplayed" },
        start: { type: "correct-exact-entry" },
      })
      const invalid = editChallengeDifficulty(grid, pending, {
        type: "committed",
      })
      expect(controlFor(invalid)).toEqual({
        ...controlFor(pending),
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
      expect(controlFor(pending)).toMatchObject({
        rangeValue: 1000,
        exactText: ` ${targetElo} `,
        hasPendingText: true,
        start: { type: "ready", targetElo },
      })
      const committed = editChallengeDifficulty(grid, pending, {
        type: "committed",
      })
      expect(controlFor(committed)).toMatchObject({
        rangeValue: targetElo,
        exactText: String(targetElo),
        hasPendingText: false,
        start: { type: "ready", targetElo },
      })
    },
  )

  it("cannot silently substitute a supported target for a restored invalid value", () => {
    const restored = createChallengeDifficultyDraft(grid, 2400)
    expect(controlFor(restored)).toMatchObject({
      rangeValue: 100,
      exactText: "2400",
      hasPendingText: true,
      history: { type: "unselected" },
      start: { type: "unavailable" },
    })
    const recovered = editChallengeDifficulty(grid, restored, {
      type: "selected",
      targetElo: 100,
    })
    expect(controlFor(recovered)).toMatchObject({
      rangeValue: 100,
      exactText: "100",
      hasPendingText: false,
      showError: false,
      history: { type: "unplayed" },
      start: { type: "ready", targetElo: 100 },
    })
  })

  it("recovers invalid text by selecting the committed Elo again", () => {
    const pending = editChallengeDifficulty(grid, draft, {
      type: "typed",
      text: "1012",
    })
    const invalid = editChallengeDifficulty(grid, pending, {
      type: "committed",
    })
    const recovered = editChallengeDifficulty(grid, invalid, {
      type: "selected",
      targetElo: 1000,
    })
    expect(controlFor(recovered)).toEqual(controlFor(draft))
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
  for (const variant of MATCH_VARIANTS) {
    const grid = challengeDifficultyGrid(variant)
    const draft = createChallengeDifficultyDraft(grid, 1000)
    const pending = editChallengeDifficulty(grid, draft, {
      type: "typed",
      text: "1025",
    })
    expect(projectChallengeDifficulty(variant, pending, history)).toMatchObject(
      {
        history: { type: "played", record: history[variant].difficulties[0] },
        rangeValue: 1000,
        start: { type: "ready", targetElo: 1025 },
      },
    )
    const committed = editChallengeDifficulty(grid, pending, {
      type: "committed",
    })
    expect(
      projectChallengeDifficulty(variant, committed, history).history,
    ).toEqual({
      type: "unplayed",
    })
  }
})
