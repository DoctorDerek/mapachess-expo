import { describe, expect, it } from "vitest"
import loadCatalog from "@mapachess/localization/catalog"
import { HERO_CATALOG } from "@mapachess/profile/hero-catalog"
import { DEFAULT_PLAYER_APPEARANCE } from "@mapachess/profile/player-appearance"
import dressingRoomChoices, { DRESSING_CATEGORIES } from "./dressingRoomChoices"

const copy = loadCatalog("en").profile.dressing
const draft = DEFAULT_PLAYER_APPEARANCE

describe("dressing-room choices", () => {
  it("keeps styles and colors independent without flattening the catalog", () => {
    const clothes = dressingRoomChoices("Clothes", draft, copy)
    expect(clothes.styles).toHaveLength(HERO_CATALOG.cloth.length)
    expect(clothes.colors).toHaveLength(8)
    expect(
      clothes.styles.every(
        ({ appearance }) => appearance.clothColor === draft.clothColor,
      ),
    ).toBe(true)
    const hair = dressingRoomChoices("Hair", draft, copy)
    expect(hair.styles).toHaveLength(HERO_CATALOG.hair.length)
    expect(hair.colors).toHaveLength(10)
    expect(
      hair.styles.every(
        ({ appearance }) => appearance.hairColor === draft.hairColor,
      ),
    ).toBe(true)
    expect(hair.colors.at(-1)?.appearance.hairColor).toBe(10)
  })

  it("offers only actual weapon variants and retains the selected variant", () => {
    const dagger = dressingRoomChoices(
      "Weapons",
      { ...draft, weapon: "weapon5_c3" },
      copy,
    )
    expect(dagger.colors).toHaveLength(4)
    expect(
      dagger.styles.find(({ selected }) => selected)?.appearance.weapon,
    ).toBe("weapon5_c3")
    expect(
      dagger.colors.find(({ selected }) => selected)?.appearance.weapon,
    ).toBe("weapon5_c3")
    for (const weapon of [
      "none",
      "weapon1",
      "weapon2",
      "weapon3",
      "weapon4",
    ] as const)
      expect(
        dressingRoomChoices("Weapons", { ...draft, weapon }, copy).colors,
      ).toEqual([])
  })

  it("keeps faces, skin and animal eligibility separate from palette choices", () => {
    expect(dressingRoomChoices("Skin", draft, copy).styles).toHaveLength(
      HERO_CATALOG.skin.length,
    )
    expect(dressingRoomChoices("Face", draft, copy).styles).toHaveLength(
      HERO_CATALOG.face.length,
    )
    expect(dressingRoomChoices("Animal", draft, copy)).toEqual({
      styles: [],
      colors: [],
    })
    for (const category of DRESSING_CATEGORIES) {
      const { styles, colors } = dressingRoomChoices(category, draft, copy)
      if (styles.length > 0)
        expect(styles.filter(({ selected }) => selected)).toHaveLength(1)
      if (colors.length > 0)
        expect(colors.filter(({ selected }) => selected)).toHaveLength(1)
    }
  })
})
