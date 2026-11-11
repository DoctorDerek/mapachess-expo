// @vitest-environment happy-dom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useSelector } from "@xstate/react"
import { describe, expect, it, vi } from "vitest"
import useWebNavigationHistory from "../../lib/gameplay/useWebNavigationHistory"
import {
  selectWebNavigationDestination,
  type WebMatchSessionActor,
} from "../../lib/gameplay/webMatchSessionMachine"
import { installDomHarness } from "../../test/domHarness"
import gamepadHarness from "../../test/gamepadHarness"
import { browsingSession } from "../../test/sessionHarness"

installDomHarness()

function Navigation({ actor }: Readonly<{ actor: WebMatchSessionActor }>) {
  const navigation = useWebNavigationHistory(actor)
  const destination = useSelector(actor, selectWebNavigationDestination)
  return (
    <>
      <output aria-label="Destination">{JSON.stringify(destination)}</output>
      <button
        onClick={() =>
          actor.send({
            type: "MATCH_SESSION.SETUP_REQUESTED",
            setup: {
              variant: "standard",
              mode: "story",
              opponentId: "chicken-stockfish",
            },
          })
        }
      >
        Set up
      </button>
      <button onClick={() => navigation.open("settings")}>Settings</button>
      <button onClick={() => navigation.open("credits")}>Credits</button>
      <button onClick={() => navigation.close("settings")}>
        Close settings
      </button>
      <button onClick={() => navigation.close("profile-card")}>
        Close absent
      </button>
      <button onClick={navigation.back}>Back</button>
    </>
  )
}

