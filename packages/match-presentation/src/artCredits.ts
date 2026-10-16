import type { MapachessCatalog } from "@mapachess/localization/catalog"

type CreditMessage =
  keyof MapachessCatalog["shared"]["creditControls"]["labels"]

type CreditLabel =
  | string
  | Readonly<{ message: CreditMessage }>
  | Readonly<{ piece: keyof MapachessCatalog["board"]["pieces"] }>

type ArtCredit = Readonly<{
  id: keyof MapachessCatalog["credits"]
  title: CreditLabel
  creator: string
  license: CreditLabel
  licenseTerms?: CreditMessage
  licenseUrl: string
  sources: readonly Readonly<{ label: CreditLabel; url: string }>[]
}>

export const ART_CREDITS = Object.freeze({
  mapachitoIdentity: Object.freeze({
    id: "mapachitoIdentity" as const,
    title: { message: "mapachitoIdentity" as const },
    creator: "Dr. Derek Austin",
    license: { message: "allRightsReserved" as const },
    licenseUrl: "https://DoctorDerek.com",
    sources: Object.freeze([
      { label: "DoctorDerek.com", url: "https://DoctorDerek.com" },
    ]),
  }),
  kenney: Object.freeze({
    id: "kenney" as const,
    title: "Input Prompts",
    creator: "Kenney",
    license: "CC0 1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sources: Object.freeze([
      { label: "Input Prompts", url: "https://kenney.nl/assets/input-prompts" },
    ]),
  }),
  seethingswarm: Object.freeze({
    id: "seethingswarm" as const,
    title: { message: "animalSprites" as const },
    creator: "SeethingSwarm",
    license: { message: "licensedArtwork" as const },
    licenseUrl: "https://seethingswarm.itch.io/raccoonpack",
    sources: Object.freeze([
      Object.freeze({
        label: "Chickenpack",
        url: "https://seethingswarm.itch.io/chickenpack",
      }),
      Object.freeze({
        label: "Bunnypack",
        url: "https://seethingswarm.itch.io/bunnypack",
      }),
      Object.freeze({
        label: "Dogpack",
        url: "https://seethingswarm.itch.io/dogpack",
      }),
      Object.freeze({
        label: "Catset",
        url: "https://seethingswarm.itch.io/catset",
      }),
      Object.freeze({
        label: "Mousepack",
        url: "https://seethingswarm.itch.io/mousepack",
      }),
      Object.freeze({
        label: "Frogpack",
        url: "https://seethingswarm.itch.io/frogpack",
      }),
      Object.freeze({
        label: "Turtlepack",
        url: "https://seethingswarm.itch.io/turtlepack",
      }),
      Object.freeze({
        label: "Pandapack",
        url: "https://seethingswarm.itch.io/pandapack",
      }),
      Object.freeze({
        label: "Lil Otter",
        url: "https://seethingswarm.itch.io/lil-otter",
      }),
      Object.freeze({
        label: "Raccoonpack",
        url: "https://seethingswarm.itch.io/raccoonpack",
      }),
      Object.freeze({
        label: "Lil Axolotl",
        url: "https://seethingswarm.itch.io/lil-axolotl",
      }),
      Object.freeze({
        label: "Parrotpack",
        url: "https://seethingswarm.itch.io/parrotpack",
      }),
      Object.freeze({
        label: "Lil Hedgehog",
        url: "https://seethingswarm.itch.io/lil-hedgehog",
      }),
      Object.freeze({
        label: "Deerpack",
        url: "https://seethingswarm.itch.io/deerpack",
      }),
      Object.freeze({
        label: "Foxpack",
        url: "https://seethingswarm.itch.io/foxpack",
      }),
      Object.freeze({
        label: "Wolfpack",
        url: "https://seethingswarm.itch.io/wolfpack",
      }),
      Object.freeze({
        label: "Falconpack",
        url: "https://seethingswarm.itch.io/falconpack",
      }),
      Object.freeze({
        label: "Cranepack",
        url: "https://seethingswarm.itch.io/cranepack",
      }),
      Object.freeze({
        label: "Crowpack",
        url: "https://seethingswarm.itch.io/crowpack",
      }),
      Object.freeze({
        label: "Batpack",
        url: "https://seethingswarm.itch.io/batpack",
      }),
      Object.freeze({
        label: "Lil Ninja",
        url: "https://seethingswarm.itch.io/lil-ninja",
      }),
      Object.freeze({
        label: "Lil War Hero",
        url: "https://seethingswarm.itch.io/lil-war-hero",
      }),
      Object.freeze({
        label: "Dragonflypack",
        url: "https://seethingswarm.itch.io/dragonflypack",
      }),
    ]),
  }),
  captainskolot: Object.freeze({
    id: "captainskolot" as const,
    title: "Racoon Portrait Pack",
    creator: "CaptainSkolot",
    license: "CC BY 4.0",
    licenseTerms: "sourcePageTerms" as const,
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    sources: Object.freeze([
      Object.freeze({
        label: "Racoon Portrait Pack",
        url: "https://captainskolot.itch.io/racoon-portrait-pack-asset-pixelart-pixel-art-sprite-badass-bust-pack-rpg-vis",
      }),
    ]),
  }),
  greyfox: Object.freeze({
    id: "greyfox" as const,
    title: { message: "greyfoxFaces" as const },
    creator: "GreyFox / Kashir0",
    license: { message: "attributionRequired" as const },
    licenseUrl: "https://frfgreyfox.itch.io/chess-animal-asset-free",
    sources: Object.freeze([
      Object.freeze({
        label: "Chess-animals + ico assets",
        url: "https://frfgreyfox.itch.io/chess-animal-asset-free",
      }),
    ]),
  }),
  heroes99: Object.freeze({
    id: "heroes99" as const,
    title: "Heroes99",
    creator: "AU_pixel",
    license: { message: "licensedArtwork" as const },
    licenseUrl: "https://au-pixel.itch.io/heroes99",
    sources: Object.freeze([
      Object.freeze({
        label: "Heroes99",
        url: "https://au-pixel.itch.io/heroes99",
      }),
    ]),
  }),
  chessnut: Object.freeze({
    id: "chessnut" as const,
    title: "Chessnut",
    creator: "Alexis Luengas",
    license: "Apache License 2.0",
    licenseUrl: "https://www.apache.org/licenses/LICENSE-2.0",
    sources: Object.freeze([
      Object.freeze({
        label: { message: "chessnutSource" as const },
        url: "https://github.com/LexLuengas/chessnut-pieces",
      }),
    ]),
  }),
  skoll: Object.freeze({
    id: "skoll" as const,
    title: { message: "skollIcons" as const },
    creator: "Skoll",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    sources: Object.freeze([
      Object.freeze({
        label: { piece: "king" as const },
        url: "https://game-icons.net/1x1/skoll/chess-king.html",
      }),
      Object.freeze({
        label: { piece: "queen" as const },
        url: "https://game-icons.net/1x1/skoll/chess-queen.html",
      }),
      Object.freeze({
        label: { piece: "rook" as const },
        url: "https://game-icons.net/1x1/skoll/chess-rook.html",
      }),
      Object.freeze({
        label: { piece: "bishop" as const },
        url: "https://game-icons.net/1x1/skoll/chess-bishop.html",
      }),
      Object.freeze({
        label: { piece: "knight" as const },
        url: "https://game-icons.net/1x1/skoll/chess-knight.html",
      }),
      Object.freeze({
        label: { piece: "pawn" as const },
        url: "https://game-icons.net/1x1/skoll/chess-pawn.html",
      }),
    ]),
  }),
  "toffee-classical": Object.freeze({
    id: "toffee-classical" as const,
    title: "Chess Pixel — Classical",
    creator: "ToffeeCraft",
    license: { message: "licensedArtwork" as const },
    licenseUrl: "https://toffeecraft.itch.io/chess-pixel",
    sources: Object.freeze([
      Object.freeze({
        label: { message: "classical" as const },
        url: "https://toffeecraft.itch.io/chess-pixel",
      }),
    ]),
  }),
  "toffee-wood": Object.freeze({
    id: "toffee-wood" as const,
    title: "Chess Pixel — Wood",
    creator: "ToffeeCraft",
    license: { message: "licensedArtwork" as const },
    licenseUrl: "https://toffeecraft.itch.io/chess-pixel-wood",
    sources: Object.freeze([
      Object.freeze({
        label: { message: "wood" as const },
        url: "https://toffeecraft.itch.io/chess-pixel-wood",
      }),
    ]),
  }),
  "toffee-ice": Object.freeze({
    id: "toffee-ice" as const,
    title: "Chess Pixel — Ice",
    creator: "ToffeeCraft",
    license: { message: "licensedArtwork" as const },
    licenseUrl: "https://toffeecraft.itch.io/chess-pixel-ice",
    sources: Object.freeze([
      Object.freeze({
        label: { message: "ice" as const },
        url: "https://toffeecraft.itch.io/chess-pixel-ice",
      }),
    ]),
  }),
  backterria: Object.freeze({
    id: "backterria" as const,
    title: "The Chess",
    creator: "Backterria",
    license: { message: "licensedArtwork" as const },
    licenseUrl: "https://backterria.itch.io/the-chess",
    sources: Object.freeze([
      Object.freeze({
        label: "The Chess",
        url: "https://backterria.itch.io/the-chess",
      }),
    ]),
  }),
  cosunosuke: Object.freeze({
    id: "cosunosuke" as const,
    title: "32-bit Chess Asset Pack",
    creator: "Cosunosuke",
    license: { message: "creatorPermission" as const },
    licenseUrl: "https://cosunosuke.itch.io/31-bir-chess-asset-pack",
    sources: Object.freeze([
      Object.freeze({
        label: "32-bit Chess Asset Pack",
        url: "https://cosunosuke.itch.io/31-bir-chess-asset-pack",
      }),
    ]),
  }),
  "cat-chess": Object.freeze({
    id: "cat-chess" as const,
    title: "Cat chess set",
    creator: "OgreofWart @ DarkEvil ink.",
    license: "CC0 1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sources: Object.freeze([
      Object.freeze({
        label: "Cat chess set",
        url: "https://opengameart.org/content/cat-chess-set",
      }),
    ]),
  }),
}) satisfies Readonly<Record<keyof MapachessCatalog["credits"], ArtCredit>>

