import { describe, expect, it } from "vitest"
import loadCatalog from "@mapachess/localization/catalog"
import { STOCKFISH_OPPONENTS } from "@mapachess/match/stockfish-opponent"
import matchResultPresentation, {
  matchResultRating,
  storyResultPresentation,
} from "../src/matchResultPresentation.js"
import type { AcceptedMatchReward } from "../src/playerData.js"
import applyStoryMatchResult, {
  createInitialStoryProgress,
} from "../src/storyProgress.js"
import completedStoryMatch from "./storyProgressTestSupport.js"

const copy = loadCatalog("en")
const match = completedStoryMatch()
const progress = applyStoryMatchResult(createInitialStoryProgress(), match)
const reward: AcceptedMatchReward = {
  matchId: match.matchId,
  awardedXp: 12,
  totalXpBefore: 70,
  unlockedAchievementIds: [],
  ratedElo: { variant: "standard", before: 100, after: 112 },
}

describe("completed match presentation", () => {
  it("projects the earned Story medal and next available opponent", () => {
    const next = STOCKFISH_OPPONENTS[1]!
    expect(matchResultPresentation(match, progress, copy)).toMatchObject({
      heading: copy.gameplay.defeatedOpponent(
        copy.animals.opponent(match.opponentId),
      ),
      medal: "gold",
      storyComplete: false,
      action: {
        kind: "next",
        target: { id: next.id, elo: next.storyTargetElo },
        setup: { mode: "story", variant: "standard", opponentId: next.id },
      },
    })
  })

  it("keeps historical medals separate from a current loss or draw", () => {
    for (const conclusion of [
      { type: "resignation", winner: "white" },
      { type: "draw-agreement" },
    ] as const) {
      const ended = { ...match, conclusion }
      expect(storyResultPresentation(ended, progress)).toMatchObject({
        medal: null,
        best: "gold",
      })
      expect(matchResultPresentation(ended, progress, copy)).toMatchObject({
        medal: null,
        reason: null,
        action: { kind: "replay", target: { id: match.opponentId, elo: 100 } },
      })
    }
  })

  it("offers the Story ladder when all opponents have been defeated", () => {
    const standard = STOCKFISH_OPPONENTS.map(({ id }) => ({
      opponentId: id,
      highestMedal: "bronze" as const,
    }))
    const last = STOCKFISH_OPPONENTS.at(-1)!
    expect(
      matchResultPresentation(
        { ...match, opponentId: last.id },
        { ...progress, standard },
        copy,
      ),
    ).toMatchObject({
      storyComplete: true,
      action: { kind: "ladder", setup: { mode: "story", variant: "standard" } },
    })
  })

  it("preserves a Challenge target, an unknown legacy target and a non-checkmate win reason", () => {
    const challenge = {
      ...match,
      mode: "challenge",
      conclusion: { type: "resignation", winner: "black" },
    } as const
    expect(
      matchResultPresentation(
        { ...challenge, opponentTargetElo: 1825 },
        progress,
        copy,
      ),
    ).toMatchObject({
      reason: copy.interface.matchCelebration.opponentResigned,
      action: {
        kind: "replay",
        target: { id: match.opponentId, elo: 1825 },
        setup: null,
      },
    })
    expect(matchResultPresentation(challenge, progress, copy)?.action).toEqual({
      kind: "replay",
      target: { id: match.opponentId, elo: undefined },
      setup: null,
    })
    expect(
      matchResultPresentation({ ...match, conclusion: null }, progress, copy),
    ).toBeNull()
  })

  it("retains exact accepted rating values and fills only legacy context fields", () => {
    expect(matchResultRating(match, null)).toBeNull()
    expect(matchResultRating(match, { ...reward, ratedElo: null })).toBeNull()
    expect(
      matchResultRating({ ...match, pieceHintsUsed: true }, reward),
    ).toEqual({
      variant: "standard",
      assistance: "silver",
      timeCategory: "untimed",
      before: 100,
      after: 112,
    })
    const ratedElo = {
      variant: "chess960",
      assistance: "bronze",
      timeCategory: "bullet",
      before: 100,
      after: 100,
    } as const
    expect(matchResultRating(match, { ...reward, ratedElo })).toEqual(ratedElo)
  })
})
