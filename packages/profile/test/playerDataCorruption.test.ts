import { describe, expect, it } from "vitest"
import { createInitialMatchPosition } from "@mapachess/match/match-position"
import { LEVEL_ACHIEVEMENTS, levelFromTotalXp } from "../src/globalXp"
import createInitialPlayerData, {
  type MapachessPlayerData,
} from "../src/playerData"
import {
  canonicalPlayerData,
  decodeMapachessPlayerData,
} from "../src/playerDataCodec"
import { replaceActiveMatch } from "../src/profileMutations"
import completedStoryMatch from "./storyProgressTestSupport"

const completed = {
  ...completedStoryMatch(),
  opponentTargetElo: 100,
  ratedOpponentElo: 100,
  playerElosAtStart: { gold: 100, silver: 100, bronze: 100 },
}
const fresh = {
  ...completed,
  conclusion: null,
  cursor: 0,
  moveIds: [],
  currentFen: createInitialMatchPosition(completed.startingPosition).fen,
}
const accepted = replaceActiveMatch(
  replaceActiveMatch(
    {
      ...createInitialPlayerData(),
      totalXp: 100,
      unlockedAchievementIds: LEVEL_ACHIEVEMENTS.filter(
        ({ level }) => level <= levelFromTotalXp(100),
      ).map(({ id }) => id),
    },
    fresh,
  ),
  completed,
)
const reward = accepted.lastAcceptedResultReward
if (
  reward === null ||
  reward.ratedElo === null ||
  reward.contribution === undefined
)
  throw new Error(
    "The corruption fixtures require a fully accepted rated result.",
  )
const rated = reward.ratedElo
const contribution = reward.contribution

const receiptDamage: readonly Corruption[] = [
  {
    problem: "out-of-order achievements",
    corrupt: (data) => ({
      ...data,
      unlockedAchievementIds: [...data.unlockedAchievementIds].reverse(),
    }),
  },
  {
    problem: "reward total different from profile XP",
    corrupt: (data) => ({
      ...data,
      lastAcceptedResultReward: {
        ...reward,
        totalXpBefore: reward.totalXpBefore + 4,
      },
    }),
  },
  {
    problem: "active receipt marked rebase",
    corrupt: (data) => ({
      ...data,
      lastAcceptedResultReward: {
        ...reward,
        contribution: { ...contribution, eloState: "rebase" },
      },
    }),
  },
  {
    problem: "rated receipt without count ownership",
    corrupt: (data) => ({
      ...data,
      lastAcceptedResultReward: {
        ...reward,
        contribution: { ...contribution, ratedMatchCountBefore: null },
      },
    }),
  },
  {
    problem: "mismatched contribution variant",
    corrupt: (data) => ({
      ...data,
      lastAcceptedResultReward: {
        ...reward,
        contribution: { ...contribution, variant: "chess960" },
      },
    }),
  },
  {
    problem: "mismatched contribution assistance",
    corrupt: (data) => ({
      ...data,
      lastAcceptedResultReward: {
        ...reward,
        contribution: { ...contribution, assistance: "bronze" },
      },
    }),
  },
  {
    problem: "mismatched contribution time category",
    corrupt: (data) => ({
      ...data,
      lastAcceptedResultReward: {
        ...reward,
        contribution: { ...contribution, timeCategory: "blitz" },
      },
    }),
  },
  {
    problem: "wrong retained opponent",
    corrupt: (data) => ({
      ...data,
      lastAcceptedResultReward: {
        ...reward,
        contribution: { ...contribution, opponentId: "bunny-stockfish" },
      },
    }),
  },
  {
    problem: "Challenge result attached to Story",
    corrupt: (data) => ({
      ...data,
      lastAcceptedResultReward: {
        ...reward,
        contribution: { ...contribution, challengeOutcome: "win" },
      },
    }),
  },
  {
    problem: "missing retained conclusion",
    corrupt: (data) => ({
      ...data,
      lastAcceptedResultReward: {
        ...reward,
        contribution: {
          ...contribution,
          ending: { ...contribution.ending, conclusion: null },
        },
      },
    }),
  },
  {
    problem: "retained cursor inconsistent with its moves",
    corrupt: (data) => ({
      ...data,
      lastAcceptedResultReward: {
        ...reward,
        contribution: {
          ...contribution,
          ending: {
            ...contribution.ending,
            cursor: contribution.ending.cursor - 1,
          },
        },
      },
    }),
  },
  {
    problem: "retained ending FEN inconsistent with its moves",
    corrupt: (data) => ({
      ...data,
      lastAcceptedResultReward: {
        ...reward,
        contribution: {
          ...contribution,
          ending: { ...contribution.ending, currentFen: fresh.currentFen },
        },
      },
    }),
  },
  {
    problem: "receipt rating different from profile balance",
    corrupt: (data) => ({
      ...data,
      ratings: {
        ...data.ratings,
        "standard-untimed-gold": data.ratings["standard-untimed-gold"] + 1,
      },
    }),
  },
  {
    problem: "receipt count different from profile count",
    corrupt: (data) => ({
      ...data,
      ratedMatchCounts: {
        ...data.ratedMatchCounts,
        "standard-untimed-gold":
          data.ratedMatchCounts["standard-untimed-gold"] + 1,
      },
    }),
  },
]

