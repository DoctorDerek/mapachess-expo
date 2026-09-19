import type { PresentationImages } from "./presentationImages"

type BattleRecipeRequest = Readonly<{
  phaseIndex: number
  reactionSequence: number
  sources: readonly string[]
}>

export type BattleRecipePreparation = Readonly<{
  prepare: (request: BattleRecipeRequest) => Promise<boolean>
  reset: () => void
}>

export default function createBattleRecipePreparation(
  images: PresentationImages,
): BattleRecipePreparation {
  let current: Readonly<{
    request: BattleRecipeRequest
    ready: Promise<boolean>
  }> | null = null

  return {
    reset(): void {
      current = null
    },
    prepare(request): Promise<boolean> {
      if (
        current === null ||
        current.request.phaseIndex !== request.phaseIndex ||
        current.request.reactionSequence !== request.reactionSequence ||
        current.request.sources.length !== request.sources.length ||
        current.request.sources.some(
          (source, index) => source !== request.sources[index],
        )
      ) {
        current = {
          request: { ...request, sources: [...request.sources] },
          ready: images.prepare(request.sources),
        }
      }
      return current.ready
    },
  }
}
