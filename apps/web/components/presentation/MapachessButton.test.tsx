import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import MapachessButton from "./MapachessButton"

describe("action button feedback", () => {
  it.each([false, true])(
    "retains both labels and exposes only the current label when busy is %s",
    (busy) => {
      const markup = renderToStaticMarkup(
        <MapachessButton aria-busy={busy} busyLabel="Opening match…">
          Start match
        </MapachessButton>,
      )
      expect(markup).toContain('aria-busy="' + String(busy) + '"')
      expect(markup.includes('disabled=""')).toBe(busy)
      expect(markup).toContain(
        `aria-hidden="${String(busy)}" class="col-start-1 row-start-1 ${busy ? "invisible" : ""}">Start match`,
      )
      expect(markup).toContain(
        `aria-hidden="${String(!busy)}" class="col-start-1 row-start-1 ${busy ? "" : "invisible"}">Opening match…`,
      )
    },
  )
})
