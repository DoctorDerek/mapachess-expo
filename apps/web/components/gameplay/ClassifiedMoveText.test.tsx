import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { MOVE_GRADE_LABELS, MOVE_GRADES } from "@mapachess/match/move-feedback"
import ClassifiedMoveText from "./ClassifiedMoveText"

describe("shared notation and classification typography", () => {
  it.each(MOVE_GRADES)(
    "renders %s with only a space before the bold full grade",
    (grade) => {
      const markup = renderToStaticMarkup(
        createElement(ClassifiedMoveText, { notation: "12... Nf6", grade }),
      )
      expect(markup).toBe(
        `<span class="font-normal">12... Nf6</span> <strong class="font-bold">${MOVE_GRADE_LABELS[grade]}</strong>`,
      )
    },
  )

  it("preserves notation while classification is still unavailable", () => {
    expect(
      renderToStaticMarkup(
        createElement(ClassifiedMoveText, {
          notation: "35. O-O+",
          grade: null,
        }),
      ),
    ).toBe('<span class="font-normal">35. O-O+</span>')
  })
})
