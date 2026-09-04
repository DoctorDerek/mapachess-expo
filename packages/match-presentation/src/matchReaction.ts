export const MATCH_PRESENTATION_PARTICIPANTS = ["player", "opponent"] as const

export type MatchPresentationParticipant =
  (typeof MATCH_PRESENTATION_PARTICIPANTS)[number]

export type MatchParticipantReaction =
  | Readonly<{ family: "idle" }>
  | Readonly<{
      family: "capture" | "check"
      role: "attacker" | "victim"
    }>
  | Readonly<{ family: "victory" | "defeat" }>

export type MatchPresentationPhase = Readonly<{
  kind: "capture" | "check" | "conclusion"
  opponent: MatchParticipantReaction
  player: MatchParticipantReaction
}>
