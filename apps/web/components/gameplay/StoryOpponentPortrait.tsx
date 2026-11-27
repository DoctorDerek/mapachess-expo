import cx from "classix"
import type { CSSProperties } from "react"
import { STANDALONE_ANIMAL_SCALE } from "@mapachess/match-presentation/presentation-asset-manifest"
import type { StockfishOpponentDefinition } from "@mapachess/match/stockfish-opponent"
import { preparedArtSource } from "../../lib/presentation/characterArtPack"
import useCharacterArtPack from "../../lib/presentation/useCharacterArtPack"
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
  useCharacterArtPack(near && animation !== null)
  const source =
    near && animation ? preparedArtSource(animation.sourceId) : undefined

  const scale = presentation.layout.standaloneScale ?? STANDALONE_ANIMAL_SCALE
  const pixelSize = `${scale}px`
  const length = (pixels: number) =>
    `calc(${pixels} * var(--portrait-pixel-size))`

  return (
    <span
      ref={ref}
      aria-hidden="true"
      style={
        {
          "--portrait-pixel-size": pixelSize,
          "--portrait-min-width": length(
            presentation.layout.clearance.horizontalRadius * 2,
          ),
          "--portrait-min-height": length(
            presentation.layout.clearance.above +
              presentation.layout.clearance.below,
          ),
        } as CSSProperties
      }
      className={cx(
        "grid min-h-(--portrait-min-height) min-w-(--portrait-min-width) place-items-end-safe justify-items-center p-1",
        framed &&
          "bg-mapachito-white border-mapachito-charcoal/30 shrink-0 rounded-lg border-2 font-mono font-bold",
      )}
    >
      {animation === null ? (
        framed ? (
          opponent.storyPosition
        ) : null
      ) : (
        <span
          data-testid="animal-artwork"
          className={cx(
            "block h-(--portrait-height) w-(--portrait-width) bg-(image:--portrait-image) bg-size-(--portrait-size) bg-position-(--portrait-position) bg-no-repeat [image-rendering:pixelated]",
            locked && "brightness-0",
          )}
          style={
            {
              "--portrait-image":
                source === undefined ? undefined : `url("${source}")`,
              "--portrait-position": `${length(-animation.geometry.visibleX)} ${length(-animation.geometry.visibleY)}`,
              "--portrait-size": `${length(animation.geometry.frameWidth * animation.frameCount)} ${length(animation.geometry.frameHeight)}`,
              "--portrait-width": length(animation.geometry.visibleWidth),
              "--portrait-height": length(animation.geometry.visibleHeight),
            } as CSSProperties
          }
        />
      )}
    </span>
  )
}
