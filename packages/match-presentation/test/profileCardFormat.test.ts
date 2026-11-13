import { describe, expect, it } from "vitest"
import {
  profileCardAnimationFrameCount,
  profileCardCharacterLayout,
} from "../src/profileCardFormat.js"

describe("shared personal artwork placement", () => {
  it("retains the authored live-card placement with and without its companion", () => {
    const viewport = {
      width: 360,
      height: 450,
      heroBounds: { width: 25, height: 31 },
    }
    expect(
      profileCardCharacterLayout({ ...viewport, animalBounds: null }),
    ).toEqual({
      hero: { x: 43, y: 55, width: 275, height: 341 },
      animal: null,
      ground: { x: 180, y: 396, radiusX: 115.2, radiusY: 9.450000000000001 },
    })
    expect(
      profileCardCharacterLayout({
        ...viewport,
        animalBounds: { width: 20, height: 20 },
      }),
    ).toMatchObject({
      hero: { x: 19, y: 86, width: 250, height: 310 },
      animal: { x: 213, y: 296, width: 100, height: 100 },
    })
  })

  it("fits a wide weapon without cropping and retains the export floor", () => {
    expect(
      profileCardCharacterLayout({
        width: 360,
        height: 450,
        heroBounds: { width: 45, height: 31 },
        animalBounds: { width: 20, height: 20 },
      }),
    ).toMatchObject({
      hero: { x: 32, y: 241, width: 225, height: 155 },
    })
    expect(
      profileCardCharacterLayout({
        width: 576,
        height: 470,
        heroBounds: { width: 25, height: 31 },
        animalBounds: { width: 20, height: 20 },
      }),
    ).toMatchObject({
      hero: { x: 93, y: 73, width: 275, height: 341 },
      animal: { x: 360, y: 294, width: 120, height: 120 },
      ground: { y: 414 },
    })
  })

  it("keeps layered poses on integral source-pixel scales and one common floor", () => {
    for (const width of [180, 360, 576, 960])
      for (const height of [240, 450, 470])
        for (const heroBounds of [
          { width: 25, height: 31 },
          { width: 25, height: 32 },
          { width: 45, height: 31 },
          { width: 30, height: 31 },
        ])
          for (const animalBounds of [
            null,
            { width: 20, height: 20 },
            { width: 47, height: 39 },
          ]) {
            const layout = profileCardCharacterLayout({
              width,
              height,
              heroBounds,
              animalBounds,
            })
            expect(Number.isInteger(layout.hero.width / heroBounds.width)).toBe(
              true,
            )
            expect(layout.hero.height / heroBounds.height).toBe(
              layout.hero.width / heroBounds.width,
            )
            expect(layout.hero.y + layout.hero.height).toBe(layout.ground.y)
            expect(layout.hero.x).toBeGreaterThanOrEqual(0)
            expect(layout.hero.x + layout.hero.width).toBeLessThanOrEqual(width)
            if (layout.animal !== null && animalBounds !== null) {
              expect(layout.animal.y + layout.animal.height).toBe(
                layout.ground.y,
              )
              expect(
                Number.isInteger(layout.animal.width / animalBounds.width),
              ).toBe(true)
              expect(layout.animal.height / animalBounds.height).toBe(
                layout.animal.width / animalBounds.width,
              )
              expect(layout.animal.x + layout.animal.width).toBeLessThanOrEqual(
                width,
              )
            }
          }
  })

  it("preserves a complete synchronized idle loop without changing pacing", () => {
    expect(profileCardAnimationFrameCount(6, 4)).toBe(12)
    expect(profileCardAnimationFrameCount(6, 1)).toBe(6)
    expect(profileCardAnimationFrameCount(6, 6)).toBe(6)
  })
})
