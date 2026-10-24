import { afterEach, describe, expect, it } from "vitest"
import loadCatalog, {
  CATALOG_LOADERS,
  getCatalogHealth,
} from "@mapachess/localization/catalog"
import createCatalogReader from "../../localization/src/catalogReader.js"
import localizeArtCredits, { ART_CREDITS } from "../src/artCredits.js"

afterEach(() => expect(getCatalogHealth().issues).toEqual([]))

describe("localized attribution with canonical provenance", () => {
  it("keeps creators, IDs and every source and license URL identical in both languages", () => {
    for (const locale of ["en", "es-419"] as const) {
      const credits = localizeArtCredits(loadCatalog(locale))
      expect(credits).toHaveLength(Object.keys(ART_CREDITS).length)
      for (const credit of credits) {
        const original = ART_CREDITS[credit.id]
        expect(credit.creator).toBe(original.creator)
        expect(credit.licenseUrl).toBe(original.licenseUrl)
        expect(credit.sources.map(({ url }) => url)).toEqual(
          original.sources.map(({ url }) => url),
        )
        if (typeof original.title === "string")
          expect(credit.title).toBe(original.title)
        for (const [index, source] of original.sources.entries()) {
          if (typeof source.label === "string")
            expect(credit.sources[index]?.label).toBe(source.label)
        }
      }
    }
  })

  it("preserves the existing English headings, summaries and piece link names", () => {
    const credits = localizeArtCredits(loadCatalog("en"))
    expect(credits.map(({ title }) => title)).toEqual([
      "Nunito Sans",
      "Mapachito ice cream",
      "Input Prompts",
      "Fluent Emoji",
      "Animal sprites",
      "Racoon Portrait Pack",
      "Chess-animals faces",
      "Heroes99",
      "Chessnut",
      "Game-icons chess icons",
      "Chess Pixel — Classical",
      "Chess Pixel — Wood",
      "Chess Pixel — Ice",
      "The Chess",
      "32-bit Chess Asset Pack",
      "Cat chess set",
    ])
    expect(credits.map(({ license }) => license)).toEqual([
      "SIL Open Font License 1.1",
      "All rights reserved; supplied for Mapachess",
      "CC0 1.0",
      "MIT",
      "Licensed game artwork",
      "CC BY 4.0; additional source-page terms",
      "Licensed game artwork; attribution required",
      "Licensed game artwork",
      "Apache License 2.0",
      "CC BY 3.0",
      "Licensed game artwork",
      "Licensed game artwork",
      "Licensed game artwork",
      "Licensed game artwork",
      "Creator-authorized game use; no standalone asset redistribution",
      "CC0 1.0",
    ])
    expect(
      credits
        .find(({ id }) => id === "skoll")
        ?.sources.map(({ label }) => label),
    ).toEqual(["King", "Queen", "Rook", "Bishop", "Knight", "Pawn"])
  })

  it("localizes descriptive metadata without translating original titles or license identifiers", () => {
    const credits = localizeArtCredits(loadCatalog("es-419"))
    expect(
      credits
        .filter(({ id }) =>
          ["mapachitoIdentity", "seethingswarm", "greyfox", "skoll"].includes(
            id,
          ),
        )
        .map(({ title }) => title),
    ).toEqual([
      "Helado de Mapachito",
      "Sprites de animales",
      "Caras de Chess-animals",
      "Iconos de ajedrez de Game-icons",
    ])
    expect(credits.find(({ id }) => id === "captainskolot")?.license).toBe(
      "CC BY 4.0; condiciones adicionales en la página de origen",
    )
    expect(credits.find(({ id }) => id === "greyfox")?.license).toBe(
      "Recursos gráficos con licencia para el juego; atribución obligatoria",
    )
    expect(credits.find(({ id }) => id === "cosunosuke")?.license).toBe(
      "Uso en el juego autorizado por el creador; se prohíbe redistribuir los recursos por separado",
    )
    expect(credits.find(({ id }) => id === "chessnut")?.sources[0]?.label).toBe(
      "Código fuente de Chessnut",
    )
    expect(
      credits
        .find(({ id }) => id === "skoll")
        ?.sources.map(({ label }) => label),
    ).toEqual(["Rey", "Dama", "Torre", "Alfil", "Caballo", "Peón"])
    expect(
      credits
        .filter(({ id }) => id.startsWith("toffee-"))
        .map(({ sources }) => sources[0]?.label),
    ).toEqual(["Clásicas", "Madera", "Hielo"])
  })

  it("corrects all eight audited Mexican Spanish terms without changing English or board identities", () => {
    const copy = loadCatalog("es-419")
    expect(copy.artwork.pieces).toMatchObject({
      "toffee-wood": "Toffee · madera",
      "toffee-ice": "Toffee · hielo",
      "back-fantasy-i-mono": "Fantasía I · blancas / negras",
      "back-fantasy-i-color": "Fantasía I · azules / rojas",
      "back-fantasy-i-earth": "Fantasía I · amarillas / verdes",
      "back-fantasy-ii-plain": "Fantasía II · sencillas",
      "back-fantasy-ii-gold": "Fantasía II · oro",
    })
    expect(copy.credits.backterria.contribution).toBe(
      "Piezas y tableros de ajedrez convencionales y de fantasía",
    )
    for (const id of ["toffee-wood", "toffee-ice"] as const)
      expect(copy.artwork.pieces[id]).toBe(copy.artwork.boards[id])
    expect(loadCatalog("en").artwork.pieces["back-fantasy-i-color"]).toBe(
      "Fantasy I · blue / red",
    )
  })

  it("recovers broken metadata copy and formatters while reporting the precise fallback paths", () => {
    const spanish = CATALOG_LOADERS["es-419"]()
    const reader = createCatalogReader({
      ...CATALOG_LOADERS,
      "es-419": () => ({
        ...spanish,
        shared: {
          ...spanish.shared,
          creditControls: {
            ...spanish.shared.creditControls,
            labels: {
              ...spanish.shared.creditControls.labels,
              animalSprites: null,
            },
            pieceSource: () => {
              throw new Error("Broken formatter")
            },
            licenseWithTerms: () => "",
          },
        },
      }),
    })
    const credits = localizeArtCredits(reader.load("es-419"))
    expect(credits.find(({ id }) => id === "seethingswarm")?.title).toBe(
      "Animal sprites",
    )
    expect(credits.find(({ id }) => id === "skoll")?.title).toBe(
      "Iconos de ajedrez de Game-icons",
    )
    expect(credits.find(({ id }) => id === "skoll")?.sources[1]?.label).toBe(
      "Dama",
    )
    expect(credits.find(({ id }) => id === "captainskolot")?.license).toBe(
      "CC BY 4.0; condiciones adicionales en la página de origen",
    )
    expect(new Set(reader.health().issues.map(({ path }) => path))).toEqual(
      new Set([
        "shared.creditControls.labels.animalSprites",
        "shared.creditControls.pieceSource",
        "shared.creditControls.licenseWithTerms",
      ]),
    )
    expect(
      reader.health().issues.every(({ recovery }) => recovery === "english"),
    ).toBe(true)
  })

  it("retains usable attribution links when both entire language catalogs are unavailable", () => {
    const reader = createCatalogReader({
      en: () => null,
      "es-419": () => undefined,
    })
    const credits = localizeArtCredits(reader.load("es-419"))
    expect(credits).toHaveLength(Object.keys(ART_CREDITS).length)
    expect(credits.find(({ id }) => id === "captainskolot")?.license).toContain(
      "CC BY 4.0",
    )
    for (const credit of credits) {
      expect(credit.title.length).toBeGreaterThan(0)
      expect(credit.license.length).toBeGreaterThan(0)
      expect(credit.sources.map(({ url }) => url)).toEqual(
        ART_CREDITS[credit.id].sources.map(({ url }) => url),
      )
    }
    expect(reader.health().issues.length).toBeGreaterThan(0)
    expect(
      reader.health().issues.every(({ recovery }) => recovery === "emergency"),
    ).toBe(true)
  })
})
