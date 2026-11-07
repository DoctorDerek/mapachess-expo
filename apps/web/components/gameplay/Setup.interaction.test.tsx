// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import loadCatalog from "@mapachess/localization/catalog"
import { bootApplication, savedProfile } from "../../test/applicationHarness"
import { installDomHarness } from "../../test/domHarness"

installDomHarness()
const copy = loadCatalog("en")

async function setup(
  variant: "standard" | "chess960",
  mode: "story" | "challenge",
) {
  const view = await bootApplication()
  fireEvent.click(
    screen.getByRole("button", {
      name: new RegExp(copy.setup.presentations[variant][mode].title),
    }),
  )
  await screen.findByRole("heading", {
    name: copy.setup.presentations[variant][mode].title,
  })
  return view
}

describe("mode setup, staged choices, and start recovery", () => {
  it.each([
    ["standard", "story"],
    ["chess960", "story"],
    ["standard", "challenge"],
    ["chess960", "challenge"],
  ] as const)(
    "browses %s %s and safely returns Home without creating a match",
    async (variant, mode) => {
      const { indexedDb } = await setup(variant, mode)
      expect(
        screen.getByRole("button", { name: new RegExp(copy.setup.startMatch) }),
      ).toHaveProperty("disabled", false)
      fireEvent.click(screen.getByRole("button", { name: copy.setup.allModes }))
      await screen.findByRole("button", {
        name: new RegExp(copy.setup.presentations.standard.story.title),
      })
      expect((await savedProfile(indexedDb)).activeMatch).toBeNull()
    },
  )
  it("cancels a time-control draft, then accepts Bullet 1+0 without creating another mode", async () => {
    await setup("standard", "story")
    fireEvent.click(
      screen.getByRole("button", { name: copy.gameplay.clock.change }),
    )
    const dialog = within(
      screen.getByRole("dialog", { name: copy.gameplay.clock.timeControl }),
    )
    const bullet = dialog.getByRole("radio", { name: /Bullet.*1\+0/ })
    fireEvent.click(bullet)
    fireEvent.click(dialog.getByRole("button", { name: copy.setup.cancel }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(
      screen.getByText(copy.gameplay.clock.category.untimed, { exact: true }),
    ).toBeTruthy()
    fireEvent.click(
      screen.getByRole("button", { name: copy.gameplay.clock.change }),
    )
    const second = within(
      screen.getByRole("dialog", { name: copy.gameplay.clock.timeControl }),
    )
    fireEvent.click(second.getByRole("radio", { name: /Bullet.*1\+0/ }))
    fireEvent.click(second.getByRole("button", { name: copy.setup.done }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(screen.getByText(/Bullet.*1\+0/)).toBeTruthy()
  })
  it("stages Auto-Hints until Done and persists the approved default", async () => {
    const { indexedDb } = await setup("standard", "story")
    fireEvent.click(
      screen.getByRole("button", { name: copy.setup.changeHints }),
    )
    const dialog = within(
      screen.getByRole("dialog", { name: copy.setup.betterHints }),
    )
    fireEvent.click(
      dialog.getByRole("radio", {
        name: copy.setup.autoHints["no-auto-hints"].label,
      }),
    )
    expect((await savedProfile(indexedDb)).settings.autoHintMode).toBe(
      "auto-move-hints",
    )
    fireEvent.click(dialog.getByRole("button", { name: copy.setup.done }))
    await waitFor(async () =>
      expect((await savedProfile(indexedDb)).settings.autoHintMode).toBe(
        "no-auto-hints",
      ),
    )
  })
  it("accepts a calibrated Challenge difficulty separately from opponent identity", async () => {
    await setup("chess960", "challenge")
    fireEvent.click(
      screen.getByRole("button", { name: copy.setup.changeDifficulty }),
    )
    const dialog = within(
      screen.getByRole("dialog", { name: copy.setup.chooseDifficulty }),
    )
    fireEvent.change(dialog.getByRole("combobox"), { target: { value: "500" } })
    fireEvent.click(dialog.getByRole("radio", { name: /^500/ }))
    fireEvent.click(dialog.getByRole("button", { name: copy.setup.done }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(
      screen.getByText(copy.setup.elo("500"), { exact: true }),
    ).toBeTruthy()
    expect(
      screen.getByText(copy.animals.opponent("chicken-stockfish"), {
        selector: "p",
        exact: true,
      }),
    ).toBeTruthy()
    const position = screen.getByRole("spinbutton", {
      name: copy.setup.positionNumber(959),
    })
    fireEvent.change(position, { target: { value: "518" } })
    expect(position).toHaveProperty("value", "518")
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(copy.setup.randomize) }),
    )
    expect(Number(position.getAttribute("value"))).toBeGreaterThanOrEqual(0)
  })
  it("keeps startup failures recoverable without changing the saved profile", async () => {
    const { indexedDb } = await setup("standard", "story")
    const before = await savedProfile(indexedDb)
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(copy.setup.startMatch) }),
    )
    const retry = await screen.findByRole("button", {
      name: copy.interface.webGame.retry,
    })
    expect((await savedProfile(indexedDb)).activeMatch).toBe(before.activeMatch)
    fireEvent.click(retry)
    await screen.findByRole("button", { name: copy.interface.webGame.retry })
    expect((await savedProfile(indexedDb)).activeMatch).toBeNull()
  })
})
