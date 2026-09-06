import type { StockfishOpponentId } from "@mapachess/match/stockfish-opponent"

const ANIMAL_OPPONENT_SOURCE_PACKS = Object.freeze({
  "chicken-stockfish": Object.freeze(["Chickenpack"] as const),
  "bunny-stockfish": Object.freeze(["Bunnypack"] as const),
  "dog-stockfish": Object.freeze(["Dogpack", "Lil Doggies"] as const),
  "cat-stockfish": Object.freeze(["Catset", "Kittens"] as const),
  "mouse-stockfish": Object.freeze(["Mousepack"] as const),
  "frog-stockfish": Object.freeze(["Frogpack"] as const),
  "turtle-stockfish": Object.freeze(["Turtlepack"] as const),
  "panda-stockfish": Object.freeze(["Pandapack"] as const),
  "otter-stockfish": Object.freeze(["Lil Otter"] as const),
  "raccoon-stockfish": Object.freeze(["Raccoonpack"] as const),
  "axolotl-stockfish": Object.freeze(["Lil Axolotl"] as const),
  "parrot-stockfish": Object.freeze(["Parrotpack"] as const),
  "hedgehog-stockfish": Object.freeze(["Lil Hedgehog"] as const),
  "deer-stockfish": Object.freeze(["Deerpack"] as const),
  "fox-stockfish": Object.freeze(["Foxpack", "Lil Fox"] as const),
  "wolf-stockfish": Object.freeze(["Wolfpack"] as const),
  "falcon-stockfish": Object.freeze(["Falconpack"] as const),
  "crane-stockfish": Object.freeze(["Cranepack"] as const),
  "crow-stockfish": Object.freeze(["Crowpack"] as const),
  "bat-stockfish": Object.freeze(["Batpack"] as const),
  "ninja-stockfish": Object.freeze(["Lil Ninja"] as const),
  "war-hero-stockfish": Object.freeze(["Lil War Hero"] as const),
  "dragonfly-stockfish": Object.freeze(["Dragonflypack"] as const),
}) satisfies Readonly<
  Record<StockfishOpponentId, readonly [string, ...string[]]>
>

export default ANIMAL_OPPONENT_SOURCE_PACKS
