import type { MapachessCatalog } from "./catalog.js"

const credits = {
  mapachitoIdentity: {
    contribution: "Animación original de bienvenida e imagen fija",
  },
  kenney: {
    contribution: "Iconos de los botones y las direcciones del control",
    modifications:
      "Selección de iconos de 64 píxeles de Input Prompts 1.5A, sin modificaciones.",
  },
  seethingswarm: {
    contribution: "Animales de batalla y acompañantes de la tarjeta de perfil",
  },
  captainskolot: {
    contribution: "Reacciones del entrenador Mapachito",
    modifications: "Retratos extraídos del atlas proporcionado.",
  },
  greyfox: {
    contribution: "Reacciones opcionales del entrenador con caras de animales",
    modifications:
      "Caras sin modificar, asignadas a las etiquetas de reacción de Mapachess.",
  },
  heroes99: {
    contribution:
      "Personajes, ropa y armas por capas para las tarjetas de perfil",
    modifications:
      "Fotogramas de reposo extraídos para composiciones del juego por capas.",
  },
  chessnut: { contribution: "Piezas de ajedrez vectoriales" },
  skoll: {
    contribution: "Piezas de ajedrez vectoriales",
    modifications:
      "Contornos contrastantes añadidos a las siluetas originales.",
  },
  "toffee-classical": {
    contribution: "Piezas y tableros de ajedrez en pixel art",
    modifications:
      "Áreas jugables de los tableros y piezas individuales extraídas.",
  },
  "toffee-wood": {
    contribution: "Piezas y tablero de ajedrez en pixel art",
    modifications: "Área jugable del tablero y piezas individuales extraídas.",
  },
  "toffee-ice": {
    contribution: "Piezas y tablero de ajedrez en pixel art",
    modifications: "Área jugable del tablero y piezas individuales extraídas.",
  },
  backterria: {
    contribution: "Piezas y tableros de ajedrez convencionales y Fantasy",
    modifications:
      "Áreas jugables de los tableros y celdas de sprites del autor extraídas.",
  },
  cosunosuke: {
    contribution:
      "Piezas de ajedrez doradas y azules en pixel art y tablero de pizarra",
    modifications:
      "Celdas de piezas individuales extraídas; colores originales y tablero sin marco conservados.",
  },
  "cat-chess": {
    contribution: "Piezas y tablero de ajedrez con temática de gatos",
    modifications:
      "Márgenes transparentes recortados; escala compartida de las piezas conservada. Tablero recortado y girado.",
  },
} as const satisfies MapachessCatalog["credits"]

export default credits
