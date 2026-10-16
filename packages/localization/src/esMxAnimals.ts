import type { MapachessCatalog } from "./catalog.js"

const names = {
  "chicken-stockfish": "Pollo",
  "bunny-stockfish": "Conejito",
  "dog-stockfish": "Perro",
  "cat-stockfish": "Gato",
  "mouse-stockfish": "Ratón",
  "frog-stockfish": "Rana",
  "turtle-stockfish": "Tortuga",
  "panda-stockfish": "Panda",
  "otter-stockfish": "Nutria",
  "raccoon-stockfish": "Mapache",
  "axolotl-stockfish": "Ajolote",
  "parrot-stockfish": "Loro",
  "hedgehog-stockfish": "Erizo",
  "deer-stockfish": "Venado",
  "fox-stockfish": "Zorro",
  "wolf-stockfish": "Lobo",
  "falcon-stockfish": "Halcón",
  "crane-stockfish": "Grulla",
  "crow-stockfish": "Cuervo",
  "bat-stockfish": "Murciélago",
  "ninja-stockfish": "Ninja",
  "war-hero-stockfish": "Héroe de guerra",
  "dragonfly-stockfish": "Libélula",
} as const

const animals = {
  names,
  opponent: (id: keyof typeof names): string => `${names[id]} Stockfish`,
} as const satisfies MapachessCatalog["animals"]

export default animals
