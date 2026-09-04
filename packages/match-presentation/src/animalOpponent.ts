export const ANIMAL_OPPONENTS = [
  {
    displayName: "Chicken",
    id: "chicken",
    sourcePacks: ["Chickenpack"],
  },
  {
    displayName: "Bunny",
    id: "bunny",
    sourcePacks: ["Bunnypack"],
  },
  {
    displayName: "Dog",
    id: "dog",
    sourcePacks: ["Dogpack", "Lil Doggies"],
  },
  {
    displayName: "Cat",
    id: "cat",
    sourcePacks: ["Catset", "Kittens"],
  },
  {
    displayName: "Mouse",
    id: "mouse",
    sourcePacks: ["Mousepack"],
  },
  {
    displayName: "Frog",
    id: "frog",
    sourcePacks: ["Frogpack"],
  },
  {
    displayName: "Turtle",
    id: "turtle",
    sourcePacks: ["Turtlepack"],
  },
  {
    displayName: "Panda",
    id: "panda",
    sourcePacks: ["Pandapack"],
  },
  {
    displayName: "Otter",
    id: "otter",
    sourcePacks: ["Lil Otter"],
  },
  {
    displayName: "Raccoon",
    id: "raccoon",
    sourcePacks: ["Raccoonpack"],
  },
  {
    displayName: "Axolotl",
    id: "axolotl",
    sourcePacks: ["Lil Axolotl"],
  },
  {
    displayName: "Parrot",
    id: "parrot",
    sourcePacks: ["Parrotpack"],
  },
  {
    displayName: "Hedgehog",
    id: "hedgehog",
    sourcePacks: ["Lil Hedgehog"],
  },
  {
    displayName: "Deer",
    id: "deer",
    sourcePacks: ["Deerpack"],
  },
  {
    displayName: "Fox",
    id: "fox",
    sourcePacks: ["Foxpack", "Lil Fox"],
  },
  {
    displayName: "Wolf",
    id: "wolf",
    sourcePacks: ["Wolfpack"],
  },
  {
    displayName: "Falcon",
    id: "falcon",
    sourcePacks: ["Falconpack"],
  },
  {
    displayName: "Crane",
    id: "crane",
    sourcePacks: ["Cranepack"],
  },
  {
    displayName: "Crow",
    id: "crow",
    sourcePacks: ["Crowpack"],
  },
  {
    displayName: "Bat",
    id: "bat",
    sourcePacks: ["Batpack"],
  },
  {
    displayName: "Ninja",
    id: "ninja",
    sourcePacks: ["Lil Ninja"],
  },
  {
    displayName: "War Hero",
    id: "war-hero",
    sourcePacks: ["Lil War Hero"],
  },
  {
    displayName: "Dragonfly",
    id: "dragonfly",
    sourcePacks: ["Dragonflypack"],
  },
] as const satisfies readonly Readonly<{
  displayName: string
  id: string
  sourcePacks: readonly [string, ...string[]]
}>[]

export type AnimalOpponentDefinition = (typeof ANIMAL_OPPONENTS)[number]
export type AnimalOpponentId = AnimalOpponentDefinition["id"]

export default ANIMAL_OPPONENTS
