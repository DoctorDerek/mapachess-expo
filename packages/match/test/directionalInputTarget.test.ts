import { describe, expect, it } from "vitest"
import directionalInputTarget from "../src/directionalInputTarget.js"

describe("shared directional control navigation", () => {
  const current = { value: "current", x: 50, y: 50 }
  const controls = [
    current,
    { value: "left", x: 0, y: 50 },
    { value: "right", x: 100, y: 50 },
    { value: "up", x: 50, y: 0 },
    { value: "down", x: 50, y: 100 },
    { value: "diagonal", x: 70, y: 51 },
  ]
  it.each(["left", "right", "up", "down"] as const)(
    "selects the same %s candidate for browser/native coordinates",
    (direction) =>
      expect(
        directionalInputTarget(
          current,
          controls.filter((entry) => entry.value !== "diagonal"),
          direction,
        ),
      ).toBe(direction),
  )
  it("retains the existing forward/perpendicular weighting and does not wrap at an edge", () => {
    expect(directionalInputTarget(current, controls, "right")).toBe("diagonal")
    expect(directionalInputTarget(current, [current], "left")).toBeUndefined()
  })
})
