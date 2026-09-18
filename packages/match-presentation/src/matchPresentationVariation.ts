import type {
  MatchParticipantReaction,
  MatchPresentationPhase,
} from "./matchReaction.js"
import {
  matchSpriteReactionSlot,
  type MatchSpriteReactionSlot,
} from "./presentationAssetManifest.js"

type BattleRole = Exclude<MatchSpriteReactionSlot, "idle">
type RoleEntries = Readonly<Record<BattleRole, number>>

export type MatchPresentationVariation = Readonly<{
  player: RoleEntries
  opponent: RoleEntries
}>

const INITIAL_ROLE_ENTRIES: RoleEntries = Object.freeze({
  "capture-attacker": 0,
  "capture-victim": 0,
  "check-attacker": 0,
  "check-victim": 0,
  victory: 0,
  defeat: 0,
})

export const INITIAL_MATCH_PRESENTATION_VARIATION: MatchPresentationVariation =
  Object.freeze({
    player: INITIAL_ROLE_ENTRIES,
    opponent: INITIAL_ROLE_ENTRIES,
  })

const enterRole = (
  entries: RoleEntries,
  reaction: MatchParticipantReaction,
): RoleEntries => {
  const role = matchSpriteReactionSlot(reaction)
  return role === "idle"
    ? entries
    : Object.freeze({ ...entries, [role]: entries[role] + 1 })
}

export default function advanceMatchPresentationVariation(
  variation: MatchPresentationVariation,
  phase: MatchPresentationPhase,
): MatchPresentationVariation {
  return Object.freeze({
    player: enterRole(variation.player, phase.player),
    opponent: enterRole(variation.opponent, phase.opponent),
  })
}

export const matchPresentationVariationOrdinal = (
  entries: RoleEntries,
  reaction: MatchParticipantReaction,
): number => {
  const role = matchSpriteReactionSlot(reaction)
  return role === "idle" ? 0 : entries[role] - 1
}
