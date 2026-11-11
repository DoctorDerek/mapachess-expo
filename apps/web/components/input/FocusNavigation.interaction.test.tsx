// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
  activateInput,
  foregroundInputRoot,
  inputControls,
  inputFocusTarget,
  isTextInput,
  moveInputFocus,
} from "../../lib/input/webFocusNavigation"
import { installDomHarness } from "../../test/domHarness"

installDomHarness()

function controls() {
  const clicked = vi.fn()
  const view = render(
    <section aria-label="Navigation fixture">
      <button onClick={clicked}>Top left</button>
      <button>Top right</button>
      <button>Bottom left</button>
      <button>Bottom right</button>
      <button disabled>Disabled</button>
      <div hidden>
        <button>Hidden</button>
      </div>
      <div inert>
        <button>Inert</button>
      </div>
      <div aria-hidden="true">
        <button>Decorative</button>
      </div>
      <details>
        <summary>History</summary>
        <button>Closed history entry</button>
      </details>
      <label htmlFor="radio">Choice label</label>
      <input id="radio" type="radio" className="sr-only" />
      <textarea aria-label="Notes" />
      <input aria-label="Text" />
    </section>,
  )
  const root = screen.getByRole("region")
  for (const [index, name] of [
    "Top left",
    "Top right",
    "Bottom left",
    "Bottom right",
  ].entries()) {
    const button = screen.getByRole("button", { name })
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue(
      new DOMRect((index % 2) * 100, Math.floor(index / 2) * 100, 80, 48),
    )
  }
  return { ...view, root, clicked }
}

describe("controller spatial navigation against rendered controls", () => {
  it("moves through a two-dimensional layout, rejects backwards targets, and does not wrap at an edge", () => {
    const { root } = controls()
    const first = screen.getByRole("button", { name: "Top left" })
    first.focus()
    moveInputFocus(root, "right", null)
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Top right" }),
    )
    moveInputFocus(root, "down", null)
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Bottom right" }),
    )
    moveInputFocus(root, "right", null)
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Bottom right" }),
    )
    moveInputFocus(root, "left", null)
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Bottom left" }),
    )
    moveInputFocus(root, "up", null)
    expect(document.activeElement).toBe(first)
  })

  it("excludes hidden, inert, disabled and collapsed descendants but retains summary and labeled radio input", () => {
    const { root } = controls()
    const available = inputControls(root)
    for (const label of [
      "Disabled",
      "Hidden",
      "Inert",
      "Decorative",
      "Closed history entry",
    ]) {
      const button = screen.getByText(label)
      expect(available).not.toContain(button)
    }
    const radio = screen.getByRole("radio")
    expect(available).toContain(radio)
    expect(inputFocusTarget(radio)).toBe(screen.getByText("Choice label"))
    fireEvent.click(screen.getByText("History"))
    expect(inputControls(root)).toContain(
      screen.getByText("Closed history entry"),
    )
  })

  it("restores the last valid control, selects direction-aware entry, and handles an empty scope", () => {
    const { root } = controls()
    const first = screen.getByRole("button", { name: "Top left" })
    moveInputFocus(root, "down", null)
    expect(document.activeElement).toBe(first)
    first.blur()
    moveInputFocus(root, "right", first)
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Top right" }),
    )
    document.activeElement?.dispatchEvent(new Event("blur"))
    const empty = document.createElement("section")
    expect(activateInput(empty)).toBe(false)
    moveInputFocus(empty, "up", first)
    screen.getByRole("button", { name: "Top right" }).blur()
    moveInputFocus(root, "left", document.createElement("button"))
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Text" }),
    )
  })

  it("activates the focused control rather than clicking on the first navigation press", () => {
    const { root, clicked } = controls()
    expect(activateInput(root)).toBe(true)
    expect(clicked).not.toHaveBeenCalled()
    expect(activateInput(root)).toBe(true)
    expect(clicked).toHaveBeenCalledOnce()
    expect(isTextInput(screen.getByRole("textbox", { name: "Notes" }))).toBe(
      true,
    )
    expect(isTextInput(screen.getByRole("textbox", { name: "Text" }))).toBe(
      true,
    )
    expect(isTextInput(screen.getByRole("radio"))).toBe(false)
    expect(isTextInput(null)).toBe(false)
  })

  it("uses the last visible dialog and its deepest active input layer", () => {
    const view = render(
      <>
        <section aria-modal="true">
          <button>Underlying</button>
        </section>
        <dialog open>
          <div data-player-input-layer>
            <button>First layer</button>
          </div>
          <div data-player-input-layer>
            <button>Top layer</button>
          </div>
        </dialog>
        <dialog open hidden>
          <button>Hidden modal</button>
        </dialog>
      </>,
    )
    expect(foregroundInputRoot()).toBe(
      screen.getByText("Top layer").parentElement,
    )
    view.unmount()
    const modal = render(
      <section aria-modal="true">
        <button>Active modal</button>
      </section>,
    )
    expect(foregroundInputRoot()).toBe(
      screen.getByText("Active modal").parentElement,
    )
    modal.unmount()
    expect(foregroundInputRoot()).toBe(document.body)
  })
})
