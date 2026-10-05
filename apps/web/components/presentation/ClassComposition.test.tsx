import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import ProfileAction from "../profile/ProfileAction"
import MapachessButton from "./MapachessButton"
import MapachessNotice from "./MapachessNotice"
import MapachessShell from "./MapachessShell"

describe("optional utility class composition", () => {
  it.each([undefined, "", "mt-3 xl:px-0"])(
    "preserves caller classes without empty or missing-value tokens: %s",
    (className) => {
      const classProps = className === undefined ? {} : { className }
      const surfaces = [
        <ProfileAction {...classProps}>Customize</ProfileAction>,
        <MapachessButton {...classProps}>Start match</MapachessButton>,
        <MapachessNotice {...classProps}>Ready</MapachessNotice>,
        <MapachessShell {...classProps}>Game</MapachessShell>,
      ]
      for (const surface of surfaces) {
        const markup = renderToStaticMarkup(surface)
        const classes = markup.match(/class="([^"]*)"/)?.[1]
        expect(classes).toBeDefined()
        expect(classes).not.toMatch(/(?:^|\s)(?:undefined|null|false)(?:\s|$)/)
        expect(classes).toBe(classes?.trim())
        if (className) expect(classes).toMatch(/mt-3 xl:px-0$/)
      }
    },
  )

  it.each([
    ["primary", "bg-mapachito-raspberry"],
    ["secondary", "bg-mapachito-violet"],
    ["destructive", "bg-mapachito-charcoal"],
    ["hint", "bg-mapachito-white"],
  ] as const)("retains the %s button variant", (variant, background) => {
    const markup = renderToStaticMarkup(
      <MapachessButton variant={variant} disabled>
        Undo
      </MapachessButton>,
    )
    expect(markup).toContain(background)
    expect(markup).toContain('disabled=""')
    expect(markup).toContain("disabled:cursor-not-allowed")
    expect(markup).toContain("motion-reduce:enabled:active:translate-none")
  })

  it.each([
    ["information", "inset-shadow-mapachito-blue"],
    ["warning", "inset-shadow-mapachito-deep-gold"],
  ] as const)("retains the %s notice accent", (tone, accent) => {
    expect(
      renderToStaticMarkup(
        <MapachessNotice tone={tone}>Ready</MapachessNotice>,
      ),
    ).toContain(accent)
  })

  it.each(["page", "match"] as const)(
    "retains the %s shell composition",
    (spacing) => {
      const markup = renderToStaticMarkup(
        <MapachessShell as="main" spacing={spacing}>
          Game
        </MapachessShell>,
      )
      expect(markup).toMatch(/^<main /)
      expect(markup.includes("safe-area-inset-top")).toBe(spacing === "match")
      expect(markup.includes("xl:px-5")).toBe(spacing === "match")
      expect(markup).toContain("before:bg-[repeating-linear-gradient")
    },
  )
})
