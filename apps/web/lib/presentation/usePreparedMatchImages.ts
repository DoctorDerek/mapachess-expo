import { useEffect, useMemo, useState } from "react"
import { preload } from "react-dom"
import {
  DEFAULT_COACH_COLLECTION,
  NEUTRAL_COACH_PORTRAIT_LABEL,
  type CoachCollectionId,
} from "@mapachess/match-presentation/coach-portrait"
import type { ImplementedDurableOpponentId } from "@mapachess/match/durable-match-record"
import type { StockfishOpponentId } from "@mapachess/match/stockfish-opponent"
import { useCoachCollection } from "./CoachCollectionContext"
import createPresentationImages from "./presentationImages"
import resolveWebOpponentPresentation from "./webOpponentPresentation"
import { coachPortraitSource } from "./webPresentationAssets"

export const initialMatchPresentationSources = (
  opponentId: ImplementedDurableOpponentId | null,
  playerAnimal: StockfishOpponentId = "raccoon-stockfish",
  collection: CoachCollectionId = DEFAULT_COACH_COLLECTION,
): readonly string[] => {
  if (opponentId === null) return []
  const player = resolveWebOpponentPresentation(playerAnimal)
  const opponent = resolveWebOpponentPresentation(opponentId)
  const coach = coachPortraitSource(NEUTRAL_COACH_PORTRAIT_LABEL, collection)
  return [
    ...new Set([
      ...(player.kind === "sprite" ? [player.steps[0].animation.sourceId] : []),
      ...(opponent.kind === "sprite"
        ? [opponent.steps[0].animation.sourceId]
        : []),
      ...(coach === null ? [] : [coach]),
    ]),
  ]
}

export default function usePreparedMatchImages(
  opponentId: ImplementedDurableOpponentId | null,
  playerAnimal: StockfishOpponentId = "raccoon-stockfish",
): void {
  const collection = useCoachCollection()
  const sources = useMemo(
    () => initialMatchPresentationSources(opponentId, playerAnimal, collection),
    [opponentId, playerAnimal, collection],
  )
  const [images] = useState(() => createPresentationImages())
  for (const source of sources)
    preload(source, { as: "image", fetchPriority: "low" })

  useEffect(() => {
    images.retain(sources)
    void images.prepare(sources)
  }, [images, sources])
  useEffect(() => () => images.retain([]), [images])
}
