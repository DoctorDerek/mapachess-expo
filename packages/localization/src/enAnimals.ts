const names = {
  "chicken-stockfish": "Chicken",
  "bunny-stockfish": "Bunny",
  "dog-stockfish": "Dog",
  "cat-stockfish": "Cat",
  "mouse-stockfish": "Mouse",
  "frog-stockfish": "Frog",
  "turtle-stockfish": "Turtle",
  "panda-stockfish": "Panda",
  "otter-stockfish": "Otter",
  "raccoon-stockfish": "Raccoon",
  "axolotl-stockfish": "Axolotl",
  "parrot-stockfish": "Parrot",
  "hedgehog-stockfish": "Hedgehog",
  "deer-stockfish": "Deer",
  "fox-stockfish": "Fox",
  "wolf-stockfish": "Wolf",
  "falcon-stockfish": "Falcon",
  "crane-stockfish": "Crane",
  "crow-stockfish": "Crow",
  "bat-stockfish": "Bat",
  "ninja-stockfish": "Ninja",
  "war-hero-stockfish": "War Hero",
  "dragonfly-stockfish": "Dragonfly",
} as const

const animals = {
  names,
  opponent: (id: keyof typeof names): string => `${names[id]} Stockfish`,
} as const

export default animals
