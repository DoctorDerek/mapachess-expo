import { describe, expect, it } from "vitest"
import type { SpriteFrameGeometry } from "../src/presentationAssetManifest"
import createSpritePresentationGeometry, {
  battleContactDistancePixels,
} from "../src/spritePresentationGeometry"

const REFERENCE_GEOMETRY = Object.freeze({
  bottomCenterX: 6,
  bottomY: 14,
  frameHeight: 16,
  frameWidth: 16,
  visibleHeight: 7,
  visibleWidth: 6,
  visibleX: 3,
  visibleY: 7,
}) satisfies SpriteFrameGeometry

describe("sprite presentation geometry", () => {
  it.each([
    [90, 170, 80],
    [150, 280, 130],
    [90.25, 170.5, 80],
    [170, 150, 0],
  ])(
    "closes the measured arena gap from %s to %s without crossing an overlap",
    (leftEdge, rightEdge, distance) => {
      expect(battleContactDistancePixels(leftEdge, rightEdge)).toBe(distance)
    },
  )
  it("anchors visible feet at the origin instead of the transparent canvas edge", () => {
    expect(
      createSpritePresentationGeometry(
        REFERENCE_GEOMETRY,
        REFERENCE_GEOMETRY,
        30,
      ),
    ).toEqual({
      frameHeight: 16,
      frameOffsetX: -6,
      frameOffsetY: -14,
      frameWidth: 16,
      integerScale: 4,
    })
  })

  it("retains reference scale and anchor when a reaction becomes wider or airborne", () => {
    const extendedReaction = {
      ...REFERENCE_GEOMETRY,
      visibleHeight: 10,
      visibleWidth: 15,
      visibleX: 1,
      visibleY: 1,
    }

    expect(
      createSpritePresentationGeometry(
        extendedReaction,
        REFERENCE_GEOMETRY,
        30,
      ),
    ).toEqual(
      createSpritePresentationGeometry(
        REFERENCE_GEOMETRY,
        REFERENCE_GEOMETRY,
        30,
      ),
    )
  })

  it("honors an authored clip anchor override without changing character scale", () => {
    const geometry = createSpritePresentationGeometry(
      { ...REFERENCE_GEOMETRY, bottomCenterX: 7.5, bottomY: 13 },
      REFERENCE_GEOMETRY,
      30,
    )

    expect(geometry.frameOffsetX).toBe(-7.5)
    expect(geometry.frameOffsetY).toBe(-13)
    expect(geometry.integerScale).toBe(4)
  })

  it.each([0, 6, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects a presentation height that cannot provide a finite integer scale: %s",
    (maximumHeight) => {
      expect(() =>
        createSpritePresentationGeometry(
          REFERENCE_GEOMETRY,
          REFERENCE_GEOMETRY,
          maximumHeight,
        ),
      ).toThrow(RangeError)
    },
  )
})
