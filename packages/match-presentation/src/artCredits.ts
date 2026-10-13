import loadCatalog from "@mapachess/localization/catalog"

type ArtCredit = Readonly<{
  id: string
  title: string
  creator: string
  contribution: string
  license: string
  licenseUrl: string
  sources: readonly Readonly<{ label: string; url: string }>[]
  modifications: string | null
}>

export const ART_CREDITS = Object.freeze({
  mapachitoIdentity: Object.freeze({
    id: "mapachitoIdentity" as const,
    title: "Mapachito ice cream",
    creator: "Dr. Derek Austin",
    contribution: loadCatalog("en").credits["mapachitoIdentity"].contribution,
    license: "All rights reserved; supplied for Mapachess",
    licenseUrl: "https://DoctorDerek.com",
    sources: Object.freeze([
      { label: "DoctorDerek.com", url: "https://DoctorDerek.com" },
    ]),
    modifications: null,
  }),
  kenney: Object.freeze({
    id: "kenney" as const,
    title: "Input Prompts",
    creator: "Kenney",
    contribution: loadCatalog("en").credits["kenney"].contribution,
    license: "CC0 1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sources: Object.freeze([
      { label: "Input Prompts", url: "https://kenney.nl/assets/input-prompts" },
    ]),
    modifications: loadCatalog("en").credits["kenney"].modifications,
  }),
  seethingswarm: Object.freeze({
    id: "seethingswarm" as const,
    title: "Animal sprites",
    creator: "SeethingSwarm",
    contribution: loadCatalog("en").credits["seethingswarm"].contribution,
    license: "Licensed game artwork",
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
    modifications: null,
  }),
  captainskolot: Object.freeze({
    id: "captainskolot" as const,
    title: "Racoon Portrait Pack",
    creator: "CaptainSkolot",
    contribution: loadCatalog("en").credits["captainskolot"].contribution,
    license: "CC BY 4.0; additional source-page terms",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    sources: Object.freeze([
      Object.freeze({
        label: "Racoon Portrait Pack",
        url: "https://captainskolot.itch.io/racoon-portrait-pack-asset-pixelart-pixel-art-sprite-badass-bust-pack-rpg-vis",
      }),
    ]),
    modifications: loadCatalog("en").credits["captainskolot"].modifications,
  }),
  greyfox: Object.freeze({
    id: "greyfox" as const,
    title: "Chess-animals faces",
    creator: "GreyFox / Kashir0",
    contribution: loadCatalog("en").credits["greyfox"].contribution,
    license: "Licensed game artwork; attribution required",
    licenseUrl: "https://frfgreyfox.itch.io/chess-animal-asset-free",
    sources: Object.freeze([
      Object.freeze({
        label: "Chess-animals + ico assets",
        url: "https://frfgreyfox.itch.io/chess-animal-asset-free",
      }),
    ]),
    modifications: loadCatalog("en").credits["greyfox"].modifications,
  }),
  heroes99: Object.freeze({
    id: "heroes99" as const,
    title: "Heroes99",
    creator: "AU_pixel",
    contribution: loadCatalog("en").credits["heroes99"].contribution,
    license: "Licensed game artwork",
    licenseUrl: "https://au-pixel.itch.io/heroes99",
    sources: Object.freeze([
      Object.freeze({
        label: "Heroes99",
        url: "https://au-pixel.itch.io/heroes99",
      }),
    ]),
    modifications: loadCatalog("en").credits["heroes99"].modifications,
  }),
  chessnut: Object.freeze({
    id: "chessnut" as const,
    title: "Chessnut",
    creator: "Alexis Luengas",
    contribution: loadCatalog("en").credits["chessnut"].contribution,
    license: "Apache License 2.0",
    licenseUrl: "https://www.apache.org/licenses/LICENSE-2.0",
    sources: Object.freeze([
      Object.freeze({
        label: "Chessnut source",
        url: "https://github.com/LexLuengas/chessnut-pieces",
      }),
    ]),
    modifications: null,
  }),
  skoll: Object.freeze({
    id: "skoll" as const,
    title: "Game-icons chess icons",
    creator: "Skoll",
    contribution: loadCatalog("en").credits["skoll"].contribution,
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    sources: Object.freeze([
      Object.freeze({
        label: "King",
        url: "https://game-icons.net/1x1/skoll/chess-king.html",
      }),
      Object.freeze({
        label: "Queen",
        url: "https://game-icons.net/1x1/skoll/chess-queen.html",
      }),
      Object.freeze({
        label: "Rook",
        url: "https://game-icons.net/1x1/skoll/chess-rook.html",
      }),
      Object.freeze({
        label: "Bishop",
        url: "https://game-icons.net/1x1/skoll/chess-bishop.html",
      }),
      Object.freeze({
        label: "Knight",
        url: "https://game-icons.net/1x1/skoll/chess-knight.html",
      }),
      Object.freeze({
        label: "Pawn",
        url: "https://game-icons.net/1x1/skoll/chess-pawn.html",
      }),
    ]),
    modifications: loadCatalog("en").credits["skoll"].modifications,
  }),
  "toffee-classical": Object.freeze({
    id: "toffee-classical" as const,
    title: "Chess Pixel — Classical",
    creator: "ToffeeCraft",
    contribution: loadCatalog("en").credits["toffee-classical"].contribution,
    license: "Licensed game artwork",
    licenseUrl: "https://toffeecraft.itch.io/chess-pixel",
    sources: Object.freeze([
      Object.freeze({
        label: "Classical",
        url: "https://toffeecraft.itch.io/chess-pixel",
      }),
    ]),
    modifications: loadCatalog("en").credits["toffee-classical"].modifications,
  }),
  "toffee-wood": Object.freeze({
    id: "toffee-wood" as const,
    title: "Chess Pixel — Wood",
    creator: "ToffeeCraft",
    contribution: loadCatalog("en").credits["toffee-wood"].contribution,
    license: "Licensed game artwork",
    licenseUrl: "https://toffeecraft.itch.io/chess-pixel-wood",
    sources: Object.freeze([
      Object.freeze({
        label: "Wood",
        url: "https://toffeecraft.itch.io/chess-pixel-wood",
      }),
    ]),
    modifications: loadCatalog("en").credits["toffee-wood"].modifications,
  }),
  "toffee-ice": Object.freeze({
    id: "toffee-ice" as const,
    title: "Chess Pixel — Ice",
    creator: "ToffeeCraft",
    contribution: loadCatalog("en").credits["toffee-ice"].contribution,
    license: "Licensed game artwork",
    licenseUrl: "https://toffeecraft.itch.io/chess-pixel-ice",
    sources: Object.freeze([
      Object.freeze({
        label: "Ice",
        url: "https://toffeecraft.itch.io/chess-pixel-ice",
      }),
    ]),
    modifications: loadCatalog("en").credits["toffee-ice"].modifications,
  }),
  backterria: Object.freeze({
    id: "backterria" as const,
    title: "The Chess",
    creator: "Backterria",
    contribution: loadCatalog("en").credits["backterria"].contribution,
    license: "Licensed game artwork",
    licenseUrl: "https://backterria.itch.io/the-chess",
    sources: Object.freeze([
      Object.freeze({
        label: "The Chess",
        url: "https://backterria.itch.io/the-chess",
      }),
    ]),
    modifications: loadCatalog("en").credits["backterria"].modifications,
  }),
  cosunosuke: Object.freeze({
    id: "cosunosuke" as const,
    title: "32-bit Chess Asset Pack",
    creator: "Cosunosuke",
    contribution: loadCatalog("en").credits["cosunosuke"].contribution,
    license: "Creator-authorized game use; no standalone asset redistribution",
    licenseUrl: "https://cosunosuke.itch.io/31-bir-chess-asset-pack",
    sources: Object.freeze([
      Object.freeze({
        label: "32-bit Chess Asset Pack",
        url: "https://cosunosuke.itch.io/31-bir-chess-asset-pack",
      }),
    ]),
    modifications: loadCatalog("en").credits["cosunosuke"].modifications,
  }),
  "cat-chess": Object.freeze({
    id: "cat-chess" as const,
    title: "Cat chess set",
    creator: "OgreofWart @ DarkEvil ink.",
    contribution: loadCatalog("en").credits["cat-chess"].contribution,
    license: "CC0 1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sources: Object.freeze([
      Object.freeze({
        label: "Cat chess set",
        url: "https://opengameart.org/content/cat-chess-set",
      }),
    ]),
    modifications: loadCatalog("en").credits["cat-chess"].modifications,
  }),
}) satisfies Readonly<Record<string, ArtCredit>>

export type ArtCreditId = keyof typeof ART_CREDITS

export const ART_CREDITS_COPY = loadCatalog("en").shared.creditControls
