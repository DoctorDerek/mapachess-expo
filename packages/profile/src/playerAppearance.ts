import { MATCH_VARIANTS } from "@mapachess/match/match-variant"
import {
  STOCKFISH_OPPONENTS,
  type StockfishOpponentId,
} from "@mapachess/match/stockfish-opponent"
import {
  failData,
  requireEnumValue,
  requireExactKeys,
  requireObject,
} from "./decodePrimitives.js"
import {
  HERO_CATALOG,
  heroWeaponDefinition,
  type HeroClothId,
  type HeroHairId,
  type HeroWeaponId,
} from "./heroCatalog.js"
import type { StoryProgress } from "./storyProgress.js"

export type PlayerAppearance = Readonly<{
  skin: number
  face: number
  hair: HeroHairId
  hairColor: number
  cloth: HeroClothId
  clothColor: number
  animal: StockfishOpponentId
  weapon: HeroWeaponId
}>

export const DEFAULT_PLAYER_APPEARANCE: PlayerAppearance = Object.freeze({
  skin: 1,
  face: 2,
  hair: "m4",
  hairColor: 2,
  cloth: "cloth13",
  clothColor: 3,
  animal: "raccoon-stockfish",
  weapon: "none",
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
  left.animal === right.animal &&
  left.weapon === right.weapon

export const eligiblePlayerAnimals = (
  progress: StoryProgress,
): readonly StockfishOpponentId[] =>
  Object.freeze([
    DEFAULT_PLAYER_APPEARANCE.animal,
    ...STOCKFISH_OPPONENTS.filter(
      ({ id }) =>
        id !== DEFAULT_PLAYER_APPEARANCE.animal &&
        MATCH_VARIANTS.some((variant) =>
          progress[variant].some(({ opponentId }) => opponentId === id),
        ),
    ).map(({ id }) => id),
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
  legacyChicken: "preserve" | "reject" = "reject",
): PlayerAppearance {
  const received = requireObject(value, path)
  requireExactKeys(
    received,
    [
      "skin",
      "face",
      "hair",
      "hairColor",
      "cloth",
      "clothColor",
      "animal",
      "weapon",
    ],
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
      legacyChicken === "preserve"
        ? [...eligiblePlayerAnimals(progress), "chicken-stockfish"]
        : eligiblePlayerAnimals(progress),
      `${path}.animal`,
    ),
    weapon: requireEnumValue(
      received.weapon,
      HERO_CATALOG.weapons.flatMap(({ variants }) => [...variants]),
      `${path}.weapon`,
    ),
  })
}

export function decodeLegacyPlayerAppearance(
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
  return decodePlayerAppearance(
    { ...received, weapon: "none" },
    progress,
    path,
    "preserve",
  )
}

export function legacyPlayerAppearance(
  appearance: PlayerAppearance,
): Omit<PlayerAppearance, "weapon"> {
  const { weapon: _weapon, ...legacy } = appearance
  return legacy
}

export function heroLayerPaths(
  appearance: PlayerAppearance,
): readonly string[] {
  const { skin, face, hair, hairColor, cloth, clothColor, weapon } = appearance
  const weaponStyle = heroWeaponDefinition(weapon)
  const weaponPath = (side: "bot" | "top"): string =>
    `profile/hero/weapon/${weaponStyle.id}/${weaponStyle.id}_${side}/${weapon}_${side}.png`
  return [
    ...(weapon === "none" ? [] : [weaponPath("bot")]),
    `profile/hero/skin/skin_c${skin}.png`,
    `profile/hero/hair/${hair}/${hair}_bot/${hair}_c${hairColor}_bot.png`,
    `profile/hero/face/face_c${face}.png`,
    `profile/hero/cloth/${cloth}/${cloth}_bot/${cloth}_c${clothColor}_bot.png`,
    `profile/hero/cloth/${cloth}/${cloth}_top/${cloth}_c${clothColor}_top.png`,
    `profile/hero/hair/${hair}/${hair}_top/${hair}_c${hairColor}_top.png`,
    ...(weapon === "none" ? [] : [weaponPath("top")]),
  ]
}
