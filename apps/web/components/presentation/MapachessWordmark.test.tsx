import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import MapachessWordmark from "./MapachessWordmark"

describe("MapachessWordmark", () => {
  it("renders the brand once as ordinary readable text", () => {
    const markup = renderToStaticMarkup(createElement(MapachessWordmark))

    expect(markup.replace(/<[^>]*>/g, "")).toBe("Mapachess")
    expect(markup).not.toContain("aria-hidden")
    expect(markup).not.toContain('role="img"')
    expect(markup).not.toContain("<br")
  })
})
