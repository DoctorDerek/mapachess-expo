import type { StockfishOpponentDefinition } from "@mapachess/match/stockfish-opponent"
import resolveWebOpponentPresentation from "../../lib/presentation/webOpponentPresentation"

type StoryOpponentPortraitProps = Readonly<{
  opponent: StockfishOpponentDefinition
  locked: boolean
}>

const PORTRAIT_PIXEL_SCALE = 2

export default function StoryOpponentPortrait({
  opponent,
  locked,
}: StoryOpponentPortraitProps) {
  const presentation = resolveWebOpponentPresentation(opponent.id)
  const animation =
    presentation.kind === "sprite" ? presentation.steps[0].animation : null

  return (
    <span
      aria-hidden="true"
      className="bg-mapachito-white border-mapachito-charcoal/30 grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg border-2 font-mono font-bold"
    >
      {animation === null ? (
        opponent.storyPosition
      ) : (
        <span
          className={
            locked
              ? "block brightness-0 [image-rendering:pixelated]"
              : "block [image-rendering:pixelated]"
          }
          style={{
            backgroundImage: `url("${animation.sourceId}")`,
            backgroundPosition: `${-animation.geometry.visibleX * PORTRAIT_PIXEL_SCALE}px ${-animation.geometry.visibleY * PORTRAIT_PIXEL_SCALE}px`,
            backgroundRepeat: "no-repeat",
            backgroundSize: `${animation.geometry.frameWidth * animation.frameCount * PORTRAIT_PIXEL_SCALE}px ${animation.geometry.frameHeight * PORTRAIT_PIXEL_SCALE}px`,
            width: animation.geometry.visibleWidth * PORTRAIT_PIXEL_SCALE,
            height: animation.geometry.visibleHeight * PORTRAIT_PIXEL_SCALE,
          }}
        />
      )}
    </span>
  )
}
