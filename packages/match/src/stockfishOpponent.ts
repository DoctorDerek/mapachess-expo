const STOCKFISH_OPPONENT_IDENTITIES = [
  { id: "chicken-stockfish", displayName: "Chicken Stockfish" },
  { id: "bunny-stockfish", displayName: "Bunny Stockfish" },
  { id: "dog-stockfish", displayName: "Dog Stockfish" },
  { id: "cat-stockfish", displayName: "Cat Stockfish" },
  { id: "mouse-stockfish", displayName: "Mouse Stockfish" },
  { id: "frog-stockfish", displayName: "Frog Stockfish" },
  { id: "turtle-stockfish", displayName: "Turtle Stockfish" },
  { id: "panda-stockfish", displayName: "Panda Stockfish" },
  { id: "otter-stockfish", displayName: "Otter Stockfish" },
  { id: "raccoon-stockfish", displayName: "Raccoon Stockfish" },
  { id: "axolotl-stockfish", displayName: "Axolotl Stockfish" },
  { id: "parrot-stockfish", displayName: "Parrot Stockfish" },
  { id: "hedgehog-stockfish", displayName: "Hedgehog Stockfish" },
  { id: "deer-stockfish", displayName: "Deer Stockfish" },
  { id: "fox-stockfish", displayName: "Fox Stockfish" },
  { id: "wolf-stockfish", displayName: "Wolf Stockfish" },
  { id: "falcon-stockfish", displayName: "Falcon Stockfish" },
  { id: "crane-stockfish", displayName: "Crane Stockfish" },
  { id: "crow-stockfish", displayName: "Crow Stockfish" },
  { id: "bat-stockfish", displayName: "Bat Stockfish" },
  { id: "ninja-stockfish", displayName: "Ninja Stockfish" },
  { id: "war-hero-stockfish", displayName: "War Hero Stockfish" },
  { id: "dragonfly-stockfish", displayName: "Dragonfly Stockfish" },
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
