import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { MATCH_MEDALS } from "@mapachess/profile/match-medal"
import MedalSymbol from "../../components/presentation/MedalSymbol"
import medalArtworkSource, { MEDAL_ICON_SIZE } from "./medalArtwork"

const UPSTREAM_SHA256 = {
  bronze: "b88e840433181b12ad1c1de0ab0e1fc84437b4c3f187f6a9e13013dfe4da7c32",
  silver: "cd9cea56595cdca5db22e0891499e5d1d033fb30bd03a77fe2836ecccbb97c80",
  gold: "3f4dc5626b0e9f62585d317572e9c11d8ec64856c3e82f03c16c40be3a31dae5",
} as const

describe("fixed Fluent 3D medal artwork", () => {
  it.each(MATCH_MEDALS)(
    "bundles the unmodified Microsoft %s medal",
    async (medal) => {
      const source = new URL(
        `../../../../packages/match-presentation/assets/medals/${medal}.png`,
        import.meta.url,
      )
      const bytes = await readFile(source)
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        UPSTREAM_SHA256[medal],
      )
      expect(bytes.readUInt32BE(16)).toBe(256)
      expect(bytes.readUInt32BE(20)).toBe(256)
    },
  )

  it.each(MATCH_MEDALS)(
    "renders %s as a decorative image with reserved dimensions",
    (medal) => {
      const source = medalArtworkSource(medal)
      const markup = renderToStaticMarkup(createElement(MedalSymbol, { medal }))
      expect(source).not.toMatch(/^https?:/)
      expect(markup).toContain(`src="${source}" alt="" aria-hidden="true"`)
      expect(markup).toContain(
        `width="${MEDAL_ICON_SIZE}" height="${MEDAL_ICON_SIZE}"`,
      )
      expect(markup).not.toMatch(/[🥇🥈🥉]/u)
      expect(markup).not.toContain("/_next/image?")
    },
  )

  it("uses three distinct images and retains their attribution", async () => {
    expect(new Set(MATCH_MEDALS.map(medalArtworkSource)).size).toBe(3)
    const license = await readFile(
      new URL(
        "../../../../packages/match-presentation/assets/medals/LICENSE.txt",
        import.meta.url,
      ),
      "utf8",
    )
    expect(license).toContain("Copyright (c) Microsoft Corporation.")
    expect(license).toContain("MIT License")
    expect(license).toContain("1ffb34c752ecf5d402f04cfb4b392c77f57c54bc")
  })
})
