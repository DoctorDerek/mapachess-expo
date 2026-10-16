import type { MapachessCatalog } from "./catalog.js"

const reactionSlots = {
  idle: "en reposo",
  "capture-attacker": "atacante en una captura",
  "capture-victim": "víctima de una captura",
  "check-attacker": "atacante en un jaque",
  "check-victim": "en jaque",
  victory: "victoria",
  defeat: "derrota",
} as const

const presentation = {
  playerName: "Mapachito",
  coach: (collection: string): string => `Entrenador: ${collection}`,
  fighter: (name: string, slot: keyof typeof reactionSlots): string =>
    `${name}: ${reactionSlots[slot]}`,
  unavailableFighter: (name: string): string =>
    `${name} · Imagen no disponible`,
  ready: (opponent: string): string => `Mapachito y ${opponent} están listos.`,
  capture: (attacker: string, victim: string): string =>
    `${attacker} captura; ${victim} reacciona.`,
  check: (attacker: string, victim: string): string =>
    `${attacker} da jaque; ${victim} reacciona.`,
  victory: (winner: string): string => `${winner} gana la batalla de ajedrez.`,
  resumingMatch: "Reanudando partida guardada…",
  sessionFailure: {
    "open-current-match": "No se pudo abrir tu partida guardada.",
    "restart-match": "No se pudo reiniciar tu partida.",
    "return-to-menu": "Mapachess no pudo volver al menú.",
    start: "No se pudo iniciar tu partida.",
  },
  metadataDescription:
    "Un juego de ajedrez siempre gratis y sin cuenta, con Mejores pistas y oponentes animales de Stockfish.",
} as const satisfies MapachessCatalog["presentation"]

export default presentation
