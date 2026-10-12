import { describe, expect, it } from "vitest"
import { CONTROLLER_CONTROLS } from "@mapachess/match/player-input"
import {
  CONTROLLER_GLYPHS,
  controllerFamily,
  controllerPrompt,
} from "../src/inputPrompts.js"

describe("effective controller prompts", () => {
  it("identifies only supported families and leaves ambiguous identifiers generic", () => {
    for (const [id, expected] of [
      ["Steam Deck", "steam-deck"],
      ["Xbox Wireless Controller", "xbox"],
      ["DualSense Wireless Controller", "playstation5"],
      ["054c-09cc-Wireless Controller", "playstation4"],
      ["Nintendo Switch Pro Controller", "nintendo"],
      ["XInput STANDARD GAMEPAD", "generic"],
      ["Wireless Controller", "generic"],
      ["", "generic"],
    ])
      expect(controllerFamily(id ?? "")).toBe(expected)
  })
  it("covers each physical position with an accessible label and correct face orientation", () => {
    const families = [
      "generic",
      "steam-deck",
      "xbox",
      "playstation4",
      "playstation5",
      "nintendo",
    ] as const
    for (const family of families)
      for (const control of CONTROLLER_CONTROLS) {
        expect(CONTROLLER_GLYPHS[family][control]).toMatch(/\.png$/)
        expect(controllerPrompt(family, control)).toEqual({
          source: expect.stringMatching(/^\/input-prompts\/[a-z0-9_]+\.png$/),
          label: expect.any(String),
        })
      }
    expect(controllerPrompt("steam-deck", "south").source).toContain("button_a")
    expect(controllerPrompt("nintendo", "south").source).toContain("button_b")
    expect(controllerPrompt("generic", "south").source).toContain(
      "buttons_down",
    )
  })
})
