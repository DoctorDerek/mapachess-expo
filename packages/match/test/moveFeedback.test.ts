import { describe, expect, it } from "vitest"
import { moveGradeText } from "../src/moveFeedback.js"

describe("move grade presentation copy", () => {
  it.each([
    ["brilliant", "Brilliant !!"],
    ["genius", "Genius !"],
    ["best", "Best ★"],
    ["good", "Good ✓"],
    ["inaccuracy", "Inaccuracy ?!"],
    ["mistake", "Mistake ?"],
    ["blunder", "Blunder ??"],
  ] as const)(
    "formats %s without additional evidence or explanation",
    (grade, label) => {
      expect(moveGradeText("white", grade)).toBe(`White • ${label}`)
      expect(moveGradeText("black", grade)).toBe(`Black • ${label}`)
    },
  )
})
