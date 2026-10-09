import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import {
  MATCH_COLORS,
  MATCH_PIECE_ROLES,
} from "@mapachess/match/match-position"
import manifest from "../../../ghost_assets/chess-assets.manifest.json"
import provenance from "../../../ghost_assets/chess-assets.provenance.json"
import ANIMAL_OPPONENT_SOURCE_PACKS from "../src/animalOpponent.js"
import { ART_CREDITS } from "../src/artCredits.js"
import {
  CHESS_BOARDS,
  CHESS_PIECE_SETS,
} from "../src/chessAppearanceCatalog.js"

describe("prepared chess appearance", () => {
  it("keeps the unchanged defaults, independent catalogs and pending sources out", () => {
    expect(CHESS_PIECE_SETS[0]).toEqual({
      id: "current",
      label: "Mapachess default",
      kind: "unicode",
    })
    expect(CHESS_BOARDS[0]).toEqual({
      id: "current",
      label: "Mapachess blue / white",
      kind: "colors",
    })
    for (const catalog of [CHESS_BOARDS, CHESS_PIECE_SETS]) {
      expect(new Set(catalog.map((entry) => entry.id)).size).toBe(
        catalog.length,
      )
      expect(Object.isFrozen(catalog)).toBe(true)
      for (const entry of catalog) {
        expect(Object.isFrozen(entry)).toBe(true)
        expect(entry).not.toHaveProperty("unlock")
        expect(entry.id).not.toMatch(/greyfox/)
      }
    }
  })

  it("maps each role, side and board to the exact prepared source identity and geometry", async () => {
    const usedPaths = new Set<string>()
    for (const set of CHESS_PIECE_SETS) {
      if (set.kind === "unicode") continue
      expect(ART_CREDITS[set.credit]).toBeDefined()
      for (const color of MATCH_COLORS) {
        expect(Object.keys(set.pieces[color]).sort()).toEqual(
          [...MATCH_PIECE_ROLES].sort(),
        )
        for (const role of MATCH_PIECE_ROLES) {
          const image = set.pieces[color][role]
          const evidence = provenance.files.find(
            (file) =>
              "set" in file &&
              file.set === set.id &&
              file.color === color &&
              file.role === role,
          )
          expect(evidence).toMatchObject({
            runtime: image.path,
            width: image.width,
            height: image.height,
          })
          usedPaths.add(image.path)
        }
      }
    }
    for (const board of CHESS_BOARDS) {
      if (board.kind === "colors") continue
      expect(ART_CREDITS[board.credit]).toBeDefined()
      const evidence = provenance.files.find(
        (file) => "board" in file && file.board.toLowerCase() === board.id,
      )
      expect(evidence).toMatchObject({
        runtime: board.image.path,
        width: board.image.width,
        height: board.image.height,
      })
      usedPaths.add(board.image.path)
    }
    expect(usedPaths).toEqual(
      new Set(provenance.files.map((file) => file.runtime)),
    )
    for (const file of manifest.files) {
      expect(usedPaths.has(file.path)).toBe(true)
      expect(
        provenance.files.find((entry) => entry.runtime === file.path)?.sha256,
      ).toBe(file.sha256)
      expect(file.path).toMatch(
        /^(backterria|toffee-(classical|wood|ice)|cosunosuke)\/.+\.png$/,
      )
    }
    for (const file of provenance.files) {
      if (manifest.files.some((entry) => entry.path === file.runtime)) continue
      const bytes = await readFile(
        new URL(
          `../../../apps/web/public/chess-assets/${file.runtime}`,
          import.meta.url,
        ),
      )
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(file.sha256)
    }
  })

  it("keeps Cosunosuke's two authored sides, exact role cells and frameless board", () => {
    const pieces = CHESS_PIECE_SETS.find(({ id }) => id === "cosunosuke")
    expect(pieces).toMatchObject({
      credit: "cosunosuke",
      delivery: "protected-chess",
      rendering: "pixelated",
    })
    const roles = ["king", "queen", "bishop", "knight", "rook", "pawn"]
    for (const [row, color] of ["white", "black"].entries())
      for (const [column, role] of roles.entries())
        expect(
          provenance.files.find(
            (file) =>
              "set" in file &&
              file.set === "cosunosuke" &&
              file.color === color &&
              file.role === role,
          ),
        ).toMatchObject({
          source: "cosunosuke/32-bit chess/pieces.png",
          runtime: `cosunosuke/pieces/${color}-${role}.png`,
          width: 32,
          height: 32,
          crop: { left: column * 32, top: row * 32, width: 32, height: 32 },
        })
    const board = provenance.files.find(
      (file) => "board" in file && file.board === "cosunosuke",
    )
    expect(board).toMatchObject({
      source: "cosunosuke/32-bit chess/board_frameless.png",
      runtime: "cosunosuke/boards/cosunosuke.png",
      width: 256,
      height: 256,
      crop: null,
    })
    expect(board?.sha256).toBe(board?.sourceSha256)
    expect(
      manifest.files.filter(({ path }) => path.startsWith("cosunosuke/")),
    ).toHaveLength(13)
  })

  it("retains source and license links for every artist, including CC0", () => {
    for (const credit of Object.values(ART_CREDITS)) {
      expect(credit.creator.length).toBeGreaterThan(0)
      expect(credit.licenseUrl).toMatch(/^https:\/\//)
      expect(credit.sources.length).toBeGreaterThan(0)
      for (const source of credit.sources) {
        expect(source.url).toMatch(/^https:\/\//)
        expect(source.label.length).toBeGreaterThan(0)
      }
    }
    expect(ART_CREDITS["cat-chess"].license).toBe("CC0 1.0")
    expect(ART_CREDITS.skoll.modifications).toContain("outlines")
  })

  it("records Cosunosuke's permission and attribution without relicensing the art", async () => {
    const credit = ART_CREDITS.cosunosuke
    expect(credit.creator).toBe("Cosunosuke")
    expect(credit.license).toContain("no standalone asset redistribution")
    const notice = await readFile(
      new URL(
        "../../../ghost_assets/licenses/cosunosuke/LICENSE.txt",
        import.meta.url,
      ),
      "utf8",
    )
    expect(notice).toContain(credit.licenseUrl)
    expect(notice).toContain("Cosunosuke replied:")
    expect(notice).toContain("aren't redistributed as a standalone package")
  })

  it("credits every shipped animal source in game and in the repository notice", async () => {
    const sources = ART_CREDITS.seethingswarm.sources
    expect(sources.map(({ label }) => label)).toEqual(
      Object.values(ANIMAL_OPPONENT_SOURCE_PACKS).map(([primary]) => primary),
    )
    expect(new Set(sources.map(({ url }) => url)).size).toBe(sources.length)
    const notice = await readFile(
      new URL("../../../ghost_assets/LICENSE.txt", import.meta.url),
      "utf8",
    )
    for (const { url } of sources) expect(notice).toContain(url)
  })
})
