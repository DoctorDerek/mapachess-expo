import { IMPLEMENTED_DURABLE_OPPONENT_IDS } from "@mapachess/match/durable-match-record"
import {
  failData,
  requireBoolean,
  requireEnumValue,
  requireExactKeys,
  requireObject,
  requireSafeRevision,
  requireString,
} from "./decodePrimitives.js"
import { decodeConclusion, decodeMoveIds } from "./durableMatchCodec.js"
import {
  PLAYER_ELO_RATING_IDS,
  type AcceptedMatchReward,
} from "./playerData.js"

export default function decodeResultContribution(
  received: unknown,
  path: string,
): NonNullable<AcceptedMatchReward["contribution"]> {
  const object = requireObject(received, path)
  requireExactKeys(
    object,
    [
      "applied",
      "ending",
      "variant",
      "opponentId",
      "challengeOutcome",
      "ratedMatchCountBefore",
      "eloState",
    ],
    path,
  )
  const ending = requireObject(object.ending, `${path}.ending`)
  requireExactKeys(
    ending,
    ["conclusion", "cursor", "currentFen", "moveIds"],
    `${path}.ending`,
  )
  const conclusion = decodeConclusion(
    ending.conclusion,
    `${path}.ending.conclusion`,
  )
  if (conclusion === null) return failData(`${path}.ending.conclusion`)
  const cursor = requireSafeRevision(ending.cursor, `${path}.ending.cursor`)
  const moveIds = decodeMoveIds(ending.moveIds, `${path}.ending.moveIds`)
  if (cursor !== moveIds.length) return failData(`${path}.ending.cursor`)
  return Object.freeze({
    applied: requireBoolean(object.applied, `${path}.applied`),
    ending: Object.freeze({
      conclusion,
      cursor,
      moveIds,
      currentFen: requireString(
        ending.currentFen,
        `${path}.ending.currentFen`,
        256,
      ),
    }),
    variant: requireEnumValue(
      object.variant,
      PLAYER_ELO_RATING_IDS,
      `${path}.variant`,
    ),
    opponentId: requireEnumValue(
      object.opponentId,
      IMPLEMENTED_DURABLE_OPPONENT_IDS,
      `${path}.opponentId`,
    ),
    challengeOutcome:
      object.challengeOutcome === null
        ? null
        : requireEnumValue(
            object.challengeOutcome,
            ["win", "loss"] as const,
            `${path}.challengeOutcome`,
          ),
    ratedMatchCountBefore:
      object.ratedMatchCountBefore === null
        ? null
        : requireSafeRevision(
            object.ratedMatchCountBefore,
            `${path}.ratedMatchCountBefore`,
          ),
    eloState: requireEnumValue(
      object.eloState,
      ["active", "superseded", "rebase"] as const,
      `${path}.eloState`,
    ),
  })
}
