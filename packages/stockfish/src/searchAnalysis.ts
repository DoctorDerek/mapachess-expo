import type {
  StockfishEngineSearchInformation,
  StockfishEngineSearchResult,
  StockfishPrincipalVariation,
} from "./engineSession.js"

type CollectedAnalysis = Pick<
  StockfishEngineSearchResult,
  "latestExactPrincipalVariation" | "principalVariations"
>

export type StockfishSearchAnalysis = Readonly<{
  record: (
    rank: number,
    moves: readonly string[],
    information: StockfishEngineSearchInformation,
  ) => void
  complete: () => CollectedAnalysis
}>

export default function createStockfishSearchAnalysis(): StockfishSearchAnalysis {
  let latestExactPrincipalVariation: StockfishPrincipalVariation | undefined
  const variationsByRank = new Map<number, StockfishPrincipalVariation>()

  return Object.freeze<StockfishSearchAnalysis>({
    record: (rank, moves, information) => {
      const variation: StockfishPrincipalVariation = Object.freeze({
        rank,
        moves: Object.freeze([...moves]),
        ...(information.depth === undefined
          ? {}
          : { depth: information.depth }),
        ...(information.selectiveDepth === undefined
          ? {}
          : { selectiveDepth: information.selectiveDepth }),
        ...(information.nodes === undefined
          ? {}
          : { nodes: information.nodes }),
        ...(information.score === undefined
          ? {}
          : { score: information.score }),
      })
      variationsByRank.set(rank, variation)
      if (rank === 1 && information.score?.bound === "exact") {
        latestExactPrincipalVariation = variation
      }
    },
    complete: () => {
      const principalVariations = Object.freeze(
        [...variationsByRank.values()].sort(
          (left, right) => left.rank - right.rank,
        ),
      )
      return {
        ...(latestExactPrincipalVariation === undefined
          ? {}
          : { latestExactPrincipalVariation }),
        ...(principalVariations.length === 0 ? {} : { principalVariations }),
      }
    },
  })
}
