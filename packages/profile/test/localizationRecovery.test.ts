import { describe, expect, it, vi } from "vitest"
import { CATALOG_LOADERS } from "../../localization/src/catalog.js"
import { MAX_CATALOG_ISSUES } from "../../localization/src/catalogIssues.js"
import createCatalogReader from "../../localization/src/catalogReader.js"
import english from "../../localization/src/en.js"
import { SHIPPED_LOCALES } from "../../localization/src/locale.js"
import {
  isMessageRows,
  isMessageText,
  readMember,
  readMessage,
  UNAVAILABLE_TEXT,
} from "../../localization/src/messageRecovery.js"
import validateCatalog from "../../localization/src/validateCatalog.js"
import formatterExamples from "./fixtures/localizationFormatters.js"

const thresholds = {
  brilliantGain: 10,
  geniusGain: 5,
  inaccuracyLoss: 5,
  mistakeLoss: 10,
  blunderLoss: 20,
}

describe("catalog quality gates before recovery", () => {
  it("validates every raw shipped catalog and exercises every formatter without fallbacks", () => {
    for (const locale of SHIPPED_LOCALES) {
      const loader = CATALOG_LOADERS[locale]
      expect(validateCatalog(loader), locale).toEqual([])
      const raw = loader()
      const reader = createCatalogReader(CATALOG_LOADERS)
      const copy = reader.load(locale)
      for (const [path, examples] of Object.entries(formatterExamples)) {
        const resolve = (root: unknown) =>
          path.split(".").reduce(
            readMember,
            readMessage(() => root),
          )
        const rawRead = resolve(raw)
        const safeRead = resolve(copy)
        if (
          !rawRead.ok ||
          typeof rawRead.value !== "function" ||
          !safeRead.ok ||
          typeof safeRead.value !== "function"
        ) {
          throw new Error(`Missing formatter: ${path}`)
        }
        for (const parameters of examples) {
          const original: unknown = Reflect.apply(
            rawRead.value,
            undefined,
            parameters,
          )
          const resolved: unknown = Reflect.apply(
            safeRead.value,
            undefined,
            parameters,
          )
          expect(
            path.startsWith("classification.")
              ? isMessageRows(original)
              : isMessageText(original),
            path,
          ).toBe(true)
          expect(JSON.stringify(original), path).not.toMatch(/undefined|NaN/)
          expect(resolved, path).toEqual(original)
        }
      }
      expect(reader.health()).toEqual({ issues: [], limitReached: false })
    }
  })

  it("rejects an unrepaired defect even when the repaired result is identical to English", () => {
    const broken = {
      ...english,
      introduction: { ...english.introduction, start: undefined },
    }
    const reader = createCatalogReader({
      en: () => english,
      "es-419": () => broken,
    })
    expect(reader.load("es-419").introduction.start).toBe(
      english.introduction.start,
    )
    expect(validateCatalog(() => broken)).toEqual([
      { path: "introduction.start", reason: "missing" },
    ])
    expect(reader.health()).toEqual({
      limitReached: false,
      issues: [
        {
          locale: "es-419",
          path: "introduction.start",
          source: "selected",
          reason: "missing",
          recovery: "english",
        },
      ],
    })
  })

  it("detects extra keys, invalid branches, throwing loaders and getters in raw catalogs", () => {
    expect(
      validateCatalog(() => ({ ...english, unexpected: "Extra" })),
    ).toEqual([{ path: "$.unexpected", reason: "extra" }])
    expect(validateCatalog(() => ({ ...english, board: 3 }))).toEqual([
      { path: "board", reason: "invalid" },
    ])
    expect(
      validateCatalog(() => {
        throw new Error("Unavailable")
      }),
    ).toEqual([{ path: "$", reason: "threw" }])
    expect(
      validateCatalog(() => ({
        ...english,
        get board() {
          throw new Error("Private contents")
        },
      })),
    ).toEqual([{ path: "board", reason: "threw" }])
  })
})

