const reactionSlots = {
  idle: "idle",
  "capture-attacker": "capture attacker",
  "capture-victim": "capture victim",
  "check-attacker": "check attacker",
  "check-victim": "check victim",
  victory: "victory",
  defeat: "defeat",
} as const

const presentation = {
  playerName: "Mapachito",
  coach: (collection: string): string => `${collection} coach`,
  fighter: (name: string, slot: keyof typeof reactionSlots): string =>
    `${name}: ${reactionSlots[slot]}`,
  unavailableFighter: (name: string): string => `${name} · Artwork unavailable`,
  ready: (opponent: string): string => `Mapachito and ${opponent} are ready.`,
  capture: (attacker: string, victim: string): string =>
    `${attacker} captures; ${victim} reacts.`,
  check: (attacker: string, victim: string): string =>
    `${attacker} gives check; ${victim} reacts.`,
  victory: (winner: string): string => `${winner} wins the chess battle.`,
  resumingMatch: "Resuming saved match…",
  sessionFailure: {
    "open-current-match": "Your saved match could not open.",
    "restart-match": "Your match could not restart.",
    "return-to-menu": "Mapachess could not return to the menu.",
    start: "Your match could not start.",
  },
  metadataDescription:
    "A permanently free, accountless chess game with Better Hints and animal Stockfish opponents.",
} as const

export default presentation
