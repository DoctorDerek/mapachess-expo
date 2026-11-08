import resolveOpponentPresentation from "@mapachess/match-presentation/opponent-presentation"
import type { StockfishOpponentId } from "@mapachess/match/stockfish-opponent"
import NativeSpriteFrame from "./NativeSpriteFrame"

export default function NativeAnimal({
  animal,
}: Readonly<{ animal: StockfishOpponentId }>) {
  const presentation = resolveOpponentPresentation(animal)
  if (presentation.kind !== "sprite") return null
  const animation = presentation.steps[0].animation
  return (
    <NativeSpriteFrame
      sourceId={animation.sourceId}
      frameWidth={animation.geometry.frameWidth}
      frameHeight={animation.geometry.frameHeight}
      frameCount={animation.frameCount}
    />
  )
}
