export const HERO_IDLE_GEOMETRY = {
  width: 45,
  height: 32,
  frameCount: 6,
} as const
const HERO_BODY_IDLE_BOUNDS = { x: 9, y: 0, width: 25, height: 31 } as const
export const HERO_CATALOG = {
  weapons: [
    {
      id: "none",
      label: "None",
      variants: ["none"],
      bounds: HERO_BODY_IDLE_BOUNDS,
    },
    {
      id: "weapon1",
      label: "Sword",
      variants: ["weapon1"],
      bounds: HERO_BODY_IDLE_BOUNDS,
    },
    {
      id: "weapon2",
      label: "Spear",
      variants: ["weapon2"],
      bounds: { ...HERO_BODY_IDLE_BOUNDS, height: 32 },
    },
    {
      id: "weapon3",
      label: "Wand",
      variants: ["weapon3"],
      bounds: HERO_BODY_IDLE_BOUNDS,
    },
    {
      id: "weapon4",
      label: "Axe",
      variants: ["weapon4"],
      bounds: { x: 0, y: 0, width: 45, height: 31 },
    },
    {
      id: "weapon5",
      label: "Dagger",
      variants: ["weapon5_c1", "weapon5_c2", "weapon5_c3", "weapon5_c4"],
      bounds: { x: 6, y: 0, width: 30, height: 31 },
    },
  ],
  skin: [1, 2, 3, 4, 5, 6],
  face: [1, 2, 3, 4, 5, 6, 7],
  cloth: [
    { id: "cloth1", colors: [1, 2, 3, 4, 5, 6, 7, 8] },
    { id: "cloth2", colors: [1, 2, 3, 4, 5, 6, 7, 8] },
    { id: "cloth3", colors: [1, 2, 3, 4, 5, 6, 7, 8] },
    { id: "cloth4", colors: [1, 2, 3, 4, 5, 6, 7, 8] },
    { id: "cloth5", colors: [1, 2, 3, 4, 5, 6, 7, 8] },
    { id: "cloth6", colors: [1, 2, 3, 4, 5, 6, 7, 8] },
    { id: "cloth7", colors: [1, 2, 3, 4, 5, 6, 7, 8] },
    { id: "cloth8", colors: [1, 2, 3, 4, 5, 6, 7, 8] },
    { id: "cloth9", colors: [1, 2, 3, 4, 5, 6, 7, 8] },
    { id: "cloth10", colors: [1, 2, 3, 4, 5, 6, 7, 8] },
    { id: "cloth11", colors: [1, 2, 3, 4, 5, 6, 7, 8] },
    { id: "cloth12", colors: [1, 2, 3, 4, 5, 6, 7, 8] },
    { id: "cloth13", colors: [1, 2, 3, 4, 5, 6, 7, 8] },
    { id: "cloth14", colors: [1, 2, 3, 4, 5, 6, 7, 8] },
    { id: "cloth15", colors: [1, 2, 3, 4, 5, 6, 7, 8] },
    { id: "cloth16", colors: [1, 2, 3, 4, 5, 6, 7, 8] },
    { id: "cloth17", colors: [1, 2, 3, 4, 5, 6, 7, 8] },
  ],
  hair: [
    { id: "m1", colors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    { id: "m2", colors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    { id: "m3", colors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    { id: "m4", colors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    { id: "m5", colors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    { id: "m6", colors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    { id: "m7", colors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    { id: "m8", colors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    { id: "m9", colors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    { id: "m10", colors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    { id: "m11", colors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    { id: "m12", colors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    { id: "m13", colors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    { id: "m14", colors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    { id: "f1", colors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    { id: "f2", colors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    { id: "f3", colors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    { id: "f4", colors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    { id: "f5", colors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    { id: "f6", colors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    { id: "f7", colors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    { id: "f8", colors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    { id: "f9", colors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  ],
} as const
export type HeroHairId = (typeof HERO_CATALOG.hair)[number]["id"]
export type HeroClothId = (typeof HERO_CATALOG.cloth)[number]["id"]
export type HeroWeaponId =
  (typeof HERO_CATALOG.weapons)[number]["variants"][number]

export function heroWeaponDefinition(
  id: HeroWeaponId,
): (typeof HERO_CATALOG.weapons)[number] {
  const definition = HERO_CATALOG.weapons.find(({ variants }) =>
    variants.some((variant) => variant === id),
  )
  if (definition === undefined)
    throw new Error("Appearance requires a supported weapon.")
  return definition
}
