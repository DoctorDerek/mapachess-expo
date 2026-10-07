import type { SpriteAnimationDefinition } from "@mapachess/match-presentation/presentation-asset-manifest"
import { MATCH_VARIANT_LABELS } from "@mapachess/match/match-variant"
import { levelFromTotalXp } from "@mapachess/profile/global-xp"
import {
  HERO_IDLE_GEOMETRY,
  heroWeaponDefinition,
} from "@mapachess/profile/hero-catalog"
import {
  heroLayerPaths,
  type PlayerAppearance,
} from "@mapachess/profile/player-appearance"
import type { MapachessPlayerData } from "@mapachess/profile/player-data"
import resolveWebOpponentPresentation from "./webOpponentPresentation"
import {
  LICENSED_PRESENTATION_ASSETS_ENABLED,
  presentationAssetSource,
} from "./webPresentationAssets"

export const CARD_PALETTE = Object.freeze({
  blue: "#009DAE",
  cyan: "#71DFE7",
  mint: "#C2FFF9",
  yellow: "#FFE652",
  ink: "#1e1e1e",
})
export type CardContent = Readonly<{
  level: boolean
  standard: boolean
  chess960: boolean
  animal: boolean
}>
export const INITIAL_CARD_CONTENT: CardContent = Object.freeze({
  level: true,
  standard: true,
  chess960: true,
  animal: true,
})
export type CardFacts = Readonly<{
  level: number
  standard: number
  chess960: number
}>
export type CardInput = Readonly<{
  appearance: PlayerAppearance
  facts: CardFacts
  content: CardContent
  format: "GIF" | "PNG"
}>
export const cardFacts = (data: MapachessPlayerData): CardFacts => ({
  level: levelFromTotalXp(data.totalXp),
  standard: Math.round(data.ratings.standard),
  chess960: Math.round(data.ratings.chess960),
})
export type CardArtwork = Readonly<{
  hero: readonly HTMLImageElement[]
  heroBounds: Readonly<{ x: number; y: number; width: number; height: number }>
  animal: Readonly<{
    image: HTMLImageElement
    animation: SpriteAnimationDefinition<string>
  }> | null
}>
const images = new Map<string, Promise<HTMLImageElement>>()
function loadImage(path: string): Promise<HTMLImageElement> {
  const cached = images.get(path)
  if (cached !== undefined) return cached
  const image = new Image()
  image.src = path
  const ready = image
    .decode()
    .then(() => image)
    .catch((error) => {
      images.delete(path)
      throw error
    })
  if (images.size >= 96) images.delete(images.keys().next().value ?? "")
  images.set(path, ready)
  return ready
}
export async function loadCardArtwork(
  appearance: PlayerAppearance,
  includeAnimal = true,
): Promise<CardArtwork> {
  if (!LICENSED_PRESENTATION_ASSETS_ENABLED)
    throw new Error("Licensed profile artwork is unavailable in this build.")
  const presentation = resolveWebOpponentPresentation(appearance.animal)
  if (presentation.kind !== "sprite")
    throw new Error("Selected animal artwork is unavailable.")
  const animation = presentation.steps[0].animation
  const [hero, animal] = await Promise.all([
    Promise.all(
      heroLayerPaths(appearance).map((path) =>
        loadImage(presentationAssetSource(path)),
      ),
    ),
    includeAnimal
      ? loadImage(animation.sourceId).then((image) => ({ image, animation }))
      : null,
  ])
  return {
    hero,
    heroBounds: heroWeaponDefinition(appearance.weapon).bounds,
    animal,
  }
}

