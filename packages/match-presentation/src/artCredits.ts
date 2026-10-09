type ArtCredit = Readonly<{
  title: string
  creator: string
  contribution: string
  license: string
  licenseUrl: string
  sources: readonly Readonly<{ label: string; url: string }>[]
  modifications: string | null
}>

export const ART_CREDITS = Object.freeze({
  seethingswarm: Object.freeze({
    title: "Animal sprites",
    creator: "SeethingSwarm",
    contribution: "Battle animals and profile-card companions",
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
    title: "Racoon Portrait Pack",
    creator: "CaptainSkolot",
    contribution: "Mapachito coach reactions",
    license: "CC BY 4.0; additional source-page terms",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    sources: Object.freeze([
      Object.freeze({
        label: "Racoon Portrait Pack",
        url: "https://captainskolot.itch.io/racoon-portrait-pack-asset-pixelart-pixel-art-sprite-badass-bust-pack-rpg-vis",
      }),
    ]),
    modifications: "Portraits extracted from the supplied atlas.",
  }),
  greyfox: Object.freeze({
    title: "Chess-animals faces",
    creator: "GreyFox / Kashir0",
    contribution: "Optional animal-face coach reactions",
    license: "Licensed game artwork; attribution required",
    licenseUrl: "https://frfgreyfox.itch.io/chess-animal-asset-free",
    sources: Object.freeze([
      Object.freeze({
        label: "Chess-animals + ico assets",
        url: "https://frfgreyfox.itch.io/chess-animal-asset-free",
      }),
    ]),
    modifications: "Unmodified faces assigned to Mapachess reaction labels.",
  }),
  heroes99: Object.freeze({
    title: "Heroes99",
    creator: "AU_pixel",
    contribution: "Layered profile-card characters, clothing and weapons",
    license: "Licensed game artwork",
    licenseUrl: "https://au-pixel.itch.io/heroes99",
    sources: Object.freeze([
      Object.freeze({
        label: "Heroes99",
        url: "https://au-pixel.itch.io/heroes99",
      }),
    ]),
    modifications: "Idle frames extracted for layered game compositions.",
  }),
  chessnut: Object.freeze({
    title: "Chessnut",
    creator: "Alexis Luengas",
    contribution: "Vector chess pieces",
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
    title: "Game-icons chess icons",
    creator: "Skoll",
    contribution: "Vector chess pieces",
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
    modifications: "Contrasting outlines added to the original silhouettes.",
  }),
  "toffee-classical": Object.freeze({
    title: "Chess Pixel — Classical",
    creator: "ToffeeCraft",
    contribution: "Pixel-art chess pieces and boards",
    license: "Licensed game artwork",
    licenseUrl: "https://toffeecraft.itch.io/chess-pixel",
    sources: Object.freeze([
      Object.freeze({
        label: "Classical",
        url: "https://toffeecraft.itch.io/chess-pixel",
      }),
    ]),
    modifications: "Playable board areas and individual pieces extracted.",
  }),
  "toffee-wood": Object.freeze({
    title: "Chess Pixel — Wood",
    creator: "ToffeeCraft",
    contribution: "Pixel-art chess pieces and board",
    license: "Licensed game artwork",
    licenseUrl: "https://toffeecraft.itch.io/chess-pixel-wood",
    sources: Object.freeze([
      Object.freeze({
        label: "Wood",
        url: "https://toffeecraft.itch.io/chess-pixel-wood",
      }),
    ]),
    modifications: "Playable board area and individual pieces extracted.",
  }),
  "toffee-ice": Object.freeze({
    title: "Chess Pixel — Ice",
    creator: "ToffeeCraft",
    contribution: "Pixel-art chess pieces and board",
    license: "Licensed game artwork",
    licenseUrl: "https://toffeecraft.itch.io/chess-pixel-ice",
    sources: Object.freeze([
      Object.freeze({
        label: "Ice",
        url: "https://toffeecraft.itch.io/chess-pixel-ice",
      }),
    ]),
    modifications: "Playable board area and individual pieces extracted.",
  }),
  backterria: Object.freeze({
    title: "The Chess",
    creator: "Backterria",
    contribution: "Conventional and Fantasy chess pieces and boards",
    license: "Licensed game artwork",
    licenseUrl: "https://backterria.itch.io/the-chess",
    sources: Object.freeze([
      Object.freeze({
        label: "The Chess",
        url: "https://backterria.itch.io/the-chess",
      }),
    ]),
    modifications: "Playable board areas and authored sprite cells extracted.",
  }),
  cosunosuke: Object.freeze({
    title: "32-bit Chess Asset Pack",
    creator: "Cosunosuke",
    contribution: "Gold and blue pixel-art chess pieces and slate board",
    license: "Creator-authorized game use; no standalone asset redistribution",
    licenseUrl: "https://cosunosuke.itch.io/31-bir-chess-asset-pack",
    sources: Object.freeze([
      Object.freeze({
        label: "32-bit Chess Asset Pack",
        url: "https://cosunosuke.itch.io/31-bir-chess-asset-pack",
      }),
    ]),
    modifications:
      "Individual piece cells extracted; original colors and frameless board retained.",
  }),
  "cat-chess": Object.freeze({
    title: "Cat chess set",
    creator: "OgreofWart @ DarkEvil ink.",
    contribution: "Cat-themed chess pieces and board",
    license: "CC0 1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sources: Object.freeze([
      Object.freeze({
        label: "Cat chess set",
        url: "https://opengameart.org/content/cat-chess-set",
      }),
    ]),
    modifications:
      "Transparent margins trimmed; shared piece scale retained. Board cropped and rotated.",
  }),
}) satisfies Readonly<Record<string, ArtCredit>>

export type ArtCreditId = keyof typeof ART_CREDITS

export const ART_CREDITS_COPY = Object.freeze({
  title: "Credits",
  close: "Close Credits",
  externalLink: "opens in a new tab",
})
