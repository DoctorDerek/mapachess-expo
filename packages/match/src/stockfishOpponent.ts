import loadCatalog from "@mapachess/localization/catalog"

const STOCKFISH_OPPONENT_IDENTITIES = [
  {
    id: "chicken-stockfish",
    displayName: loadCatalog("en").animals.opponent("chicken-stockfish"),
  },
  {
    id: "bunny-stockfish",
    displayName: loadCatalog("en").animals.opponent("bunny-stockfish"),
  },
  {
    id: "dog-stockfish",
    displayName: loadCatalog("en").animals.opponent("dog-stockfish"),
  },
  {
    id: "cat-stockfish",
    displayName: loadCatalog("en").animals.opponent("cat-stockfish"),
  },
  {
    id: "mouse-stockfish",
    displayName: loadCatalog("en").animals.opponent("mouse-stockfish"),
  },
  {
    id: "frog-stockfish",
    displayName: loadCatalog("en").animals.opponent("frog-stockfish"),
  },
  {
    id: "turtle-stockfish",
    displayName: loadCatalog("en").animals.opponent("turtle-stockfish"),
  },
  {
    id: "panda-stockfish",
    displayName: loadCatalog("en").animals.opponent("panda-stockfish"),
  },
  {
    id: "otter-stockfish",
    displayName: loadCatalog("en").animals.opponent("otter-stockfish"),
  },
  {
    id: "raccoon-stockfish",
    displayName: loadCatalog("en").animals.opponent("raccoon-stockfish"),
  },
  {
    id: "axolotl-stockfish",
    displayName: loadCatalog("en").animals.opponent("axolotl-stockfish"),
  },
  {
    id: "parrot-stockfish",
    displayName: loadCatalog("en").animals.opponent("parrot-stockfish"),
  },
  {
    id: "hedgehog-stockfish",
    displayName: loadCatalog("en").animals.opponent("hedgehog-stockfish"),
  },
  {
    id: "deer-stockfish",
    displayName: loadCatalog("en").animals.opponent("deer-stockfish"),
  },
  {
    id: "fox-stockfish",
    displayName: loadCatalog("en").animals.opponent("fox-stockfish"),
  },
  {
    id: "wolf-stockfish",
    displayName: loadCatalog("en").animals.opponent("wolf-stockfish"),
  },
  {
    id: "falcon-stockfish",
    displayName: loadCatalog("en").animals.opponent("falcon-stockfish"),
  },
  {
    id: "crane-stockfish",
    displayName: loadCatalog("en").animals.opponent("crane-stockfish"),
  },
  {
    id: "crow-stockfish",
    displayName: loadCatalog("en").animals.opponent("crow-stockfish"),
  },
  {
    id: "bat-stockfish",
    displayName: loadCatalog("en").animals.opponent("bat-stockfish"),
  },
  {
    id: "ninja-stockfish",
    displayName: loadCatalog("en").animals.opponent("ninja-stockfish"),
  },
  {
    id: "war-hero-stockfish",
    displayName: loadCatalog("en").animals.opponent("war-hero-stockfish"),
  },
  {
    id: "dragonfly-stockfish",
    displayName: loadCatalog("en").animals.opponent("dragonfly-stockfish"),
  },
] as const

const STORY_OPPONENT_TARGET_ELO_STEP = 100

export type StockfishOpponentId =
  (typeof STOCKFISH_OPPONENT_IDENTITIES)[number]["id"]

export type StockfishOpponentDefinition =
  (typeof STOCKFISH_OPPONENT_IDENTITIES)[number] &
    Readonly<{
      storyPosition: number
      storyTargetElo: number
    }>

export const STOCKFISH_OPPONENTS: readonly StockfishOpponentDefinition[] =
  Object.freeze(
    STOCKFISH_OPPONENT_IDENTITIES.map((opponent, index) =>
      Object.freeze({
        ...opponent,
        storyPosition: index + 1,
        storyTargetElo: (index + 1) * STORY_OPPONENT_TARGET_ELO_STEP,
      }),
    ),
  )

export default function stockfishOpponent(
  opponentId: StockfishOpponentId,
): StockfishOpponentDefinition {
  const opponent = STOCKFISH_OPPONENTS.find(({ id }) => id === opponentId)
  if (opponent === undefined) {
    throw new TypeError(`Unknown Stockfish opponent identity: ${opponentId}`)
  }
  return opponent
}
