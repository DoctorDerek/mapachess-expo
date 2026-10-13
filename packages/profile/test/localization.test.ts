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
import {
  CHESS_BOARDS,
  CHESS_PIECE_SETS,
} from "../../match-presentation/src/chessAppearanceCatalog.js"
import { COACH_PORTRAITS } from "../../match-presentation/src/coachPortrait.js"
import { matchConclusionText } from "../../match/src/matchConclusion.js"

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

describe("American English player-facing catalog", () => {
  const copy = loadCatalog("en")

  it("formats counts and ratings without changing the stored values", () => {
    expect(copy.profile.ratedMatches(0)).toBe("0 rated matches")
    expect(copy.profile.ratedMatches(1)).toBe("1 rated match")
    expect(copy.profile.ratedMatches(2)).toBe("2 rated matches")
    expect(copy.gameplay.elo(445.21238123123)).toBe("445")
    expect(copy.gameplay.elo(1200.5)).toBe("1201")
    expect(copy.profile.rating("Standard Chess", 1200.5)).toBe(
      "Standard Chess · 1201 Elo",
    )
    expect(copy.gameplay.xpProgress(1000, 2000)).toBe("1,000 / 2,000 XP")
    expect(copy.gameplay.storyCompletion(12.345)).toBe("12.3%")
  })

  it("owns every selectable artwork and coach label without changing their IDs", () => {
    expect(Object.keys(copy.artwork.pieces).sort()).toEqual(
      CHESS_PIECE_SETS.map(({ id }) => id).sort(),
    )
    expect(Object.keys(copy.artwork.boards).sort()).toEqual(
      CHESS_BOARDS.map(({ id }) => id).sort(),
    )
    for (const piece of CHESS_PIECE_SETS)
      expect(copy.artwork.pieces[piece.id]).toBe(piece.label)
    for (const board of CHESS_BOARDS)
      expect(copy.artwork.boards[board.id]).toBe(board.label)
    expect(Object.keys(copy.shared.coachPortraitNames).sort()).toEqual(
      COACH_PORTRAITS.map(({ label }) => label).sort(),
    )
  })

  it("keeps whole hint announcements distinct for player and opponent on the unchanged board", () => {
    expect(
      copy.gameplay.hints.piecesShown(["e2", "d2", "g1"], ["e7", "d7", "g8"]),
    ).toBe(
      "Piece Hints shown. Player Piece Hints: e2, d2, g1. Opponent Piece Hints: e7, d7, g8.",
    )
    expect(copy.gameplay.hints.movesShown([], [])).toBe(
      "Move Hints shown. Player Move Hints: none. Opponent Move Hints: none.",
    )
    expect(copy.gameplay.hints.castle("queen", "c1", "a1", "d1")).toBe(
      "castle queenside, king to c1, rook from a1 to d1",
    )
  })

  it("describes square facts without changing move ownership or legality", () => {
    expect(
      copy.board.square(
        "e2",
        { color: "white", role: "pawn" },
        true,
        false,
        false,
        [copy.board.pieceHint("player")],
      ),
    ).toBe("e2, White pawn, selected, Player Piece Hint")
    expect(copy.board.square("e4", undefined, false, true, true, [])).toBe(
      "e4, empty, legal destination, board not accepting moves",
    )
    expect(copy.board.promote("knight")).toBe("Promote to knight")
  })

  it("preserves evaluation signs, bounds and mate ownership", () => {
    expect(copy.evaluation.centipawns(125, "exact")).toBe("+1.25")
    expect(copy.evaluation.centipawns(-125, "lower")).toBe("≥ −1.25")
    expect(copy.evaluation.centipawns(0, "upper")).toBe("≤ 0.00")
    expect(copy.evaluation.mate("black", 0, "exact")).toBe("Black checkmate")
    expect(copy.evaluation.mate("white", 3, "upper")).toBe(
      "White M3 · upper bound",
    )
  })

  it("selects conclusions by semantic facts, not English labels", () => {
    const conclusionCopy = {
      ...copy.gameplay.conclusion,
      playerWon: "Selected catalog victory",
      stalemate: "Selected catalog stalemate",
      opponentWon: (name: string): string => `Selected catalog winner: ${name}`,
    }
    expect(
      matchConclusionText(
        { type: "checkmate", winner: "white" },
        "white",
        "Chicken Stockfish",
        conclusionCopy,
      ),
    ).toBe("Selected catalog victory")
    expect(
      matchConclusionText(
        { type: "checkmate", winner: "black" },
        "white",
        "Chicken Stockfish",
        conclusionCopy,
      ),
    ).toBe("Selected catalog winner: Chicken Stockfish")
    expect(
      matchConclusionText(
        { type: "stalemate" },
        "white",
        "Chicken Stockfish",
        conclusionCopy,
      ),
    ).toBe("Selected catalog stalemate")
  })

  it("keeps typed message parameters while allowing different wording", () => {
    expectTypeOf<MapachessCatalog["board"]["promote"]>()
      .parameter(0)
      .toEqualTypeOf<"bishop" | "king" | "knight" | "pawn" | "queen" | "rook">()
    expectTypeOf<MapachessCatalog["profile"]["ratedMatches"]>()
      .parameter(0)
      .toEqualTypeOf<number>()
    expectTypeOf<
      MapachessCatalog["setup"]["variants"]["standard"]
    >().toEqualTypeOf<string>()
  })
})
