// @vitest-environment happy-dom
import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { installDomHarness } from "../../test/domHarness"
import MapachessDialog from "./MapachessDialog"

installDomHarness()

describe("match menu interaction", () => {
  it("cycles keyboard focus between the first and last actions", () => {
    render(
      <MapachessDialog
        placement="bottom-to-center"
        label="Match menu"
        onClose={vi.fn()}
      >
        <button>Settings</button>
        <button>Back to Board</button>
      </MapachessDialog>,
    )
    const first = screen.getByRole("button", { name: "Settings" })
    const last = screen.getByRole("button", { name: "Back to Board" })
    first.focus()
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true })
    expect(document.activeElement).toBe(last)
    fireEvent.keyDown(last, { key: "Tab" })
    expect(document.activeElement).toBe(first)
  })

  it("dismisses only a completed primary press on the backdrop", () => {
    const dismiss = vi.fn()
    render(
      <MapachessDialog
        placement="bottom-to-center"
        label="Match menu"
        onClose={vi.fn()}
        onBackdrop={dismiss}
      >
        <button>Settings</button>
      </MapachessDialog>,
    )
    const panel = screen.getByRole("dialog")
    vi.spyOn(panel, "getBoundingClientRect").mockReturnValue(
      new DOMRect(20, 20, 100, 100),
    )
    const outside = { button: 0, isPrimary: true, clientX: 10, clientY: 10 }
    const inside = { ...outside, clientX: 30, clientY: 30 }
    fireEvent.pointerDown(panel, inside)
    fireEvent.click(panel, outside)
    fireEvent.pointerDown(panel, outside)
    fireEvent.click(panel, inside)
    fireEvent.pointerDown(panel, outside)
    fireEvent.pointerCancel(panel)
    fireEvent.click(panel, outside)
    expect(dismiss).not.toHaveBeenCalled()
    fireEvent.pointerDown(panel, outside)
    fireEvent.click(panel, outside)
    expect(dismiss).toHaveBeenCalledOnce()
  })

  it("guards moving action buttons while keeping Back to Board reachable", () => {
    const settings = vi.fn(),
      resume = vi.fn()
    render(
      <MapachessDialog
        animateSheet
        placement="bottom-to-center"
        label="Match menu"
        onClose={vi.fn()}
      >
        <button onClick={settings}>Settings</button>
        <button data-back-to-board onClick={resume}>
          Back to Board
        </button>
      </MapachessDialog>,
    )
    const panel = screen.getByRole("dialog")
    const moving = { transitionProperty: "transform", playState: "running" }
    Object.defineProperty(panel, "getAnimations", { value: () => [moving] })
    const button = screen.getByRole("button", { name: "Settings" })
    fireEvent.pointerDown(button)
    moving.playState = "finished"
    fireEvent.click(button, { detail: 1 })
    expect(settings).not.toHaveBeenCalled()
    moving.playState = "running"
    const back = screen.getByRole("button", { name: "Back to Board" })
    fireEvent.pointerDown(back)
    fireEvent.click(back, { detail: 1 })
    expect(resume).toHaveBeenCalledOnce()
    moving.playState = "finished"
    fireEvent.pointerDown(button)
    fireEvent.click(button, { detail: 1 })
    expect(settings).toHaveBeenCalledOnce()
  })

  it("completes the active exit and ignores an abandoned exit after reopening", async () => {
    const onExitComplete = vi.fn(),
      onClose = vi.fn()
    const sheet = (leaving: boolean) => (
      <MapachessDialog
        animateSheet
        leaving={leaving}
        label="Match menu"
        onClose={onClose}
        onExitComplete={onExitComplete}
      >
        Match details
      </MapachessDialog>
    )
    const view = render(sheet(false))
    let end = Promise.withResolvers<void>()
    Object.defineProperty(screen.getByRole("dialog"), "getAnimations", {
      value: () => [{ transitionProperty: "transform", finished: end.promise }],
    })
    view.rerender(sheet(true))
    expect(onExitComplete).not.toHaveBeenCalled()
    view.rerender(sheet(false))
    await act(async () => {
      end.resolve()
      await end.promise
    })
    expect(onExitComplete).not.toHaveBeenCalled()
    end = Promise.withResolvers<void>()
    view.rerender(sheet(true))
    await act(async () => {
      end.resolve()
      await end.promise
    })
    expect(onExitComplete).toHaveBeenCalledOnce()
  })
})
