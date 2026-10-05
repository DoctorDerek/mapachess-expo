import type { StockfishOpponentId } from "@mapachess/match/stockfish-opponent"
import {
  failData,
  requireEnumValue,
  requireExactKeys,
  requireObject,
} from "./decodePrimitives.js"
import {
  HERO_CATALOG,
  type HeroClothId,
  type HeroHairId,
} from "./heroCatalog.js"
import {
  selectChallengeUnlockedOpponents,
  type StoryProgress,
} from "./storyProgress.js"

export type PlayerAppearance = Readonly<{
  skin: number
  face: number
  hair: HeroHairId
  hairColor: number
  cloth: HeroClothId
  clothColor: number
  animal: StockfishOpponentId
}>

export const DEFAULT_PLAYER_APPEARANCE: PlayerAppearance = Object.freeze({
  skin: 1,
  face: 2,
  hair: "m4",
  hairColor: 2,
  cloth: "cloth13",
  clothColor: 3,
  animal: "raccoon-stockfish",
})

export const samePlayerAppearance = (
  left: PlayerAppearance,
  right: PlayerAppearance,
): boolean =>
  left.skin === right.skin &&
  left.face === right.face &&
  left.hair === right.hair &&
  left.hairColor === right.hairColor &&
  left.cloth === right.cloth &&
  left.clothColor === right.clothColor &&
  left.animal === right.animal

export const eligiblePlayerAnimals = (
  progress: StoryProgress,
): readonly StockfishOpponentId[] =>
  Object.freeze([
    ...new Set<StockfishOpponentId>([
      "raccoon-stockfish",
      ...selectChallengeUnlockedOpponents(progress).map(({ id }) => id),
    ]),
  ])

const catalogNumber = (
  received: unknown,
  values: readonly number[],
  path: string,
): number => values.find((value) => value === received) ?? failData(path)

export function decodePlayerAppearance(
  value: unknown,
  progress: StoryProgress,
  path: string,
): PlayerAppearance {
  const received = requireObject(value, path)
  requireExactKeys(
    received,
    ["skin", "face", "hair", "hairColor", "cloth", "clothColor", "animal"],
    path,
  )
  const hair =
    HERO_CATALOG.hair.find(({ id }) => id === received.hair) ??
    failData(`${path}.hair`)
  const cloth =
    HERO_CATALOG.cloth.find(({ id }) => id === received.cloth) ??
    failData(`${path}.cloth`)
  return Object.freeze({
    skin: catalogNumber(received.skin, HERO_CATALOG.skin, `${path}.skin`),
    face: catalogNumber(received.face, HERO_CATALOG.face, `${path}.face`),
    hair: hair.id,
    hairColor: catalogNumber(
      received.hairColor,
      hair.colors,
      `${path}.hairColor`,
    ),
    cloth: cloth.id,
    clothColor: catalogNumber(
      received.clothColor,
      cloth.colors,
      `${path}.clothColor`,
    ),
    animal: requireEnumValue(
      received.animal,
      eligiblePlayerAnimals(progress),
      `${path}.animal`,
    ),
  })
}

export function heroLayerPaths(
  appearance: PlayerAppearance,
): readonly string[] {
  const { skin, face, hair, hairColor, cloth, clothColor } = appearance
  return [
    `profile/hero/skin/skin_c${skin}.png`,
    `profile/hero/hair/${hair}/${hair}_bot/${hair}_c${hairColor}_bot.png`,
    `profile/hero/face/face_c${face}.png`,
    `profile/hero/cloth/${cloth}/${cloth}_bot/${cloth}_c${clothColor}_bot.png`,
    `profile/hero/cloth/${cloth}/${cloth}_top/${cloth}_c${clothColor}_top.png`,
    `profile/hero/hair/${hair}/${hair}_top/${hair}_c${hairColor}_top.png`,
  ]
}
