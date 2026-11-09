import type { CSSProperties } from "react"
import { STANDALONE_ANIMAL_SCALE } from "@mapachess/match-presentation/presentation-asset-manifest"
import type { StockfishOpponentDefinition } from "@mapachess/match/stockfish-opponent"
import resolveWebOpponentPresentation from "../../lib/presentation/webOpponentPresentation"
import { usePortraitViewport } from "./PortraitViewport"

type StoryOpponentPortraitProps = Readonly<{
  opponent: StockfishOpponentDefinition
  locked: boolean
  framed?: boolean
}>

export default function StoryOpponentPortrait({
  opponent,
  locked,
  framed = true,
}: StoryOpponentPortraitProps) {
  const { ref, near } = usePortraitViewport()
  const presentation = resolveWebOpponentPresentation(opponent.id)
  const animation =
    presentation.kind === "sprite" ? presentation.steps[0].animation : null

  const scale = presentation.layout.standaloneScale ?? STANDALONE_ANIMAL_SCALE
  const pixelSize = `${scale}px`
  const length = (pixels: number) =>
    `calc(${pixels} * var(--portrait-pixel-size))`

  return (
    <span
      ref={ref}
      aria-hidden="true"
      style={{
        minWidth: presentation.layout.clearance.horizontalRadius * 2 * scale,
        minHeight:
          (presentation.layout.clearance.above +
            presentation.layout.clearance.below) *
          scale,
      }}
      className={
        framed
          ? "bg-mapachito-white border-mapachito-charcoal/30 grid shrink-0 place-items-end-safe justify-items-center rounded-lg border-2 p-1 font-mono font-bold"
          : "grid place-items-end-safe justify-items-center p-1"
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
              backgroundImage: near
                ? `url("${animation.sourceId}")`
                : undefined,
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
