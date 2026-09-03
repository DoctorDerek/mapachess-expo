import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import MapachessWordmark from "./MapachessWordmark"

describe("MapachessWordmark", () => {
  it("exposes one accessible name while hiding decorative lettering", () => {
    const markup = renderToStaticMarkup(createElement(MapachessWordmark))

    expect(markup).toContain('role="img"')
    expect(markup).toContain('aria-label="Mapachess"')
    expect(markup.match(/aria-hidden="true"/g)).toHaveLength(2)
  })
})