type Corruption = {
  problem: string
  corrupt: (data: MapachessPlayerData) => unknown
}
const corruptions: readonly Corruption[] = [
  { problem: "missing object", corrupt: () => null },
  { problem: "array root", corrupt: () => [] },
  {
    problem: "wrong schema",
    corrupt: (data) => ({ ...data, schema: "different-game" }),
  },
  {
    problem: "future schema version",
    corrupt: (data) => ({ ...data, schemaVersion: 999 }),
  },
  {
    problem: "extra root key",
    corrupt: (data) => ({ ...data, unexpected: true }),
  },
  {
    problem: "unsafe revision",
    corrupt: (data) => ({ ...data, revision: Number.MAX_SAFE_INTEGER + 1 }),
  },
  {
    problem: "negative revision",
    corrupt: (data) => ({ ...data, revision: -1 }),
  },
  { problem: "fractional XP", corrupt: (data) => ({ ...data, totalXp: 0.5 }) },
  { problem: "negative XP", corrupt: (data) => ({ ...data, totalXp: -2 }) },
  {
    problem: "non-boolean first arrival",
    corrupt: (data) => ({ ...data, introductionCompleted: "yes" }),
  },
  {
    problem: "missing rating contexts",
    corrupt: (data) => ({ ...data, ratings: {} }),
  },
  {
    problem: "nonfinite rating",
    corrupt: (data) => ({
      ...data,
      ratings: { ...data.ratings, "standard-untimed-gold": Number.NaN },
    }),
  },
  {
    problem: "below-minimum rating",
    corrupt: (data) => ({
      ...data,
      ratings: { ...data.ratings, "standard-untimed-gold": 99 },
    }),
  },
  {
    problem: "negative rated count",
    corrupt: (data) => ({
      ...data,
      ratedMatchCounts: {
        ...data.ratedMatchCounts,
        "standard-untimed-gold": -1,
      },
    }),
  },
  {
    problem: "invalid hint mode",
    corrupt: (data) => ({
      ...data,
      settings: { ...data.settings, autoHintMode: "automatic" },
    }),
  },
  {
    problem: "invalid reaction position",
    corrupt: (data) => ({
      ...data,
      settings: { ...data.settings, moveReactionPlacement: "sideways" },
    }),
  },
  {
    problem: "invalid card category",
    corrupt: (data) => ({
      ...data,
      settings: {
        ...data.settings,
        cardRatingContext: { category: "daily", assistance: "gold" },
      },
    }),
  },
  {
    problem: "invalid card medal",
    corrupt: (data) => ({
      ...data,
      settings: {
        ...data.settings,
        cardRatingContext: { category: "untimed", assistance: "platinum" },
      },
    }),
  },
  {
    problem: "missing processed-ID list",
    corrupt: (data) => ({ ...data, processedMatchResultIds: null }),
  },
  {
    problem: "blank processed ID",
    corrupt: (data) => ({ ...data, processedMatchResultIds: [""] }),
  },
  {
    problem: "trimmed processed ID",
    corrupt: (data) => ({ ...data, processedMatchResultIds: [" padded "] }),
  },
  {
    problem: "oversized processed ID",
    corrupt: (data) => ({
      ...data,
      processedMatchResultIds: ["x".repeat(257)],
    }),
  },
  {
    problem: "duplicate processed ID",
    corrupt: (data) => ({
      ...data,
      processedMatchResultIds: [completed.matchId, completed.matchId],
    }),
  },
  {
    problem: "missing achievement list",
    corrupt: (data) => ({ ...data, unlockedAchievementIds: null }),
  },
  {
    problem: "unknown achievement",
    corrupt: (data) => ({
      ...data,
      unlockedAchievementIds: ["not-an-achievement"],
    }),
  },
  {
    problem: "duplicate achievement",
    corrupt: (data) => ({
      ...data,
      unlockedAchievementIds: [
        ...data.unlockedAchievementIds,
        ...data.unlockedAchievementIds,
      ],
    }),
  },
  {
    problem: "unknown match version",
    corrupt: (data) => ({
      ...data,
      activeMatch: { ...completed, recordVersion: 999 },
    }),
  },
  {
    problem: "invalid match seed",
    corrupt: (data) => ({
      ...data,
      activeMatch: { ...completed, matchSeed: "bad" },
    }),
  },
  {
    problem: "negative cursor",
    corrupt: (data) => ({ ...data, activeMatch: { ...completed, cursor: -1 } }),
  },
  {
    problem: "cursor past branch",
    corrupt: (data) => ({ ...data, activeMatch: { ...completed, cursor: 5 } }),
  },
  {
    problem: "false derived FEN",
    corrupt: (data) => ({
      ...data,
      activeMatch: { ...completed, currentFen: fresh.currentFen },
    }),
  },
  {
    problem: "unknown starting variant",
    corrupt: (data) => ({
      ...data,
      activeMatch: {
        ...completed,
        startingPosition: { variant: "double", chess960PositionId: null },
      },
    }),
  },
  {
    problem: "invalid Chess960 layout",
    corrupt: (data) => ({
      ...data,
      activeMatch: {
        ...completed,
        startingPosition: { variant: "chess960", chess960PositionId: 960 },
      },
    }),
  },
  {
    problem: "non-list move history",
    corrupt: (data) => ({
      ...data,
      activeMatch: { ...completed, moveIds: "e2e4" },
    }),
  },
  {
    problem: "oversized move history",
    corrupt: (data) => ({
      ...data,
      activeMatch: {
        ...completed,
        moveIds: Array.from({ length: 20001 }, () => "e2e4"),
      },
    }),
  },
  {
    problem: "malformed move",
    corrupt: (data) => ({
      ...data,
      activeMatch: { ...completed, moveIds: ["invalid"] },
    }),
  },
  {
    problem: "Move Hints without Piece Hints",
    corrupt: (data) => ({
      ...data,
      activeMatch: { ...completed, moveHintsUsed: true, pieceHintsUsed: false },
    }),
  },
  {
    problem: "unknown conclusion",
    corrupt: (data) => ({
      ...data,
      activeMatch: { ...completed, conclusion: { type: "unknown" } },
    }),
  },
  {
    problem: "wrong conclusion winner",
    corrupt: (data) => ({
      ...data,
      activeMatch: {
        ...completed,
        conclusion: { type: "checkmate", winner: "white" },
      },
    }),
  },
  {
    problem: "unknown starting assistance rating",
    corrupt: (data) => ({
      ...data,
      activeMatch: {
        ...completed,
        playerElosAtStart: { gold: 100, silver: 100 },
      },
    }),
  },
  {
    problem: "negative awarded XP",
    corrupt: (data) => ({
      ...data,
      lastAcceptedResultReward: { ...reward, awardedXp: -2 },
    }),
  },
  {
    problem: "fractional awarded XP",
    corrupt: (data) => ({
      ...data,
      lastAcceptedResultReward: { ...reward, awardedXp: 0.5 },
    }),
  },
  {
    problem: "negative prior XP",
    corrupt: (data) => ({
      ...data,
      lastAcceptedResultReward: { ...reward, totalXpBefore: -2 },
    }),
  },
  {
    problem: "unprocessed reward identity",
    corrupt: (data) => ({
      ...data,
      lastAcceptedResultReward: { ...reward, matchId: "unprocessed-result" },
    }),
  },
  {
    problem: "unknown rewarded achievement",
    corrupt: (data) => ({
      ...data,
      lastAcceptedResultReward: {
        ...reward,
        unlockedAchievementIds: ["unknown"],
      },
    }),
  },
  {
    problem: "below-minimum prior Elo",
    corrupt: (data) => ({
      ...data,
      lastAcceptedResultReward: {
        ...reward,
        ratedElo: { ...rated, before: 99 },
      },
    }),
  },
  {
    problem: "below-minimum resulting Elo",
    corrupt: (data) => ({
      ...data,
      lastAcceptedResultReward: {
        ...reward,
        ratedElo: { ...rated, after: 99 },
      },
    }),
  },
  {
    problem: "unknown rewarded variant",
    corrupt: (data) => ({
      ...data,
      lastAcceptedResultReward: {
        ...reward,
        ratedElo: { ...rated, variant: "double" },
      },
    }),
  },
  {
    problem: "unknown rewarded category",
    corrupt: (data) => ({
      ...data,
      lastAcceptedResultReward: {
        ...reward,
        ratedElo: { ...rated, timeCategory: "daily" },
      },
    }),
  },
  {
    problem: "unknown rewarded assistance",
    corrupt: (data) => ({
      ...data,
      lastAcceptedResultReward: {
        ...reward,
        ratedElo: { ...rated, assistance: "platinum" },
      },
    }),
  },
  {
    problem: "unknown contribution Elo state",
    corrupt: (data) => ({
      ...data,
      lastAcceptedResultReward: {
        ...reward,
        contribution: { ...contribution, eloState: "unknown" },
      },
    }),
  },
  {
    problem: "negative contribution count",
    corrupt: (data) => ({
      ...data,
      lastAcceptedResultReward: {
        ...reward,
        contribution: { ...contribution, ratedMatchCountBefore: -1 },
      },
    }),
  },
]

describe("player-data rejection across progression, ratings, and retained match boundaries", () => {
  it.each([...corruptions, ...receiptDamage])(
    "rejects $problem while preserving the valid source profile",
    ({ corrupt }) => {
      const original = canonicalPlayerData(accepted)
      const valid = decodeMapachessPlayerData(accepted)
      if (!valid.ok)
        throw new Error(
          `The accepted fixture must decode: ${JSON.stringify(valid.issue)}`,
        )
      const decoded = decodeMapachessPlayerData(corrupt(accepted))
      expect(decoded.ok).toBe(false)
      expect(canonicalPlayerData(accepted)).toBe(original)
      expect(decodeMapachessPlayerData(accepted).ok).toBe(true)
    },
  )
})