export function drawCardCharacters(
  context: CanvasRenderingContext2D,
  artwork: CardArtwork,
  frame: number,
  width: number,
  height: number,
): void {
  context.imageSmoothingEnabled = false
  const bounds = artwork.heroBounds
  const heroScale = Math.max(
    1,
    Math.floor(
      Math.min(
        (height * 0.76) / bounds.height,
        (width * (artwork.animal === null ? 0.9 : 0.7)) / bounds.width,
      ),
    ),
  )
  const heroWidth = bounds.width * heroScale
  const heroHeight = bounds.height * heroScale
  const hasAnimal = artwork.animal !== null
  const heroX = Math.round(width * (hasAnimal ? 0.4 : 0.5) - heroWidth / 2)
  const floor = Math.round(height * 0.88)
  context.fillStyle = CARD_PALETTE.blue
  context.globalAlpha = 0.28
  context.beginPath()
  context.ellipse(
    width * 0.5,
    floor,
    width * 0.32,
    height * 0.021,
    0,
    0,
    Math.PI * 2,
  )
  context.fill()
  context.globalAlpha = 1
  for (const image of artwork.hero)
    context.drawImage(
      image,
      (frame % HERO_IDLE_GEOMETRY.frameCount) * HERO_IDLE_GEOMETRY.width +
        bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      heroX,
      floor - heroHeight,
      heroWidth,
      heroHeight,
    )
  if (artwork.animal !== null) {
    const { image, animation } = artwork.animal
    const g = animation.geometry
    const scale = Math.max(
      1,
      Math.floor(
        Math.min(
          (height * 0.28) / g.visibleHeight,
          (width * 0.32) / g.visibleWidth,
        ),
      ),
    )
    const x = Math.round(width * 0.73 - (g.visibleWidth * scale) / 2)
    context.drawImage(
      image,
      (frame % animation.frameCount) * g.frameWidth + g.visibleX,
      g.visibleY,
      g.visibleWidth,
      g.visibleHeight,
      x,
      floor - g.visibleHeight * scale,
      g.visibleWidth * scale,
      g.visibleHeight * scale,
    )
  }
}

export function drawProfileCard(
  context: CanvasRenderingContext2D,
  artwork: CardArtwork,
  input: CardInput,
  frame: number,
): void {
  const { width, height } = context.canvas
  const { content, facts } = input
  const hasFacts = content.level || content.standard || content.chess960
  const factsWidth = hasFacts ? Math.round(width * 0.4) : 0
  const invitationHeight = Math.round(height * 0.13)
  const pictureHeight = height - invitationHeight
  context.fillStyle = CARD_PALETTE.cyan
  context.fillRect(0, 0, width, height)
  context.fillStyle = CARD_PALETTE.mint
  context.beginPath()
  context.ellipse(
    width * 0.71,
    pictureHeight * 0.73,
    width * 0.4,
    pictureHeight * 0.69,
    0,
    Math.PI,
    Math.PI * 2,
  )
  context.lineTo(width, pictureHeight)
  context.lineTo(factsWidth, pictureHeight)
  context.fill()
  context.fillStyle = CARD_PALETTE.blue
  context.fillRect(
    factsWidth,
    pictureHeight * 0.91,
    width - factsWidth,
    pictureHeight * 0.09,
  )
  context.save()
  context.translate(factsWidth, 0)
  drawCardCharacters(context, artwork, frame, width - factsWidth, pictureHeight)
  context.restore()
  if (hasFacts) {
    context.fillStyle = CARD_PALETTE.yellow
    context.fillRect(0, 0, factsWidth, pictureHeight)
    const items = [
      ...(content.level ? [{ value: facts.level, label: "Level" }] : []),
      ...(content.standard
        ? [
            {
              value: facts.standard,
              label: `${MATCH_VARIANT_LABELS.standard} Elo`,
            },
          ]
        : []),
      ...(content.chess960
        ? [
            {
              value: facts.chess960,
              label: `${MATCH_VARIANT_LABELS.chess960} Elo`,
            },
          ]
        : []),
    ]
    context.fillStyle = CARD_PALETTE.ink
    context.textAlign = "left"
    context.textBaseline = "middle"
    items.forEach(({ value, label }, index) => {
      const center = (pictureHeight * (index + 0.5)) / items.length
      const left = width * 0.04
      const available = factsWidth - width * 0.08
      context.font = `bold ${Math.round(height * 0.061)}px "Trebuchet MS", sans-serif`
      if (label === "Level") {
        context.fillText(label, left, center)
        const labelWidth = context.measureText(label).width + width * 0.01
        context.font = `${Math.round(height * 0.12)}px Impact, sans-serif`
        context.fillText(
          String(value),
          left + labelWidth,
          center,
          available - labelWidth,
        )
        return
      }
      context.fillText(label, left, center + height * 0.052)
      context.font = `${Math.round(height * 0.12)}px Impact, sans-serif`
      context.fillText(String(value), left, center - height * 0.037, available)
    })
  }
  context.fillStyle = CARD_PALETTE.ink
  context.fillRect(0, pictureHeight, width, invitationHeight)
  context.fillStyle = "#fff"
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.font = `bold ${Math.round(width * 0.035)}px "Trebuchet MS", sans-serif`
  context.fillText(
    "Play free at Mapachess.com",
    width / 2,
    pictureHeight + invitationHeight / 2,
  )
}