describe("shared message recovery", () => {
  it.each([undefined, null, 42, false, {}, [], "", "  "])(
    "recovers a damaged label: %j",
    (start) => {
      const reader = createCatalogReader({
        en: () => english,
        "es-419": () => ({
          ...english,
          introduction: { ...english.introduction, start },
        }),
      })
      const copy = reader.load("es-419")
      expect(copy.introduction.start).toBe("Start")
      expect(copy.introduction.paragraphs[0]?.lead).toBe("")
      expect(reader.health()).toEqual({
        limitReached: false,
        issues: [
          {
            locale: "es-419",
            path: "introduction.start",
            source: "selected",
            reason: start == null ? "missing" : "invalid",
            recovery: "english",
          },
        ],
      })
    },
  )

  it("keeps source catalogs untouched and returns a deeply immutable, cached view", () => {
    const loader = vi.fn(() => english)
    const reader = createCatalogReader({ en: loader })
    const copy = reader.load("en")
    expect(reader.load("en")).toBe(copy)
    expect(loader).toHaveBeenCalledTimes(1)
    expect(Object.isFrozen(copy.profile.dressing)).toBe(true)
    expect(Object.isFrozen(copy.introduction.paragraphs[0])).toBe(true)
    expect(Object.isFrozen(copy.classification.table(thresholds)[0])).toBe(true)
    expect(english.introduction.start).toBe("Start")
    expect(reader.health().issues).toEqual([])
  })

  it("repairs missing branches and malformed paragraphs without erasing healthy siblings", () => {
    const selected = {
      ...english,
      board: null,
      introduction: {
        ...english.introduction,
        title: "Selected title",
        paragraphs: [null],
      },
    }
    const reader = createCatalogReader({
      en: () => english,
      "es-419": () => selected,
    })
    const copy = reader.load("es-419")
    expect(copy.introduction.title).toBe("Selected title")
    expect(copy.introduction.paragraphs).toEqual(
      english.introduction.paragraphs,
    )
    expect(
      copy.board.square(
        "e2",
        { color: "white", role: "pawn" },
        false,
        false,
        false,
        [],
      ),
    ).toBe(
      english.board.square(
        "e2",
        { color: "white", role: "pawn" },
        false,
        false,
        false,
        [],
      ),
    )
    expect(
      reader
        .health()
        .issues.every(
          ({ path, recovery }) =>
            (path.startsWith("board.") ||
              path.startsWith("introduction.paragraphs.")) &&
            recovery === "english",
        ),
    ).toBe(true)
    expect(reader.health().issues.length).toBeGreaterThan(0)
  })

  it.each([
    { formatter: undefined, reason: "missing" },
    { formatter: "not callable", reason: "invalid" },
    {
      formatter: () => {
        throw new Error("Private formatter context")
      },
      reason: "threw",
    },
    { formatter: () => "", reason: "invalid" },
    { formatter: () => ({ text: "wrong shape" }), reason: "invalid" },
  ])(
    "recovers $reason formatters, preserves arguments and records exact provenance",
    ({ formatter, reason }) => {
      const fallback = vi.fn(english.gameplay.xpProgress)
      const reader = createCatalogReader({
        en: () => ({
          ...english,
          gameplay: { ...english.gameplay, xpProgress: fallback },
        }),
        "es-419": () => ({
          ...english,
          gameplay: { ...english.gameplay, xpProgress: formatter },
        }),
      })
      const copy = reader.load("es-419")
      expect(copy.gameplay.xpProgress(1000, 2000)).toBe("1,000 / 2,000 XP")
      expect(fallback).toHaveBeenCalledExactlyOnceWith(1000, 2000)
      expect(reader.health()).toEqual({
        limitReached: false,
        issues: [
          {
            locale: "es-419",
            path: "gameplay.xpProgress",
            source: "selected",
            reason,
            recovery: "english",
          },
        ],
      })
      expect(JSON.stringify(reader.health())).not.toContain("Private formatter")
    },
  )

  it("does not invoke a fallback formatter when the selected formatter works", () => {
    const fallback = vi.fn(english.gameplay.xpProgress)
    const reader = createCatalogReader({
      en: () => ({
        ...english,
        gameplay: { ...english.gameplay, xpProgress: fallback },
      }),
      "es-419": () => english,
    })
    expect(reader.load("es-419").gameplay.xpProgress(1, 2)).toBe("1 / 2 XP")
    expect(fallback).not.toHaveBeenCalled()
    expect(reader.health().issues).toEqual([])
  })

  it("contains throwing accessors rather than letting them break the fallback UI", () => {
    const broken = {
      ...english,
      introduction: {
        ...english.introduction,
        get language() {
          throw new Error("Private getter")
        },
      },
    }
    const reader = createCatalogReader({ en: () => broken })
    expect(reader.load("en").introduction.language).toBe("Language")
    expect(reader.health()).toEqual({
      limitReached: false,
      issues: [
        {
          locale: "en",
          path: "introduction.language",
          source: "selected",
          reason: "threw",
          recovery: "emergency",
        },
      ],
    })
  })

  it("keeps essential escape controls usable when both entire sources fail", () => {
    const loader = vi.fn(() => {
      throw new Error("Catalog unavailable")
    })
    const reader = createCatalogReader({ en: loader, "es-419": loader })
    const copy = reader.load("es-419")
    expect(copy.introduction.start).toBe("Start")
    expect(copy.introduction.language).toBe("Language")
    expect(copy.interface.recoverableView.tryAgain).toBe("Try again")
    expect(copy.interface.profileSettingsPanel.closeSettings).toBe(
      "Close settings",
    )
    expect(copy.interface.profileRecoveryPanel.cancel).toBe("Cancel")
    expect(copy.interface.profileRecoveryPanel.resetAllLocalPlayerData2).toBe(
      "Reset local data",
    )
    expect(copy.profile.resetSubmit).toBe("Reset Elo")
    expect(copy.gameplay.xpProgress(500, 1000)).toBe(UNAVAILABLE_TEXT)
    expect(copy.classification.table(thresholds)).toEqual([])
    expect(copy.introduction.paragraphs).toHaveLength(5)
    expect(reader.load("es-419")).toBe(copy)
    expect(loader).toHaveBeenCalledTimes(2)
    expect(reader.health().issues).toHaveLength(MAX_CATALOG_ISSUES)
    expect(reader.health().limitReached).toBe(true)
  })

  it.each([
    null,
    "",
    [["Only one column"]],
    [["Label", 3]],
    [["Label", ""]],
    [],
  ])("rejects malformed table rows: %j", (rows) => {
    const reader = createCatalogReader({
      en: () => english,
      "es-419": () => ({
        ...english,
        classification: { ...english.classification, table: () => rows },
      }),
    })
    expect(reader.load("es-419").classification.table(thresholds)).toEqual(
      english.classification.table(thresholds),
    )
    expect(reader.health()).toEqual({
      limitReached: false,
      issues: [
        {
          locale: "es-419",
          path: "classification.table",
          source: "selected",
          reason: rows === null ? "missing" : "invalid",
          recovery: "english",
        },
      ],
    })
  })

  it("does not recursively retry the same English formatter or grow diagnostics on rerender", () => {
    const formatter = vi.fn(() => {
      throw new Error("Formatting unavailable")
    })
    const reader = createCatalogReader({
      en: () => ({
        ...english,
        gameplay: { ...english.gameplay, elo: formatter },
      }),
    })
    const copy = reader.load("en")
    for (let count = 0; count < 1000; count += 1)
      expect(copy.gameplay.elo(445.2)).toBe(UNAVAILABLE_TEXT)
    expect(formatter).toHaveBeenCalledTimes(1000)
    expect(reader.health()).toEqual({
      limitReached: false,
      issues: [
        {
          locale: "en",
          path: "gameplay.elo",
          source: "selected",
          reason: "threw",
          recovery: "emergency",
        },
      ],
    })
  })

  it("does not call a shared failing formatter twice when the catalogs are different objects", () => {
    const formatter = vi.fn(() => {
      throw new Error("Shared formatter failure")
    })
    const source = {
      ...english,
      gameplay: { ...english.gameplay, elo: formatter },
    }
    const reader = createCatalogReader({
      en: () => source,
      "es-419": () => ({ ...source }),
    })
    expect(reader.load("es-419").gameplay.elo(100)).toBe(UNAVAILABLE_TEXT)
    expect(formatter).toHaveBeenCalledTimes(1)
    expect(reader.health()).toEqual({
      limitReached: false,
      issues: [
        {
          locale: "es-419",
          path: "gameplay.elo",
          source: "selected",
          reason: "threw",
          recovery: "emergency",
        },
        {
          locale: "es-419",
          path: "gameplay.elo",
          source: "english",
          reason: "threw",
          recovery: "emergency",
        },
      ],
    })
  })

  it("keeps the selected rating explicit in emergency destructive controls without inventing numbers", () => {
    const reader = createCatalogReader({ en: () => null })
    const copy = reader.load("en")
    expect(copy.profile.rating("Chess960", 1234)).toBe(
      "Chess960 Elo unavailable",
    )
    expect(copy.profile.resetRating("Chess960")).toBe("Reset Chess960 Elo")
    expect(copy.profile.resetQuestion("Chess960")).toBe("Reset Chess960 Elo?")
    expect(copy.profile.resetConfirmation("Standard Chess")).toBe(
      "Reset Standard Chess Elo",
    )
    expect(copy.setup.presentations.standard.challenge.title).toBe(
      "Standard Chess Challenge",
    )
    expect(copy.setup.presentations.chess960.story.title).toBe("Chess960 Story")
  })

  it("survives a missing Intl implementation during module loading and formatter invocation", async () => {
    vi.resetModules()
    vi.stubGlobal("Intl", undefined)
    try {
      const { default: load, getCatalogHealth } =
        await import("../../localization/src/catalog.js")
      const copy = load("en")
      expect(copy.introduction.start).toBe("Start")
      expect(copy.gameplay.elo(100)).toBe(UNAVAILABLE_TEXT)
      expect(copy.evaluation.centipawns(100, "exact")).toBe(UNAVAILABLE_TEXT)
      expect(copy.evaluation.draw).toBe("0.00")
      expect(
        getCatalogHealth().issues.map(({ path, reason }) => ({ path, reason })),
      ).toEqual([
        { path: "gameplay.elo", reason: "threw" },
        { path: "evaluation.centipawns", reason: "threw" },
      ])
    } finally {
      vi.unstubAllGlobals()
      vi.resetModules()
    }
  })

  it("contains accidentally asynchronous loaders and formatters without unhandled rejections", async () => {
    const reader = createCatalogReader({
      en: () => english,
      "es-419": async () => {
        throw new Error("Async loader")
      },
    })
    expect(reader.load("es-419").introduction.start).toBe("Start")
    expect(reader.health().issues[0]).toEqual({
      locale: "es-419",
      path: "$",
      source: "selected",
      reason: "invalid",
      recovery: "english",
    })
    const formatterReader = createCatalogReader({
      en: () => ({
        ...english,
        gameplay: {
          ...english.gameplay,
          elo: async () => {
            throw new Error("Async formatter")
          },
        },
      }),
    })
    expect(formatterReader.load("en").gameplay.elo(100)).toBe(UNAVAILABLE_TEXT)
    expect(formatterReader.health()).toEqual({
      limitReached: false,
      issues: [
        {
          locale: "en",
          path: "gameplay.elo",
          source: "selected",
          reason: "invalid",
          recovery: "emergency",
        },
      ],
    })
    await Promise.resolve()
  })
})
