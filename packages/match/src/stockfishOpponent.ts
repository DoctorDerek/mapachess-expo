import loadCatalog from "@mapachess/localization/catalog"

// The original target is part of a saved policy's identity.
const STORY_ROSTER = [
  ["chicken-stockfish", 100, 100],
  ["bunny-stockfish", 175, 200],
  ["dog-stockfish", 250, 300],
  ["cat-stockfish", 350, 400],
  ["mouse-stockfish", 425, 500],
  ["squirrel-stockfish", 500, null],
  ["frog-stockfish", 575, 600],
  ["turtle-stockfish", 650, 700],
  ["panda-stockfish", 725, 800],
  ["otter-stockfish", 825, 900],
  ["raccoon-stockfish", 900, 1000],
  ["axolotl-stockfish", 975, 1100],
  ["parrot-stockfish", 1050, 1200],
  ["hedgehog-stockfish", 1125, 1300],
  ["deer-stockfish", 1200, 1400],
  ["fox-stockfish", 1300, 1500],
  ["wolf-stockfish", 1375, 1600],
  ["tiger-stockfish", 1450, null],
  ["falcon-stockfish", 1525, 1700],
  ["crane-stockfish", 1600, 1800],
  ["crow-stockfish", 1675, 1900],
  ["bat-stockfish", 1775, 2000],
  ["ninja-stockfish", 1850, 2100],
  ["war-hero-stockfish", 1925, 2200],
  ["dragonfly-stockfish", 2000, 2300],
] as const

export type StockfishOpponentId = (typeof STORY_ROSTER)[number][0]

export type StockfishOpponentDefinition = Readonly<{
  id: StockfishOpponentId
  displayName: string
  storyPosition: number
  storyTargetElo: number
  originalStoryTargetElo: number | null
}>

export const STOCKFISH_OPPONENTS: readonly StockfishOpponentDefinition[] =
  Object.freeze(
    STORY_ROSTER.map(([id, storyTargetElo, originalStoryTargetElo], index) =>
      Object.freeze({
        id,
        displayName: loadCatalog("en").animals.opponent(id),
        storyPosition: index + 1,
        storyTargetElo,
        originalStoryTargetElo,
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
