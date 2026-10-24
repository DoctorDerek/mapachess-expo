import type { MapachessCatalog } from "./catalog.js"
import { formatUngroupedInteger } from "./esMxNumbers.js"

const profile = {
  settingsTitle: "Personaliza tu juego",
  moveReactionPlacement: {
    label: "Posición de los avisos de jugada",
    description:
      "Junto al tablero en pantallas anchas; sobre él en pantallas estrechas.",
    options: { top: "Arriba", middle: "Centro", bottom: "Abajo" },
  },
  ratedMatches: (count: number): string => {
    const matchCountNoun =
      count === 1
        ? "partida"
        : count > 0 && count % 1_000_000 === 0
          ? "de partidas"
          : "partidas"
    return `${formatUngroupedInteger(count)} ${matchCountNoun} con puntuación`
  },
  rating: (variant: string, elo: number): string =>
    `${variant} · ${formatUngroupedInteger(elo)} Elo`,
  ratingLabel: {
    standard: "Elo de ajedrez estándar",
    chess960: "Elo de ajedrez 960",
  },
  resetRating: (variant: string): string => `Restablecer Elo de ${variant}`,
  resetQuestion: (variant: string): string => `¿Restablecer Elo de ${variant}?`,
  resetExplanation: (variant: string): string =>
    `El Elo de ${variant} vuelve a 100 y su conteo de partidas con puntuación vuelve a cero. Las demás puntuaciones, el progreso de Historia, las medallas, los registros de Desafío, la configuración y la partida activa no cambian. Deshacer y rehacer no restaurarán el cambio que una partida terminada hizo en esta puntuación. Exporta tus datos primero si quieres un respaldo.`,
  resetConfirmation: (variant: string): string =>
    `Restablecer Elo de ${variant} a 100`,
  preparingBackup: "Preparando respaldo…",
  none: "Ninguna",
  included: "Incluida",
  fileTooLarge:
    "Ese archivo supera el tamaño que Mapachess puede revisar de forma segura. Tus datos guardados no cambiaron.",
  fileUnreadable:
    "No se pudo leer ese archivo. Tus datos guardados no cambiaron. Elige el archivo de nuevo o selecciona otro respaldo.",
  importIssue: {
    integrity:
      "El respaldo no pasó la verificación de integridad. Tus datos guardados no cambiaron.",
    size: "El respaldo seleccionado supera el tamaño que Mapachess puede revisar de forma segura. Tus datos guardados no cambiaron.",
    version:
      "Este respaldo usa un formato de datos de Mapachess más reciente que esta versión no puede leer. Tus datos guardados no cambiaron.",
    read: "No se pudo leer el respaldo seleccionado. Tus datos guardados no cambiaron.",
    invalid:
      "El archivo seleccionado no es un respaldo válido de Mapachess. Tus datos guardados no cambiaron.",
  },
  persistenceFailure: {
    conflict:
      "Otra pestaña de Mapachess cambió primero los datos locales. Tu cambio pendiente sigue aquí y no los ha sobrescrito.",
    verification:
      "Mapachess no pudo verificar la copia guardada. Tu cambio pendiente sigue aquí.",
    request:
      "El almacenamiento no terminó de guardar. Tu cambio sin guardar sigue aquí.",
    unsafe:
      "Mapachess no pudo guardar este cambio de forma segura. Tu cambio pendiente sigue aquí.",
  },
  inspectingBackup:
    "Revisando el respaldo seleccionado. No se ha reemplazado nada.",
  savingData: "Guardando y verificando tus datos locales…",
  artworkPreview: (pieces: string, board: string): string =>
    `Vista previa de las piezas ${pieces} en el tablero ${board}`,
  cardPreview: (format: string): string =>
    `Vista previa de la tarjeta de perfil en ${format}`,
  cardDescription: (
    level: number,
    standard: number,
    chess960: number,
    context: string,
  ): string =>
    `Tu tarjeta de perfil: nivel ${formatUngroupedInteger(level)}, ${context}, Elo de ajedrez estándar ${formatUngroupedInteger(standard)}, Elo de ajedrez 960 ${formatUngroupedInteger(chess960)}`,
  cardRatings: "Puntuaciones de la tarjeta de perfil",
  cardTimeCategory: "Categoría de tiempo",
  cardAssistance: "Nivel de ayuda",
  cardRatingContext: (category: string, assistance: string): string =>
    `${category} · ${assistance}`,
  level: "Nivel",
  playFree: "Juega gratis en Mapachess.com",
  cardFormats: { GIF: "GIF · Animado", PNG: "PNG · Imagen fija" },
  saveToShare:
    "Guarda el archivo para compartirlo con la aplicación que prefieras.",
  animalCompanion: "Animal acompañante",
  saveFormat: (format: string): string => `Guardar ${format}`,
  shareFormat: (format: string): string => `Compartir ${format}`,
  retryFormat: (format: string): string => `Reintentar ${format}`,
  preparingFormat: (format: string): string => `Preparando ${format}…`,
  shared: "Compartido.",
  shareFailed: "No se pudo compartir. Puedes reintentar o guardar el archivo.",
  downloadRequested: (format: string): string =>
    `Descarga de ${format} solicitada.`,
  downloadFailed:
    "No se pudo iniciar la descarga. Tu tarjeta sigue lista; intenta guardarla de nuevo.",
  customization: {
    coach: {
      label: "Entrenador",
      change: "Cambiar entrenador",
      done: "Terminar de elegir entrenador",
    },
    pieces: {
      label: "Piezas",
      change: "Cambiar piezas",
      done: "Terminar de elegir piezas",
    },
    board: {
      label: "Tablero",
      change: "Cambiar tablero",
      done: "Terminar de elegir tablero",
    },
  },
  coachCollections: { mapachito: "Mapachito", greyfox: "Caras de animales" },
  dressing: {
    categories: {
      Clothes: "Ropa",
      Weapons: "Armas",
      Hair: "Cabello",
      Skin: "Piel",
      Face: "Rostro",
      Animal: "Animal",
    },
    choices: (category: string): string => `Opciones de ${category}`,
    selection: (category: string): string => `Selección de ${category}`,
    saving: "Guardando cambios…",
    unsaved: "Cambios sin guardar",
    saved: "Cambios guardados",
    weapons: {
      none: "Ninguna",
      weapon1: "Espada",
      weapon2: "Lanza",
      weapon3: "Varita",
      weapon4: "Hacha",
      weapon5: "Daga",
    },
    weaponColor: (weapon: string, color: number): string =>
      `${weapon}, color ${color}`,
    clothingColor: (color: number): string => `Color de ropa ${color}`,
    outfit: (id: string): string => `Atuendo ${id}`,
    hairColor: (color: number): string => `Color de cabello ${color}`,
    hairstyle: (id: string): string => `Peinado ${id}`,
    skin: (id: number): string => `Piel ${id}`,
    face: (id: number): string => `Rostro ${id}`,
  },
} as const satisfies MapachessCatalog["profile"]

export default profile
