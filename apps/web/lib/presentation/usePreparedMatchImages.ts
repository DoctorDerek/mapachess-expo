import { useEffect, useMemo, useState } from "react"
import { preload } from "react-dom"
import { NEUTRAL_COACH_PORTRAIT_LABEL } from "@mapachess/match-presentation/coach-portrait"
import type { ImplementedDurableOpponentId } from "@mapachess/match/durable-match-record"
import type { StockfishOpponentId } from "@mapachess/match/stockfish-opponent"
import createPresentationImages from "./presentationImages"
import resolveWebOpponentPresentation from "./webOpponentPresentation"
import { coachPortraitSource } from "./webPresentationAssets"

export const initialMatchPresentationSources = (
  opponentId: ImplementedDurableOpponentId | null,
  playerAnimal: StockfishOpponentId = "raccoon-stockfish",
): readonly string[] => {
  if (opponentId === null) return []
  const player = resolveWebOpponentPresentation(playerAnimal)
  const opponent = resolveWebOpponentPresentation(opponentId)
  const coach = coachPortraitSource(NEUTRAL_COACH_PORTRAIT_LABEL)
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
  const sources = useMemo(
    () => initialMatchPresentationSources(opponentId, playerAnimal),
    [opponentId, playerAnimal],
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
