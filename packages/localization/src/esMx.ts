import type { IntroductionCopy, MapachessCatalog } from "./catalog.js"
import animals from "./esMxAnimals.js"
import artwork from "./esMxArtwork.js"
import board from "./esMxBoard.js"
import classification from "./esMxClassification.js"
import controls from "./esMxControls.js"
import credits from "./esMxCredits.js"
import evaluation from "./esMxEvaluation.js"
import gameplay from "./esMxGameplay.js"
import interfaceCopy from "./esMxInterface.js"
import presentation from "./esMxPresentation.js"
import profile from "./esMxProfile.js"
import setup from "./esMxSetup.js"
import shared from "./esMxShared.js"

const introduction = Object.freeze({
  title: "Mapachess",
  region: "Introducción",
  heading: "Ajedrez gratis con Mejores pistas para ambos bandos.",
  paragraphs: Object.freeze([
    {
      lead: "",
      body: "Juega ajedrez estándar o ajedrez 960 contra los animales de Stockfish. Avanza por los 23 oponentes de Historia o elige tu propio Desafío.",
    },
    {
      lead: "Descubre las posibilidades.",
      body: "Las Pistas de piezas resaltan tres piezas de cada bando. Después, las Pistas de movimientos muestran tres movimientos para esas piezas de cada bando. Tú decides cuándo quieres ayuda.",
    },
    {
      lead: "Prueba otra idea.",
      body: "Deshaz una jugada, explora otra variante y sigue aprendiendo. Tu entrenador y las batallas de animales reaccionan conforme avanza la partida.",
    },
    {
      lead: "Dale tu estilo.",
      body: "Elige el animal con el que juegas, tu entrenador, las piezas y el tablero. Después puedes cambiar estas opciones en Personaliza tu juego.",
    },
    {
      lead: "",
      body: "Gratis. Sin cuenta. Tu progreso se queda en este dispositivo. Exporta un respaldo desde Configuración cuando quieras una copia que puedas llevar contigo.",
    },
  ]),
  language: "Idioma",
  start: "Comenzar",
  starting: "Comenzando…",
  credit: "Un juego de Mapachito",
  author: "por Dr. Derek Austin",
  website: "DoctorDerek.com",
  websiteNewTab: " (se abre en una pestaña nueva)",
}) satisfies IntroductionCopy

const mexicanSpanish = Object.freeze({
  introduction,
  setup,
  interface: interfaceCopy,
  profile,
  shared,
  controls,
  gameplay,
  animals,
  board,
  artwork,
  evaluation,
  classification,
  credits,
  presentation,
}) satisfies MapachessCatalog

export default mexicanSpanish
