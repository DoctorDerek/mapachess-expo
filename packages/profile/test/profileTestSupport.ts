import { createHash } from "node:crypto"
import {
  durableStoreSnapshotsEqual,
  EMPTY_DURABLE_STORE_SNAPSHOT,
  type DurableStoreAdapter,
  type DurableStoreSnapshot,
} from "../src/durableStore.js"
import type { MatchMedal } from "../src/matchMedal.js"
import type { MapachessPlayerData } from "../src/playerData.js"
import { PLAYER_RATING_CONTEXTS } from "../src/ratingContext.js"

function withoutAssistance<T extends { assistance?: MatchMedal }>(
  value: T,
): Omit<T, "assistance"> {
  const { assistance: _assistance, ...previous } = value
  return previous
}

export function withoutAssistanceRatings(data: MapachessPlayerData) {
  const reward = data.lastAcceptedResultReward
  const { cardRatingContext: _cardRatingContext, ...settings } = data.settings
  const contexts = PLAYER_RATING_CONTEXTS.filter(
    ({ assistance }) => assistance === "gold",
  )
  const legacyId = ({ variant, category }: (typeof contexts)[number]) =>
    category === "untimed" ? variant : `${variant}-${category}`
  return {
    ...data,
    settings,
    ratings: Object.fromEntries(
      contexts.map((context) => [legacyId(context), data.ratings[context.id]]),
    ),
    ratedMatchCounts: Object.fromEntries(
      contexts.map((context) => [
        legacyId(context),
        data.ratedMatchCounts[context.id],
      ]),
    ),
    lastAcceptedResultReward:
      reward === null
        ? null
        : {
            ...reward,
            ratedElo:
              reward.ratedElo === null
                ? null
                : withoutAssistance(reward.ratedElo),
            ...(reward.contribution === undefined
              ? {}
              : { contribution: withoutAssistance(reward.contribution) }),
          },
  }
}

export function withoutMoveReactionPlacement(data: MapachessPlayerData) {
  const previous = withoutAssistanceRatings(data)
  const { moveReactionPlacement: _placement, ...settings } = previous.settings
  return { ...previous, settings }
}

export function withoutFirstArrivalPreferences(data: MapachessPlayerData) {
  const {
    introductionCompleted: _completed,
    settings: { locale: _locale, ...settings },
    ...previous
  } = withoutMoveReactionPlacement(data)
  return {
    ...previous,
    settings,
    ratings: {
      standard: data.ratings["standard-untimed-gold"],
      chess960: data.ratings["chess960-untimed-gold"],
    },
    ratedMatchCounts: {
      standard: data.ratedMatchCounts["standard-untimed-gold"],
      chess960: data.ratedMatchCounts["chess960-untimed-gold"],
    },
  }
}

export const sha256 = async (canonicalValue: string): Promise<string> =>
  createHash("sha256").update(canonicalValue).digest("hex")

export class InMemoryDurableStoreAdapter implements DurableStoreAdapter {
  snapshot: DurableStoreSnapshot

  constructor(snapshot = EMPTY_DURABLE_STORE_SNAPSHOT) {
    this.snapshot = snapshot
  }

  async read(): Promise<DurableStoreSnapshot> {
    return this.snapshot
  }

  async compareAndSwapVerified({
    expected,
    next,
  }: Parameters<DurableStoreAdapter["compareAndSwapVerified"]>[0]) {
    if (!durableStoreSnapshotsEqual(this.snapshot, expected)) {
      return {
        actual: this.snapshot,
        ok: false as const,
        type: "PROFILE.STORAGE_CONFLICT" as const,
      }
    }

    this.snapshot = next
    return { ok: true as const, snapshot: this.snapshot }
  }
}
