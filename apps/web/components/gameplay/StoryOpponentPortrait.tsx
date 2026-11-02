import type { CSSProperties } from "react"
import type { StockfishOpponentDefinition } from "@mapachess/match/stockfish-opponent"
import resolveWebOpponentPresentation from "../../lib/presentation/webOpponentPresentation"

type StoryOpponentPortraitProps = Readonly<{
  opponent: StockfishOpponentDefinition
  locked: boolean
  framed?: boolean
}>

const PORTRAIT_PIXEL_SCALE = 2

export default function StoryOpponentPortrait({
  opponent,
  locked,
  framed = true,
}: StoryOpponentPortraitProps) {
  const presentation = resolveWebOpponentPresentation(opponent.id)
  const animation =
    presentation.kind === "sprite" ? presentation.steps[0].animation : null

  const geometry = animation?.geometry
  const pixelSize =
    framed || geometry === undefined
      ? `${PORTRAIT_PIXEL_SCALE}px`
      : `min(${PORTRAIT_PIXEL_SCALE}px, calc(100cqw / ${geometry.visibleWidth}), calc(100cqh / ${geometry.visibleHeight}))`
  const length = (pixels: number) =>
    `calc(${pixels} * var(--portrait-pixel-size))`

  return (
    <span
      aria-hidden="true"
      className={
        framed
          ? "bg-mapachito-white border-mapachito-charcoal/30 grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg border-2 font-mono font-bold"
          : "@container-size grid size-full place-items-end-safe justify-items-center"
      }
    >
      {animation === null ? (
        framed ? (
          opponent.storyPosition
        ) : null
      ) : (
        <span
          className={
            locked
              ? "block brightness-0 [image-rendering:pixelated]"
              : "block [image-rendering:pixelated]"
          }
          style={
            {
              "--portrait-pixel-size": pixelSize,
              backgroundImage: `url("${animation.sourceId}")`,
              backgroundPosition: `${length(-animation.geometry.visibleX)} ${length(-animation.geometry.visibleY)}`,
              backgroundRepeat: "no-repeat",
              backgroundSize: `${length(animation.geometry.frameWidth * animation.frameCount)} ${length(animation.geometry.frameHeight)}`,
              width: length(animation.geometry.visibleWidth),
              height: length(animation.geometry.visibleHeight),
            } as CSSProperties & { "--portrait-pixel-size": string }
          }
        />
      )}
    </span>
  )
}
