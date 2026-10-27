import type { MapachessCatalog } from "@mapachess/localization/catalog"
import {
  HERO_CATALOG,
  heroWeaponDefinition,
} from "@mapachess/profile/hero-catalog"
import type { PlayerAppearance } from "@mapachess/profile/player-appearance"

export const DRESSING_CATEGORIES = [
  "Clothes",
  "Weapons",
  "Hair",
  "Skin",
  "Face",
  "Animal",
] as const
export type DressingCategory = (typeof DRESSING_CATEGORIES)[number]
export type DressingChoice = Readonly<{
  label: string
  selected: boolean
  appearance: PlayerAppearance
}>

export default function dressingRoomChoices(
  category: DressingCategory,
  draft: PlayerAppearance,
  copy: MapachessCatalog["profile"]["dressing"],
): Readonly<{
  styles: readonly DressingChoice[]
  colors: readonly DressingChoice[]
}> {
  switch (category) {
    case "Clothes": {
      const clothing = HERO_CATALOG.cloth.find(({ id }) => id === draft.cloth)
      if (clothing === undefined)
        throw new Error("The editor requires validated clothing.")
      return {
        styles: HERO_CATALOG.cloth.map((item) => ({
          label: copy.outfit(item.id.slice(5)),
          selected: item.id === draft.cloth,
          appearance: {
            ...draft,
            cloth: item.id,
            clothColor:
              item.colors.find((color) => color === draft.clothColor) ??
              item.colors[0],
          },
        })),
        colors: clothing.colors.map((clothColor) => ({
          label: copy.clothingColor(clothColor),
          selected: clothColor === draft.clothColor,
          appearance: { ...draft, clothColor },
        })),
      }
    }
    case "Hair": {
      const hair = HERO_CATALOG.hair.find(({ id }) => id === draft.hair)
      if (hair === undefined)
        throw new Error("The editor requires validated hair.")
      return {
        styles: HERO_CATALOG.hair.map((item) => ({
          label: copy.hairstyle(item.id),
          selected: item.id === draft.hair,
          appearance: {
            ...draft,
            hair: item.id,
            hairColor:
              item.colors.find((color) => color === draft.hairColor) ??
              item.colors[0],
          },
        })),
        colors: hair.colors.map((hairColor) => ({
          label: copy.hairColor(hairColor),
          selected: hairColor === draft.hairColor,
          appearance: { ...draft, hairColor },
        })),
      }
    }
    case "Weapons": {
      const weapon = heroWeaponDefinition(draft.weapon)
      return {
        styles: HERO_CATALOG.weapons.map((item) => ({
          label: copy.weapons[item.id],
          selected: item.id === weapon.id,
          appearance: {
            ...draft,
            weapon:
              item.variants.find((variant) => variant === draft.weapon) ??
              item.variants[0],
          },
        })),
        colors:
          weapon.variants.length === 1
            ? []
            : weapon.variants.map((variant, index) => ({
                label: copy.weaponColor(copy.weapons[weapon.id], index + 1),
                selected: variant === draft.weapon,
                appearance: { ...draft, weapon: variant },
              })),
      }
    }
    case "Skin":
      return {
        styles: HERO_CATALOG.skin.map((skin) => ({
          label: copy.skin(skin),
          selected: skin === draft.skin,
          appearance: { ...draft, skin },
        })),
        colors: [],
      }
    case "Face":
      return {
        styles: HERO_CATALOG.face.map((face) => ({
          label: copy.face(face),
          selected: face === draft.face,
          appearance: { ...draft, face },
        })),
        colors: [],
      }
    case "Animal":
      return { styles: [], colors: [] }
  }
}