export type ArtCreditId = keyof typeof ART_CREDITS

export type LocalizedArtCredit = Readonly<{
  id: ArtCreditId
  title: string
  creator: string
  contribution: string
  license: string
  licenseUrl: string
  sources: readonly Readonly<{ label: string; url: string }>[]
  modifications: string | null
}>

export default function localizeArtCredits(
  copy: MapachessCatalog,
): readonly LocalizedArtCredit[] {
  const controls = copy.shared.creditControls
  const label = (value: CreditLabel): string => {
    if (typeof value === "string") return value
    return "message" in value
      ? controls.labels[value.message]
      : controls.pieceSource(copy.board.pieces[value.piece])
  }
  return Object.values(ART_CREDITS).map((credit) => {
    const description = copy.credits[credit.id]
    const license = label(credit.license)
    return {
      id: credit.id,
      title: label(credit.title),
      creator: credit.creator,
      contribution: description.contribution,
      modifications:
        "modifications" in description ? description.modifications : null,
      license:
        "licenseTerms" in credit
          ? controls.licenseWithTerms(
              license,
              controls.labels[credit.licenseTerms],
            )
          : license,
      licenseUrl: credit.licenseUrl,
      sources: credit.sources.map((source) => ({
        label: label(source.label),
        url: source.url,
      })),
    }
  })
}
