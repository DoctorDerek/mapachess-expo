import type { MapachessCatalog } from "./catalog.js"

const setup = {
  menuTitle: "Elige tu juego",
  menuDescription:
    "Juega a tu manera. Las Mejores pistas siempre están a tu alcance.",
  allModes: "Todos los modos de juego",
  opponent: "Oponente",
  color: "Juega con",
  white: "Blancas",
  black: "Negras",
  random: "Al azar",
  randomize: "Elegir al azar",
  pinnedPosition:
    "Esta posición se conserva hasta que selecciones Elegir al azar.",
  freshPosition:
    "Cada nueva configuración recibe un número de posición al azar. Iniciar partida usa el número que se muestra.",
  randomColor: "Tu bando se elige al azar cuando comienza la partida.",
  position: "Posición inicial de Chess960",
  positionNumber: (maximum: number): string =>
    `Número de posición (0–${maximum})`,
  invalidSetup:
    "Elige un animal disponible, una dificultad, un bando y una posición inicial válida.",
  difficulty: "Dificultad · Elo estimado",
  difficultyLabel: "Dificultad",
  estimated: "Elo estimado",
  unavailableSelection:
    "Esta selección no está disponible. Elige un animal desbloqueado y una dificultad compatible.",
  untimed: "Sin reloj",
  webCalibrationDifficulty:
    "Estas estimaciones de dificultad están calibradas contra un grupo controlado de motores, no son puntuaciones humanas certificadas.",
  storyAvailability:
    "Derrota a cada oponente para desbloquear al siguiente en esta progresión de Historia. Vuelve a jugar las partidas que ganaste para mejorar tu medalla.",
  challengeAvailability:
    "Elige cualquier animal que hayas derrotado en cualquiera de las dos progresiones de Historia. Pollo siempre está disponible. La apariencia del animal no cambia la dificultad.",
  startMatch: "Iniciar partida",
  openingMatch: "Abriendo partida…",
  restartingMatch: "Reiniciando partida…",
  returningToMenu: "Volviendo al menú…",
  change: "Cambiar",
  done: "Listo",
  accept: "Aceptar",
  cancel: "Cancelar",
  customizeProfile: "Personalizar tarjeta de perfil",
  shareProfile: "Compartir tarjeta de perfil",
  chooseAnimal: "Elegir animal",
  chooseOpponent: "Elegir oponente",
  chooseDifficulty: "Elegir dificultad",
  changeAnimal: "Cambiar animal",
  changeStoryOpponent: "Cambiar oponente de Historia",
  changeDifficulty: "Cambiar dificultad",
  changeHints: "Cambiar pistas",
  playAsAction: (animal: string): string =>
    `Juega como ${animal} · Cambiar animal`,
  elo: (value: string): string => `${value} Elo`,
  bestMedal: (medal: string): string => ` · Mejor medalla: ${medal}`,
  lastPlayed: (opponent: string): string => ` · Último oponente: ${opponent}`,
  difficultyMedals:
    "Mejor medalla en esta dificultad: Oro — sin pistas; Plata — solo Pistas de piezas; Bronce — se permiten Pistas de movimientos. El animal es tu último oponente, no tu próxima selección.",
  variants: { standard: "Ajedrez estándar", chess960: "Chess960" },
  modes: { story: "Historia", challenge: "Desafío" },
  presentations: {
    standard: {
      story: {
        title: "Historia de ajedrez estándar",
        description: "La posición inicial clásica. Tu bando se elige al azar.",
      },
      challenge: {
        title: "Desafío de ajedrez estándar",
        description:
          "La posición inicial clásica. Elige blancas, negras o al azar.",
      },
    },
    chess960: {
      story: {
        title: "Historia de Chess960",
        description: "Una nueva posición inicial y un bando elegido al azar.",
      },
      challenge: {
        title: "Desafío de Chess960",
        description:
          "Elige tu bando y una posición inicial al azar o por número.",
      },
    },
  },
  betterHints: "Mejores pistas",
  autoHints: {
    "auto-move-hints": {
      label: "Pistas de movimientos automáticas",
      description:
        "Muestra automáticamente tres Pistas de piezas y sus Pistas de movimientos para cada bando.",
      medal: "Bronce si ganas después de usar Pistas de movimientos.",
    },
    "auto-piece-hints": {
      label: "Pistas de piezas automáticas",
      description:
        "Muestra automáticamente tres Pistas de piezas para cada bando. Solicita sus Pistas de movimientos en tu turno.",
      medal:
        "Plata si ganas con Pistas de piezas, pero sin Pistas de movimientos.",
    },
    "no-auto-hints": {
      label: "Sin pistas automáticas",
      description:
        "En tu turno, solicita tres Pistas de piezas para cada bando y después sus Pistas de movimientos.",
      medal: "Oro si ganas sin usar ninguna pista.",
    },
  },
  hintMedalExplanation:
    "Las medallas reflejan las pistas que se mostraron durante la partida. Cambiar esta opción nunca borra las pistas usadas anteriormente.",
} as const satisfies MapachessCatalog["setup"]

export default setup
