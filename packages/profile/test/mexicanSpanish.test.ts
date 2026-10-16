import { describe, expect, it } from "vitest"
import loadCatalog from "../../localization/src/catalog.js"
import createCatalogReader from "../../localization/src/catalogReader.js"
import english from "../../localization/src/en.js"
import mexicanSpanish from "../../localization/src/esMx.js"
import {
  CHESS_BOARDS,
  CHESS_PIECE_SETS,
} from "../../match-presentation/src/chessAppearanceCatalog.js"
import { COACH_PORTRAITS } from "../../match-presentation/src/coachPortrait.js"
import { matchConclusionText } from "../../match/src/matchConclusion.js"

const copy = loadCatalog("es-419")

describe("Mexican Spanish player-facing catalog", () => {
  it.each([
    [0, "0 partidas con puntuación"],
    [1, "1 partida con puntuación"],
    [2, "2 partidas con puntuación"],
    [9001, "9001 partidas con puntuación"],
    [1_000_000, "1000000 de partidas con puntuación"],
    [2_000_000, "2000000 de partidas con puntuación"],
    [1_000_001, "1000001 partidas con puntuación"],
  ])("formats the reviewed match count %s", (count, expected) => {
    expect(copy.profile.ratedMatches(count)).toBe(expected)
  })

  it("uses Mexican number formatting without changing rating or XP values", () => {
    expect(copy.gameplay.elo(445.21238123123)).toBe("445")
    expect(copy.gameplay.targetElo(1200.5)).toBe("Elo objetivo: 1201")
    expect(copy.gameplay.xpProgress(1000, 2000)).toBe("1,000 / 2,000 XP")
    expect(copy.gameplay.storyCompletion(12.345)).toBe("12.3%")
    expect(copy.profile.cardDescription(9001, 445.2, 1200.5)).toBe(
      "Tu tarjeta de perfil: nivel 9001, Elo de ajedrez estándar 445, Elo de Chess960 1201",
    )
    expect(copy.evaluation.centipawns(125, "exact")).toBe("+1.25")
    expect(copy.evaluation.centipawns(-125, "lower")).toBe("≥ −1.25")
    expect(copy.evaluation.centipawns(0, "upper")).toBe("≤ 0.00")
  })

  it("keeps complete localized artwork and emotion identities", () => {
    expect(Object.keys(copy.artwork.pieces).sort()).toEqual(
      CHESS_PIECE_SETS.map(({ id }) => id).sort(),
    )
    expect(Object.keys(copy.artwork.boards).sort()).toEqual(
      CHESS_BOARDS.map(({ id }) => id).sort(),
    )
    expect(Object.keys(copy.shared.coachPortraitNames).sort()).toEqual(
      COACH_PORTRAITS.map(({ label }) => label).sort(),
    )
    expect(copy.shared.coachPortraitNames.hurt_low).toBe("Dolor leve")
    expect(copy.shared.coachPortraitNames.impressed_1).toBe(
      "Impresionado · retrato 11",
    )
    expect(copy.shared.coachPortraitNames.impressed_2).toBe(
      "Impresionado · retrato 14",
    )
  })

  it("keeps hint ownership, empty lists and Chess960 castling coordinates explicit", () => {
    expect(
      copy.gameplay.hints.piecesShown(["e2", "d2", "g1"], ["e7", "d7", "g8"]),
    ).toBe(
      "Pistas de piezas visibles. Pistas de piezas del jugador: e2, d2, g1. Pistas de piezas del oponente: e7, d7, g8.",
    )
    expect(copy.gameplay.hints.movesShown([], [])).toBe(
      "Pistas de movimientos visibles. Pistas de movimientos del jugador: ninguna. Pistas de movimientos del oponente: ninguna.",
    )
    expect(copy.gameplay.hints.castle("king", "g1", "f1", "f1")).toBe(
      "enroque corto, rey a g1, torre de f1 a f1",
    )
    expect(copy.gameplay.hints.castle("queen", "c8", "a8", "d8")).toBe(
      "enroque largo, rey a c8, torre de a8 a d8",
    )
    expect(copy.board.castle("O-O", "g1", "f1")).toBe(
      "Enroque O-O — rey a g1, torre a f1",
    )
  })

  it("uses side-based piece descriptions without incorrect gender agreement", () => {
    for (const role of [
      "bishop",
      "king",
      "knight",
      "pawn",
      "queen",
      "rook",
    ] as const)
      for (const color of ["white", "black"] as const)
        expect(
          copy.board.square("e2", { color, role }, false, false, false, []),
        ).toBe(
          `e2, ${copy.board.pieces[role]} de las ${color === "white" ? "blancas" : "negras"}`,
        )
    expect(copy.board.square("e4", undefined, true, true, true, [])).toBe(
      "e4, vacía, seleccionada, destino legal, el tablero no acepta movimientos",
    )
    expect(copy.board.promote("knight")).toBe("Promocionar a caballo")
  })

  it("names real recovery controls and preserves their safety promises", () => {
    expect(
      copy.interface.matchRecovery.yourPendingChangeIsRetainedButNot,
    ).toContain(copy.interface.matchRecovery.retrySave)
    expect(
      copy.interface.inputBindingSettings.changesApplyOnlyAfterSaveSucceedsTab,
    ).toContain(copy.interface.inputBindingSettings.saveControls)
    expect(copy.profile.importIssue.integrity).toContain(
      "Tus datos guardados no cambiaron.",
    )
    expect(copy.profile.persistenceFailure.conflict).toContain(
      "no los ha sobrescrito",
    )
    expect(copy.controls.requiredAction).toContain(
      "sin asignación en el control",
    )
    expect(copy.gameplay.retryTurn("Héroe de guerra Stockfish")).toBe(
      "Reintentar el turno de Héroe de guerra Stockfish",
    )
  })

  it("retains draw reasons, mate ownership and result semantics", () => {
    expect(copy.evaluation.mate("black", 0, "exact")).toBe(
      "Las negras dan jaque mate",
    )
    expect(copy.evaluation.mate("white", 3, "upper")).toBe(
      "Blancas M3 · límite superior",
    )
    expect(
      matchConclusionText(
        { type: "checkmate", winner: "white" },
        "white",
        "Pollo Stockfish",
        copy.gameplay.conclusion,
      ),
    ).toBe("¡Ganaste!")
    expect(
      matchConclusionText(
        { type: "checkmate", winner: "black" },
        "white",
        "Pollo Stockfish",
        copy.gameplay.conclusion,
      ),
    ).toBe("Pollo Stockfish ganó.")
    expect(
      matchConclusionText(
        { type: "stalemate" },
        "white",
        "Pollo Stockfish",
        copy.gameplay.conclusion,
      ),
    ).toBe("Tablas por ahogado.")
    expect(copy.gameplay.conclusion["insufficient-material"]).toBe(
      "Tablas por material insuficiente.",
    )
  })

  it("distinguishes singular unlocks and move hints from piece hints", () => {
    expect(copy.gameplay.challengeList(["Pollo Stockfish"])).toBe(
      "Desbloqueado para ambos modos Desafío: Pollo Stockfish",
    )
    expect(
      copy.gameplay.challengeList([
        "Pollo Stockfish",
        "Héroe de guerra Stockfish",
      ]),
    ).toBe(
      "Desbloqueados para ambos modos Desafío: Pollo Stockfish, Héroe de guerra Stockfish",
    )
    expect(copy.shared.medalHintUse.silver).toBe(
      "Usaste Pistas de piezas · sin Pistas de movimientos",
    )
    expect(copy.shared.medalHintUse.gold).toBe("No usaste pistas")
  })

  it.each([null, undefined, "", 42])(
    "recovers only a damaged Spanish label: %j",
    (start) => {
      const reader = createCatalogReader({
        en: () => english,
        "es-419": () => ({
          ...mexicanSpanish,
          introduction: { ...mexicanSpanish.introduction, start },
        }),
      })
      const recovered = reader.load("es-419")
      expect(recovered.introduction.start).toBe("Start")
      expect(recovered.introduction.language).toBe("Idioma")
      expect(recovered.gameplay.conclusion.playerWon).toBe("¡Ganaste!")
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
})
