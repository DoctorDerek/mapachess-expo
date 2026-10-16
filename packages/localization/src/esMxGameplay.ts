import type { MapachessCatalog } from "./catalog.js"
import {
  formatInteger,
  formatStoryPercentage,
  formatUngroupedInteger,
} from "./esMxNumbers.js"

const gameplay = {
  integer: formatInteger,
  elo: formatUngroupedInteger,
  storyCompletion: formatStoryPercentage,
  defeatedCount: (count: number, total: number): string =>
    `Oponentes derrotados: ${formatInteger(count)} / ${formatInteger(total)}`,
  nextUnlocked: (opponent: string): string =>
    `Siguiente oponente desbloqueado: ${opponent}`,
  lockedOpponent: (position: number): string =>
    `Oponente bloqueado ${formatInteger(position)}`,
  targetElo: (elo: number): string =>
    `Elo objetivo: ${formatUngroupedInteger(elo)}`,
  defeatedMedal: (medal: string): string => `Derrotado · ${medal}`,
  challengeList: (opponents: readonly string[]): string =>
    `${opponents.length === 1 ? "Desbloqueado" : "Desbloqueados"} para ambos modos Desafío: ${opponents.join(", ")}`,
  conclusion: {
    playerWon: "¡Ganaste!",
    opponentWon: (opponent: string): string => `${opponent} ganó.`,
    opponentResigned: (opponent: string): string =>
      `${opponent} se rindió — ganaste.`,
    playerResigned: (opponent: string): string =>
      `Te rendiste — ${opponent} ganó.`,
    "draw-agreement": "Tablas por acuerdo.",
    stalemate: "Tablas por ahogado.",
    "insufficient-material": "Tablas por material insuficiente.",
  },
  defeatedOpponent: (opponent: string): string => `¡Derrotaste a ${opponent}!`,
  resultActions: {
    replay: "Volver a jugar contra este oponente",
    ladder: "Progresión de Historia",
    next: "Siguiente oponente",
  },
  opponentAndElo: (opponent: string, elo: number): string =>
    `${opponent} · ${formatUngroupedInteger(elo)} Elo`,
  awardedXp: (amount: number): string => `+${formatInteger(amount)} XP`,
  level: (level: number): string => `Nivel ${formatInteger(level)}`,
  xpProgress: (current: number, required: number): string =>
    `${formatInteger(current)} / ${formatInteger(required)} XP`,
  levelProgress: (level: number, current: number, required: number): string =>
    `Nivel ${formatInteger(level)}. ${formatInteger(current)} de ${formatInteger(required)} XP para el siguiente nivel.`,
  levelAchievement: (level: number): string =>
    `Alcanza el nivel ${formatInteger(level)}`,
  achievementUnlocked: (title: string): string =>
    `Logro desbloqueado · ${title}`,
  noNewMedal: "Sin medalla nueva",
  bestMedal: (medal: string): string => `Tu mejor medalla: ${medal}.`,
  challengeUnlocked: (opponent: string): string =>
    `${opponent} está disponible en ambos modos Desafío.`,
  storyDefeated: (count: number): string =>
    `Derrotaste a los ${formatInteger(count)} oponentes de esta Historia.`,
  opponentMoveInvalid: (opponent: string): string =>
    `${opponent} generó un movimiento no válido. Reintenta o usa Deshacer.`,
  opponentTurnFailed: (opponent: string): string =>
    `${opponent} no pudo terminar su turno. Reintenta o usa Deshacer.`,
  retryTurn: (opponent: string): string => `Reintentar el turno de ${opponent}`,
  drawDeclined: (opponent: string): string => `${opponent} rechaza las tablas.`,
  hints: {
    controls: {
      failure: "Reintentar Pistas de piezas",
      hidden: "Pistas disponibles en tu turno",
      loading: "Buscando Pistas de piezas…",
      "move-hints": "Pistas de movimientos visibles",
      "piece-hints": "Mostrar Pistas de movimientos",
      ready: "Mostrar Pistas de piezas",
      unavailable: "Pistas no disponibles",
      complete: "Pistas no disponibles después de la partida",
    },
    guidance: {
      failure:
        "No se pudieron calcular las Pistas de piezas. Tu posición no cambió.",
      hidden: "Las Pistas de piezas vuelven cuando es tu turno.",
      loading:
        "Buscando Pistas de piezas para ambos bandos sin cambiar el tablero.",
      "move-hints":
        "Las flechas verdes continuas muestran movimientos del jugador. Las flechas rojas discontinuas muestran movimientos del oponente.",
      "piece-hints":
        "Los bordes verdes continuos marcan piezas del jugador. Los bordes rojos discontinuos marcan piezas del oponente.",
      ready:
        "Comienza por encontrar las piezas más importantes del jugador y del oponente.",
      unavailable:
        "Las Mejores pistas no están disponibles en esta versión de Mapachess.",
      complete:
        "Las Mejores pistas solo están disponibles mientras la partida está en curso.",
    },
    loading: "Buscando Pistas de piezas para el jugador y el oponente.",
    failed:
      "No se pudieron calcular las Pistas de piezas. El tablero no cambió.",
    piecesShown: (
      player: readonly string[],
      opponent: readonly string[],
    ): string =>
      `Pistas de piezas visibles. Pistas de piezas del jugador: ${player.length === 0 ? "ninguna" : player.join(", ")}. Pistas de piezas del oponente: ${opponent.length === 0 ? "ninguna" : opponent.join(", ")}.`,
    movesShown: (
      player: readonly string[],
      opponent: readonly string[],
    ): string =>
      `Pistas de movimientos visibles. Pistas de movimientos del jugador: ${player.length === 0 ? "ninguna" : player.join("; ")}. Pistas de movimientos del oponente: ${opponent.length === 0 ? "ninguna" : opponent.join("; ")}.`,
    move: (from: string, to: string): string => `${from} a ${to}`,
    castle: (
      side: "king" | "queen",
      to: string,
      rookFrom: string,
      rookTo: string,
    ): string =>
      `enroque ${side === "king" ? "corto" : "largo"}, rey a ${to}, torre de ${rookFrom} a ${rookTo}`,
  },
} as const satisfies MapachessCatalog["gameplay"]

export default gameplay