describe("browser navigation with the canonical session actor", () => {
  it("restores the opener after Back but does not steal focus if the player has moved to another control", async ({
    onTestFinished,
  }) => {
    const frames = gamepadHarness()
    const actor = browsingSession(onTestFinished)
    const view = render(<Navigation actor={actor} />)
    const opener = screen.getByRole("button", { name: "Settings" })
    opener.focus()
    fireEvent.click(opener)
    fireEvent.click(screen.getByRole("button", { name: "Back" }))
    await waitFor(() =>
      expect(actor.getSnapshot().context.overlays).toEqual([]),
    )
    const other = screen.getByRole("button", { name: "Close absent" })
    other.focus()
    frames.frame()
    expect(document.activeElement).toBe(other)
    opener.focus()
    fireEvent.click(opener)
    fireEvent.click(screen.getByRole("button", { name: "Back" }))
    await waitFor(() =>
      expect(actor.getSnapshot().context.overlays).toEqual([]),
    )
    frames.frame()
    expect(document.activeElement).toBe(opener)
    view.unmount()
    expect(frames.pendingFrames).toBe(0)
  })

  it("falls back to canonical overlay closing when browser state no longer belongs to this scope", ({
    onTestFinished,
  }) => {
    const actor = browsingSession(onTestFinished)
    render(<Navigation actor={actor} />)
    fireEvent.click(screen.getByRole("button", { name: "Settings" }))
    fireEvent.click(screen.getByRole("button", { name: "Credits" }))
    window.history.replaceState("foreign application state", "")
    fireEvent.click(screen.getByRole("button", { name: "Close settings" }))
    expect(actor.getSnapshot().context.overlays).toEqual([])
    expect(actor.getSnapshot().context.session).toBeNull()
  })
  it("restores setup and Home through Back and Forward without opening an engine", async ({
    onTestFinished,
  }) => {
    const actor = browsingSession(onTestFinished)
    render(<Navigation actor={actor} />)
    fireEvent.click(screen.getByText("Set up"))
    expect(actor.getSnapshot().matches({ menu: "setup" })).toBe(true)
    fireEvent.click(screen.getByText("Back"))
    await waitFor(() =>
      expect(actor.getSnapshot().matches({ menu: "choosingMode" })).toBe(true),
    )
    act(() => window.history.forward())
    await waitFor(() =>
      expect(actor.getSnapshot().matches({ menu: "setup" })).toBe(true),
    )
    expect(actor.getSnapshot().context.session).toBeNull()
  })
  it("closes an entire named surface but Back only removes the top overlay", async ({
    onTestFinished,
  }) => {
    const actor = browsingSession(onTestFinished)
    render(<Navigation actor={actor} />)
    fireEvent.click(screen.getByText("Settings"))
    fireEvent.click(screen.getByText("Credits"))
    expect(actor.getSnapshot().context.overlays).toEqual([
      "settings",
      "credits",
    ])
    fireEvent.click(screen.getByText("Back"))
    await waitFor(() =>
      expect(actor.getSnapshot().context.overlays).toEqual(["settings"]),
    )
    fireEvent.click(screen.getByText("Credits"))
    fireEvent.click(screen.getByText("Close settings"))
    await waitFor(() =>
      expect(actor.getSnapshot().context.overlays).toEqual([]),
    )
  })
  it("ignores closing an absent overlay and leaves ordinary root departure available", ({
    onTestFinished,
  }) => {
    const actor = browsingSession(onTestFinished)
    const back = vi.spyOn(window.history, "back")
    render(<Navigation actor={actor} />)
    const state: unknown = window.history.state
    fireEvent.click(screen.getByText("Close absent"))
    fireEvent.click(screen.getByText("Back"))
    expect(window.history.state).toEqual(state)
    expect(back).not.toHaveBeenCalled()
    expect(actor.getSnapshot().matches("menu")).toBe(true)
  })
  it.each([
    null,
    {},
    { mapachessNavigation: null },
    { mapachessNavigation: { scope: "stale", index: -1, destination: {} } },
    { mapachessNavigation: { scope: "stale", index: 2.5, destination: {} } },
    { mapachessNavigation: {} },
    { mapachessNavigation: { scope: 9, index: 1, destination: {} } },
    { mapachessNavigation: { scope: "stale", index: "1", destination: {} } },
    {
      mapachessNavigation: {
        scope: "stale",
        index: Number.NaN,
        destination: {},
      },
    },
    {
      mapachessNavigation: {
        scope: "stale",
        index: Number.MAX_SAFE_INTEGER + 1,
        destination: {},
      },
    },
    { mapachessNavigation: { scope: "stale", index: 1 } },
    { mapachessNavigation: { scope: "stale", index: 1, destination: null } },
  ])(
    "normalizes untrusted history state %# without restoring an invalid screen",
    (state) => {
      const actor = browsingSession(() => undefined)
      const view = render(<Navigation actor={actor} />)
      act(() => window.dispatchEvent(new PopStateEvent("popstate", { state })))
      expect(actor.getSnapshot().matches("menu")).toBe(true)
      expect(actor.getSnapshot().context.overlays).toEqual([])
      view.unmount()
      actor.stop()
    },
  )
  it("adopts an eligible initial history entry and retains unrelated history state", async ({
    onTestFinished,
  }) => {
    window.history.replaceState(
      {
        retained: 1,
        mapachessNavigation: {
          scope: "old",
          index: 3,
          destination: {
            screen: "setup",
            setupKey: "story:standard",
            matchId: null,
            overlays: ["settings"],
          },
        },
      },
      "",
    )
    const actor = browsingSession(onTestFinished)
    render(<Navigation actor={actor} />)
    await waitFor(() =>
      expect(actor.getSnapshot().context.overlays).toEqual(["settings"]),
    )
    expect(actor.getSnapshot().matches({ menu: "setup" })).toBe(true)
    expect(window.history.state.retained).toBe(1)
  })
  it("removes its listener and subscription when unmounted", ({
    onTestFinished,
  }) => {
    const actor = browsingSession(onTestFinished)
    const remove = vi.spyOn(window, "removeEventListener")
    const view = render(<Navigation actor={actor} />)
    fireEvent.click(screen.getByText("Settings"))
    view.unmount()
    const state: unknown = window.history.state
    actor.send({ type: "MATCH_SESSION.OVERLAY_CLOSED", overlay: "settings" })
    expect(window.history.state).toEqual(state)
    expect(remove).toHaveBeenCalledWith("popstate", expect.any(Function))
  })
})
