import { describe, expect, expectTypeOf, it } from "vitest"
import loadCatalog, {
  CATALOG_LOADERS,
  type MapachessCatalog,
} from "../../localization/src/catalog.js"
import resolveLocale, {
  CANDIDATE_LOCALES,
  DEFAULT_LOCALE,
  isShippedLocale,
  LOCALE_LABELS,
  SHIPPED_LOCALES,
  type ShippedLocale,
} from "../../localization/src/locale.js"

describe("shared localization foundation", () => {
  it("keeps the shipped manifest, labels and typed loaders in agreement", () => {
    expect(SHIPPED_LOCALES).toEqual(["en"])
    expect(SHIPPED_LOCALES).toContain(DEFAULT_LOCALE)
    expect(new Set(CANDIDATE_LOCALES).size).toBe(CANDIDATE_LOCALES.length)
    expect(new Set(SHIPPED_LOCALES).size).toBe(SHIPPED_LOCALES.length)
    expect(Object.keys(LOCALE_LABELS)).toEqual(SHIPPED_LOCALES)
    expect(Object.keys(CATALOG_LOADERS)).toEqual(SHIPPED_LOCALES)
    expectTypeOf<keyof typeof CATALOG_LOADERS>().toEqualTypeOf<ShippedLocale>()
    expectTypeOf(loadCatalog).returns.toEqualTypeOf<MapachessCatalog>()
    for (const locale of SHIPPED_LOCALES) {
      expect(CANDIDATE_LOCALES).toContain(locale)
      expect(loadCatalog(locale)).toBe(CATALOG_LOADERS[locale]())
    }
  })

  it("keeps unshipped candidates and untrusted values out of selectable languages", () => {
    for (const value of [
      null,
      undefined,
      {},
      [],
      1,
      true,
      "en-US",
      "es-419",
      "",
    ])
      expect(isShippedLocale(value)).toBe(false)
    expect(isShippedLocale("en")).toBe(true)
    expect(resolveLocale({ selection: "es-419", preferences: ["es-MX"] })).toBe(
      "en",
    )
    expect(resolveLocale({ route: "zh-Hant", preferences: ["zh-TW"] })).toBe(
      "en",
    )
  })

  it.each([
    { selection: "en" as const, route: "unsupported", preferences: ["es-MX"] },
    { selection: "es-419" as const, route: "EN" },
    { route: "EN-us" },
    { preferences: ["unsupported", "en-GB"] },
    { preferences: ["EN-us"] },
    { preferences: [] },
    {},
  ])("resolves a safe shipped language from %j", (input) => {
    expect(resolveLocale(input)).toBe("en")
  })

  it("loads immutable local English without a network or asynchronous boot stage", () => {
    const catalog = loadCatalog("en")
    expect(Object.isFrozen(CANDIDATE_LOCALES)).toBe(true)
    expect(Object.isFrozen(SHIPPED_LOCALES)).toBe(true)
    expect(Object.isFrozen(LOCALE_LABELS)).toBe(true)
    expect(Object.isFrozen(CATALOG_LOADERS)).toBe(true)
    expect(Object.isFrozen(catalog)).toBe(true)
    expect(Object.isFrozen(catalog.introduction)).toBe(true)
    expect(Object.isFrozen(catalog.introduction.paragraphs)).toBe(true)
    expect(loadCatalog("en")).toBe(catalog)
  })

  it("contains nonblank required copy while retaining intentionally absent paragraph leads", () => {
    for (const locale of SHIPPED_LOCALES) {
      const { paragraphs, ...labels } = loadCatalog(locale).introduction
      for (const value of Object.values(labels))
        expect(value.trim()).not.toBe("")
      expect(paragraphs).toHaveLength(5)
      for (const { body, lead } of paragraphs) {
        expect(body.trim()).not.toBe("")
        if (lead !== "") expect(lead.trim()).not.toBe("")
      }
      expect(paragraphs.filter(({ lead }) => lead === "")).toHaveLength(2)
    }
  })
})
